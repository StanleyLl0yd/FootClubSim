import { sameCanonicalValue } from './canonical-value.js';
import { generateDoubleRoundRobin } from './fixtures.js';
import { isStableId } from './identifiers.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { startM1MatchResultJournal } from './m1-result-journal.js';
import { simulateM1V105SpecialGoalChronology,
  type M1V105Run } from './m1-v105-special-goal-chronology.js';
import type { InitialCareerSave } from './save.js';

export const M1_V120_JOURNAL_SCHEMA = 120 as const;
type Good = Extract<M1V105Run, { ok: true }>;
export interface M1V120Source {
  /** Exact prematch minus the immutable M0 catalog, restored on replay. */
  readonly prematch: Readonly<Record<string, unknown>>;
  readonly policy: unknown;
  readonly plannedCommands: readonly unknown[];
  readonly checkpointMedical: readonly unknown[];
  readonly intraphaseMedical: readonly unknown[];
  readonly trustedDecisions: readonly unknown[];
}
export interface M1V120Entry {
  readonly commandId: string;
  readonly fixtureId: string;
  readonly round: number;
  readonly source: M1V120Source;
  readonly result: Good;
}
export interface M1V120Journal {
  readonly schemaVersion: typeof M1_V120_JOURNAL_SCHEMA;
  readonly careerId: string;
  readonly selectedClubId: string;
  readonly basePackId: string;
  readonly basePackVersion: string;
  readonly revision: number;
  readonly entries: readonly M1V120Entry[];
}
export interface M1V120Apply {
  readonly schemaVersion: typeof M1_V120_JOURNAL_SCHEMA;
  readonly commandId: string;
  readonly careerId: string;
  readonly expectedRevision: number;
  readonly prematch: unknown;
  readonly policy: unknown;
  readonly plannedCommands: readonly unknown[];
  readonly checkpointMedical: readonly unknown[];
  readonly intraphaseMedical: readonly unknown[];
  readonly trustedDecisions: readonly unknown[];
  readonly result: unknown;
}
export type M1V120Error =
  'INVALID_INITIAL' | 'INVALID_JOURNAL' | 'INVALID_REQUEST' |
  'STALE_REVISION' | 'WRONG_CAREER' | 'WRONG_FIXTURE' |
  'DUPLICATE_COMMAND' | 'UNTRUSTED_CATALOG' |
  'SOURCE_REPLAY_REJECTED' | 'CLAIMED_RESULT_MISMATCH' |
  'JOURNAL_SIZE_LIMIT' | 'SEASON_COMPLETE';
export type M1V120Gate =
  | Readonly<{ok:false;error:M1V120Error}>
  | Readonly<{ok:true;schemaVersion:120;
      status:'VERSIONED_DENSE_MATCH_SOURCE_NOT_BROWSER_PERSISTED';
      journal:M1V120Journal;
      v105PhysicalAndSpecialGoalsReplayed:true;
      originalM0Unchanged:true;
      previousV8JournalsUnchanged:true;
      sourceRefereeAuthenticated:false;
      browserIndexedDbCasCommitted:false;
      calibratedRealismAccepted:false}>;

const MAX_JOURNAL_BYTES = 30_000_000;
const MAX_SOURCE_BYTES = 500_000;
const JOURNAL_KEYS = ['schemaVersion','careerId','selectedClubId',
  'basePackId','basePackVersion','revision','entries'] as const;
const ENTRY_KEYS = ['commandId','fixtureId','round','source','result'] as const;
const SOURCE_KEYS = ['prematch','policy','plannedCommands',
  'checkpointMedical','intraphaseMedical','trustedDecisions'] as const;
const APPLY_KEYS = ['schemaVersion','commandId','careerId',
  'expectedRevision','prematch','policy','plannedCommands',
  'checkpointMedical','intraphaseMedical','trustedDecisions','result'] as const;
const fail = (error:M1V120Error):M1V120Gate => ({ok:false,error});
const record = (v:unknown):v is Record<string,unknown> =>
  v!==null && typeof v==='object' && !Array.isArray(v);
const exact = (v:Record<string,unknown>,keys:readonly string[]) =>
  Reflect.ownKeys(v).length===keys.length &&
    keys.every(k=>Object.hasOwn(v,k));
function copy(v:unknown,maxBytes:number):unknown|null {
  if (!isPlainJsonTree(v)) return null;
  try {
    const raw=JSON.stringify(v);
    return raw.length<=maxBytes ? JSON.parse(raw) as unknown : null;
  } catch { return null; }
}
function validatedInitial(v:unknown):v is InitialCareerSave {
  return startM1MatchResultJournal(v).ok;
}
function controlledSchedule(initial:InitialCareerSave) {
  return generateDoubleRoundRobin(initial.catalog.clubs.map(c=>c.id))
    .flatMap(round=>round.fixtures)
    .filter(f=>f.homeClubId===initial.selectedClubId ||
      f.awayClubId===initial.selectedClubId);
}
function baseJournal(initial:InitialCareerSave):M1V120Journal {
  return {schemaVersion:120,careerId:initial.careerId,
    selectedClubId:initial.selectedClubId,basePackId:initial.basePackId,
    basePackVersion:initial.basePackVersion,revision:0,entries:[]};
}
function good(journal:M1V120Journal):M1V120Gate {
  return {ok:true,schemaVersion:120,
    status:'VERSIONED_DENSE_MATCH_SOURCE_NOT_BROWSER_PERSISTED',
    journal,v105PhysicalAndSpecialGoalsReplayed:true,
    originalM0Unchanged:true,previousV8JournalsUnchanged:true,
    sourceRefereeAuthenticated:false,
    browserIndexedDbCasCommitted:false,calibratedRealismAccepted:false};
}
function replay(initial:InitialCareerSave,entry:M1V120Entry,
  scheduled:ReturnType<typeof controlledSchedule>[number]):boolean {
  if (!record(entry)||!exact(entry,ENTRY_KEYS) ||
      !isStableId(entry.commandId)||entry.fixtureId!==scheduled.id ||
      entry.round!==scheduled.round ||
      !record(entry.source)||!exact(entry.source,SOURCE_KEYS) ||
      !record(entry.source.prematch) ||
      Object.hasOwn(entry.source.prematch,'catalog') ||
      !Array.isArray(entry.source.plannedCommands) ||
      !Array.isArray(entry.source.checkpointMedical) ||
      !Array.isArray(entry.source.intraphaseMedical) ||
      !Array.isArray(entry.source.trustedDecisions) ||
      !record(entry.result)) return false;
  const source=entry.source;
  if (!sameCanonicalValue(source.prematch.fixture,scheduled)) return false;
  const prematch={...source.prematch,catalog:initial.catalog};
  const simulation=simulateM1V105SpecialGoalChronology(
    prematch,source.policy,source.plannedCommands,
    source.checkpointMedical,source.intraphaseMedical,source.trustedDecisions);
  return simulation.ok && sameCanonicalValue(simulation,entry.result);
}
function readJournal(initial:InitialCareerSave,unknown:unknown):M1V120Journal|null {
  const snapshot=copy(unknown,MAX_JOURNAL_BYTES);
  if (!record(snapshot)||!exact(snapshot,JOURNAL_KEYS)||
      snapshot.schemaVersion!==M1_V120_JOURNAL_SCHEMA ||
      snapshot.careerId!==initial.careerId ||
      snapshot.selectedClubId!==initial.selectedClubId ||
      snapshot.basePackId!==initial.basePackId ||
      snapshot.basePackVersion!==initial.basePackVersion ||
      !Number.isSafeInteger(snapshot.revision) ||
      (snapshot.revision as number)<0 ||
      (snapshot.revision as number)>30 ||
      !Array.isArray(snapshot.entries) ||
      snapshot.entries.length!==snapshot.revision) return null;
  const schedule=controlledSchedule(initial),ids=new Set<string>();
  const journal=snapshot as unknown as M1V120Journal;
  for(let i=0;i<journal.entries.length;i++){
    const entry=journal.entries[i]!;
    if (ids.has(entry.commandId)||!schedule[i] ||
        !replay(initial,entry,schedule[i]!)) return null;
    ids.add(entry.commandId);
  }
  return journal;
}
/** Version 120 never reads, rewrites or interprets legacy v8 saved journals. */
export function startM1V120Journal(initial:unknown):M1V120Gate {
  if(!validatedInitial(initial))return fail('INVALID_INITIAL');
  return good(baseJournal(initial));
}
export function validateM1V120Journal(
  initial:unknown,journal:unknown,
):M1V120Gate {
  if(!validatedInitial(initial))return fail('INVALID_INITIAL');
  const checked=readJournal(initial,journal);
  return checked?good(checked):fail('INVALID_JOURNAL');
}
/** Full replay + source result identity, then pure revision-CAS journal proposal. */
export function applyM1V120Source(
  initial:unknown,journal:unknown,untrustedRequest:unknown,
):M1V120Gate {
  if(!validatedInitial(initial))return fail('INVALID_INITIAL');
  const prior=readJournal(initial,journal);
  if(!prior)return fail('INVALID_JOURNAL');
  const raw=copy(untrustedRequest,MAX_SOURCE_BYTES);
  if(!record(raw)||!exact(raw,APPLY_KEYS)||
      raw.schemaVersion!==120 ||
      !isStableId(raw.commandId) ||
      !Number.isSafeInteger(raw.expectedRevision) ||
      !record(raw.prematch)||!record(raw.prematch.fixture) ||
      !Array.isArray(raw.plannedCommands)||
      !Array.isArray(raw.checkpointMedical)||
      !Array.isArray(raw.intraphaseMedical)||
      !Array.isArray(raw.trustedDecisions)||
      !record(raw.result))return fail('INVALID_REQUEST');
  if(raw.careerId!==prior.careerId)return fail('WRONG_CAREER');
  if(raw.expectedRevision!==prior.revision)return fail('STALE_REVISION');
  if(prior.entries.some(e=>e.commandId===raw.commandId))
    return fail('DUPLICATE_COMMAND');
  const schedule=controlledSchedule(initial);
  const fixture=schedule[prior.revision];
  if(!fixture)return fail('SEASON_COMPLETE');
  if(!sameCanonicalValue(raw.prematch.fixture,fixture))
    return fail('WRONG_FIXTURE');
  if(!sameCanonicalValue(raw.prematch.catalog,initial.catalog))
    return fail('UNTRUSTED_CATALOG');
  const simulation=simulateM1V105SpecialGoalChronology(
    raw.prematch,raw.policy,raw.plannedCommands,
    raw.checkpointMedical,raw.intraphaseMedical,raw.trustedDecisions);
  if(!simulation.ok)return fail('SOURCE_REPLAY_REJECTED');
  if(!sameCanonicalValue(simulation,raw.result))
    return fail('CLAIMED_RESULT_MISMATCH');
  const {catalog: _catalog,...sourcePrematch}=raw.prematch;
  void _catalog;
  const next:M1V120Journal={...prior,revision:prior.revision+1,
    entries:[...prior.entries,{commandId:raw.commandId as string,
      fixtureId:fixture.id,round:fixture.round,
      source:{prematch:sourcePrematch,policy:raw.policy,
        plannedCommands:raw.plannedCommands,
        checkpointMedical:raw.checkpointMedical,
        intraphaseMedical:raw.intraphaseMedical,
        trustedDecisions:raw.trustedDecisions},
      result:simulation}]};
  const serialized=JSON.stringify(next);
  if(serialized.length>MAX_JOURNAL_BYTES)
    return fail('JOURNAL_SIZE_LIMIT');
  return good(next);
}
