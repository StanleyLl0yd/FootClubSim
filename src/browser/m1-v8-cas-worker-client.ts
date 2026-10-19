import { isStableId } from '../core/identifiers.js';
import type { M1V8JournalError } from '../core/m1-v8-result-journal.js';
import type { M1V8PersistenceCode } from './m1-v8-journal-store.js';
import { M1_V8_CAS_WORKER_PROTOCOL_VERSION,
  readM1V8WorkerCommitRequest, type M1V8WorkerCommitRequest }
  from './m1-v8-cas-worker-protocol.js';

/**
 * A confirmed CAS acknowledgement is not a licence to trust unvalidated
 * sporting evidence, nor a guarantee against later browser storage eviction.
 */
export interface M1V8WorkerCommitReceipt {
  readonly careerId: string;
  readonly jobId: string;
  readonly journalRevision: number;
}
export type M1V8WorkerCommitFailureCode =
  | 'INVALID_REQUEST' | 'WORKER_UNAVAILABLE' | 'COMMIT_OUTCOME_UNKNOWN'
  | M1V8PersistenceCode;
export class M1V8WorkerCommitError extends Error {
  constructor(
    public readonly code: M1V8WorkerCommitFailureCode,
    public readonly domainError?: M1V8JournalError,
  ) {
    super(domainError ? code + ': ' + domainError : code);
    this.name = 'M1V8WorkerCommitError';
  }
}

const definitiveCodes = new Set<M1V8PersistenceCode>([
  'UNAVAILABLE', 'OPEN_FAILED', 'BLOCKED', 'STORAGE_FAILED',
  'QUOTA_EXCEEDED', 'INVALID_ID', 'ALREADY_EXISTS', 'NOT_FOUND',
  'CORRUPTED', 'STALE_REVISION', 'DOMAIN_REJECTED',
]);
const journalKeys = [
  'schemaVersion', 'careerId', 'controlledClubId', 'basePackId',
  'basePackVersion', 'revision', 'results',
] as const;
const ownValue = (value: object, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ?
    descriptor.value : undefined;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const exact = (value: object, keys: readonly string[]): boolean =>
  Reflect.ownKeys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));

type CommitReply =
  | Readonly<{ kind: 'committed'; receipt: M1V8WorkerCommitReceipt }>
  | Readonly<{ kind: 'failed'; code: M1V8PersistenceCode;
    domainError?: M1V8JournalError }>;

/**
 * Parse only the acknowledgement metadata, not the potentially multi-MB
 * journal clone on the UI thread. The journal must be read and replayed
 * independently before its content is treated as authoritative.
 */
export function readM1V8WorkerCommitReply(
  raw: unknown, request: M1V8WorkerCommitRequest,
): CommitReply | null {
  if (!record(raw) ||
      ownValue(raw, 'schemaVersion') !== M1_V8_CAS_WORKER_PROTOCOL_VERSION ||
      ownValue(raw, 'jobId') !== request.jobId ||
      ownValue(raw, 'careerId') !== request.careerId) return null;
  if (ownValue(raw, 'kind') === 'committed') {
    if (!exact(raw, ['schemaVersion', 'kind', 'jobId', 'careerId', 'journal'])) {
      return null;
    }
    const journal = ownValue(raw, 'journal');
    if (!record(journal) || !exact(journal, journalKeys)) return null;
    const revision = request.expectedRevision + request.requests.length;
    const results = ownValue(journal, 'results');
    if (!Number.isSafeInteger(revision) || revision > 240 ||
        ownValue(journal, 'schemaVersion') !== 4 ||
        ownValue(journal, 'careerId') !== request.careerId ||
        ownValue(journal, 'revision') !== revision ||
        !Array.isArray(results) || results.length !== revision) return null;
    return { kind: 'committed', receipt: {
      jobId: request.jobId, careerId: request.careerId,
      journalRevision: revision,
    } };
  }
  if (ownValue(raw, 'kind') !== 'failed' ||
      !(exact(raw, ['schemaVersion', 'kind', 'jobId', 'careerId', 'code']) ||
        exact(raw, ['schemaVersion', 'kind', 'jobId', 'careerId', 'code', 'domainError']))) {
    return null;
  }
  const code = ownValue(raw, 'code');
  if (typeof code !== 'string' || !definitiveCodes.has(code as M1V8PersistenceCode)) {
    // An unexpected worker crash is not proof that a commit was rolled back.
    return null;
  }
  const domainError = ownValue(raw, 'domainError');
  if (domainError !== undefined &&
      (code !== 'DOMAIN_REJECTED' || typeof domainError !== 'string' ||
       !isStableId(domainError))) return null;
  return { kind: 'failed', code: code as M1V8PersistenceCode,
    ...(domainError === undefined ? {} :
      { domainError: domainError as M1V8JournalError }) };
}

export type M1V8WorkerTransport = Pick<Worker,
  'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

/**
 * A lost reply (timeout, worker crash, malformed/mismatched response) has an
 * indeterminate commit outcome. Do NOT automatically replay the command.
 * Instead inspect the persisted v8 journal before deciding on recovery.
 */
export function runM1V8WorkerCommit(
  worker: M1V8WorkerTransport, raw: unknown, timeoutMs = 60_000,
): Promise<M1V8WorkerCommitReceipt> {
  const admitted = readM1V8WorkerCommitRequest(raw);
  if (!admitted.ok || !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 || timeoutMs > 180_000) {
    try { worker.terminate(); } catch { /* Worker was not started. */ }
    return Promise.reject(new M1V8WorkerCommitError('INVALID_REQUEST'));
  }
  const request = admitted.request;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = (error: M1V8WorkerCommitError | null,
      receipt?: M1V8WorkerCommitReceipt) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      try { worker.terminate(); } catch { /* Outcome is already classified. */ }
      if (error) reject(error);
      else if (receipt) resolve(receipt);
      else reject(new M1V8WorkerCommitError('COMMIT_OUTCOME_UNKNOWN'));
    };
    worker.onmessage = event => {
      // Dedicated Workers normally use an empty MessageEvent origin.
      if (event.origin !== '' && event.origin !== location.origin) {
        finish(new M1V8WorkerCommitError('COMMIT_OUTCOME_UNKNOWN'));
        return;
      }
      const reply = readM1V8WorkerCommitReply(event.data, request);
      if (!reply) {
        finish(new M1V8WorkerCommitError('COMMIT_OUTCOME_UNKNOWN'));
      } else if (reply.kind === 'committed') {
        finish(null, reply.receipt);
      } else {
        finish(new M1V8WorkerCommitError(reply.code, reply.domainError));
      }
    };
    worker.onerror = () => finish(
      new M1V8WorkerCommitError('COMMIT_OUTCOME_UNKNOWN'));
    worker.onmessageerror = () => finish(
      new M1V8WorkerCommitError('COMMIT_OUTCOME_UNKNOWN'));
    timeout = setTimeout(() => finish(
      new M1V8WorkerCommitError('COMMIT_OUTCOME_UNKNOWN')), timeoutMs);
    try {
      worker.postMessage(request);
    } catch {
      finish(new M1V8WorkerCommitError('COMMIT_OUTCOME_UNKNOWN'));
    }
  });
}

export function commitM1V8ViaDedicatedWorker(
  raw: unknown, timeoutMs = 60_000,
): Promise<M1V8WorkerCommitReceipt> {
  const admitted = readM1V8WorkerCommitRequest(raw);
  if (!admitted.ok) {
    return Promise.reject(new M1V8WorkerCommitError('INVALID_REQUEST'));
  }
  let worker: Worker;
  try {
    worker = new Worker(new URL('./m1-v8-cas-worker.js', import.meta.url),
      { type: 'module' });
  } catch {
    return Promise.reject(new M1V8WorkerCommitError('WORKER_UNAVAILABLE'));
  }
  return runM1V8WorkerCommit(worker, admitted.request, timeoutMs);
}
