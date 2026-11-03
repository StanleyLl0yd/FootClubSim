import {sameCanonicalValue} from './canonical-value.js';
import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {simulateM1V23TemporaryTreatment}
  from './m1-v23-temporary-treatment.js';
import {buildM1V124GeneratedCommands}
  from './m1-v124-generated-source.js';
import {orderM1V166CombinedCommands}
  from './m1-v166-combined-source.js';
import {verifyM1V158CommandShape}
  from './m1-v158-generated-goal-stops.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';

type Command=Readonly<Record<string,unknown>>;
const valid=(value:unknown):value is Command=>
  value!==null&&typeof value==='object'&&!Array.isArray(value);

/** One causal referee, medical and manager source. v23 updates the
 * live physical XI before selecting future incidents.
 */
export function regenerateM1V182UnifiedSource(
  prematch:unknown,policy:unknown,manager:unknown,
){
  if(!isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
      !isPlainJsonTree(manager)||!Array.isArray(manager)||
      manager.length>5||manager.some(command=>
        !valid(command)||command.kind!=='substitute-normal'))
    return {ok:false as const,error:'INVALID_MANAGER_SOURCE' as const};
  const changes=manager as Command[];
  const half=changes.filter(c=>c.elapsedSeconds===2700);
  const inPlay=changes.filter(c=>c.elapsedSeconds!==2700);
  const generated=simulateM1V23TemporaryTreatment(
    prematch,policy,half,inPlay);
  if(!generated.ok)
    return {ok:false as const,error:'UNIFIED_GENERATION_REJECTED' as const};
  const referee=buildM1V124GeneratedCommands(
    generated.generatedIncidents,generated.fixtureId);
  const plannedCommands=orderM1V166CombinedCommands(referee,changes);
  if(plannedCommands.length>275)
    return {ok:false as const,error:'SOURCE_EVENT_BUDGET' as const};
  const checkpointMedical=[...generated.syntheticTreatmentActions];
  const result=simulateM1V105SpecialGoalChronology(
    prematch,policy,plannedCommands,checkpointMedical,[],[]);
  if(!result.ok)
    return {ok:false as const,error:'UNIFIED_REPLAY_REJECTED' as const};
  return {ok:true as const,sourceFixtureId:generated.fixtureId,
    plannedCommands,checkpointMedical,
    generatedIncidents:[...generated.generatedIncidents],
    temporaryExitCount:generated.syntheticTemporaryExitCount,
    temporaryReturnCount:generated.syntheticTemporaryReturnCount,
    result};
}

/** Canonical v182 claim is independently replayed before v120 CAS.
 * Internal source decisions are fictional, never external authority.
 */
export function verifyM1V182UnifiedSourceClaim(
  prematch:unknown,policy:unknown,planned:unknown,medical:unknown,
  fixtureId:string,selectedClubId:string,careerSeed:number,
):boolean{
  if(typeof fixtureId!=='string'||!fixtureId||
      typeof selectedClubId!=='string'||!selectedClubId||
      !Number.isSafeInteger(careerSeed)||careerSeed<0||
      careerSeed>0xffffffff||
      !isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
      !isPlainJsonTree(planned)||!isPlainJsonTree(medical)||
      !Array.isArray(planned)||!Array.isArray(medical)||
      planned.length>275||!valid(prematch)||
      !valid(prematch.fixture)||
      prematch.fixture.id!==fixtureId||
      prematch.rngSeed!==deriveM1FixtureSeed(careerSeed,fixtureId))
    return false;
  const substitutions=(planned as Command[]).filter(c=>
    c?.kind==='substitute-normal');
  if(substitutions.length>5||
      substitutions.some((c,i)=>
        c.commandId!=='v182-sub-'+fixtureId+'-'+i))
    return false;
  if(substitutions.length>0){
    const shaped=substitutions.map((c,i)=>({
      ...c,commandId:'v158-sub-'+fixtureId+'-'+i,
    }));
    if(!verifyM1V158CommandShape(
      prematch,policy,shaped,fixtureId,selectedClubId,careerSeed))
      return false;
  }
  const expected=regenerateM1V182UnifiedSource(
    prematch,policy,substitutions);
  return expected.ok&&expected.sourceFixtureId===fixtureId&&
    sameCanonicalValue(expected.plannedCommands,planned)&&
    sameCanonicalValue(expected.checkpointMedical,medical);
}
