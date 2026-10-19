import { commitM1V8PersistedBatch, M1V8PersistenceError }
  from './m1-v8-journal-store.js';
import { M1_V8_CAS_WORKER_PROTOCOL_VERSION,
  readM1V8WorkerCommitRequest }
  from './m1-v8-cas-worker-protocol.js';

/**
 * Isolated v8 research worker: the complete IndexedDB readwrite CAS,
 * including trusted-source replay, runs in this worker. The database,
 * transaction scope and persisted schema remain exactly the same.
 * No standalone permission to authenticate sporting decisions is implied.
 */
const worker = self as unknown as {
  postMessage: (data: unknown) => void;
  addEventListener: (
    type: 'message', listener: (event: MessageEvent<unknown>) => void
  ) => void;
};

worker.addEventListener('message', event => {
  const parsed = readM1V8WorkerCommitRequest(event.data);
  if (!parsed.ok) {
    worker.postMessage({
      schemaVersion: M1_V8_CAS_WORKER_PROTOCOL_VERSION,
      kind: 'failed', jobId: null, careerId: null,
      code: 'INVALID_REQUEST',
    });
    return;
  }
  const { jobId, careerId, expectedRevision, requests } = parsed.request;
  void commitM1V8PersistedBatch(careerId, expectedRevision, requests)
    .then(journal => {
      worker.postMessage({
        schemaVersion: M1_V8_CAS_WORKER_PROTOCOL_VERSION,
        kind: 'committed', jobId, careerId, journal,
      });
    })
    .catch((error: unknown) => {
      const known = error instanceof M1V8PersistenceError;
      worker.postMessage({
        schemaVersion: M1_V8_CAS_WORKER_PROTOCOL_VERSION,
        kind: 'failed', jobId, careerId,
        code: known ? error.code : 'WORKER_FAILED',
        ...(known && error.domainError ?
          { domainError: error.domainError } : {}),
      });
    });
});
