import {simulateM1V19InternalReferee}
  from './m1-v19-internal-foul-injury.js';
import {buildM1V124GeneratedCommands}
  from './m1-v124-generated-source.js';
import {prepareM1V158GeneratedGoalSubstitutions}
  from './m1-v158-dense-goal-substitutions.js';
import {prepareM1V132DenseManagerSubstitution}
  from './m1-v132-dense-manager-substitution.js';
import {prepareM1V136DenseDoubleSubstitution}
  from './m1-v136-dense-double-substitution.js';
import {prepareM1V138DenseFiveSubstitutions}
  from './m1-v138-dense-five-substitutions.js';
import {prepareM1V128ManualFictionalContinuation}
  from './m1-v128-manual-fictional-continuation.js';
import {orderM1V166CombinedCommands,
  verifyM1V166CombinedSourceClaim,
  verifyM1V180RefereeStoppageSourceClaim}
  from './m1-v166-combined-source.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';
import type {InitialCareerSave} from './save.js';
import type {M1V120Journal} from './m1-v120-playable-journal.js';

export const M1_V166_COMBINED_SCHEMA=166 as const;

/** Optional unified source. Unsupported collisions fail without changes.
 * The v158 admission remains conservative; no whistle is fabricated.
 */
export function prepareM1V166CombinedMatch(
  initial:InitialCareerSave,journal:M1V120Journal,choices:unknown,
){
  const automatic=Array.isArray(choices)&&choices.length===0;
  const first=automatic?
    prepareM1V128ManualFictionalContinuation(initial,journal):
    prepareM1V158GeneratedGoalSubstitutions(initial,journal,choices);
  const refereeOnlyStop=!automatic&&first?.ok===false&&
    first.error==='NO_GENERATED_GOAL_STOP';
  const list=Array.isArray(choices)?choices:[];
  const base=refereeOnlyStop?
    list.length===1?
      prepareM1V132DenseManagerSubstitution(initial,journal,list[0]):
    list.length===2?
      prepareM1V136DenseDoubleSubstitution(initial,journal,list):
      prepareM1V138DenseFiveSubstitutions(initial,journal,list):
    first;
  if(!base||!base.ok)return base;
  const source=base.request;
  const generated=simulateM1V19InternalReferee(
    source.prematch,source.policy);
  if(!generated.ok)
    return {ok:false as const,error:'REFEREE_SOURCE_REJECTED' as const};
  const referee=buildM1V124GeneratedCommands(
    generated.generatedIncidents,base.fixture.id);
  const substitutions=refereeOnlyStop?
    source.plannedCommands.map((raw,i)=>({
      ...(raw as Record<string,unknown>),actor:{kind:'player'},
      commandId:'v158-sub-'+base.fixture.id+'-'+i,
    })):
    source.plannedCommands as Record<string,unknown>[];
  const combined=orderM1V166CombinedCommands(referee,substitutions);
  const valid=refereeOnlyStop?
    verifyM1V180RefereeStoppageSourceClaim(
      source.prematch,source.policy,combined,base.fixture.id,
      initial.selectedClubId,initial.rngState):
    verifyM1V166CombinedSourceClaim(
      source.prematch,source.policy,combined,base.fixture.id,
      initial.selectedClubId,initial.rngState);
  if(!valid)
    return {ok:false as const,error:'COMBINED_SOURCE_REJECTED' as const};
  const result=simulateM1V105SpecialGoalChronology(
    source.prematch,source.policy,combined,[],[],[]);
  if(!result.ok)
    return {ok:false as const,error:'COMBINED_SOURCE_REJECTED' as const};
  return {...base,schemaVersion:M1_V166_COMBINED_SCHEMA,
    status:automatic?
      'REPLAY_VERIFIED_FICTIONAL_REFEREE_AUTOMATIC' as const:
      refereeOnlyStop?
      'REPLAY_VERIFIED_GENERATED_REFEREE_STOP_AND_MANAGER' as const:
      'REPLAY_VERIFIED_FICTIONAL_REFEREE_AND_MANAGER' as const,
    fictionalIncidentCount:generated.generatedIncidents.length,
    refereeAndMedicalAuthorityAuthenticated:false as const,
    fullOpponentHistoryAvailable:false as const,
    request:{...source,
      commandId:(refereeOnlyStop?'v180-ref-whistle-':
        'v166-combined-')+base.fixture.id,
      plannedCommands:combined,result}};
}
