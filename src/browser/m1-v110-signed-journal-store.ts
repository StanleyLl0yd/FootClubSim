import {sameCanonicalValue} from '../core/canonical-value.js';
import {isStableId} from '../core/identifiers.js';
import {isPlainJsonTree} from '../core/plain-json-tree.js';
import {appendM1V109SignedSource,startM1V109SignedJournal,
  validateM1V109SignedJournal,type M1V109SignedJournal,
  type M1V109Error} from '../core/m1-v109-signed-journal.js';
import {loadInitialCareer} from './initial-career-store.js';

const DATABASE='footclubsim-m1-v110';
const STORE='signed-v105-journals';
export type M1V110StorageCode=
  'UNAVAILABLE'|'OPEN_FAILED'|'BLOCKED'|'STORAGE_FAILED'|
  'QUOTA_EXCEEDED'|'INVALID_ID'|'ALREADY_EXISTS'|'NOT_FOUND'|
  'CORRUPTED'|'STALE_REVISION'|'STALE_SNAPSHOT'|'DOMAIN_REJECTED';
export class M1V110StorageError extends Error{
  constructor(public readonly code:M1V110StorageCode,
    public readonly domainError?:M1V109Error){
    super(domainError?code+': '+domainError:code);
    this.name='M1V110StorageError';
  }
}
const fail=(code:M1V110StorageCode,domainError?:M1V109Error)=>
  new M1V110StorageError(code,domainError);
const quota=(e:DOMException|null)=>e?.name==='QuotaExceededError';
async function openDatabase():Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')throw fail('UNAVAILABLE');
  return new Promise((resolve,reject)=>{
    let req:IDBOpenDBRequest;
    try{req=indexedDB.open(DATABASE,1);}
    catch{reject(fail('UNAVAILABLE'));return;}
    let settled=false;
    const rejectOnce=(code:M1V110StorageCode)=>{
      if(settled)return;
      settled=true;
      reject(fail(code));
    };
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE);
    };
    req.onerror=()=>rejectOnce(quota(req.error)?'QUOTA_EXCEEDED':'OPEN_FAILED');
    req.onblocked=()=>rejectOnce('BLOCKED');
    req.onsuccess=()=>{
      if(settled){req.result.close();return;}
      settled=true;
      resolve(req.result);
    };
  });
}
/** The operation and every IDB event handler are synchronous; no await in a transaction. */
async function transact<T>(mode:IDBTransactionMode,
  operation:(store:IDBObjectStore,
    abort:(error:M1V110StorageError)=>void,
    setResult:(value:T)=>void,
    setRequestError:(error:M1V110StorageError)=>void)=>void):Promise<T>{
  const db=await openDatabase();
  try{
    return await new Promise<T>((resolve,reject)=>{
      let tx:IDBTransaction;
      try{tx=db.transaction(STORE,mode);}
      catch{reject(fail('STORAGE_FAILED'));return;}
      let result:T|undefined;
      let failure:M1V110StorageError|null=null;
      const abort=(error:M1V110StorageError)=>{
        failure=error;
        try{tx.abort();}
        catch{reject(error);}
      };
      tx.oncomplete=()=>{
        if(failure||result===undefined)
          reject(failure??fail('STORAGE_FAILED'));
        else resolve(result);
      };
      tx.onabort=()=>reject(failure??fail(quota(tx.error)?
        'QUOTA_EXCEEDED':'STORAGE_FAILED'));
      tx.onerror=()=>{/* Abort or commit is authoritative. */};
      try{
        operation(tx.objectStore(STORE),abort,
          value=>{result=value;},error=>{failure=error;});
      }catch{abort(fail('STORAGE_FAILED'));}
    });
  }finally{db.close();}
}
async function loadRaw(careerId:string):Promise<unknown>{
  const read=await transact('readonly',(store,_abort,setResult,setRequestError)=>{
    const req=store.get(careerId);
    req.onsuccess=()=>setResult({found:req.result!==undefined,value:req.result});
    req.onerror=()=>setRequestError(fail(quota(req.error)?
      'QUOTA_EXCEEDED':'STORAGE_FAILED'));
  }) as {found:boolean;value:unknown};
  if(!read.found)throw fail('NOT_FOUND');
  return read.value;
}
/** An isolated store; legacy M0 and v7 are never modified. */
export async function createM1V110PersistedSignedJournal(
  careerId:string,trustedKeyId:string,
):Promise<M1V109SignedJournal>{
  if(!isStableId(careerId)||!isStableId(trustedKeyId))
    throw fail('INVALID_ID');
  const initial=await loadInitialCareer(careerId);
  const started=startM1V109SignedJournal(initial,trustedKeyId);
  if(!started.ok)throw fail('DOMAIN_REJECTED',started.error);
  return transact('readwrite',(store,_abort,setResult,setRequestError)=>{
    const req=store.add(started.journal,careerId);
    req.onerror=()=>setRequestError(fail(req.error?.name==='ConstraintError'?
      'ALREADY_EXISTS':quota(req.error)?'QUOTA_EXCEEDED':'STORAGE_FAILED'));
    setResult(started.journal);
  });
}
/** Verify every historical signature AFTER a coherent read transaction completes. */
export async function loadM1V110PersistedSignedJournal(
  careerId:string,trustedPublicKey:unknown,trustedKeyId:string,
):Promise<M1V109SignedJournal>{
  if(!isStableId(careerId)||!isStableId(trustedKeyId))
    throw fail('INVALID_ID');
  const initial=await loadInitialCareer(careerId);
  const raw=await loadRaw(careerId);
  const checked=await validateM1V109SignedJournal(
    initial,trustedPublicKey,trustedKeyId,raw);
  if(!checked.ok)throw fail('CORRUPTED');
  return checked.journal;
}
/**
 * Verify full existing history and new Ed25519 source BEFORE starting write
 * transaction. Within ONE readwrite transaction compare exact previously
 * verified snapshot, revision and identity, then put exactly once.
 */
export async function commitM1V110PersistedSignedSource(
  careerId:string,trustedPublicKey:unknown,trustedKeyId:string,
  expectedRevision:number,context:unknown,envelope:unknown,
  source:unknown,result:unknown,
):Promise<M1V109SignedJournal>{
  if(!isStableId(careerId)||!isStableId(trustedKeyId))
    throw fail('INVALID_ID');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
      expectedRevision>240)throw fail('DOMAIN_REJECTED','STALE_REVISION');
  const initial=await loadInitialCareer(careerId);
  const previous=await loadRaw(careerId);
  const proposed=await appendM1V109SignedSource(
    initial,trustedPublicKey,trustedKeyId,
    previous,context,envelope,source,result);
  if(!proposed.ok)throw fail('DOMAIN_REJECTED',proposed.error);
  if(proposed.journal.revision!==expectedRevision+1)
    throw fail('STALE_REVISION');
  return transact('readwrite',(store,abort,setResult,setRequestError)=>{
    const read=store.get(careerId);
    read.onerror=()=>setRequestError(fail(quota(read.error)?
      'QUOTA_EXCEEDED':'STORAGE_FAILED'));
    read.onsuccess=()=>{
      if(read.result===undefined){abort(fail('NOT_FOUND'));return;}
      const current=read.result as unknown;
      if(!isPlainJsonTree(current)||typeof current!=='object'||
          current===null||!('revision' in current)){
        abort(fail('STALE_SNAPSHOT'));return;
      }
      if(current.revision!==expectedRevision){
        abort(fail('STALE_REVISION'));return;
      }
      if(!isPlainJsonTree(previous)||
          !sameCanonicalValue(current,previous)){
        abort(fail('STALE_SNAPSHOT'));return;
      }
      const put=store.put(proposed.journal,careerId);
      put.onerror=()=>setRequestError(fail(quota(put.error)?
        'QUOTA_EXCEEDED':'STORAGE_FAILED'));
      setResult(proposed.journal);
    };
  });
}
