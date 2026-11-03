import {isPlainJsonTree} from './plain-json-tree.js';
import type {M1V29CausalSourceRun}
  from './m1-v23-temporary-treatment.js';
import type {M1V105Run}
  from './m1-v105-special-goal-chronology.js';

/** 2026/27 Law 5: the injured victim of a physical offence for which
 * the opponent is cautioned or sent off may remain on the pitch.
 * This is an internally generated source decision, not clinical authority.
 */
export const M1_V186_LAW5_SCHEMA=186 as const;
export interface M1V186Law5Evidence {
  readonly incidentId:string;
  readonly decisionEventId:string;
  readonly whistleEventId:string;
  readonly restartEventId:string;
  readonly offenderTeamId:string;
  readonly offenderPlayerId:string;
  readonly patientTeamId:string;
  readonly patientPlayerId:string;
  readonly runningSeconds:number;
  readonly exception:'opponent-carded-physical-offence';
  readonly modelledDisposition:'may-remain-after-assessment'|
    'voluntary-extended-off-field-assessment';
  readonly exitEventId:string|null;
  readonly returnEventId:string|null;
  readonly minimumRunningSecondsSatisfied:boolean;
}
export type M1V186Law5Result=
  | Readonly<{ok:false;error:'INVALID_CAUSAL_SOURCE'|
    'UNSUPPORTED_LAW5_ORIGIN'|'INVALID_MEDICAL_CHRONOLOGY'}>
  | Readonly<{ok:true;schemaVersion:186;
    status:'SOURCE_BOUND_LAW5_PHYSICAL_OFFENCE_SUBSET';
    evidence:readonly M1V186Law5Evidence[];
    physicalOffenceExceptionSourceVerified:true;
    otherLaw5ExceptionsSupported:false;
    bleedingClearanceAuthenticated:false;
    refereeAuthorityAuthenticated:false;
    externalMedicalAuthorityAuthenticated:false}>;

const fail=(error:Extract<M1V186Law5Result,{ok:false}>['error']):
  M1V186Law5Result=>({ok:false,error});

/** This is called on the EXACT seeded v29 and persisted v105 replay.
 * Caller-provided medical/referee labels cannot authorize a return.
 */
export function deriveM1V186Law5FromCausalSource(
  source:M1V29CausalSourceRun,result:M1V105Run,
):M1V186Law5Result {
  if(!isPlainJsonTree(source)||!isPlainJsonTree(result)||
      !source.ok||!result.ok||
      source.fixtureId!==result.fixtureId)
    return fail('INVALID_CAUSAL_SOURCE');
  const medical=source.syntheticTreatmentActions;
  const evidence:M1V186Law5Evidence[]=[];
  const visited=new Set<string>();
  const exits=medical.filter(a=>a.kind==='treatment-exit');
  const returns=medical.filter(a=>a.kind==='treatment-return');
  const absentEvents=(patientId:string,start:number,end:number)=>
    result.events.some(e=>e.elapsedSeconds>=start&&
      e.elapsedSeconds<end&&(
        e.type==='adjudication'&&e.decision.playerId===patientId||
        e.type==='source'&&e.source.type==='shot'&&
          e.source.playerId===patientId));
  const physicalEvent=(action:typeof medical[number])=>
    result.events.find(e=>
      e.type==='source'&&e.source.type==='physical-transition'&&
      e.source.source.type==='medical'&&
      e.source.source.action.id===action.id&&
      e.source.source.action.teamId===action.teamId&&
      e.source.source.action.playerId===action.playerId&&
      e.source.source.action.kind===action.kind&&
      e.elapsedSeconds===action.elapsedSeconds);
  for(const assessment of source.causalAssessments){
    const incident=source.generatedIncidents.find(i=>
      i.id===assessment.incidentId);
    if(!incident||visited.has(incident.id)||
        incident.teamId===assessment.patientTeamId||
        !['reckless-challenge','serious-foul-play'].includes(
          incident.offence)||
        !['caution','direct-red'].includes(incident.sanction))
      return fail('UNSUPPORTED_LAW5_ORIGIN');
    visited.add(incident.id);
    const decision=source.match.events.find(e=>
      e.id===incident.sourceEventId);
    const whistle=source.match.events.find(e=>
      e.id===assessment.foulWhistleEventId&&
      e.kind==='synthetic-foul-whistle');
    const restart=source.match.events.find(e=>
      e.id===assessment.foulRestartEventId&&
      e.kind==='synthetic-foul-restart');
    if(!decision||!whistle||!restart||
        decision.id!==assessment.offenderSourceEventId||
        decision.teamId!==incident.teamId||
        decision.playerId!==incident.playerId||
        whistle.sourceEventId!==decision.sourceEventId||
        restart.sourceEventId!==decision.sourceEventId||
        whistle.runningSeconds!==assessment.elapsedSeconds||
        decision.runningSeconds!==assessment.elapsedSeconds||
        restart.runningSeconds!==assessment.elapsedSeconds||
        assessment.elapsedSeconds!==incident.elapsedSeconds||
        !['caution','second-yellow-dismissal',
          'straight-red-dismissal'].includes(decision.kind))
      return fail('INVALID_MEDICAL_CHRONOLOGY');
    const patientSide=whistle.onField.home.includes(
      assessment.patientPlayerId)?'home':
      whistle.onField.away.includes(assessment.patientPlayerId)?'away':null;
    if(!patientSide||
        !whistle.onField[patientSide==='home'?'away':'home']
          .includes(incident.playerId))
      return fail('INVALID_MEDICAL_CHRONOLOGY');
    const savedDecision=result.events.find(e=>{
      if(e.type!=='source'||e.source.type!=='physical-transition'||
          e.source.source.type!=='availability')return false;
      const action=e.source.source.source.entry.action;
      return 'id' in action&&'playerId' in action&&
        action.id===incident.decisionId&&
        action.teamId===incident.teamId&&
        action.playerId===incident.playerId&&
        e.elapsedSeconds===assessment.elapsedSeconds;
    });
    if(!savedDecision)return fail('INVALID_MEDICAL_CHRONOLOGY');
    const leave=exits.filter(e=>
      e.teamId===assessment.patientTeamId&&
      e.playerId===assessment.patientPlayerId&&
      e.elapsedSeconds===assessment.elapsedSeconds);
    const back=returns.filter(e=>
      e.teamId===assessment.patientTeamId&&
      e.playerId===assessment.patientPlayerId&&
      e.elapsedSeconds===assessment.elapsedSeconds+300);
    if(assessment.transition==='on-field-quick'){
      if(leave.length!==0||back.length!==0||
          !restart.onField[patientSide].includes(
            assessment.patientPlayerId))
        return fail('INVALID_MEDICAL_CHRONOLOGY');
      evidence.push({incidentId:incident.id,decisionEventId:decision.id,
        whistleEventId:whistle.id,restartEventId:restart.id,
        offenderTeamId:incident.teamId,offenderPlayerId:incident.playerId,
        patientTeamId:assessment.patientTeamId,
        patientPlayerId:assessment.patientPlayerId,
        runningSeconds:assessment.elapsedSeconds,
        exception:'opponent-carded-physical-offence',
        modelledDisposition:'may-remain-after-assessment',
        exitEventId:null,returnEventId:null,
        minimumRunningSecondsSatisfied:true});
      continue;
    }
    if(assessment.transition!=='off-field-return'||
        leave.length!==1||back.length!==1)
      return fail('INVALID_MEDICAL_CHRONOLOGY');
    const exit=leave[0]!,entry=back[0]!;
    const exitEvent=physicalEvent(exit),returnEvent=physicalEvent(entry);
    if(!exitEvent||!returnEvent||
        savedDecision.sequence>=exitEvent.sequence||
        exitEvent.sequence>=returnEvent.sequence||
        entry.elapsedSeconds-restart.runningSeconds<60||
        entry.returnContext!=='running-clock'||
        entry.ballInPlay!==true||entry.entryBoundary!=='touchline'||
        typeof entry.refereeSignalId!=='string'||
        !entry.refereeSignalId.startsWith('m1-v23-unverified-')||
        restart.onField[patientSide].includes(
          assessment.patientPlayerId)||
        absentEvents(assessment.patientPlayerId,exit.elapsedSeconds,
          entry.elapsedSeconds))
      return fail('INVALID_MEDICAL_CHRONOLOGY');
    evidence.push({incidentId:incident.id,decisionEventId:decision.id,
      whistleEventId:whistle.id,restartEventId:restart.id,
      offenderTeamId:incident.teamId,offenderPlayerId:incident.playerId,
      patientTeamId:assessment.patientTeamId,
      patientPlayerId:assessment.patientPlayerId,
      runningSeconds:assessment.elapsedSeconds,
      exception:'opponent-carded-physical-offence',
      modelledDisposition:'voluntary-extended-off-field-assessment',
      exitEventId:exitEvent.id,returnEventId:returnEvent.id,
      minimumRunningSecondsSatisfied:true});
  }
  const departures=evidence.filter(e=>e.exitEventId!==null).length;
  if(departures!==exits.length||departures!==returns.length||
      evidence.length!==source.causalAssessments.length)
    return fail('INVALID_MEDICAL_CHRONOLOGY');
  return {ok:true,schemaVersion:M1_V186_LAW5_SCHEMA,
    status:'SOURCE_BOUND_LAW5_PHYSICAL_OFFENCE_SUBSET',
    evidence,physicalOffenceExceptionSourceVerified:true,
    otherLaw5ExceptionsSupported:false,
    bleedingClearanceAuthenticated:false,
    refereeAuthorityAuthenticated:false,
    externalMedicalAuthorityAuthenticated:false};
}
