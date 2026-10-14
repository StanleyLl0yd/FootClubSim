import {
  exportInitialCareer, importInitialCareer, type InitialCareerSave,
} from '../core/save.js';
import { isStableId } from '../core/identifiers.js';

export type CareerStorageErrorCode =
  'UNAVAILABLE' | 'OPEN_FAILED' | 'BLOCKED' | 'DUPLICATE' |
  'NOT_FOUND' | 'CORRUPTED' | 'STORAGE_FAILED' | 'QUOTA_EXCEEDED' | 'INVALID_ID';

export class CareerStorageError extends Error {
  constructor(public readonly code: CareerStorageErrorCode) {
    super(code);
    this.name = 'CareerStorageError';
  }
}

const DATABASE = 'footclubsim-m0';
const STORE = 'initial-careers';

/** Opens only an M0 prototype store; never upgrades or modifies future career formats. */
function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new CareerStorageError('UNAVAILABLE'));
  }
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); }
    catch { reject(new CareerStorageError('UNAVAILABLE')); return; }
    let settled = false;
    function failure(code: CareerStorageErrorCode): void {
      if (settled) return;
      settled = true;
      reject(new CareerStorageError(code));
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => failure(request.error?.name === 'QuotaExceededError' ?
      'QUOTA_EXCEEDED' : 'OPEN_FAILED');
    request.onblocked = () => failure('BLOCKED');
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
  });
}

/**
 * Add-only write: duplicate career IDs never overwrite an existing career.
 * Resolve only on transaction completion, not on the request's success event.
 */
export async function saveNewInitialCareer(snapshot: InitialCareerSave): Promise<void> {
  if (!isStableId(snapshot.careerId)) throw new CareerStorageError('INVALID_ID');
  const encoded = await exportInitialCareer(snapshot);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = db.transaction(STORE, 'readwrite'); }
      catch { reject(new CareerStorageError('STORAGE_FAILED')); return; }
      let requestError: CareerStorageErrorCode = 'STORAGE_FAILED';
      let request: IDBRequest<IDBValidKey>;
      try { request = transaction.objectStore(STORE).add(encoded, snapshot.careerId); }
      catch { reject(new CareerStorageError('STORAGE_FAILED')); return; }
      request.onerror = () => {
        if (request.error?.name === 'ConstraintError') requestError = 'DUPLICATE';
        else if (request.error?.name === 'QuotaExceededError') requestError = 'QUOTA_EXCEEDED';
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new CareerStorageError(
        requestError === 'STORAGE_FAILED' && transaction.error?.name === 'QuotaExceededError' ?
          'QUOTA_EXCEEDED' : requestError,
      ));
      transaction.onerror = () => { /* Wait for abort so that no partial write is reported. */ };
    });
  } finally {
    db.close();
  }
}

/** Read and validate a copy. No missing/corrupt entry is silently initialized or replaced. */
export async function loadInitialCareer(careerId: string): Promise<InitialCareerSave> {
  if (!isStableId(careerId)) throw new CareerStorageError('INVALID_ID');
  const db = await openDatabase();
  let encoded: unknown;
  try {
    encoded = await new Promise<unknown>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = db.transaction(STORE, 'readonly'); }
      catch { reject(new CareerStorageError('STORAGE_FAILED')); return; }
      let request: IDBRequest<unknown>;
      try { request = transaction.objectStore(STORE).get(careerId); }
      catch { reject(new CareerStorageError('STORAGE_FAILED')); return; }
      let value: unknown;
      request.onsuccess = () => { value = request.result as unknown; };
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () => reject(new CareerStorageError('STORAGE_FAILED'));
      transaction.onerror = () => { /* Abort determines final transaction outcome. */ };
    });
  } finally {
    db.close();
  }
  if (encoded === undefined) throw new CareerStorageError('NOT_FOUND');
  if (typeof encoded !== 'string') throw new CareerStorageError('CORRUPTED');
  const result = await importInitialCareer(encoded);
  if (!result.ok) throw new CareerStorageError('CORRUPTED');
  if (result.value.careerId !== careerId) throw new CareerStorageError('CORRUPTED');
  return result.value;
}
