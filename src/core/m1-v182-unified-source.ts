import {sameCanonicalValue} from './canonical-value.js';
import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {simulateM1V23TemporaryTreatment,
  simulateM1V29CausalMedicalSource,type M1V29CausalSourceRun}
  from './m1-v23-temporary-treatment.js';
import {buildM1V124GeneratedCommands}
  from './m1-v124-generated-source.js';
import {orderM1V166CombinedCommands}
  from './m1-v166-combined-source.js';
import {verifyM1V158CommandShape}
  from './m1-v158-generated-goal-stops.js';
import {simulateM1V105SpecialGoalChronology,
  type M1V105Run}
  from './m1-v105-special-goal-chronology.js';

type Command=Readonly<Record<string,unknown>>;
const valid=(value:unknown):value is Command=>
  value!==null&&typeof value==='object'&&!Array.isArray(value);

type Causal=Extract<M1V29CausalSourceRun,{ok:true}>;
type Replay=Extract<M1V105Run,{ok:true}>;

/** The causal victim evidence must also be visible in the persisted
 * v105 physical source, not only in v29's independent diagnostic IDs.
 */
function causalWitness(source:Causal,result:Replay):boolean{
  const medical=source.syntheticTreatmentActions;
  const assessments=source.causalAssessments;
  const departures=assessments.filter(a=>
    a.transition==='off-field-return');
  if(medical.length!==departures.length*2)return false;
  const hasMedical=(action:typeof medical[number])=>
    result.events.some(event=>
      event.type==='source'&&
      event.source.type==='physical-transition'&&
      event.source.source.type==='medical'&&
      event.source.source.action.id===action.id&&
      event.source.source.action.kind===action.kind&&
      event.source.source.action.teamId===action.teamId&&
      event.source.source.action.playerId===action.playerId&&
      event.elapsedSeconds===action.elapsedSeconds);
  for(const assessment of assessments){
    const incident=source.generatedIncidents.find(i=>
      i.id===assessment.incidentId);
    if(!incident||incident.teamId===assessment.patientTeamId||
        incident.elapsedSeconds!==assessment.elapsedSeconds||
        incident.sanction==='injury-withdrawal')return false;
    const referee=result.events.find(event=>{
      if(event.type!=='source'||
          event.source.type!=='physical-transition'||
          event.source.source.type!=='availability')return false;
      const action=event.source.source.source.entry.action;
      return 'id' in action&&
        'playerId' in action&&
        action.id===incident.decisionId&&
        action.teamId===incident.teamId&&
        action.playerId===incident.playerId&&
        event.elapsedSeconds===assessment.elapsedSeconds;
    });
    if(!referee)return false;
    const exits=medical.filter(action=>
      action.kind==='treatment-exit'&&
      action.teamId===assessment.patientTeamId&&
      action.playerId===assessment.patientPlayerId&&
      action.elapsedSeconds===assessment.elapsedSeconds);
    if(assessment.transition==='on-field-quick'){
      if(exits.length!==0)return false;
      continue;
    }
    if(exits.length!==1)return false;
    const exit=exits[0]!;
    const returns=medical.filter(action=>
      action.kind==='treatment-return'&&
      action.teamId===assessment.patientTeamId&&
      action.playerId===assessment.patientPlayerId&&
      action.elapsedSeconds===assessment.elapsedSeconds+300);
    if(returns.length!==1||!hasMedical(exit)||
        !hasMedical(returns[0]!))return false;
    const departureEvent=result.events.find(event=>
      event.type==='source'&&
      event.source.type==='physical-transition'&&
      event.source.source.type==='medical'&&
      event.source.source.action.id===exit.id);
    if(!departureEvent||referee.sequence>=departureEvent.sequence)
      return false;
  }
  return true;
}

/** One causal referee, medical and manager source. v23 updates the
 * live physical XI before selecting future incidents.
 */
function regenerateUnifiedSource(
  prematch:unknown,policy:unknown,manager:unknown,causal:boolean,
){
  if(!isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
      !isPlainJsonTree(manager)||!Array.isArray(manager)||
      manager.length>5||manager.some(command=>
        !valid(command)||command.kind!=='substitute-normal'))
    return {ok:false as const,error:'INVALID_MANAGER_SOURCE' as const};
  const changes=manager as Command[];
  const half=changes.filter(c=>c.elapsedSeconds===2700);
  const inPlay=changes.filter(c=>c.elapsedSeconds!==2700);
  const generated=causal?
    simulateM1V29CausalMedicalSource(prematch,policy,half,inPlay):
    simulateM1V23TemporaryTreatment(prematch,policy,half,inPlay);
  if(!generated.ok)
    return {ok:false as const,error:'UNIFIED_GENERATION_REJECTED' as const};
  const causalGenerated='causalAssessments' in generated&&
    Array.isArray(generated.causalAssessments)?
      generated as Causal:null;
  if(causal&&!causalGenerated)
    return {ok:false as const,error:'UNIFIED_GENERATION_REJECTED' as const};
  const referee=buildM1V124GeneratedCommands(
    generated.generatedIncidents,generated.fixtureId);
  const plannedCommands=orderM1V166CombinedCommands(referee,changes);
  if(plannedCommands.length>275)
    return {ok:false as const,error:'SOURCE_EVENT_BUDGET' as const};
  const checkpointMedical=[...generated.syntheticTreatmentActions];
  const result=simulateM1V105SpecialGoalChronology(
    prematch,policy,plannedCommands,checkpointMedical,[],[]);
  if(!result.ok||
      (causal&&causalGenerated!==null&&
       !causalWitness(causalGenerated,result)))
    return {ok:false as const,error:'UNIFIED_REPLAY_REJECTED' as const};
  return {ok:true as const,sourceFixtureId:generated.fixtureId,
    plannedCommands,checkpointMedical,
    generatedIncidents:[...generated.generatedIncidents],
    temporaryExitCount:generated.syntheticTemporaryExitCount,
    temporaryReturnCount:generated.syntheticTemporaryReturnCount,
    result,
    ...(causalGenerated!==null&&causal?
      {causalAssessments:causalGenerated.causalAssessments}:{}),
  };
}

export function regenerateM1V182UnifiedSource(
  prematch:unknown,policy:unknown,manager:unknown,
){
  return regenerateUnifiedSource(prematch,policy,manager,false);
}

/** Causal patient is selected at the original whistle before substitutions.
 * Versioned separately so old persisted v182 histories never change.
 */
export function regenerateM1V184CausalSource(
  prematch:unknown,policy:unknown,manager:unknown,
){
  return regenerateUnifiedSource(prematch,policy,manager,true);
}

/** Canonical v182 claim is independently replayed before v120 CAS.
 * Internal source decisions are fictional, never external authority.
 */
function verifyUnifiedSourceClaim(
  prematch:unknown,policy:unknown,planned:unknown,medical:unknown,
  fixtureId:string,selectedClubId:string,careerSeed:number,
  causal:boolean,
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
        c.commandId!==(causal?'v184-sub-':'v182-sub-')+fixtureId+'-'+i))
    return false;
  if(substitutions.length>0){
    const shaped=substitutions.map((c,i)=>({
      ...c,commandId:'v158-sub-'+fixtureId+'-'+i,
    }));
    if(!verifyM1V158CommandShape(
      prematch,policy,shaped,fixtureId,selectedClubId,careerSeed))
      return false;
  }
  const expected=regenerateUnifiedSource(
    prematch,policy,substitutions,causal);
  return expected.ok&&expected.sourceFixtureId===fixtureId&&
    sameCanonicalValue(expected.plannedCommands,planned)&&
    sameCanonicalValue(expected.checkpointMedical,medical);
}

export function verifyM1V182UnifiedSourceClaim(
  prematch:unknown,policy:unknown,planned:unknown,medical:unknown,
  fixtureId:string,selectedClubId:string,careerSeed:number,
):boolean{
  return verifyUnifiedSourceClaim(prematch,policy,planned,medical,
    fixtureId,selectedClubId,careerSeed,false);
}

export function verifyM1V184CausalSourceClaim(
  prematch:unknown,policy:unknown,planned:unknown,medical:unknown,
  fixtureId:string,selectedClubId:string,careerSeed:number,
):boolean{
  return verifyUnifiedSourceClaim(prematch,policy,planned,medical,
    fixtureId,selectedClubId,careerSeed,true);
}
