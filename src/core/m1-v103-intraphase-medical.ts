import {sameCanonicalValue} from './canonical-value.js';
import {isStableId} from './identifiers.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {startM1PlayerControl,advanceM1PlayerControl}
  from './m1-player-control.js';
import {computeM1V5PhaseShot,M1_V5_DRAWS_PER_PHASE,
  type M1V5Shot} from './m1-phases-v5.js';
import {M1_CLOCK_MAX_EVENTS,M1_CLOCK_STEP_SECONDS,
  type M1PrematchInput} from './m1-clock.js';
import {admitM1OffFieldMedicalReturn}
  from './m1-medical-return.js';
import {simulateM1V101PhysicalIntraphase,
  type M1V101Event} from './m1-v101-physical-intraphase.js';
import type {M1V7TemporaryMedicalAction}
  from './m1-v7-temporary-medical.js';
import {M1_V99_SLOTS_PER_CHECKPOINT,M1_V99_SECONDS_PER_SLOT}
  from './m1-v99-intraphase-shots.js';
import {SeededRng,RNG_VERSION} from './rng.js';
import type {MatchLedgerReport} from './match-contracts.js';
import type {Player} from './model.js';

export const M1_V103_EVENT_SCHEMA=103 as const;
type SourceTransition=Extract<M1V101Event,{type:'physical-transition'}>;
type Exit=Extract<M1V7TemporaryMedicalAction,{kind:'treatment-exit'}>;
type Absence=Readonly<{origin:'v8'|'v103';exit:Exit}>;
export type M1V103Shot=Readonly<
  Omit<M1V5Shot,'schemaVersion'> & {schemaVersion:103}>;
export type M1V103Event=M1V103Shot |
  Readonly<{schemaVersion:103;type:'physical-transition';
    id:string;sequence:number;elapsedSeconds:number;
    source:SourceTransition['source']}> |
  Readonly<{schemaVersion:103;type:'intraphase-medical';
    id:string;sequence:number;elapsedSeconds:number;
    action:M1V7TemporaryMedicalAction}> |
  Readonly<{schemaVersion:103;type:'full-time';
    id:'m1-v103-full-time';sequence:number;elapsedSeconds:5400}>;
export type M1V103Run=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'INVALID_INTRAPHASE_SCHEDULE'|
    'SOURCE_REJECTED'|'PHYSICAL_SOURCE_CONFLICT'|'INVALID_RETURN'|
    'INVALID_CLOCK_TRANSITION'} >
  | Readonly<{ok:true;schemaVersion:103;
    status:'100_SECOND_MEDICAL_SOURCE_NOT_AUTHENTICATED_OR_PLAYABLE';
    fixtureId:string;modelRngVersion:typeof RNG_VERSION;
    rngSeed:number;rngState:number;rngDraws:number;
    sourceTransitionCount:number;intraphaseMedicalCount:number;
    events:readonly M1V103Event[];report:MatchLedgerReport;
    sourceV101PhysicalTransitionsReplayVerified:true;
    intraphasePhysicalPresenceAppliedBeforeShots:true;
    clinicalAndRefereeSourceAuthenticated:false;
    specialGoalsSupported:false;careerCASAdmissionSupported:false;
    releaseCalibrationAccepted:false}>;

const fields=['schemaVersion','id','fixtureId','teamId',
  'playerId','elapsedSeconds'];
const exitFields=[...fields,'kind','reason','restartAtRunningSeconds'];
const returnFields=[...fields,'kind','returnContext','ballInPlay',
  'entryBoundary','refereeSignalId'];
function readIntraphaseMedical(raw:unknown):M1V7TemporaryMedicalAction|null{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const action=raw as Record<string,unknown>;
  const expected=action.kind==='treatment-exit'?exitFields:
    action.kind==='treatment-return'?returnFields:[];
  if(Object.keys(action).length!==expected.length||
      !expected.every(k=>Object.hasOwn(action,k))||
      action.schemaVersion!==1||
      !isStableId(action.id)||!isStableId(action.fixtureId)||
      !isStableId(action.teamId)||!isStableId(action.playerId)||
      !Number.isSafeInteger(action.elapsedSeconds)||
      (action.elapsedSeconds as number)<=0||
      (action.elapsedSeconds as number)>=5400||
      (action.elapsedSeconds as number)%M1_V99_SECONDS_PER_SLOT!==0||
      (action.elapsedSeconds as number)%M1_CLOCK_STEP_SECONDS===0)
    return null;
  if(action.kind==='treatment-exit'){
    if(!['injury-stopped-play','medical-staff-entered',
      'requested-on-field-attention'].includes(action.reason as string)||
        !Number.isSafeInteger(action.restartAtRunningSeconds)||
        (action.restartAtRunningSeconds as number)<
          (action.elapsedSeconds as number)||
        (action.restartAtRunningSeconds as number)>=5400)
      return null;
  }else if(!['running-clock','half-time'].includes(
      action.returnContext as string)||
      typeof action.ballInPlay!=='boolean'||
      !['touchline','goal-line'].includes(action.entryBoundary as string)||
      !isStableId(action.refereeSignalId))
    return null;
  return action as M1V7TemporaryMedicalAction;
}

/** Separate schema: v8/v101 checkpoints stay unchanged, new 100s commands
 * affect only later subslots. Input authority is never authenticated here. */
export function simulateM1V103IntraphaseMedical(
  prematch:unknown,policy:unknown,plannedCommands:unknown=[],
  checkpointMedical:unknown=[],intraphaseMedical:unknown=[],
):M1V103Run{
  if(![prematch,policy,plannedCommands,checkpointMedical,
      intraphaseMedical].every(isPlainJsonTree)||
      !Array.isArray(intraphaseMedical)||intraphaseMedical.length>36)
    return {ok:false,error:'INVALID_INPUT'};
  const source=simulateM1V101PhysicalIntraphase(
    prematch,policy,plannedCommands,checkpointMedical);
  if(!source.ok)return {ok:false,error:'SOURCE_REJECTED'};
  const started=startM1PlayerControl(prematch,policy);
  if(!started.ok)return {ok:false,error:'SOURCE_REJECTED'};
  const input=prematch as M1PrematchInput;
  const actions:M1V7TemporaryMedicalAction[]=[];
  const ids=new Set<string>();
  let prev=-1;
  for(const raw of intraphaseMedical){
    const a=readIntraphaseMedical(raw);
    if(!a||a.fixtureId!==input.fixture.id||
        (a.teamId!==input.fixture.homeClubId&&
          a.teamId!==input.fixture.awayClubId)||
        a.elapsedSeconds<=prev||ids.has(a.id))
      return {ok:false,error:'INVALID_INTRAPHASE_SCHEDULE'};
    prev=a.elapsedSeconds;
    ids.add(a.id);
    actions.push(a);
  }
  const players=new Map<string,Player>(
    input.catalog.players.map(p=>[p.id,p]));
  const starters=new Set([
    ...input.homeLineup.starters,...input.awayLineup.starters]);
  const teams={home:[...input.homeLineup.starters],
    away:[...input.awayLineup.starters]};
  const absent=new Map<string,Absence>();
  const transitions=source.events.filter(
    (e):e is SourceTransition=>e.type==='physical-transition');
  const rng=new SeededRng(input.rngSeed);
  const totals={home:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0},
    away:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0}};
  const events:M1V103Event[]=[];
  let controlled=started.state,sourceIndex=0,medicalIndex=0;
  const sideFor=(teamId:string):'home'|'away'|null=>
    teamId===input.fixture.homeClubId?'home':
      teamId===input.fixture.awayClubId?'away':null;
  function checkPresence():boolean{
    for(const side of ['home','away'] as const){
      const present=teams[side].filter(id=>!absent.has(id));
      if(present.length<7||present.length>11||
          present.filter(id=>players.get(id)?.primaryPosition==='GK')
            .length!==1)return false;
    }
    return true;
  }
  function applySource(event:SourceTransition):boolean{
    const e=event.source;
    const action=e.type==='availability'?e.source.entry.action:e.action;
    const side=sideFor(action.teamId);
    if(!side)return false;
    if(e.type==='availability'){
      const a=e.source.entry.action;
      if(a.kind==='substitute-normal'){
        const at=teams[side].indexOf(a.outPlayerId);
        if(at<0||absent.has(a.outPlayerId)||
            teams[side].includes(a.inPlayerId))return false;
        teams[side][at]=a.inPlayerId;
      }else if(e.source.entry.effect!=='yellow'){
        if(!teams[side].includes(a.playerId)||
            absent.has(a.playerId))return false;
        teams[side]=teams[side].filter(id=>id!==a.playerId);
      }
    }else if(e.action.kind==='treatment-exit'){
      if(!teams[side].includes(e.action.playerId)||
          absent.has(e.action.playerId))return false;
      absent.set(e.action.playerId,{origin:'v8',exit:e.action});
    }else{
      const old=absent.get(e.action.playerId);
      if(!old||old.origin!=='v8')return false;
      absent.delete(e.action.playerId);
    }
    events.push({schemaVersion:103,type:'physical-transition',
      id:'m1-v103-source-'+event.id,sequence:events.length+1,
      elapsedSeconds:event.elapsedSeconds,source:e});
    return true;
  }
  function applyIntraphase(action:M1V7TemporaryMedicalAction):boolean{
    const side=sideFor(action.teamId);
    if(!side||!teams[side].includes(action.playerId)||
        !starters.has(action.playerId)||
        players.get(action.playerId)?.primaryPosition==='GK')return false;
    if(action.kind==='treatment-exit'){
      if(absent.has(action.playerId))return false;
      absent.set(action.playerId,{origin:'v103',exit:action});
    }else{
      const old=absent.get(action.playerId);
      if(!old||old.origin!=='v103')return false;
      const decision=admitM1OffFieldMedicalReturn(input,{
        schemaVersion:1,fixtureId:action.fixtureId,
        teamId:action.teamId,playerId:action.playerId,
        reason:old.exit.reason,
        offFieldAtRunningSeconds:old.exit.elapsedSeconds,
        restartAtRunningSeconds:old.exit.restartAtRunningSeconds,
        requestedAtRunningSeconds:action.elapsedSeconds,
        returnContext:action.returnContext,ballInPlay:action.ballInPlay,
        entryBoundary:action.entryBoundary,
        refereeSignalId:action.refereeSignalId,
      });
      if(!decision.ok)return false;
      absent.delete(action.playerId);
    }
    events.push({schemaVersion:103,type:'intraphase-medical',
      id:'m1-v103-med-'+action.id,sequence:events.length+1,
      elapsedSeconds:action.elapsedSeconds,action});
    return true;
  }
  for(let phase=0;phase<M1_CLOCK_MAX_EVENTS;phase++){
    const second=phase*M1_CLOCK_STEP_SECONDS;
    if(transitions[sourceIndex]?.elapsedSeconds<second)
      return {ok:false,error:'PHYSICAL_SOURCE_CONFLICT'};
    while(transitions[sourceIndex]?.elapsedSeconds===second){
      if(!applySource(transitions[sourceIndex]!))
        return {ok:false,error:'PHYSICAL_SOURCE_CONFLICT'};
      sourceIndex++;
    }
    for(let slot=0;slot<M1_V99_SLOTS_PER_CHECKPOINT;slot++){
      const shotSecond=second+(slot+1)*M1_V99_SECONDS_PER_SLOT-1;
      while(actions[medicalIndex]?.elapsedSeconds<=shotSecond){
        if(!applyIntraphase(actions[medicalIndex]!))
          return {ok:false,error:'INVALID_RETURN'};
        medicalIndex++;
      }
      if(!checkPresence())
        return {ok:false,error:'PHYSICAL_SOURCE_CONFLICT'};
      const present={home:teams.home.filter(id=>!absent.has(id)),
        away:teams.away.filter(id=>!absent.has(id))};
      const raw=computeM1V5PhaseShot(
        input,controlled,players,present,phase,rng,events.length+1);
      if(!raw)continue;
      const side=sideFor(raw.teamId);
      if(!side||!present[side].includes(raw.playerId)||
          players.get(raw.playerId)?.primaryPosition==='GK')
        return {ok:false,error:'PHYSICAL_SOURCE_CONFLICT'};
      const stats=totals[side];
      stats.shots++;
      stats.xgMilli+=raw.xgMilli;
      if(raw.outcome==='goal'||raw.outcome==='saved')
        stats.shotsOnTarget++;
      if(raw.outcome==='goal')stats.goals++;
      events.push({...raw,schemaVersion:103,
        id:'m1-v103-shot-'+(phase+1)+'-'+(slot+1),
        sequence:events.length+1,elapsedSeconds:shotSecond});
    }
    const next=advanceM1PlayerControl(input,policy,controlled);
    if(!next.ok)return {ok:false,error:'INVALID_CLOCK_TRANSITION'};
    controlled=next.state;
  }
  if(sourceIndex!==transitions.length||medicalIndex!==actions.length)
    return {ok:false,error:'PHYSICAL_SOURCE_CONFLICT'};
  events.push({schemaVersion:103,type:'full-time',
    id:'m1-v103-full-time',sequence:events.length+1,
    elapsedSeconds:5400});
  return {ok:true,schemaVersion:103,
    status:'100_SECOND_MEDICAL_SOURCE_NOT_AUTHENTICATED_OR_PLAYABLE',
    fixtureId:input.fixture.id,modelRngVersion:RNG_VERSION,
    rngSeed:input.rngSeed,rngState:rng.snapshot(),
    rngDraws:M1_CLOCK_MAX_EVENTS*M1_V99_SLOTS_PER_CHECKPOINT*
      M1_V5_DRAWS_PER_PHASE,
    sourceTransitionCount:transitions.length,
    intraphaseMedicalCount:actions.length,events,
    report:{fixtureId:input.fixture.id,...totals},
    sourceV101PhysicalTransitionsReplayVerified:true,
    intraphasePhysicalPresenceAppliedBeforeShots:true,
    clinicalAndRefereeSourceAuthenticated:false,
    specialGoalsSupported:false,careerCASAdmissionSupported:false,
    releaseCalibrationAccepted:false};
}

export function verifyM1V103IntraphaseMedical(
  prematch:unknown,policy:unknown,plannedCommands:unknown,
  checkpointMedical:unknown,intraphaseMedical:unknown,candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const replay=simulateM1V103IntraphaseMedical(
    prematch,policy,plannedCommands,checkpointMedical,intraphaseMedical);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
