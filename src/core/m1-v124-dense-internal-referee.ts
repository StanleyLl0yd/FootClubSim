import {buildM1V124GeneratedCommands,
  verifyM1V124GeneratedSourceClaim}
  from './m1-v124-generated-source.js';
import {simulateM1V19InternalReferee}
  from './m1-v19-internal-foul-injury.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';
import {prepareM1V122DenseOrdinaryMatch,
  type M1V122DenseProposal} from './m1-v122-dense-ordinary-season.js';
import {validateM1V120Journal,
  type M1V120Journal} from './m1-v120-playable-journal.js';
import type {InitialCareerSave} from './save.js';

export const M1_V124_DENSE_REFEREE_SCHEMA=124 as const;
export type M1V124DenseRefereeProposal=
  | Readonly<{ok:false;error:'INVALID_JOURNAL'|
      'PREVIOUS_EXCEPTION_NOT_SUPPORTED'|'NO_LEGAL_LINEUP'|
      'SOURCE_GENERATION_REJECTED'|'REFEREE_REPLAY_REJECTED'}>
  | Readonly<{ok:true;schemaVersion:124;
      scenario:'internal-referee';incidents:number;
      fixtureId:string;
      request:Extract<M1V122DenseProposal,{ok:true}>['request'];
      sourceCompletelyRegenerated:true;
      authorityAuthenticated:false;
      furtherExceptionalLifecycleSupported:false}>;

/** One fictional v19 referee calculation, merged into the dense v105 source.
 * No external or client-supplied command list is trusted or accepted.
 */
export function prepareM1V124DenseVirtualRefereeMatch(
  initial:InitialCareerSave,journal:M1V120Journal,
):M1V124DenseRefereeProposal|null {
  const base=prepareM1V122DenseOrdinaryMatch(initial,journal);
  if(base===null)return null;
  if(!base.ok)return base;
  return buildM1V124VirtualRefereeFromVerifiedBase(base);
}

/** Use only a validated, source-replayed per-fixture base. The returned
 * request still requires the existing v120 replay/CAS admission gate.
 */
export function buildM1V124VirtualRefereeFromVerifiedBase(
  base:Pick<Extract<M1V122DenseProposal,{ok:true}>,'fixture'|'request'>,
):M1V124DenseRefereeProposal {
  const source=base.request;
  const generated=simulateM1V19InternalReferee(
    source.prematch,source.policy);
  if(!generated.ok)
    return {ok:false,error:'REFEREE_REPLAY_REJECTED'};
  const plannedCommands=buildM1V124GeneratedCommands(
    generated.generatedIncidents,base.fixture.id);
  const dense=simulateM1V105SpecialGoalChronology(
    source.prematch,source.policy,plannedCommands,[],[],[]);
  if(!dense.ok)return {ok:false,error:'SOURCE_GENERATION_REJECTED'};
  return {ok:true,schemaVersion:M1_V124_DENSE_REFEREE_SCHEMA,
    scenario:'internal-referee',incidents:generated.generatedIncidents.length,
    fixtureId:base.fixture.id,
    request:{...source,commandId:'v124-virtual-referee-'+base.fixture.id,
      plannedCommands,result:dense},
    sourceCompletelyRegenerated:true,
    authorityAuthenticated:false,furtherExceptionalLifecycleSupported:false,
  };
}
/**
 * Recheck the complete already-admitted journal before granting a
 * provisional source-identity proof for an event-rich v124 fixture.
 * This does not establish real referee or medical issuer authority.
 */
export function verifyM1V124DenseVirtualRefereeSource(
  initial:InitialCareerSave,rawJournal:M1V120Journal,fixtureId:string,
):boolean {
  const verified=validateM1V120Journal(initial,rawJournal);
  if(!verified.ok)return false;
  const entry=verified.journal.entries.find(item=>item.fixtureId===fixtureId);
  if(!entry||entry.commandId!=='v124-virtual-referee-'+fixtureId||
      entry.source.checkpointMedical.length!==0||
      entry.source.intraphaseMedical.length!==0||
      entry.source.trustedDecisions.length!==0)return false;
  const prematch={...entry.source.prematch,catalog:initial.catalog};
  return verifyM1V124GeneratedSourceClaim(
    prematch,entry.source.policy,entry.source.plannedCommands,
    fixtureId,initial.rngState);
}
