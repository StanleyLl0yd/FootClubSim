import { commitM1V32PersistedBatch, M1V32PersistenceError }
  from './m1-v32-journal-store.js';
import { M1_V43_WORKER_PROTOCOL_VERSION, readM1V43WorkerRequest }
  from './m1-v43-schema6-worker-protocol.js';

/**
 * Research-only dedicated Worker: the unchanged v32 schema-6 full
 * source replay and optimistic CAS run off the page's main thread.
 * A receipt is NOT a verified match report or a production user save.
 */
const worker=self as unknown as {
  postMessage:(data:unknown)=>void;
  addEventListener:(type:'message',handler:(e:MessageEvent<unknown>)=>void)=>void;
};
worker.addEventListener('message',event=>{
  if(event.origin!=='' && event.origin!==self.location.origin)return;
  const admitted=readM1V43WorkerRequest(event.data);
  if(!admitted.ok){
    worker.postMessage({
      schemaVersion:M1_V43_WORKER_PROTOCOL_VERSION,
      kind:'failed',jobId:null,careerId:null,code:'INVALID_REQUEST',
    });
    return;
  }
  const {jobId,careerId,expectedRevision,requests}=admitted.request;
  void commitM1V32PersistedBatch(careerId,expectedRevision,requests)
    .then(journal=>{
      worker.postMessage({
        schemaVersion:M1_V43_WORKER_PROTOCOL_VERSION,
        kind:'committed-receipt',jobId,careerId,
        journalRevision:journal.revision,
      });
    })
    .catch((error:unknown)=>{
      const known=error instanceof M1V32PersistenceError;
      worker.postMessage({
        schemaVersion:M1_V43_WORKER_PROTOCOL_VERSION,
        kind:'failed',jobId,careerId,
        code:known?error.code:'WORKER_FAILED',
        ...(known&&error.domainError?
          {domainError:error.domainError}:{}),
      });
    });
});
