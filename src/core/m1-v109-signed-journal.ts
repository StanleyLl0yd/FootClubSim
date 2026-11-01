import {sameCanonicalValue} from './canonical-value.js';
import {generateDoubleRoundRobin} from './fixtures.js';
import {isStableId} from './identifiers.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {startM1MatchResultJournal} from './m1-result-journal.js';
import {verifyM1V107SignedV105Source} from './m1-v107-signed-v105-source.js';
import type {InitialCareerSave} from './save.js';
import type {M1V105Run} from './m1-v105-special-goal-chronology.js';

export const M1_V109_SIGNED_JOURNAL_SCHEMA=109 as const;
const JOURNAL_KEYS=['schemaVersion','careerId','basePackId','basePackVersion',
  'selectedClubId','trustedKeyId','revision','entries'];
const ENTRY_KEYS=['schemaVersion','context','envelope','source','result'];
const CONTEXT_KEYS=['careerId','fixtureId','expectedRevision','challengeId'];
const MAX_JOURNAL_BYTES=60_000_000;
type Accepted=Extract<M1V105Run,{ok:true}>;
type Context=Readonly<{careerId:string;fixtureId:string;
  expectedRevision:number;challengeId:string}>;
export interface M1V109SignedEntry {
  readonly schemaVersion:109;
  readonly context:Context;
  readonly envelope:Readonly<{schemaVersion:107;payload:string;signature:string}>;
  readonly source:readonly unknown[];
  readonly result:Accepted;
}
export interface M1V109SignedJournal {
  readonly schemaVersion:109;
  readonly careerId:string;
  readonly basePackId:string;
  readonly basePackVersion:string;
  readonly selectedClubId:string;
  readonly trustedKeyId:string;
  readonly revision:number;
  readonly entries:readonly M1V109SignedEntry[];
}
export type M1V109Error='INVALID_INITIAL_CAREER'|'INVALID_JOURNAL'|
  'INVALID_KEY_ID'|'INVALID_ENTRY'|'WRONG_CAREER'|'STALE_REVISION'|
  'DUPLICATE_CHALLENGE'|'DUPLICATE_FIXTURE'|'UNKNOWN_FIXTURE'|
  'UNTRUSTED_PACK'|'SIGNATURE_OR_SOURCE_REJECTED'|'REVISION_LIMIT';
export type M1V109Result=
  | Readonly<{ok:true;journal:M1V109SignedJournal}>
  | Readonly<{ok:false;error:M1V109Error}>;
const fail=(error:M1V109Error):M1V109Result=>({ok:false,error});
const rec=(v:unknown):v is Record<string,unknown> =>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[]):boolean=>
  Reflect.ownKeys(v).length===keys.length&&
  keys.every(k=>Object.hasOwn(v,k));
const initialValid=(v:unknown):v is InitialCareerSave=>
  startM1MatchResultJournal(v).ok;
function snapshot(v:unknown):unknown|null{
  if(!isPlainJsonTree(v))return null;
  try{
    const serialized=JSON.stringify(v);
    return serialized.length<=MAX_JOURNAL_BYTES?
      JSON.parse(serialized) as unknown:null;
  }catch{return null;}
}
const fixtureMap=(initial:InitialCareerSave)=>
  new Map(generateDoubleRoundRobin(initial.catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures).map(f=>[f.id,f]));
function sourceScope(initial:InitialCareerSave,entry:M1V109SignedEntry):M1V109Error|null{
  const prematch=entry.source[0];
  if(!rec(prematch)||!rec(prematch.fixture)||
      prematch.fixture.id!==entry.context.fixtureId)return 'UNKNOWN_FIXTURE';
  const fixture=fixtureMap(initial).get(entry.context.fixtureId);
  if(!fixture||!sameCanonicalValue(fixture,prematch.fixture))
    return 'UNKNOWN_FIXTURE';
  if(!sameCanonicalValue(initial.catalog,prematch.catalog))
    return 'UNTRUSTED_PACK';
  return null;
}
function readJournal(initial:InitialCareerSave, keyId:string, raw:unknown):
  M1V109SignedJournal|null{
  if(!rec(raw)||!exact(raw,JOURNAL_KEYS)||raw.schemaVersion!==109||
      raw.careerId!==initial.careerId||raw.basePackId!==initial.basePackId||
      raw.basePackVersion!==initial.basePackVersion||
      raw.selectedClubId!==initial.selectedClubId||
      raw.trustedKeyId!==keyId||
      !Number.isSafeInteger(raw.revision)||(raw.revision as number)<0||
      (raw.revision as number)>240||!Array.isArray(raw.entries)||
      raw.entries.length!==raw.revision)return null;
  return raw as unknown as M1V109SignedJournal;
}
export function startM1V109SignedJournal(initial:unknown,keyId:unknown):M1V109Result{
  if(!initialValid(initial))return fail('INVALID_INITIAL_CAREER');
  if(!isStableId(keyId))return fail('INVALID_KEY_ID');
  return {ok:true,journal:{schemaVersion:109,careerId:initial.careerId,
    basePackId:initial.basePackId,basePackVersion:initial.basePackVersion,
    selectedClubId:initial.selectedClubId,trustedKeyId:keyId,revision:0,
    entries:[]}};
}
/**
 * All historical signatures and v105 results are independently replayed.
 * The public key and issuer key ID must be provisioned OUTSIDE editable saves.
 */
export async function validateM1V109SignedJournal(
  initial:unknown,trustedPublicKey:unknown,trustedKeyId:unknown,raw:unknown,
):Promise<M1V109Result>{
  if(!initialValid(initial))return fail('INVALID_INITIAL_CAREER');
  if(!isStableId(trustedKeyId))return fail('INVALID_KEY_ID');
  const copy=snapshot(raw);
  const journal=readJournal(initial,trustedKeyId,copy);
  if(!journal)return fail('INVALID_JOURNAL');
  const challenges=new Set<string>(),fixtures=new Set<string>();
  for(let i=0;i<journal.entries.length;i++){
    const entry=journal.entries[i];
    if(!rec(entry)||!exact(entry,ENTRY_KEYS)||entry.schemaVersion!==109||
        !rec(entry.context)||!exact(entry.context,CONTEXT_KEYS)||
        entry.context.careerId!==journal.careerId||
        entry.context.expectedRevision!==i||
        !isStableId(entry.context.challengeId)||
        !isStableId(entry.context.fixtureId)||
        !Array.isArray(entry.source)||!rec(entry.envelope))
      return fail('INVALID_JOURNAL');
    if(challenges.has(entry.context.challengeId)||
        fixtures.has(entry.context.fixtureId))return fail('INVALID_JOURNAL');
    challenges.add(entry.context.challengeId);
    fixtures.add(entry.context.fixtureId);
    if(sourceScope(initial,entry))return fail('INVALID_JOURNAL');
    const verified=await verifyM1V107SignedV105Source(
      trustedPublicKey,entry.context,entry.envelope,entry.source,entry.result);
    if(!verified.ok)return fail('INVALID_JOURNAL');
  }
  return {ok:true,journal};
}
/** A pure, copy-on-write proposal. It does not persist or authenticate issuer roles. */
export async function appendM1V109SignedSource(
  initial:unknown,trustedPublicKey:unknown,trustedKeyId:unknown,
  journalCandidate:unknown,contextCandidate:unknown,
  envelopeCandidate:unknown,sourceCandidate:unknown,resultCandidate:unknown,
):Promise<M1V109Result>{
  const copied=snapshot({context:contextCandidate,envelope:envelopeCandidate,
    source:sourceCandidate,result:resultCandidate});
  if(!rec(copied)||!rec(copied.context)||!rec(copied.envelope)||
      !Array.isArray(copied.source)||!rec(copied.result))
    return fail('INVALID_ENTRY');
  const before=await validateM1V109SignedJournal(
    initial,trustedPublicKey,trustedKeyId,journalCandidate);
  if(!before.ok)return before;
  const original=initial as InitialCareerSave, journal=before.journal;
  if(journal.revision>=240)return fail('REVISION_LIMIT');
  const context=copied.context;
  if(!exact(context,CONTEXT_KEYS)||!isStableId(context.careerId)||
      !isStableId(context.fixtureId)||!isStableId(context.challengeId)||
      !Number.isSafeInteger(context.expectedRevision))
    return fail('INVALID_ENTRY');
  if(context.careerId!==journal.careerId)return fail('WRONG_CAREER');
  if(context.expectedRevision!==journal.revision)return fail('STALE_REVISION');
  if(journal.entries.some(e=>e.context.challengeId===context.challengeId))
    return fail('DUPLICATE_CHALLENGE');
  if(journal.entries.some(e=>e.context.fixtureId===context.fixtureId))
    return fail('DUPLICATE_FIXTURE');
  const entry={schemaVersion:109,context:context as unknown as Context,
    envelope:copied.envelope as unknown as M1V109SignedEntry['envelope'],
    source:copied.source,result:copied.result as unknown as Accepted} as const;
  const invalid=sourceScope(original,entry);
  if(invalid)return fail(invalid);
  const verified=await verifyM1V107SignedV105Source(
    trustedPublicKey,entry.context,entry.envelope,entry.source,entry.result);
  if(!verified.ok)return fail('SIGNATURE_OR_SOURCE_REJECTED');
  const proposed={...journal,revision:journal.revision+1,
    entries:[...journal.entries,entry]};
  return {ok:true,journal:proposed};
}
