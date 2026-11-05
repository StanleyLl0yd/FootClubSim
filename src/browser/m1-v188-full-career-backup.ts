import {isStableId} from '../core/identifiers.js';
import {sameCanonicalValue} from '../core/canonical-value.js';
import {exportInitialCareer,importInitialCareer,
  type InitialCareerSave} from '../core/save.js';
import {validateM1V188LeagueJournal,type M1V188Journal}
  from '../core/m1-v188-league-source-journal.js';
import type {Catalog} from '../core/model.js';
import {CareerStorageError,loadInitialCareer,saveNewInitialCareer}
  from './initial-career-store.js';
import {M1V188StorageError,loadM1V188PersistedLeague,
  restoreM1V188PersistedLeague} from './m1-v188-league-store.js';

/**
 * Complete playable-career backup: immutable initial state + ALL committed
 * v188 fixtures. Both databases are distinct, so restoration is a validated,
 * retryable two-stage ADD-ONLY process, never cross-database atomicity.
 * SHA-256 checks accidental corruption; it is not a signature.
 */
export const M1_V188_FULL_BACKUP_FORMAT='footclubsim-v188-full-career';
export const M1_V188_FULL_BACKUP_VERSION=1;
export const M1_V188_FULL_BACKUP_MAX_CHARS=130_000_000;
const HASH=/^[0-9a-f]{64}$/;
const KEYS=['format','version','careerId','checksumAlgorithm',
  'initialPayload','initialChecksum','journalPayload','journalChecksum'];

export type M1V188FullBackupCode='INVALID_BACKUP'|'TOO_LARGE'|
  'CRYPTO_UNAVAILABLE'|'UNKNOWN_PACK'|'CONFLICT';
export class M1V188FullBackupError extends Error{
  constructor(readonly code:M1V188FullBackupCode){
    super(code);this.name='M1V188FullBackupError';
  }
}
const fail=(code:M1V188FullBackupCode)=>
  new M1V188FullBackupError(code);
const record=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
function exact(v:unknown):v is Record<string,unknown>{
  return record(v)&&Object.keys(v).length===KEYS.length&&
    KEYS.every(key=>Object.hasOwn(v,key));
}
async function digest(value:string):Promise<string>{
  if(!globalThis.crypto?.subtle)throw fail('CRYPTO_UNAVAILABLE');
  try{
    const hash=await globalThis.crypto.subtle.digest(
      'SHA-256',new TextEncoder().encode(value));
    return Array.from(new Uint8Array(hash),byte=>
      byte.toString(16).padStart(2,'0')).join('');
  }catch{throw fail('CRYPTO_UNAVAILABLE');}
}
export interface M1V188FullBackupContents{
  readonly initial:InitialCareerSave;
  readonly journal:M1V188Journal;
}

/** Export validated in-memory data, useful also for unit tests. */
export async function encodeM1V188FullCareerBackup(
  initial:InitialCareerSave,journal:unknown,
):Promise<string>{
  const checked=validateM1V188LeagueJournal(initial,journal);
  if(!checked.ok)throw fail('INVALID_BACKUP');
  const initialPayload=await exportInitialCareer(initial);
  const journalPayload=JSON.stringify(checked.journal);
  const [initialChecksum,journalChecksum]=await Promise.all([
    digest(initialPayload),digest(journalPayload)]);
  const result=JSON.stringify({
    format:M1_V188_FULL_BACKUP_FORMAT,version:M1_V188_FULL_BACKUP_VERSION,
    careerId:initial.careerId,checksumAlgorithm:'sha256',
    initialPayload,initialChecksum,journalPayload,journalChecksum,
  });
  if(result.length>M1_V188_FULL_BACKUP_MAX_CHARS)throw fail('TOO_LARGE');
  return result;
}

export async function exportM1V188FullCareerBackup(
  careerId:string,
):Promise<string>{
  if(!isStableId(careerId))throw fail('INVALID_BACKUP');
  const initial=await loadInitialCareer(careerId);
  const journal=await loadM1V188PersistedLeague(careerId);
  return encodeM1V188FullCareerBackup(initial,journal);
}

/** Recheck *all* bytes and full match-source replay before any storage write.
 * Only exact, app-known catalog packs may be restored.
 */
export async function decodeM1V188FullCareerBackup(
  encoded:unknown,knownCatalogs:readonly Catalog[],
):Promise<M1V188FullBackupContents>{
  if(typeof encoded!=='string')throw fail('INVALID_BACKUP');
  if(encoded.length>M1_V188_FULL_BACKUP_MAX_CHARS)throw fail('TOO_LARGE');
  let value:unknown;
  try{value=JSON.parse(encoded) as unknown;}
  catch{throw fail('INVALID_BACKUP');}
  if(!exact(value)||value.format!==M1_V188_FULL_BACKUP_FORMAT||
      value.version!==M1_V188_FULL_BACKUP_VERSION||
      !isStableId(value.careerId)||
      value.checksumAlgorithm!=='sha256'||
      typeof value.initialPayload!=='string'||
      typeof value.journalPayload!=='string'||
      typeof value.initialChecksum!=='string'||
      typeof value.journalChecksum!=='string'||
      !HASH.test(value.initialChecksum)||
      !HASH.test(value.journalChecksum)||
      value.initialPayload.length>5_000_000||
      value.journalPayload.length>105_000_000)
    throw fail('INVALID_BACKUP');
  const [first,second]=await Promise.all([
    digest(value.initialPayload),digest(value.journalPayload)]);
  if(first!==value.initialChecksum||second!==value.journalChecksum)
    throw fail('INVALID_BACKUP');
  const imported=await importInitialCareer(value.initialPayload);
  if(!imported.ok||imported.value.careerId!==value.careerId)
    throw fail('INVALID_BACKUP');
  if(!knownCatalogs.some(catalog=>
      sameCanonicalValue(catalog,imported.value.catalog)))
    throw fail('UNKNOWN_PACK');
  let journal:unknown;
  try{journal=JSON.parse(value.journalPayload) as unknown;}
  catch{throw fail('INVALID_BACKUP');}
  const verified=validateM1V188LeagueJournal(imported.value,journal);
  if(!verified.ok||verified.journal.careerId!==value.careerId)
    throw fail('INVALID_BACKUP');
  return {initial:imported.value,journal:verified.journal};
}
async function ensureInitial(initial:InitialCareerSave):Promise<void>{
  try{
    const present=await loadInitialCareer(initial.careerId);
    if(!sameCanonicalValue(present,initial))throw fail('CONFLICT');
    return;
  }catch(error){
    if(!(error instanceof CareerStorageError)||
        error.code!=='NOT_FOUND')throw error;
  }
  try{await saveNewInitialCareer(initial);}
  catch(error){
    if(!(error instanceof CareerStorageError)||
        error.code!=='DUPLICATE')throw error;
  }
  const present=await loadInitialCareer(initial.careerId);
  if(!sameCanonicalValue(present,initial))throw fail('CONFLICT');
}
async function ensureJournal(
  initial:InitialCareerSave,journal:M1V188Journal,
):Promise<void>{
  try{
    const present=await loadM1V188PersistedLeague(initial.careerId);
    if(!sameCanonicalValue(present,journal))throw fail('CONFLICT');
    return;
  }catch(error){
    if(!(error instanceof M1V188StorageError)||
        error.code!=='NOT_FOUND')throw error;
  }
  try{
    await restoreM1V188PersistedLeague(initial.careerId,journal);
  }catch(error){
    if(!(error instanceof M1V188StorageError)||
        error.code!=='ALREADY_EXISTS')throw error;
  }
  const present=await loadM1V188PersistedLeague(initial.careerId);
  if(!sameCanonicalValue(present,journal))throw fail('CONFLICT');
}

/** Idempotent, add-only two-database restore. A failed second stage may
 * leave the initial record; retry the SAME archive, never overwrite it.
 */
export async function restoreM1V188FullCareerBackup(
  encoded:unknown,knownCatalogs:readonly Catalog[],
):Promise<M1V188FullBackupContents>{
  const content=await decodeM1V188FullCareerBackup(
    encoded,knownCatalogs);
  await ensureInitial(content.initial);
  await ensureJournal(content.initial,content.journal);
  return content;
}
