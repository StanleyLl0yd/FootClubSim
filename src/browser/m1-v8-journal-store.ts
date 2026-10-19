import { isStableId } from '../core/identifiers.js';
import {
  applyM1V8MatchResultBatchAtRevision, startM1V8MatchJournal,
  validateM1V8MatchJournal, type M1V8JournalError, type M1V8MatchJournal,
} from '../core/m1-v8-result-journal.js';
import { loadInitialCareer } from './initial-career-store.js';

/**
 * An isolated v8-only browser persistence prototype. The immutable M0 initial career
 * is read from its existing add-only store, never upgraded or rewritten here.
 * Atomicity is provided by ONE IndexedDB readwrite transaction per CAS.
 * Domain validation replays every accepted v8 source entry synchronously.
 * This is correctness-first and may block the browser main thread.
 * This is local crash/concurrency safety, NOT authenticated referee authority.
 */
const DATABASE = 'footclubsim-m1-v8';
const STORE = 'result-journals';
export type M1V8PersistenceCode =
  'UNAVAILABLE' | 'OPEN_FAILED' | 'BLOCKED' | 'STORAGE_FAILED' |
  'QUOTA_EXCEEDED' | 'INVALID_ID' | 'ALREADY_EXISTS' | 'NOT_FOUND' |
  'CORRUPTED' | 'STALE_REVISION' | 'DOMAIN_REJECTED';
export class M1V8PersistenceError extends Error {
  constructor(
    public readonly code: M1V8PersistenceCode,
    public readonly domainError?: M1V8JournalError,
  ) {
    super(domainError ? code + ': ' + domainError : code);
    this.name = 'M1V8PersistenceError';
  }
}
const fail = (code: M1V8PersistenceCode, domainError?: M1V8JournalError) =>
  new M1V8PersistenceError(code, domainError);
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
    const rejectOnce = (code: M1V8PersistenceCode) => {
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
    store: IDBObjectStore, abort: (error: M1V8PersistenceError) => void,
    setResult: (value: T) => void, setRequestError: (error: M1V8PersistenceError) => void,
  ) => void,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(STORE, mode); }
      catch { reject(fail('STORAGE_FAILED')); return; }
      let result: T | undefined;
      let failure: M1V8PersistenceError | null = null;
      const abort = (error: M1V8PersistenceError) => {
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

function verified(raw: unknown, initial: unknown): M1V8MatchJournal {
  const outcome = validateM1V8MatchJournal(initial, raw);
  if (!outcome.ok) throw fail('CORRUPTED');
  return outcome.journal;
}

/** Missing or damaged journals are NEVER created or silently replaced on read. */
export async function loadM1V8PersistedJournal(careerId: string):
  Promise<M1V8MatchJournal> {
  if (!validId(careerId)) throw fail('INVALID_ID');
  const initial = await loadInitialCareer(careerId);
  return transact('readonly', (store, abort, setResult, setRequestError) => {
    const request = store.get(careerId);
    request.onsuccess = () => {
      if (request.result === undefined) { abort(fail('NOT_FOUND')); return; }
      try { setResult(verified(request.result, initial)); }
      catch { abort(fail('CORRUPTED')); }
    };
    request.onerror = () => setRequestError(fail(isQuota(request.error) ?
      'QUOTA_EXCEEDED' : 'STORAGE_FAILED'));
  });
}

/** Add-only initialization. Never overwrites an existing M1 journal. */
export async function createM1V8PersistedJournal(careerId: string):
  Promise<M1V8MatchJournal> {
  if (!validId(careerId)) throw fail('INVALID_ID');
  const initial = await loadInitialCareer(careerId);
  const fresh = startM1V8MatchJournal(initial);
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
 * A true read-modify-write CAS within a single IDB readwrite transaction.
 * The source career is loaded before opening that transaction. The stored
 * journal is source-replayed once before the revision check and domain batch.
 * Independent
 * tabs targeting the same object store serialize under IDB transaction locks.
 * The final batch is written once; a failed proposal aborts without any put.
 */
export async function commitM1V8PersistedBatch(
  careerId: string, expectedRevision: number, requests: unknown,
): Promise<M1V8MatchJournal> {
  if (!validId(careerId)) throw fail('INVALID_ID');
  if (!Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 || expectedRevision > 240) {
    throw fail('DOMAIN_REJECTED', 'INVALID_APPLY_COMMAND');
  }
  const initial = await loadInitialCareer(careerId);
  return transact('readwrite', (store, abort, setResult, setRequestError) => {
    const read = store.get(careerId);
    read.onerror = () => setRequestError(fail(isQuota(read.error) ?
      'QUOTA_EXCEEDED' : 'STORAGE_FAILED'));
    read.onsuccess = () => {
      if (read.result === undefined) { abort(fail('NOT_FOUND')); return; }
      const proposed = applyM1V8MatchResultBatchAtRevision(
        initial, read.result, expectedRevision, requests);
      if (!proposed.ok) {
        if (proposed.error === 'INVALID_JOURNAL' ||
            proposed.error === 'INVALID_INITIAL_CAREER') {
          abort(fail('CORRUPTED'));
        } else if (proposed.error === 'STALE_REVISION') {
          abort(fail('STALE_REVISION'));
        } else {
          abort(fail('DOMAIN_REJECTED', proposed.error));
        }
        return;
      }
      const put = store.put(proposed.journal, careerId);
      put.onerror = () => setRequestError(fail(isQuota(put.error) ?
        'QUOTA_EXCEEDED' : 'STORAGE_FAILED'));
      setResult(proposed.journal);
    };
  });
}
