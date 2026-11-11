import {isStableId} from '../core/identifiers.js';
import {parseM1V188PauseDraft,
  type M1V188PauseDraft} from '../core/m1-v188-pause-draft.js';

/** Advisory pause drafts live in their own DB, never in the
 * authoritative v188 journal and its readwrite CAS transaction.
 */
const DB='footclubsim-m1-v188-pause-drafts',STORE='pause-checkpoints';
export type M1V188PauseStoreCode='UNAVAILABLE'|'OPEN_FAILED'|
  'BLOCKED'|'STORAGE_FAILED'|'QUOTA_EXCEEDED'|'INVALID_DRAFT'|
  'CORRUPTED_DRAFT'|'STALE_DRAFT';
export class M1V188PauseStoreError extends Error{
  constructor(readonly code:M1V188PauseStoreCode){
    super(code);this.name='M1V188PauseStoreError';
  }
}
const fail=(code:M1V188PauseStoreCode)=>new M1V188PauseStoreError(code);
const quota=(e:DOMException|null)=>e?.name==='QuotaExceededError';
async function open():Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')throw fail('UNAVAILABLE');
  return new Promise((resolve,reject)=>{
    let request:IDBOpenDBRequest;
    try{request=indexedDB.open(DB,1);}
    catch{reject(fail('UNAVAILABLE'));return;}
    let settled=false;
    const rejectOnce=(code:M1V188PauseStoreCode)=>{
      if(settled)return;settled=true;reject(fail(code));
    };
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onerror=()=>rejectOnce('OPEN_FAILED');
    request.onblocked=()=>rejectOnce('BLOCKED');
    request.onsuccess=()=>{
      if(settled){request.result.close();return;}
      settled=true;resolve(request.result);
    };
  });
}
async function transact<T>(mode:IDBTransactionMode,
  work:(store:IDBObjectStore,done:(result:T)=>void,
    abort:(code:M1V188PauseStoreCode)=>void)=>void):Promise<T>{
  const db=await open();
  try{
    return await new Promise<T>((resolve,reject)=>{
      let tx:IDBTransaction;
      try{tx=db.transaction(STORE,mode);}
      catch{reject(fail('STORAGE_FAILED'));return;}
      let result:T|undefined,code:M1V188PauseStoreCode|null=null;
      const abort=(why:M1V188PauseStoreCode)=>{
        code=why;try{tx.abort();}catch{reject(fail(why));}
      };
      tx.oncomplete=()=>result===undefined?
        reject(fail('STORAGE_FAILED')):resolve(result);
      tx.onabort=()=>reject(fail(code??(quota(tx.error)?
        'QUOTA_EXCEEDED':'STORAGE_FAILED')));
      tx.onerror=()=>{};
      try{work(tx.objectStore(STORE),v=>{result=v;},abort);}
      catch{abort('STORAGE_FAILED');}
    });
  }finally{db.close();}
}
/** Reject older pauses or conflicting same-minute snapshots, even when
 * a second tab tries to overwrite them. Compare+write is one IDB tx.
 */
export async function saveM1V188PauseDraft(
  raw:M1V188PauseDraft):Promise<void>{
  const draft=parseM1V188PauseDraft(raw);
  if(!draft||!isStableId(draft.careerId))throw fail('INVALID_DRAFT');
  await transact('readwrite',(store,done,abort)=>{
    const req=store.get(draft.careerId);
    req.onsuccess=()=>{
      const prior=req.result===undefined?null:
        parseM1V188PauseDraft(req.result);
      if(req.result!==undefined&&!prior){
        abort('CORRUPTED_DRAFT');return;
      }
      if(prior&&(prior.expectedRevision>draft.expectedRevision||
          prior.expectedRevision===draft.expectedRevision&&
          prior.pauseMinute>draft.pauseMinute)){
        abort('STALE_DRAFT');return;
      }
      if(prior&&prior.expectedRevision===draft.expectedRevision&&
          prior.pauseMinute===draft.pauseMinute){
        // Idempotent retry is safe; conflicting same-minute writes are not.
        if(JSON.stringify(prior)!==JSON.stringify(draft)){
          abort('STALE_DRAFT');return;
        }
        done(true);return;
      }
      const put=store.put(draft,draft.careerId);
      put.onsuccess=()=>done(true);
    };
  });
}
/** Return RAW data for independent replay and tamper detection. */
export async function loadM1V188PauseDraft(
  careerId:string):Promise<unknown|null>{
  if(!isStableId(careerId))throw fail('INVALID_DRAFT');
  return transact('readonly',(store,done)=>{
    const req=store.get(careerId);
    req.onsuccess=()=>done(req.result===undefined?null:req.result);
  });
}
/** Cleanup is best-effort. Never delete a newer pause at a later
 * revision or minute that another tab saved concurrently.
 */
export async function clearM1V188PauseDraft(
  careerId:string,revision:number,minute:number=85):Promise<void>{
  if(!isStableId(careerId)||!Number.isSafeInteger(revision)||
      !Number.isSafeInteger(minute))throw fail('INVALID_DRAFT');
  await transact('readwrite',(store,done,abort)=>{
    const req=store.get(careerId);
    req.onsuccess=()=>{
      if(req.result===undefined){done(true);return;}
      const prior=parseM1V188PauseDraft(req.result);
      if(!prior){abort('CORRUPTED_DRAFT');return;}
      if(prior.expectedRevision>revision||
          prior.expectedRevision===revision&&prior.pauseMinute>minute){
        done(true);return;
      }
      const del=store.delete(careerId);
      del.onsuccess=()=>done(true);
    };
  });
}
