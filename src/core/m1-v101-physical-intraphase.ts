import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {startM1PlayerControl,advanceM1PlayerControl}
  from './m1-player-control.js';
import {computeM1V5PhaseShot,M1_V5_DRAWS_PER_PHASE,
  type M1V5Shot} from './m1-phases-v5.js';
import {M1_CLOCK_MAX_EVENTS,M1_CLOCK_STEP_SECONDS,
  type M1PrematchInput} from './m1-clock.js';
import {simulateM1V8MedicalPhases,type M1V8Event}
  from './m1-v8-medical-phases.js';
import {M1_V99_SLOTS_PER_CHECKPOINT,M1_V99_SECONDS_PER_SLOT}
  from './m1-v99-intraphase-shots.js';
import {SeededRng,RNG_VERSION} from './rng.js';
import type {MatchLedgerReport} from './match-contracts.js';
import type {Player} from './model.js';

/**
 * An opt-in source-bound bridge: the existing validated v8 300-second
 * availability/medical transitions govern every new 100-second shot slot.
 * Clinical/referee authority and 100-second transition commands are NOT
 * established. This does not enter the schema-6 career CAS.
 */
export const M1_V101_EVENT_SCHEMA=101 as const;
type PhysicalTransition=Extract<M1V8Event,{type:'availability'|'medical'}>;
export type M1V101Shot=Readonly<
  Omit<M1V5Shot,'schemaVersion'> & {schemaVersion:101}>;
export type M1V101Event=M1V101Shot |
  Readonly<{schemaVersion:101;type:'physical-transition';
    id:string;sequence:number;elapsedSeconds:number;source:PhysicalTransition}> |
  Readonly<{schemaVersion:101;type:'full-time';id:'m1-v101-full-time';
    sequence:number;elapsedSeconds:5400}>;
export type M1V101Run=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'SOURCE_REJECTED'|
      'INVALID_PHYSICAL_TRANSITION'|'INVALID_CLOCK_TRANSITION'} >
  | Readonly<{ok:true;schemaVersion:101;
      status:'PHYSICAL_XI_300_SECOND_BRIDGE_NOT_PLAYABLE_OR_CALIBRATED';
      fixtureId:string;modelRngVersion:typeof RNG_VERSION;
      rngSeed:number;rngState:number;rngDraws:number;
      sourceTransitionCount:number;
      events:readonly M1V101Event[];report:MatchLedgerReport;
      verifiedV8PhysicalTransitionsAt300SecondCheckpoints:true;
      intraphaseShotsUseCurrentPhysicalXI:true;
      refereeAndClinicalAuthorityAuthenticated:false;
      intraphasePhysicalTransitionsSupported:false;
      specialGoalsAndAdjudicationSupported:false;
      careerCASAdmissionSupported:false;
      releaseCalibrationAccepted:false}>;

export function simulateM1V101PhysicalIntraphase(
  prematch:unknown,policy:unknown,plannedCommands:unknown=[],
  medicalActions:unknown=[],
):M1V101Run{
  if(![prematch,policy,plannedCommands,medicalActions].every(isPlainJsonTree)||
      !Array.isArray(plannedCommands)||!Array.isArray(medicalActions)||
      plannedCommands.some(x=>!x||typeof x!=='object'||
        !['substitute-normal','caution','direct-red','injury-withdrawal']
          .includes(x.kind)))
    return {ok:false,error:'INVALID_INPUT'};
  // v8 fully replays the original v7 legal command source; no special-goal
  // decisions or tactical commands may silently bypass this bridge.
  const source=simulateM1V8MedicalPhases(
    prematch,policy,plannedCommands,[],medicalActions);
  if(!source.ok)return {ok:false,error:'SOURCE_REJECTED'};
  const start=startM1PlayerControl(prematch,policy);
  if(!start.ok)return {ok:false,error:'SOURCE_REJECTED'};
  const input=prematch as M1PrematchInput;
  const players=new Map<string,Player>(input.catalog.players.map(p=>[p.id,p]));
  const teams={
    home:[...input.homeLineup.starters],
    away:[...input.awayLineup.starters],
  };
  const absent=new Set<string>();
  const transitions:PhysicalTransition[]=source.events.filter(
    (e):e is PhysicalTransition=>
      e.type==='availability'||e.type==='medical');
  const rng=new SeededRng(input.rngSeed);
  const totals={
    home:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0},
    away:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0},
  };
  const events:M1V101Event[]=[];
  let controlled=start.state,cursor=0;
  for(let phase=0;phase<M1_CLOCK_MAX_EVENTS;phase++){
    const second=phase*M1_CLOCK_STEP_SECONDS;
    const upcoming=transitions[cursor];
    if(upcoming&&upcoming.elapsedSeconds<second)
      return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
    while(transitions[cursor]?.elapsedSeconds===second){
      const e=transitions[cursor]!;
      const teamId=e.type==='availability'?
        e.source.entry.action.teamId:e.action.teamId;
      const side=teamId===input.fixture.homeClubId?'home':
        teamId===input.fixture.awayClubId?'away':null;
      if(!side)return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
      if(e.type==='availability'){
        const action=e.source.entry.action;
        if(action.kind==='substitute-normal'){
          const index=teams[side].indexOf(action.outPlayerId);
          if(index<0||absent.has(action.outPlayerId)||
              teams[side].includes(action.inPlayerId))
            return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
          teams[side][index]=action.inPlayerId;
        }else if(e.source.entry.effect!=='yellow'){
          if(!teams[side].includes(action.playerId)||absent.has(action.playerId))
            return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
          teams[side]=teams[side].filter(id=>id!==action.playerId);
        }
      }else{
        const action=e.action;
        if(!teams[side].includes(action.playerId))
          return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
        if(action.kind==='treatment-exit'){
          if(absent.has(action.playerId))
            return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
          absent.add(action.playerId);
        }else if(!absent.delete(action.playerId)){
          return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
        }
      }
      events.push({
        schemaVersion:101,type:'physical-transition',
        id:'m1-v101-transition-'+e.id,sequence:events.length+1,
        elapsedSeconds:second,source:e,
      });
      cursor++;
    }
    const present={
      home:teams.home.filter(id=>!absent.has(id)),
      away:teams.away.filter(id=>!absent.has(id)),
    };
    for(const side of ['home','away'] as const){
      if(present[side].length<7||present[side].length>11||
          present[side].filter(id=>
            players.get(id)?.primaryPosition==='GK').length!==1)
        return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
    }
    for(let slot=0;slot<M1_V99_SLOTS_PER_CHECKPOINT;slot++){
      const raw=computeM1V5PhaseShot(
        input,controlled,players,present,phase,rng,events.length+1);
      if(!raw)continue;
      const side=raw.teamId===input.fixture.homeClubId?'home':
        raw.teamId===input.fixture.awayClubId?'away':null;
      if(!side||!present[side].includes(raw.playerId)||
          players.get(raw.playerId)?.primaryPosition==='GK')
        return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
      const team=totals[side];
      team.shots++;
      team.xgMilli+=raw.xgMilli;
      if(raw.outcome==='goal'||raw.outcome==='saved')
        team.shotsOnTarget++;
      if(raw.outcome==='goal')team.goals++;
      const elapsedSeconds=second+
        (slot+1)*M1_V99_SECONDS_PER_SLOT-1;
      events.push({
        ...raw,schemaVersion:M1_V101_EVENT_SCHEMA,
        id:'m1-v101-shot-'+(phase+1)+'-'+(slot+1),
        sequence:events.length+1,elapsedSeconds,
      });
    }
    const next=advanceM1PlayerControl(input,policy,controlled);
    if(!next.ok)return {ok:false,error:'INVALID_CLOCK_TRANSITION'};
    controlled=next.state;
  }
  if(cursor!==transitions.length)
    return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
  events.push({schemaVersion:101,type:'full-time',
    id:'m1-v101-full-time',sequence:events.length+1,elapsedSeconds:5400});
  for(const team of [totals.home,totals.away]){
    if(team.goals>team.shotsOnTarget||team.shotsOnTarget>team.shots)
      return {ok:false,error:'INVALID_PHYSICAL_TRANSITION'};
  }
  return {
    ok:true,schemaVersion:M1_V101_EVENT_SCHEMA,
    status:'PHYSICAL_XI_300_SECOND_BRIDGE_NOT_PLAYABLE_OR_CALIBRATED',
    fixtureId:input.fixture.id,modelRngVersion:RNG_VERSION,
    rngSeed:input.rngSeed,rngState:rng.snapshot(),
    rngDraws:M1_CLOCK_MAX_EVENTS*M1_V99_SLOTS_PER_CHECKPOINT*
      M1_V5_DRAWS_PER_PHASE,
    sourceTransitionCount:transitions.length,
    events,report:{fixtureId:input.fixture.id,...totals},
    verifiedV8PhysicalTransitionsAt300SecondCheckpoints:true,
    intraphaseShotsUseCurrentPhysicalXI:true,
    refereeAndClinicalAuthorityAuthenticated:false,
    intraphasePhysicalTransitionsSupported:false,
    specialGoalsAndAdjudicationSupported:false,
    careerCASAdmissionSupported:false,
    releaseCalibrationAccepted:false,
  };
}

export function verifyM1V101PhysicalIntraphase(
  prematch:unknown,policy:unknown,plannedCommands:unknown,
  medicalActions:unknown,candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const replay=simulateM1V101PhysicalIntraphase(
    prematch,policy,plannedCommands,medicalActions);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
