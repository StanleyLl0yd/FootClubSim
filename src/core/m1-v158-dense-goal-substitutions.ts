import {prepareM1V138DenseFiveSubstitutions}
  from './m1-v138-dense-five-substitutions.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';
import {verifyM1V158SourceClaim}
  from './m1-v158-generated-goal-stops.js';
import type {M1V120Journal} from './m1-v120-playable-journal.js';
import type {InitialCareerSave} from './save.js';

export const M1_V158_GOAL_STOP_SCHEMA=158 as const;

/** An opt-in v138 path: in-play changes need a generated fictional
 * goal restart, while the half-time opportunity is statutory.
 */
export function prepareM1V158GeneratedGoalSubstitutions(
  initial:InitialCareerSave,journal:M1V120Journal,choices:unknown,
){
  const base=prepareM1V138DenseFiveSubstitutions(
    initial,journal,choices);
  if(!base||!base.ok)return base;
  const fixtureId=base.fixture.id;
  const plannedCommands=base.request.plannedCommands.map((raw,i)=>({
    ...(raw as Record<string,unknown>),
    actor:{kind:'player'},
    commandId:'v158-sub-'+fixtureId+'-'+i,
  }));
  if(!verifyM1V158SourceClaim(
    base.request.prematch,base.request.policy,plannedCommands,
    fixtureId,initial.selectedClubId,initial.rngState))
    return {ok:false as const,error:'NO_GENERATED_GOAL_STOP' as const};
  const result=simulateM1V105SpecialGoalChronology(
    base.request.prematch,base.request.policy,plannedCommands,[],[],[]);
  if(!result.ok)
    return {ok:false as const,error:'SOURCE_REPLAY_REJECTED' as const};
  return {...base,schemaVersion:M1_V158_GOAL_STOP_SCHEMA,
    status:'SOURCE_REPLAYED_FICTIONAL_GOAL_STOP_SUBSTITUTIONS' as const,
    internalGeneratedGoalStopsVerified:true as const,
    request:{...base.request,
      commandId:'v158-goal-multi-'+fixtureId,
      plannedCommands,result}};
}
