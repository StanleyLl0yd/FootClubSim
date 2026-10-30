import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {simulateM1V103IntraphaseMedical,
  type M1V103Event} from './m1-v103-intraphase-medical.js';
import {simulateM1V8MedicalPhases,
  type M1V8Event} from './m1-v8-medical-phases.js';
import type {M1V7Decision,M1V7Report,M1V7TeamReport}
  from './m1-v7-adjudications.js';
import type {M1PrematchInput} from './m1-clock.js';

/** Source-replayed research chronology, not official referee provenance. */
export const M1_V105_SCHEMA=105 as const;
export type M1V105Event=
  | Readonly<{schemaVersion:105;type:'source';id:string;
      sequence:number;elapsedSeconds:number;source:M1V103Event}>
  | Readonly<{schemaVersion:105;type:'adjudication';id:string;
      sequence:number;elapsedSeconds:number;decision:M1V7Decision}>;
export type M1V105Run=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'V103_SOURCE_REJECTED'|
      'V8_ADJUDICATION_REJECTED'|'PHYSICAL_SOURCE_MISMATCH'|
      'INVALID_EVENT_CHRONOLOGY'|'SPECIAL_GOAL_PARTICIPANT_ABSENT'|
      'DUPLICATE_SOURCE_IDENTIFIER'}>
  | Readonly<{ok:true;schemaVersion:105;
      status:'REPLAY_GATED_SPECIAL_GOALS_WITHOUT_TRUSTED_REFEREE';
      fixtureId:string;sourceV103ReplayVerified:true;
      specialDecisionSourceV8ReplayVerified:true;
      rngDraws:270;rngState:number;events:readonly M1V105Event[];
      report:M1V7Report;specialDecisionCount:number;
      refereeAndPhysicianAuthorityAuthenticated:false;
      arbitrarySecondSpecialDecisionsSupported:false;
      careerCASAdmissionSupported:false;releaseCalibrationAccepted:false}>;

type Transition=Extract<M1V103Event,{type:'physical-transition'}>;
type V8Physical=Extract<M1V8Event,{type:'availability'|'medical'}>;
function physicalKey(event:V8Physical):unknown{
  if(event.type==='availability')
    return {type:event.type,time:event.elapsedSeconds,entry:event.source.entry};
  return {type:event.type,time:event.elapsedSeconds,action:event.action};
}
function sourcePhysicalKey(event:Transition):unknown{
  return physicalKey(event.source);
}
const stats=(s:Readonly<{goals:number;shots:number;
  shotsOnTarget:number;xgMilli:number}>):M1V7TeamReport=>({
    ...s,openPlayGoals:s.goals,penaltiesTaken:0,penaltyGoals:0,
    ownGoalsFor:0,xgCoverage:'open-play-only',
  });
type MutableStats={-readonly [K in keyof M1V7TeamReport]:M1V7TeamReport[K]};

export function simulateM1V105SpecialGoalChronology(
  prematch:unknown,policy:unknown,plannedCommands:unknown=[],
  checkpointMedical:unknown=[],intraphaseMedical:unknown=[],
  trustedDecisions:unknown=[],
):M1V105Run{
  if(![prematch,policy,plannedCommands,checkpointMedical,
      intraphaseMedical,trustedDecisions].every(isPlainJsonTree)||
      !Array.isArray(trustedDecisions)||trustedDecisions.length>18)
    return {ok:false,error:'INVALID_INPUT'};
  const physical=simulateM1V103IntraphaseMedical(prematch,policy,
    plannedCommands,checkpointMedical,intraphaseMedical);
  if(!physical.ok)return {ok:false,error:'V103_SOURCE_REJECTED'};
  const adjudicated=simulateM1V8MedicalPhases(prematch,policy,
    plannedCommands,trustedDecisions,checkpointMedical);
  if(!adjudicated.ok)return {ok:false,error:'V8_ADJUDICATION_REJECTED'};
  const sourceTransitions=physical.events.filter(
    (e):e is Transition=>e.type==='physical-transition');
  const v8Transitions=adjudicated.events.filter(
    (e):e is V8Physical=>e.type==='availability'||e.type==='medical');
  if(!sameCanonicalValue(sourceTransitions.map(sourcePhysicalKey),
      v8Transitions.map(physicalKey)))
    return {ok:false,error:'PHYSICAL_SOURCE_MISMATCH'};
  const adjudications=adjudicated.events.filter(
    (e):e is Extract<M1V8Event,{type:'adjudication'}>=>
      e.type==='adjudication');
  const ids=new Set(physical.events.filter(e=>e.type==='intraphase-medical')
    .map(e=>e.action.id));
  for(const e of adjudications){
    if(ids.has(e.decision.decisionId))
      return {ok:false,error:'DUPLICATE_SOURCE_IDENTIFIER'};
    ids.add(e.decision.decisionId);
  }
  const input=prematch as M1PrematchInput;
  const teams={
    home:[...input.homeLineup.starters],
    away:[...input.awayLineup.starters],
  };
  const absent=new Set<string>();
  const totals:{home:MutableStats;away:MutableStats}={
    home:stats(physical.report.home),away:stats(physical.report.away)};
  const sideFor=(teamId:string):'home'|'away'|null=>
    teamId===input.fixture.homeClubId?'home':
      teamId===input.fixture.awayClubId?'away':null;
  const active=(side:'home'|'away',id:string)=>
    teams[side].includes(id)&&!absent.has(id);
  const combined=[
    ...physical.events.map((source,i)=>({kind:'source' as const,
      time:source.elapsedSeconds,priority:source.type==='physical-transition'?0:2,
      index:i,source})),
    ...adjudications.map((entry,i)=>({kind:'decision' as const,
      time:entry.elapsedSeconds,priority:1,index:i,entry})),
  ].sort((a,b)=>a.time-b.time||a.priority-b.priority||a.index-b.index);
  const events:M1V105Event[]=[];
  function sourceTransition(e:Transition):boolean{
    const t=e.source;
    const action=t.type==='availability'?t.source.entry.action:t.action;
    const side=sideFor(action.teamId);
    if(!side)return false;
    if(t.type==='availability'){
      const a=t.source.entry.action;
      if(a.kind==='substitute-normal'){
        const at=teams[side].indexOf(a.outPlayerId);
        if(at<0||absent.has(a.outPlayerId)||
            teams[side].includes(a.inPlayerId))return false;
        teams[side][at]=a.inPlayerId;
      }else if(t.source.entry.effect!=='yellow'){
        if(!active(side,a.playerId))return false;
        teams[side]=teams[side].filter(id=>id!==a.playerId);
      }
    }else if(t.action.kind==='treatment-exit'){
      if(!active(side,t.action.playerId))return false;
      absent.add(t.action.playerId);
    }else if(!absent.delete(t.action.playerId))return false;
    return true;
  }
  function intraphase(e:Extract<M1V103Event,{type:'intraphase-medical'}>):boolean{
    const side=sideFor(e.action.teamId);
    if(!side||!teams[side].includes(e.action.playerId))return false;
    if(e.action.kind==='treatment-exit'){
      if(absent.has(e.action.playerId))return false;
      absent.add(e.action.playerId);
    }else if(!absent.delete(e.action.playerId))return false;
    return true;
  }
  for(const item of combined){
    if(item.kind==='source'){
      const source=item.source;
      if(source.type==='physical-transition'&&!sourceTransition(source)||
          source.type==='intraphase-medical'&&!intraphase(source))
        return {ok:false,error:'INVALID_EVENT_CHRONOLOGY'};
      if(source.type==='shot'){
        const side=sideFor(source.teamId);
        if(!side||!active(side,source.playerId))
          return {ok:false,error:'INVALID_EVENT_CHRONOLOGY'};
      }
      events.push({schemaVersion:105,type:'source',
        id:'m1-v105-source-'+source.id,sequence:events.length+1,
        elapsedSeconds:source.elapsedSeconds,source});
    }else{
      const decision=item.entry.decision;
      const beneficiary=sideFor(decision.teamId);
      if(!beneficiary)return {ok:false,error:'INVALID_EVENT_CHRONOLOGY'};
      const participant=decision.kind==='own-goal'?
        beneficiary==='home'?'away':'home':beneficiary;
      if(!active(participant,decision.playerId))
        return {ok:false,error:'SPECIAL_GOAL_PARTICIPANT_ABSENT'};
      const team=totals[beneficiary];
      if(decision.kind==='own-goal'){
        team.goals++;
        team.ownGoalsFor++;
      }else{
        team.penaltiesTaken++;
        team.shots++;
        if(decision.outcome!=='missed')team.shotsOnTarget++;
        if(decision.outcome==='scored'){
          team.goals++;
          team.penaltyGoals++;
        }
      }
      events.push({schemaVersion:105,type:'adjudication',
        id:'m1-v105-decision-'+decision.decisionId,
        sequence:events.length+1,elapsedSeconds:decision.elapsedSeconds,
        decision});
    }
    if(events.length>1&&events.at(-1)!.elapsedSeconds<
        events.at(-2)!.elapsedSeconds)
      return {ok:false,error:'INVALID_EVENT_CHRONOLOGY'};
  }
  const last=events.at(-1);
  if(!last||last.type!=='source'||last.source.type!=='full-time')
    return {ok:false,error:'INVALID_EVENT_CHRONOLOGY'};
  for(const team of [totals.home,totals.away]){
    if(team.goals!==team.openPlayGoals+team.penaltyGoals+
        team.ownGoalsFor||team.goals>team.shotsOnTarget+team.ownGoalsFor)
      return {ok:false,error:'INVALID_EVENT_CHRONOLOGY'};
  }
  return {ok:true,schemaVersion:105,
    status:'REPLAY_GATED_SPECIAL_GOALS_WITHOUT_TRUSTED_REFEREE',
    fixtureId:input.fixture.id,sourceV103ReplayVerified:true,
    specialDecisionSourceV8ReplayVerified:true,rngDraws:270,
    rngState:physical.rngState,events,
    report:{fixtureId:input.fixture.id,home:totals.home,away:totals.away},
    specialDecisionCount:adjudications.length,
    refereeAndPhysicianAuthorityAuthenticated:false,
    arbitrarySecondSpecialDecisionsSupported:false,
    careerCASAdmissionSupported:false,releaseCalibrationAccepted:false};
}
export function verifyM1V105SpecialGoalChronology(
  prematch:unknown,policy:unknown,plannedCommands:unknown,
  checkpointMedical:unknown,intraphaseMedical:unknown,
  trustedDecisions:unknown,candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const replay=simulateM1V105SpecialGoalChronology(prematch,policy,
    plannedCommands,checkpointMedical,intraphaseMedical,trustedDecisions);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
