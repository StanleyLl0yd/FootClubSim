import test from 'node:test';
import assert from 'node:assert/strict';
import { readM1V46ReadRequest, M1_V46_SOURCE_STATUS }
  from '../dist/browser/m1-v46-worker-read-protocol.js';
import { runM1V46ReadWorker, readM1V46WorkerReply,
  loadM1V46ViaDedicatedWorker }
  from '../dist/browser/m1-v46-worker-read-client.js';

const req=()=>({
  schemaVersion:1,kind:'read',jobId:'v46-job',
  careerId:'v46-career',
});
const success=()=>({
  schemaVersion:1,kind:'read-result',jobId:'v46-job',
  careerId:'v46-career',revision:12,fixtureCount:12,
  status:M1_V46_SOURCE_STATUS,
});
const failed=(code)=>({
  schemaVersion:1,kind:'failed',
  jobId:'v46-job',careerId:'v46-career',code,
});
function worker(post=()=>{}){
  return {
    onmessage:null,onerror:null,onmessageerror:null,killed:0,
    postMessage(value){post(this,value);},
    terminate(){this.killed++;},
    send(value,origin=''){this.onmessage?.({data:value,origin});},
  };
}
test('v46 request admission rejects accessors, extras and bad identifiers',()=>{
  assert.deepEqual(readM1V46ReadRequest(req()),req());
  for(const invalid of [
    {...req(),kind:'commit'},{...req(),careerId:''},
    {...req(),jobId:'a b'}, {...req(),additional:1},
    {...req(),schemaVersion:2},
  ])assert.equal(readM1V46ReadRequest(invalid),null);
  let called=0;
  const hostile=req();
  Object.defineProperty(hostile,'kind',{enumerable:true,
    get(){called++;return 'read';}});
  assert.equal(readM1V46ReadRequest(hostile),null);
  assert.equal(called,0);
});
test('v46 Worker returns compact correlated source-replay receipt',async()=>{
  const fake=worker(w=>w.send(success()));
  const result=await runM1V46ReadWorker(fake,req());
  assert.deepEqual(result,{
    jobId:'v46-job',careerId:'v46-career',
    revision:12,fixtureCount:12,status:M1_V46_SOURCE_STATUS,
  });
  assert.equal(fake.killed,1);
  assert.equal(fake.onmessage,null);
  assert.equal(Object.hasOwn(result,'results'),false);
});
test('v46 reply cannot forge identity, revision, source or metadata',()=>{
  assert.equal(readM1V46WorkerReply(success(),req())?.kind,'read-result');
  for(const forged of [
    {...success(),jobId:'wrong'}, {...success(),careerId:'wrong'},
    {...success(),revision:-1},{...success(),revision:241},
    {...success(),fixtureCount:11},{...success(),status:'TRUSTED'},
    {...success(),results:[1]}, {...success(),revision:'12'},
    {...success(),extra:null},failed('WORKER_FAILED'),
  ])assert.equal(readM1V46WorkerReply(forged,req()),null);
  let called=0;
  const hostile=success();
  Object.defineProperty(hostile,'revision',{enumerable:true,
    get(){called++;return 12;}});
  assert.equal(readM1V46WorkerReply(hostile,req()),null);
  assert.equal(called,0);
});
test('v46 typed failed read never fabricates a valid history',async()=>{
  for(const code of ['NOT_FOUND','CORRUPTED','STORAGE_FAILED']){
    const fake=worker(w=>w.send(failed(code)));
    await assert.rejects(runM1V46ReadWorker(fake,req()),{code});
    assert.equal(fake.killed,1);
  }
});
test('v46 crash, timeout, malformed answer and transport error fail closed',async()=>{
  for(const action of [
    w=>w.send({...success(),revision:15}),
    w=>w.onerror?.({message:'worker crashed'}),
    w=>w.onmessageerror?.({data:null}),
  ]){
    const fake=worker(w=>action(w));
    await assert.rejects(runM1V46ReadWorker(fake,req()),
      {code:'READ_OUTCOME_UNKNOWN'});
  }
  const idle=worker();
  await assert.rejects(runM1V46ReadWorker(idle,req(),4),
    {code:'READ_OUTCOME_UNKNOWN'});
  idle.send(success());assert.equal(idle.killed,1);
  const broken=worker(()=>{throw Error('post failed');});
  await assert.rejects(runM1V46ReadWorker(broken,req()),
    {code:'READ_OUTCOME_UNKNOWN'});
});
test('v46 refuses invalid timeout and request before Worker allocation',async()=>{
  const fake=worker(()=>{throw Error('unreachable');});
  await assert.rejects(runM1V46ReadWorker(fake,{...req(),kind:'commit'}),
    {code:'INVALID_REQUEST'});
  assert.equal(fake.killed,1);
  const next=worker();
  await assert.rejects(runM1V46ReadWorker(next,req(),0),
    {code:'INVALID_REQUEST'});
  assert.equal(next.killed,1);
  await assert.rejects(loadM1V46ViaDedicatedWorker({...req(),jobId:''}),
    {code:'INVALID_REQUEST'});
});
