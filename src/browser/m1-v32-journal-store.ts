import { sameCanonicalValue } from '../core/canonical-value.js';
import { isStableId } from '../core/identifiers.js';
import {
  applyM1V32ExposureBatch, startM1V32ExposureJournal,
  validateM1V32ExposureJournal, type M1V32JournalError, type M1V32Journal,
} from '../core/m1-v32-causal-medical-journal.js';
import { loadInitialCareer } from './initial-career-store.js';

/**
 * An isolated v32 schema-6 browser persistence prototype. The immutable M0 initial career
 * is read from its existing add-only store, never upgraded or rewritten here.
 * Atomicity is provided by ONE IndexedDB readwrite transaction per CAS.
 * Domain validation replays every accepted v29/v31 source entry synchronously,
 * but OUTSIDE IndexedDB transactions. Readwrite CAS rechecks the exact
 * validated snapshot before put, preserving concurrent-writer correctness.
 * Source replay may still block the browser main thread.
 * This is local crash/concurrency safety, NOT authenticated referee authority.
 */
const DATABASE = 'footclubsim-m1-v32';
const STORE = 'result-journals';
export type M1V32PersistenceCode =
  'UNAVAILABLE' | 'OPEN_FAILED' | 'BLOCKED' | 'STORAGE_FAILED' |
  'QUOTA_EXCEEDED' | 'INVALID_ID' | 'ALREADY_EXISTS' | 'NOT_FOUND' |
  'CORRUPTED' | 'STALE_REVISION' | 'DOMAIN_REJECTED';
export class M1V32PersistenceError extends Error {
  constructor(
    public readonly code: M1V32PersistenceCode,
    public readonly domainError?: M1V32JournalError,
  ) {
    super(domainError ? code + ': ' + domainError : code);
    this.name = 'M1V32PersistenceError';
  }
}
const fail = (code: M1V32PersistenceCode, domainError?: M1V32JournalError) =>
  new M1V32PersistenceError(code, domainError);
const isQuota = (error: DOMException | null): boolean =>
  error?.name === 'QuotaExceededError';
const validId = (id: unknown): id is string => isStableId(id);

async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw fail('UNAVAILABLE');
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); }
    catch { reject(fail('UNAVAILABLE')); return; }
    let settled = false;
    const rejectOnce = (code: M1V32PersistenceCode) => {
      if (settled) return;
      settled = true;
      reject(fail(code));
    };
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onerror = () => rejectOnce(isQuota(request.error) ?
      'QUOTA_EXCEEDED' : 'OPEN_FAILED');
    request.onblocked = () => rejectOnce('BLOCKED');
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      resolve(request.result);
    };
  });
}

/** No promises/await inside an active transaction: they can auto-commit it. */
async function transact<T>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore, abort: (error: M1V32PersistenceError) => void,
    setResult: (value: T) => void, setRequestError: (error: M1V32PersistenceError) => void,
  ) => void,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(STORE, mode); }
      catch { reject(fail('STORAGE_FAILED')); return; }
      let result: T | undefined;
      let failure: M1V32PersistenceError | null = null;
      const abort = (error: M1V32PersistenceError) => {
        failure = error;
        try { tx.abort(); }
        catch { reject(error); }
      };
      tx.oncomplete = () => {
        if (failure || result === undefined) reject(failure ?? fail('STORAGE_FAILED'));
        else resolve(result);
      };
      tx.onabort = () => reject(failure ?? fail(isQuota(tx.error) ?
        'QUOTA_EXCEEDED' : 'STORAGE_FAILED'));
      tx.onerror = () => { /* Wait for the authoritative abort/commit event. */ };
      try {
        operation(tx.objectStore(STORE), abort,
          value => { result = value; }, error => { failure = error; });
      } catch {
        abort(fail('STORAGE_FAILED'));
      }
    });
  } finally {
    db.close();
  }
}

function verified(raw: unknown, initial: unknown): M1V32Journal {
  const outcome = validateM1V32ExposureJournal(initial, raw);
  if (!outcome.ok) throw fail('CORRUPTED');
  return outcome.journal;
}

/**
 * Fetch one consistent structured-clone snapshot. Do not run expensive
 * source replay from an IDB callback: a readonly transaction must finish
 * before the caller validates and/or computes a proposed update.
 */
async function readRawJournal(careerId: string): Promise<unknown> {
  return transact<unknown>('readonly', (store, abort, setResult, setRequestError) => {
    const request = store.get(careerId);
    request.onsuccess = () => {
      if (request.result === undefined) { abort(fail('NOT_FOUND')); return; }
      setResult(request.result as unknown);
    };
    request.onerror = () => setRequestError(fail(isQuota(request.error) ?
      'QUOTA_EXCEEDED' : 'STORAGE_FAILED'));
  });
}

/** Missing or damaged journals are NEVER created or silently replaced on read. */
export async function loadM1V32PersistedJournal(careerId: string):
  Promise<M1V32Journal> {
  if (!validId(careerId)) throw fail('INVALID_ID');
  const initial = await loadInitialCareer(careerId);
  const raw = await readRawJournal(careerId);
  return verified(raw, initial);
}

/** Add-only initialization. Never overwrites an existing M1 journal. */
export async function createM1V32PersistedJournal(careerId: string):
  Promise<M1V32Journal> {
  if (!validId(careerId)) throw fail('INVALID_ID');
  const initial = await loadInitialCareer(careerId);
  const fresh = startM1V32ExposureJournal(initial);
  if (!fresh.ok) throw fail('CORRUPTED');
  return transact('readwrite', (store, _abort, setResult, setRequestError) => {
    const request = store.add(fresh.journal, careerId);
    request.onerror = () => setRequestError(fail(
      request.error?.name === 'ConstraintError' ? 'ALREADY_EXISTS' :
        isQuota(request.error) ? 'QUOTA_EXCEEDED' : 'STORAGE_FAILED',
    ));
    setResult(fresh.journal);
  });
}

/**
 * Restore only to a MISSING schema-6 key for an ALREADY PRESENT immutable
 * M0 initial career. Never overwrite even a corrupt journal. Verify the
 * complete source against the local initial career before opening a write
 * transaction; the add-only IDB operation is atomic under competing writers.
 */
export async function restoreM1V32PersistedJournal(
  careerId:string,candidate:unknown,
):Promise<M1V32Journal> {
  if(!validId(careerId))throw fail('INVALID_ID');
  const initial=await loadInitialCareer(careerId);
  const journal=verified(candidate,initial);
  if(journal.careerId!==careerId)throw fail('CORRUPTED');
  return transact('readwrite',(store,_abort,setResult,setRequestError)=>{
    const request=store.add(journal,careerId);
    request.onerror=()=>setRequestError(fail(
      request.error?.name==='ConstraintError'?'ALREADY_EXISTS':
        isQuota(request.error)?'QUOTA_EXCEEDED':'STORAGE_FAILED'));
    setResult(journal);
  });
}

/**
 * Optimistic read/validate/propose, followed by atomic version+content CAS.
 * Full source replay executes OUTSIDE the readwrite transaction. The exact
 * original source-replayed snapshot is compared against the current IDB
 * value INSIDE the write lock; two writers cannot both win. A changed
 * same-revision payload fails closed rather than being silently overwritten.
 * No promises/await are used in the active IDB readwrite callback.
 */
export async function commitM1V32PersistedBatch(
  careerId: string, expectedRevision: number, requests: unknown,
): Promise<M1V32Journal> {
  if (!validId(careerId)) throw fail('INVALID_ID');
  if (!Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 || expectedRevision > 240) {
    throw fail('DOMAIN_REJECTED', 'INVALID_APPLY_COMMAND');
  }
  const initial = await loadInitialCareer(careerId);
  const baseline = await readRawJournal(careerId);
  const proposed = applyM1V32ExposureBatch(
    initial, baseline, requests, expectedRevision);
  if (!proposed.ok) {
    if (proposed.error === 'INVALID_JOURNAL' ||
        proposed.error === 'INVALID_INITIAL_CAREER') {
      throw fail('CORRUPTED');
    }
    if (proposed.error === 'CAS_REVISION_MISMATCH') {
      throw fail('STALE_REVISION');
    }
    throw fail('DOMAIN_REJECTED', proposed.error);
  }
  return transact('readwrite', (store, abort, setResult, setRequestError) => {
    const read = store.get(careerId);
    read.onerror = () => setRequestError(fail(isQuota(read.error) ?
      'QUOTA_EXCEEDED' : 'STORAGE_FAILED'));
    read.onsuccess = () => {
      if (read.result === undefined) { abort(fail('NOT_FOUND')); return; }
      // Complete equality detects a same-revision replacement or tampering.
      // Checking the revision alone would permit a forged ABA-style overwrite.
      if (!sameCanonicalValue(read.result, baseline)) {
        const changed: unknown = read.result;
        const revision = changed !== null && typeof changed === 'object' &&
          !Array.isArray(changed) && Object.hasOwn(changed, 'revision') ?
          (changed as Record<string, unknown>).revision : null;
        abort(fail(Number.isSafeInteger(revision) &&
          revision !== expectedRevision ? 'STALE_REVISION' : 'CORRUPTED'));
        return;
      }
      const put = store.put(proposed.journal, careerId);
      put.onerror = () => setRequestError(fail(isQuota(put.error) ?
        'QUOTA_EXCEEDED' : 'STORAGE_FAILED'));
      setResult(proposed.journal);
    };
  });
}
