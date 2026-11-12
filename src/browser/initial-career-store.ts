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
const quota = (e:unknown):boolean =>
  typeof e==='object'&&e!==null&&'name' in e&&
  e.name==='QuotaExceededError';
const storageFailure = (e:unknown):CareerStorageError =>
  new CareerStorageError(quota(e)?'QUOTA_EXCEEDED':'STORAGE_FAILED');

/** Opens only an M0 prototype store; never upgrades or modifies future career formats. */
function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new CareerStorageError('UNAVAILABLE'));
  }
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); }
    catch (error) { reject(new CareerStorageError(quota(error)?
      'QUOTA_EXCEEDED':'UNAVAILABLE')); return; }
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
  const careerId = snapshot.careerId;
  if (!isStableId(careerId)) throw new CareerStorageError('INVALID_ID');
  const encoded = await exportInitialCareer(snapshot);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = db.transaction(STORE, 'readwrite'); }
      catch (error) { reject(storageFailure(error)); return; }
      let requestError: CareerStorageErrorCode = 'STORAGE_FAILED';
      let request: IDBRequest<IDBValidKey>;
      try { request = transaction.objectStore(STORE).add(encoded, careerId); }
      catch (error) { reject(storageFailure(error)); return; }
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
      catch (error) { reject(storageFailure(error)); return; }
      let request: IDBRequest<unknown>;
      try { request = transaction.objectStore(STORE).get(careerId); }
      catch (error) { reject(storageFailure(error)); return; }
      let value: unknown;
      request.onsuccess = () => { value = request.result as unknown; };
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () => reject(storageFailure(transaction.error));
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

/** Bounded, read-only discovery for multiple independent browser careers.
 * Never infers a valid save from a key: loadInitialCareer verifies each choice.
 */
export async function listStoredInitialCareerIds():Promise<readonly string[]>{
  const db=await openDatabase();
  try{
    return await new Promise<readonly string[]>((resolve,reject)=>{
      let transaction:IDBTransaction;
      try{transaction=db.transaction(STORE,'readonly');}
      catch(error){reject(storageFailure(error));return;}
      let keyRequest:IDBRequest<IDBValidKey[]>;
      let countRequest:IDBRequest<number>;
      try{
        const store=transaction.objectStore(STORE);
        keyRequest=store.getAllKeys(undefined,65);
        countRequest=store.count();
      }catch(error){reject(storageFailure(error));return;}
      let keys:IDBValidKey[]|null=null,count=0;
      keyRequest.onsuccess=()=>{keys=keyRequest.result;};
      countRequest.onsuccess=()=>{count=countRequest.result;};
      transaction.oncomplete=()=>{
        if(!keys||count>64||keys.length!==count){
          reject(new CareerStorageError('STORAGE_FAILED'));return;
        }
        if(!keys.every(isStableId)){
          reject(new CareerStorageError('CORRUPTED'));return;
        }
        resolve(keys as string[]);
      };
      transaction.onabort=()=>reject(storageFailure(transaction.error));
      transaction.onerror=()=>{};
    });
  }finally{db.close();}
}
