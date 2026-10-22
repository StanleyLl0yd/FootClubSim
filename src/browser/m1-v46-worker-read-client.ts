import { isPlainJsonTree } from '../core/plain-json-tree.js';
import type { M1V32PersistenceCode } from './m1-v32-journal-store.js';
import { M1_V46_READ_PROTOCOL_VERSION, M1_V46_SOURCE_STATUS,
  readM1V46ReadRequest, type M1V46ReadRequest,
} from './m1-v46-worker-read-protocol.js';

export type M1V46ReadFailureCode='INVALID_REQUEST'|
  'WORKER_UNAVAILABLE'|'READ_OUTCOME_UNKNOWN'|M1V32PersistenceCode;
export class M1V46ReadWorkerError extends Error {
  constructor(public readonly code:M1V46ReadFailureCode){
    super(code);this.name='M1V46ReadWorkerError';
  }
}
export interface M1V46ReadReceipt {
  readonly careerId:string;readonly jobId:string;
  readonly revision:number;readonly fixtureCount:number;
  readonly status:typeof M1_V46_SOURCE_STATUS;
}
const CODES=new Set<M1V32PersistenceCode>([
  'UNAVAILABLE','OPEN_FAILED','BLOCKED','STORAGE_FAILED',
  'QUOTA_EXCEEDED','INVALID_ID','ALREADY_EXISTS','NOT_FOUND',
  'CORRUPTED','STALE_REVISION','DOMAIN_REJECTED',
]);
const record=(v:unknown):v is Record<string,unknown> =>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[]):boolean=>
  Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
type Parsed=
  |Readonly<{kind:'read-result';receipt:M1V46ReadReceipt}>
  |Readonly<{kind:'failed';code:M1V32PersistenceCode}>;
/** Worker data is not inherently trusted, even if created by same-origin JS. */
export function readM1V46WorkerReply(
  value:unknown,request:M1V46ReadRequest,
):Parsed|null{
  if(!isPlainJsonTree(value)||!record(value)||
      value.schemaVersion!==M1_V46_READ_PROTOCOL_VERSION||
      value.jobId!==request.jobId||value.careerId!==request.careerId)
    return null;
  if(value.kind==='read-result'){
    if(!exact(value,['schemaVersion','kind','jobId','careerId',
      'revision','fixtureCount','status'])||
        !Number.isSafeInteger(value.revision)||
        (value.revision as number)<0||
        (value.revision as number)>240||
        value.fixtureCount!==value.revision||
        value.status!==M1_V46_SOURCE_STATUS)return null;
    return {kind:'read-result',receipt:{
      jobId:request.jobId,careerId:request.careerId,
      revision:value.revision as number,
      fixtureCount:value.fixtureCount as number,
      status:M1_V46_SOURCE_STATUS,
    }};
  }
  if(value.kind!=='failed'||!exact(value,[
    'schemaVersion','kind','jobId','careerId','code'])||
      typeof value.code!=='string'||
      !CODES.has(value.code as M1V32PersistenceCode))return null;
  return {kind:'failed',code:value.code as M1V32PersistenceCode};
}
export type M1V46ReadTransport=Pick<Worker,
  'postMessage'|'terminate'|'onmessage'|'onerror'|'onmessageerror'>;
/**
 * Timeout/crashed Worker means READ_OUTCOME_UNKNOWN, never fabricated zero
 * fixtures. This read-only operation has no commit outcome or retry authority.
 */
export function runM1V46ReadWorker(
  worker:M1V46ReadTransport,raw:unknown,timeoutMs=180_000,
):Promise<M1V46ReadReceipt>{
  const req=readM1V46ReadRequest(raw);
  if(!req||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||
      timeoutMs>180_000){
    try{worker.terminate();}catch{/* no worker */}
    return Promise.reject(new M1V46ReadWorkerError('INVALID_REQUEST'));
  }
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(err:M1V46ReadWorkerError|null,
      receipt?:M1V46ReadReceipt)=>{
      if(settled)return;settled=true;clearTimeout(timeout);
      worker.onmessage=null;worker.onerror=null;
      worker.onmessageerror=null;
      try{worker.terminate();}catch{/* already finished */}
      if(err)reject(err);
      else if(receipt)resolve(receipt);
      else reject(new M1V46ReadWorkerError('READ_OUTCOME_UNKNOWN'));
    };
    const timeout=setTimeout(()=>finish(
      new M1V46ReadWorkerError('READ_OUTCOME_UNKNOWN')),timeoutMs);
    worker.onmessage=event=>{
      if(event.origin!==''&&event.origin!==location.origin){
        finish(new M1V46ReadWorkerError('READ_OUTCOME_UNKNOWN'));return;
      }
      const answer=readM1V46WorkerReply(event.data,req);
      if(!answer)finish(new M1V46ReadWorkerError('READ_OUTCOME_UNKNOWN'));
      else if(answer.kind==='read-result')finish(null,answer.receipt);
      else finish(new M1V46ReadWorkerError(answer.code));
    };
    worker.onerror=()=>finish(
      new M1V46ReadWorkerError('READ_OUTCOME_UNKNOWN'));
    worker.onmessageerror=()=>finish(
      new M1V46ReadWorkerError('READ_OUTCOME_UNKNOWN'));
    try{worker.postMessage(req);}
    catch{finish(new M1V46ReadWorkerError('READ_OUTCOME_UNKNOWN'));}
  });
}
export function loadM1V46ViaDedicatedWorker(
  raw:unknown,timeoutMs=180_000,
):Promise<M1V46ReadReceipt>{
  const req=readM1V46ReadRequest(raw);
  if(!req)return Promise.reject(
    new M1V46ReadWorkerError('INVALID_REQUEST'));
  let worker:Worker;
  try{
    worker=new Worker(new URL('./m1-v46-worker-read.js',import.meta.url),
      {type:'module'});
  }catch{
    return Promise.reject(new M1V46ReadWorkerError('WORKER_UNAVAILABLE'));
  }
  return runM1V46ReadWorker(worker,req,timeoutMs);
}
