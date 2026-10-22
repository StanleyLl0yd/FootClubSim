import { loadM1V32PersistedJournal, M1V32PersistenceError }
  from './m1-v32-journal-store.js';
import { M1_V46_READ_PROTOCOL_VERSION, M1_V46_SOURCE_STATUS,
  readM1V46ReadRequest } from './m1-v46-worker-read-protocol.js';

/**
 * Research-only: model source replay and validation happen in a DedicatedWorker.
 * A read receipt is not a signed referee/medical statement or immutable snapshot.
 */
const worker=self as unknown as {
  postMessage:(value:unknown)=>void;
  addEventListener:(name:'message',
    callback:(event:MessageEvent<unknown>)=>void)=>void;
};
worker.addEventListener('message',event=>{
  if(event.origin!==''&&event.origin!==self.location.origin)return;
  const admitted=readM1V46ReadRequest(event.data);
  if(!admitted){
    worker.postMessage({
      schemaVersion:M1_V46_READ_PROTOCOL_VERSION,kind:'failed',
      jobId:null,careerId:null,code:'INVALID_REQUEST',
    });
    return;
  }
  const {jobId,careerId}=admitted;
  void loadM1V32PersistedJournal(careerId).then(journal=>{
    worker.postMessage({
      schemaVersion:M1_V46_READ_PROTOCOL_VERSION,kind:'read-result',
      jobId,careerId,revision:journal.revision,
      fixtureCount:journal.results.length,status:M1_V46_SOURCE_STATUS,
    });
  }).catch((error:unknown)=>{
    const known=error instanceof M1V32PersistenceError;
    worker.postMessage({
      schemaVersion:M1_V46_READ_PROTOCOL_VERSION,kind:'failed',
      jobId,careerId,code:known?error.code:'WORKER_FAILED',
    });
  });
});
