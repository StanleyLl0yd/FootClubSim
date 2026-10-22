import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readM1V43WorkerRequest,
} from '../dist/browser/m1-v43-schema6-worker-protocol.js';
import {
  commitM1V43ViaDedicatedWorker,
  readM1V43WorkerReply, runM1V43WorkerCommit,
} from '../dist/browser/m1-v43-schema6-worker-client.js';

const request=()=>({
  schemaVersion:1,kind:'commit',careerId:'v43-career',
  jobId:'v43-job',expectedRevision:0,requests:[{schemaVersion:6}],
});
const done=(raw=request())=>({
  schemaVersion:1,kind:'committed-receipt',
  careerId:raw.careerId,jobId:raw.jobId,
  journalRevision:raw.expectedRevision+raw.requests.length,
});
const failed=(code,extra={})=>({
  schemaVersion:1,kind:'failed',careerId:'v43-career',
  jobId:'v43-job',code,...extra,
});
function fakeWorker(onPost=()=>{}) {
  return {
    onmessage:null,onerror:null,onmessageerror:null,terminated:0,
    postMessage(raw){onPost(this,raw);},
    terminate(){this.terminated++;},
    send(data,origin=''){this.onmessage?.({data,origin});},
  };
}
test('v43 envelope rejects malformed, aliased and hostile request trees',()=>{
  assert.equal(readM1V43WorkerRequest(request()).ok,true);
  const cases=[
    {...request(),jobId:''},
    {...request(),kind:'read'},
    {...request(),expectedRevision:241},
    {...request(),requests:[]},
    {...request(),requests:Array(17).fill({})},
    {...request(),extra:7},
    {...request(),requests:[NaN]},
    {...request(),requests:[{x:undefined}]},
  ];
  for(const x of cases)
    assert.equal(readM1V43WorkerRequest(x).ok,false);
  const accessor=request();
  let count=0;
  Object.defineProperty(accessor,'kind',{enumerable:true,get(){
    count++;return 'commit';
  }});
  assert.equal(readM1V43WorkerRequest(accessor).ok,false);
  assert.equal(count,0);
  const shared={foo:'one'};
  assert.equal(readM1V43WorkerRequest({
    ...request(),requests:[shared,shared],
  }).ok,false);
});
test('v43 compact receipt proves only correlated commit metadata',async()=>{
  const worker=fakeWorker((w,raw)=>w.send(done(raw)));
  const receipt=await runM1V43WorkerCommit(worker,request());
  assert.deepEqual(receipt,{
    jobId:'v43-job',careerId:'v43-career',journalRevision:1,
  });
  assert.equal(worker.terminated,1);
  assert.equal(worker.onmessage,null);
});
test('v43 reply denies fake success, wrong identity and invalid revisions',()=>{
  const req=request(),ok=done();
  assert.deepEqual(readM1V43WorkerReply(ok,req),{
    kind:'committed',receipt:{
      jobId:'v43-job',careerId:'v43-career',journalRevision:1,
    },
  });
  for(const malformed of [
    {...ok,jobId:'other'}, {...ok,careerId:'other'},
    {...ok,journalRevision:0}, {...ok,journalRevision:2},
    {...ok,extra:true},{...ok,journalRevision:'1'},
    {...ok,kind:'committed',journal:[]},
    {...ok,domainError:'INVALID_BATCH'},
    failed('WORKER_FAILED'), failed('DOMAIN_REJECTED',{
      domainError:'MADE_UP_ERROR',
    }),failed('STALE_REVISION',{domainError:'INVALID_BATCH'}),
  ]){
    assert.equal(readM1V43WorkerReply(malformed,req),null);
  }
  let getterCount=0;
  const forged=done();
  Object.defineProperty(forged,'journalRevision',{enumerable:true,
    get(){getterCount++;return 1;}});
  assert.equal(readM1V43WorkerReply(forged,req),null);
  assert.equal(getterCount,0);
});
test('v43 definitive persisted errors propagate without changing history',async()=>{
  for(const [outcome,expected] of [
    [failed('STALE_REVISION'),{code:'STALE_REVISION'}],
    [failed('DOMAIN_REJECTED',{domainError:'INVALID_BATCH'}),{
      code:'DOMAIN_REJECTED',domainError:'INVALID_BATCH',
    }],
  ]){
    const worker=fakeWorker(w=>w.send(outcome));
    await assert.rejects(runM1V43WorkerCommit(worker,request()),expected);
    assert.equal(worker.terminated,1);
  }
});
test('v43 worker errors, lost replies and transport failures are ambiguous',async()=>{
  for(const simulate of [
    w=>w.send({...done(),jobId:'other'}),
    w=>w.send(failed('WORKER_FAILED')),
    w=>w.onerror?.({message:'died'}),
    w=>w.onmessageerror?.({data:null}),
  ]){
    const worker=fakeWorker(w=>simulate(w));
    await assert.rejects(runM1V43WorkerCommit(worker,request()),
      {code:'COMMIT_OUTCOME_UNKNOWN'});
    assert.equal(worker.terminated,1);
  }
  const timed=fakeWorker();
  await assert.rejects(runM1V43WorkerCommit(timed,request(),4),
    {code:'COMMIT_OUTCOME_UNKNOWN'});
  timed.send(done());
  assert.equal(timed.terminated,1);
  const broken=fakeWorker(()=>{throw new Error('failed postMessage');});
  await assert.rejects(runM1V43WorkerCommit(broken,request()),
    {code:'COMMIT_OUTCOME_UNKNOWN'});
});
test('v43 invalid inputs or unavailable worker fail before committing',async()=>{
  const w=fakeWorker(()=>{throw Error('unreachable');});
  await assert.rejects(runM1V43WorkerCommit(w,{
    ...request(),jobId:''
  }),{code:'INVALID_REQUEST'});
  assert.equal(w.terminated,1);
  const w2=fakeWorker();
  await assert.rejects(runM1V43WorkerCommit(w2,request(),0),
    {code:'INVALID_REQUEST'});
  assert.equal(w2.terminated,1);
  await assert.rejects(commitM1V43ViaDedicatedWorker({
    ...request(),requests:[],
  }),{code:'INVALID_REQUEST'});
});
