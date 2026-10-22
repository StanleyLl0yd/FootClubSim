import { isPlainJsonTree } from '../core/plain-json-tree.js';
import type { M1V32JournalError } from '../core/m1-v32-causal-medical-journal.js';
import type { M1V32PersistenceCode } from './m1-v32-journal-store.js';
import {
  M1_V43_WORKER_PROTOCOL_VERSION, readM1V43WorkerRequest,
  type M1V43WorkerRequest,
} from './m1-v43-schema6-worker-protocol.js';

export interface M1V43CommitReceipt {
  readonly jobId:string;
  readonly careerId:string;
  readonly journalRevision:number;
}
export type M1V43WorkerErrorCode =
  'INVALID_REQUEST' | 'WORKER_UNAVAILABLE' | 'COMMIT_OUTCOME_UNKNOWN' |
  M1V32PersistenceCode;
export class M1V43WorkerError extends Error {
  constructor(
    public readonly code:M1V43WorkerErrorCode,
    public readonly domainError?:M1V32JournalError,
  ){
    super(domainError?code+': '+domainError:code);
    this.name='M1V43WorkerError';
  }
}
const PERSISTENCE=new Set<M1V32PersistenceCode>([
  'UNAVAILABLE','OPEN_FAILED','BLOCKED','STORAGE_FAILED',
  'QUOTA_EXCEEDED','INVALID_ID','ALREADY_EXISTS','NOT_FOUND',
  'CORRUPTED','STALE_REVISION','DOMAIN_REJECTED',
]);
const DOMAIN=new Set<M1V32JournalError>([
  'INVALID_INITIAL_CAREER','INVALID_JOURNAL','INVALID_BATCH',
  'INVALID_APPLY_COMMAND','WRONG_CAREER','DUPLICATE_COMMAND',
  'DUPLICATE_FIXTURE','STALE_REVISION','REVISION_LIMIT',
  'UNKNOWN_FIXTURE','UNTRUSTED_PACK','INVALID_MATCH_RESULT',
  'CAS_REVISION_MISMATCH',
]);
const record=(v:unknown):v is Record<string,unknown> =>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[]) =>
  Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
type Reply=
  |Readonly<{kind:'committed';receipt:M1V43CommitReceipt}>
  |Readonly<{kind:'failed';code:M1V32PersistenceCode;
    domainError?:M1V32JournalError}>;

/** Admit only exactly correlated and bounded Worker replies. */
export function readM1V43WorkerReply(
  raw:unknown,request:M1V43WorkerRequest,
):Reply|null {
  if(!isPlainJsonTree(raw)||!record(raw)||
      raw.schemaVersion!==M1_V43_WORKER_PROTOCOL_VERSION ||
      raw.jobId!==request.jobId || raw.careerId!==request.careerId)return null;
  const target=request.expectedRevision+request.requests.length;
  if(!Number.isSafeInteger(target)||target<1||target>240)return null;
  if(raw.kind==='committed-receipt'){
    if(!exact(raw,['schemaVersion','kind','jobId','careerId',
      'journalRevision'])||raw.journalRevision!==target)return null;
    return {kind:'committed',receipt:{
      jobId:request.jobId,careerId:request.careerId,journalRevision:target,
    }};
  }
  if(raw.kind!=='failed'||
      !(exact(raw,['schemaVersion','kind','jobId','careerId','code'])||
        exact(raw,['schemaVersion','kind','jobId','careerId','code',
          'domainError'])))return null;
  if(typeof raw.code!=='string'||
      !PERSISTENCE.has(raw.code as M1V32PersistenceCode))return null;
  if(Object.hasOwn(raw,'domainError')&&
      (raw.code!=='DOMAIN_REJECTED'||typeof raw.domainError!=='string'||
        !DOMAIN.has(raw.domainError as M1V32JournalError)))return null;
  return {kind:'failed',code:raw.code as M1V32PersistenceCode,
    ...(Object.hasOwn(raw,'domainError')?
      {domainError:raw.domainError as M1V32JournalError}:{})};
}
export type M1V43WorkerTransport=Pick<Worker,
  'postMessage'|'terminate'|'onmessage'|'onerror'|'onmessageerror'>;

/**
 * A lost or malformed response is NOT proof of rollback. An uncertain
 * result requires an independent full replayed load before any retry.
 */
export function runM1V43WorkerCommit(
  worker:M1V43WorkerTransport,raw:unknown,timeoutMs=180_000,
):Promise<M1V43CommitReceipt>{
  const admitted=readM1V43WorkerRequest(raw);
  if(!admitted.ok||!Number.isSafeInteger(timeoutMs)||
      timeoutMs<1||timeoutMs>180_000){
    try{worker.terminate();}catch{/* Already unavailable. */}
    return Promise.reject(new M1V43WorkerError('INVALID_REQUEST'));
  }
  const request=admitted.request;
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error:M1V43WorkerError|null,receipt?:M1V43CommitReceipt)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      worker.onmessage=null;
      worker.onerror=null;
      worker.onmessageerror=null;
      try{worker.terminate();}catch{/* Outcome already classified. */}
      if(error)reject(error);
      else if(receipt)resolve(receipt);
      else reject(new M1V43WorkerError('COMMIT_OUTCOME_UNKNOWN'));
    };
    const timeout=setTimeout(()=>finish(
      new M1V43WorkerError('COMMIT_OUTCOME_UNKNOWN')),timeoutMs);
    worker.onmessage=event=>{
      if(event.origin!==''&&event.origin!==location.origin){
        finish(new M1V43WorkerError('COMMIT_OUTCOME_UNKNOWN'));
        return;
      }
      const reply=readM1V43WorkerReply(event.data,request);
      if(!reply)finish(new M1V43WorkerError('COMMIT_OUTCOME_UNKNOWN'));
      else if(reply.kind==='committed')finish(null,reply.receipt);
      else finish(new M1V43WorkerError(reply.code,reply.domainError));
    };
    worker.onerror=()=>finish(
      new M1V43WorkerError('COMMIT_OUTCOME_UNKNOWN'));
    worker.onmessageerror=()=>finish(
      new M1V43WorkerError('COMMIT_OUTCOME_UNKNOWN'));
    try{worker.postMessage(request);}
    catch{finish(new M1V43WorkerError('COMMIT_OUTCOME_UNKNOWN'));}
  });
}
export function commitM1V43ViaDedicatedWorker(
  raw:unknown,timeoutMs=180_000,
):Promise<M1V43CommitReceipt>{
  const admitted=readM1V43WorkerRequest(raw);
  if(!admitted.ok)
    return Promise.reject(new M1V43WorkerError('INVALID_REQUEST'));
  let worker:Worker;
  try {
    worker=new Worker(new URL('./m1-v43-schema6-worker.js',import.meta.url),
      {type:'module'});
  } catch {
    return Promise.reject(new M1V43WorkerError('WORKER_UNAVAILABLE'));
  }
  return runM1V43WorkerCommit(worker,admitted.request,timeoutMs);
}
