import {loadInitialCareer} from './initial-career-store.js';
import {startM1V188LeagueJournal,validateM1V188LeagueJournal,
  applyM1V188LeagueMatch,type M1V188Journal,
  type M1V188Request,type M1V188Error}
  from '../core/m1-v188-league-source-journal.js';
import {isStableId} from '../core/identifiers.js';

const DATABASE='footclubsim-m1-v188';
const STORE='full-league-source-journals';
export type M1V188StorageCode='UNAVAILABLE'|'OPEN_FAILED'|
  'BLOCKED'|'STORAGE_FAILED'|'QUOTA_EXCEEDED'|'INVALID_ID'|
  'ALREADY_EXISTS'|'NOT_FOUND'|'CORRUPTED'|'STALE_REVISION'|
  'DOMAIN_REJECTED';
export class M1V188StorageError extends Error{
  constructor(readonly code:M1V188StorageCode,
    readonly domainError?:M1V188Error){
    super(domainError?code+': '+domainError:code);
    this.name='M1V188StorageError';
  }
}
const fail=(code:M1V188StorageCode,domain?:M1V188Error)=>
  new M1V188StorageError(code,domain);
const quota=(e:DOMException|null)=>e?.name==='QuotaExceededError';
async function open():Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')throw fail('UNAVAILABLE');
  return new Promise((resolve,reject)=>{
    let req:IDBOpenDBRequest;
    try{req=indexedDB.open(DATABASE,1);}
    catch{reject(fail('UNAVAILABLE'));return;}
    let settled=false;
    const rejectOnce=(code:M1V188StorageCode)=>{
      if(settled)return;
      settled=true;reject(fail(code));
    };
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE);
    };
    req.onerror=()=>rejectOnce(quota(req.error)?'QUOTA_EXCEEDED':
      'OPEN_FAILED');
    req.onblocked=()=>rejectOnce('BLOCKED');
    req.onsuccess=()=>{
      if(settled){req.result.close();return;}
      settled=true;resolve(req.result);
    };
  });
}
async function transact<T>(mode:IDBTransactionMode,
  fn:(store:IDBObjectStore,abort:(e:M1V188StorageError)=>void,
    success:(v:T)=>void,error:(e:M1V188StorageError)=>void)=>void,
):Promise<T>{
  const db=await open();
  try{
    return await new Promise<T>((resolve,reject)=>{
      let tx:IDBTransaction;
      try{tx=db.transaction(STORE,mode);}
      catch{reject(fail('STORAGE_FAILED'));return;}
      let result:T|undefined,err:M1V188StorageError|null=null;
      const abort=(e:M1V188StorageError)=>{
        err=e;try{tx.abort();}catch{reject(e);}
      };
      tx.oncomplete=()=>err||result===undefined?
        reject(err??fail('STORAGE_FAILED')):resolve(result);
      tx.onabort=()=>reject(err??fail(quota(tx.error)?
        'QUOTA_EXCEEDED':'STORAGE_FAILED'));
      tx.onerror=()=>{};
      try{
        fn(tx.objectStore(STORE),abort,v=>{result=v;},
          e=>{err=e;});
      }catch{abort(fail('STORAGE_FAILED'));}
    });
  }finally{db.close();}
}
export async function createM1V188PersistedLeague(
  careerId:string):Promise<M1V188Journal>{
  if(!isStableId(careerId))throw fail('INVALID_ID');
  const initial=await loadInitialCareer(careerId);
  const first=startM1V188LeagueJournal(initial);
  if(!first.ok)throw fail('CORRUPTED');
  return transact('readwrite',(store,_abort,success,error)=>{
    const req=store.add(first.journal,careerId);
    req.onerror=()=>error(fail(req.error?.name==='ConstraintError'?
      'ALREADY_EXISTS':quota(req.error)?'QUOTA_EXCEEDED':'STORAGE_FAILED'));
    success(first.journal);
  });
}
export async function loadM1V188PersistedLeague(
  careerId:string):Promise<M1V188Journal>{
  if(!isStableId(careerId))throw fail('INVALID_ID');
  const initial=await loadInitialCareer(careerId);
  return transact('readonly',(store,abort,success,error)=>{
    const req=store.get(careerId);
    req.onsuccess=()=>{
      if(req.result===undefined){abort(fail('NOT_FOUND'));return;}
      const checked=validateM1V188LeagueJournal(initial,req.result);
      if(!checked.ok){abort(fail('CORRUPTED'));return;}
      success(checked.journal);
    };
    req.onerror=()=>error(fail(quota(req.error)?
      'QUOTA_EXCEEDED':'STORAGE_FAILED'));
  });
}
/** Read/replay/revision compare/write stay inside one readwrite IDB tx. */
export async function commitM1V188PersistedLeagueMatch(
  careerId:string,expectedRevision:number,request:M1V188Request,
):Promise<M1V188Journal>{
  if(!isStableId(careerId))throw fail('INVALID_ID');
  if(!Number.isSafeInteger(expectedRevision)||
      expectedRevision<0||expectedRevision>240)
    throw fail('DOMAIN_REJECTED');
  const initial=await loadInitialCareer(careerId);
  return transact('readwrite',(store,abort,success,error)=>{
    const read=store.get(careerId);
    read.onerror=()=>error(fail(quota(read.error)?
      'QUOTA_EXCEEDED':'STORAGE_FAILED'));
    read.onsuccess=()=>{
      if(read.result===undefined){abort(fail('NOT_FOUND'));return;}
      const prior=validateM1V188LeagueJournal(initial,read.result);
      if(!prior.ok){abort(fail('CORRUPTED'));return;}
      if(prior.journal.revision!==expectedRevision){
        abort(fail('STALE_REVISION'));return;
      }
      const next=applyM1V188LeagueMatch(
        initial,prior.journal,request);
      if(!next.ok){
        abort(fail('DOMAIN_REJECTED',next.error));return;
      }
      const put=store.put(next.journal,careerId);
      put.onerror=()=>error(fail(quota(put.error)?
        'QUOTA_EXCEEDED':'STORAGE_FAILED'));
      success(next.journal);
    };
  });
}

/** Import only a fully source-replayed journal, without replacing another
 * saved season. Exact idempotent retries are handled by backup orchestration.
 */
export async function restoreM1V188PersistedLeague(
  careerId:string,untrusted:unknown,
):Promise<M1V188Journal>{
  if(!isStableId(careerId))throw fail('INVALID_ID');
  const initial=await loadInitialCareer(careerId);
  const checked=validateM1V188LeagueJournal(initial,untrusted);
  if(!checked.ok||checked.journal.careerId!==careerId)
    throw fail('CORRUPTED');
  return transact('readwrite',(objectStore,_abort,success,error)=>{
    const req=objectStore.add(checked.journal,careerId);
    req.onerror=()=>error(fail(
      req.error?.name==='ConstraintError'?'ALREADY_EXISTS':
        quota(req.error)?'QUOTA_EXCEEDED':'STORAGE_FAILED'));
    success(checked.journal);
  });
}
