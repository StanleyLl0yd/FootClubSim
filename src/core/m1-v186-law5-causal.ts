import {isPlainJsonTree} from './plain-json-tree.js';
import {startM1Clock,type M1PrematchInput} from './m1-clock.js';
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
  readonly exception:'opponent-carded-physical-offence'|
    'goalkeeper-on-field-assessment'|'same-whistle-second-patient'|
    'source-modelled-same-team-collision'|
    'source-modelled-keeper-outfield-collision';
  readonly sameWhistlePairOrdinal?:2;
  readonly sourceCollisionEventId?:string;
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
  prematch:unknown=undefined,
):M1V186Law5Result {
  if(!isPlainJsonTree(source)||!isPlainJsonTree(result)||
      !source.ok||!result.ok||
      source.fixtureId!==result.fixtureId)
    return fail('INVALID_CAUSAL_SOURCE');
  const keeperEvidenceRequired=source.causalAssessments.some(a=>
    a.goalkeeperExceptionSource===true||a.collisionOriginSource===true);
  let keepers:ReadonlySet<string>=new Set();
  if(keeperEvidenceRequired){
    if(!isPlainJsonTree(prematch)||!startM1Clock(prematch).ok)
      return fail('UNSUPPORTED_LAW5_ORIGIN');
    const input=prematch as M1PrematchInput;
    if(input.fixture.id!==source.fixtureId)
      return fail('UNSUPPORTED_LAW5_ORIGIN');
    keepers=new Set(input.catalog.players.filter(p=>
      p.primaryPosition==='GK').map(p=>p.id));
  }
  const medical=source.syntheticTreatmentActions;
  const evidence:M1V186Law5Evidence[]=[];
  const inspectedPatients=new Map<string,readonly string[]>();
  const inspectedCollisions=new Set<string>();
  const collisionEvents=source.match.events.filter(e=>
    e.kind==='synthetic-same-team-collision');
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
    const prior=incident?
      inspectedPatients.get(incident.id)??[]:[];
    const second=assessment.sameWhistleSecondPatient===true;
    if(!incident||
        (second?prior.length!==1:prior.length!==0)||
        prior.includes(assessment.patientPlayerId)||
        incident.teamId===assessment.patientTeamId||
        !['reckless-challenge','serious-foul-play'].includes(
          incident.offence)||
        !['caution','direct-red'].includes(incident.sanction))
      return fail('UNSUPPORTED_LAW5_ORIGIN');
    inspectedPatients.set(incident.id,[...prior,assessment.patientPlayerId]);
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
    let collisionEventId:string|undefined;
    let collisionException:
      'source-modelled-same-team-collision'|
      'source-modelled-keeper-outfield-collision'|undefined;
    if(assessment.collisionOriginSource===true){
      const paired=source.causalAssessments.filter(a=>
        a.incidentId===incident.id);
      const collision=source.match.events.find(e=>
        e.id===assessment.collisionEventId&&
        e.kind==='synthetic-same-team-collision');
      const clubs=(prematch as M1PrematchInput).fixture;
      const collisionSide=collision?.teamId===clubs.homeClubId?'home':
        collision?.teamId===clubs.awayClubId?'away':null;
      const otherSide=collisionSide==='home'?'away':'home';
      if(paired.length!==2||
          paired.some(a=>a.collisionOriginSource!==true||
            a.collisionEventId!==assessment.collisionEventId)||
          paired[0]!.patientPlayerId===paired[1]!.patientPlayerId||
          !paired[1]!.sameWhistleSecondPatient||
          !collision||collision.teamId!==assessment.patientTeamId||
          collision.playerId!==paired[0]!.patientPlayerId||
          collision.collisionPartnerPlayerId!==paired[1]!.patientPlayerId||
          collision.sourceEventId!==decision.sourceEventId||
          collision.runningSeconds!==assessment.elapsedSeconds||
          collision.sequence<=whistle.sequence||
          collision.sequence>=decision.sequence||
          !collisionSide||
          !Array.isArray(collision.onField[collisionSide])||
          !Array.isArray(collision.onField[otherSide])||
          !collision.onField[collisionSide].includes(
            paired[0]!.patientPlayerId)||
          !collision.onField[collisionSide].includes(
            paired[1]!.patientPlayerId)||
          collision.onField[otherSide].includes(
            paired[0]!.patientPlayerId)||
          collision.onField[otherSide].includes(
            paired[1]!.patientPlayerId))
        return fail('UNSUPPORTED_LAW5_ORIGIN');
      collisionEventId=collision.id;
      inspectedCollisions.add(collision.id);
      collisionException=
        keepers.has(paired[0]!.patientPlayerId)||
        keepers.has(paired[1]!.patientPlayerId)?
          'source-modelled-keeper-outfield-collision':
          'source-modelled-same-team-collision';
    }else if(assessment.collisionEventId!==undefined)
      return fail('UNSUPPORTED_LAW5_ORIGIN');
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
    if(assessment.goalkeeperExceptionSource===true&&
        (!keepers.has(assessment.patientPlayerId)||
          assessment.transition!=='on-field-quick'))
      return fail('UNSUPPORTED_LAW5_ORIGIN');
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
        exception:collisionException??(assessment.goalkeeperExceptionSource===true?
          'goalkeeper-on-field-assessment':second?
          'same-whistle-second-patient':
          'opponent-carded-physical-offence'),
        ...(second?{sameWhistlePairOrdinal:2 as const}:{}),
        ...(collisionEventId?{sourceCollisionEventId:collisionEventId}:{}),
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
      exception:collisionException??(second?'same-whistle-second-patient':
        'opponent-carded-physical-offence'),
      ...(second?{sameWhistlePairOrdinal:2 as const}:{}),
      ...(collisionEventId?{sourceCollisionEventId:collisionEventId}:{}),
      modelledDisposition:'voluntary-extended-off-field-assessment',
      exitEventId:exitEvent.id,returnEventId:returnEvent.id,
      minimumRunningSecondsSatisfied:true});
  }
  const departures=evidence.filter(e=>e.exitEventId!==null).length;
  if(departures!==exits.length||departures!==returns.length||
      evidence.length!==source.causalAssessments.length||
      inspectedCollisions.size!==collisionEvents.length)
    return fail('INVALID_MEDICAL_CHRONOLOGY');
  return {ok:true,schemaVersion:M1_V186_LAW5_SCHEMA,
    status:'SOURCE_BOUND_LAW5_PHYSICAL_OFFENCE_SUBSET',
    evidence,physicalOffenceExceptionSourceVerified:true,
    otherLaw5ExceptionsSupported:false,
    bleedingClearanceAuthenticated:false,
    refereeAuthorityAuthenticated:false,
    externalMedicalAuthorityAuthenticated:false};
}
