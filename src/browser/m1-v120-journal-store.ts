import { isStableId } from '../core/identifiers.js';
import { applyM1V120Source, startM1V120Journal,
  validateM1V120Journal, type M1V120Error,
  type M1V120Journal, type M1V120Apply }
  from '../core/m1-v120-playable-journal.js';
import { loadInitialCareer } from './initial-career-store.js';

/** Dedicated, independent v120 namespace. Never opens or upgrades v8. */
const DATABASE='footclubsim-m1-v120';
const STORE='dense-result-journals';
export type M1V120StorageCode='UNAVAILABLE'|'OPEN_FAILED'|'BLOCKED'|
  'STORAGE_FAILED'|'QUOTA_EXCEEDED'|'INVALID_ID'|'ALREADY_EXISTS'|
  'NOT_FOUND'|'CORRUPTED'|'STALE_REVISION'|'DOMAIN_REJECTED';
export class M1V120StorageError extends Error {
  constructor(readonly code:M1V120StorageCode,
    readonly domainError?:M1V120Error){
    super(domainError?code+': '+domainError:code);
    this.name='M1V120StorageError';
  }
}
const fail=(code:M1V120StorageCode,domainError?:M1V120Error)=>
  new M1V120StorageError(code,domainError);
const quota=(error:DOMException|null)=>error?.name==='QuotaExceededError';
async function open():Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')throw fail('UNAVAILABLE');
  return new Promise((resolve,reject)=>{
    let req:IDBOpenDBRequest;
    try{req=indexedDB.open(DATABASE,1);}
    catch{reject(fail('UNAVAILABLE'));return;}
    let settled=false;
    const rejectOnce=(code:M1V120StorageCode)=>{
      if(settled)return;
      settled=true;reject(fail(code));
    };
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE);
    };
    req.onerror=()=>rejectOnce(quota(req.error)?'QUOTA_EXCEEDED':'OPEN_FAILED');
    req.onblocked=()=>rejectOnce('BLOCKED');
    req.onsuccess=()=>{
      if(settled){req.result.close();return;}
      settled=true;resolve(req.result);
    };
  });
}
/** No await/promise callbacks between opening an IDB transaction and its put. */
async function transact<T>(mode:IDBTransactionMode,
  fn:(store:IDBObjectStore,abort:(e:M1V120StorageError)=>void,
    success:(value:T)=>void,requestError:(e:M1V120StorageError)=>void)=>void
):Promise<T>{
  const db=await open();
  try{
    return await new Promise<T>((resolve,reject)=>{
      let tx:IDBTransaction;
      try{tx=db.transaction(STORE,mode);}
      catch{reject(fail('STORAGE_FAILED'));return;}
      let result:T|undefined,err:M1V120StorageError|null=null;
      const abort=(reason:M1V120StorageError)=>{
        err=reason;
        try{tx.abort();}catch{reject(reason);}
      };
      tx.oncomplete=()=>err||result===undefined?
        reject(err??fail('STORAGE_FAILED')):resolve(result);
      tx.onabort=()=>reject(err??fail(quota(tx.error)?
        'QUOTA_EXCEEDED':'STORAGE_FAILED'));
      tx.onerror=()=>{};
      try{fn(tx.objectStore(STORE),abort,value=>{result=value;},
        error=>{err=error;});}
      catch{abort(fail('STORAGE_FAILED'));}
    });
  }finally{db.close();}
}
function checked(initial:unknown,raw:unknown):M1V120Journal{
  const result=validateM1V120Journal(initial,raw);
  if(!result.ok)throw fail('CORRUPTED');
  return result.journal;
}
function idValid(careerId:unknown):careerId is string{
  return isStableId(careerId);
}
export async function createM1V120PersistedJournal(
  careerId:string):Promise<M1V120Journal>{
  if(!idValid(careerId))throw fail('INVALID_ID');
  const initial=await loadInitialCareer(careerId);
  const start=startM1V120Journal(initial);
  if(!start.ok)throw fail('CORRUPTED');
  return transact('readwrite',(store,_abort,success,requestError)=>{
    const req=store.add(start.journal,careerId);
    req.onerror=()=>requestError(fail(req.error?.name==='ConstraintError'?
      'ALREADY_EXISTS':quota(req.error)?'QUOTA_EXCEEDED':'STORAGE_FAILED'));
    success(start.journal);
  });
}
export async function loadM1V120PersistedJournal(
  careerId:string):Promise<M1V120Journal>{
  if(!idValid(careerId))throw fail('INVALID_ID');
  const initial=await loadInitialCareer(careerId);
  return transact('readonly',(store,abort,success,requestError)=>{
    const req=store.get(careerId);
    req.onsuccess=()=>{
      if(req.result===undefined){abort(fail('NOT_FOUND'));return;}
      try{success(checked(initial,req.result));}
      catch{abort(fail('CORRUPTED'));}
    };
    req.onerror=()=>requestError(fail(quota(req.error)?
      'QUOTA_EXCEEDED':'STORAGE_FAILED'));
  });
}
/** Serialized read-verify-replay-write in one native IndexedDB transaction. */
export async function commitM1V120PersistedSource(
  careerId:string,expectedRevision:number,request:M1V120Apply,
):Promise<M1V120Journal>{
  if(!idValid(careerId))throw fail('INVALID_ID');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
      expectedRevision>30)throw fail('DOMAIN_REJECTED');
  const initial=await loadInitialCareer(careerId);
  return transact('readwrite',(store,abort,success,requestError)=>{
    const read=store.get(careerId);
    read.onerror=()=>requestError(fail(quota(read.error)?
      'QUOTA_EXCEEDED':'STORAGE_FAILED'));
    read.onsuccess=()=>{
      if(read.result===undefined){abort(fail('NOT_FOUND'));return;}
      const before=validateM1V120Journal(initial,read.result);
      if(!before.ok){abort(fail('CORRUPTED'));return;}
      if(before.journal.revision!==expectedRevision){
        abort(fail('STALE_REVISION'));return;
      }
      const proposed=applyM1V120Source(initial,before.journal,request);
      if(!proposed.ok){
        abort(fail('DOMAIN_REJECTED',proposed.error));return;
      }
      const write=store.put(proposed.journal,careerId);
      write.onerror=()=>requestError(fail(quota(write.error)?
        'QUOTA_EXCEEDED':'STORAGE_FAILED'));
      success(proposed.journal);
    };
  });
}
