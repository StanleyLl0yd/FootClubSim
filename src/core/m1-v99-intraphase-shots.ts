import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {startM1PlayerControl,advanceM1PlayerControl}
  from './m1-player-control.js';
import {computeM1V5PhaseShot,M1_V5_DRAWS_PER_PHASE,
  type M1V5Shot} from './m1-phases-v5.js';
import {M1_CLOCK_MAX_EVENTS,M1_CLOCK_STEP_SECONDS,
  type M1PrematchInput} from './m1-clock.js';
import {SeededRng,RNG_VERSION} from './rng.js';
import type {MatchLedgerReport} from './match-contracts.js';
import type {Player} from './model.js';

/**
 * Opt-in, isolated v99 prototype for a future *versioned* match clock.
 * Three fixed slots inside each existing 300-second tactical checkpoint.
 * No legacy v5/v8 source or v76 career save is altered or reinterpreted.
 * Physical medical presence, substitutions and referee commands are NOT
 * integrated and MUST NOT be inferred from the valid shot-only result.
 */
export const M1_V99_INTRAPHASE_EVENT_SCHEMA=99 as const;
export const M1_V99_SLOTS_PER_CHECKPOINT=3 as const;
export const M1_V99_SECONDS_PER_SLOT=100 as const;
export type M1V99Shot=Readonly<
  Omit<M1V5Shot,'schemaVersion'|'id'|'sequence'|'elapsedSeconds'> & {
    schemaVersion:99;id:string;sequence:number;elapsedSeconds:number;
  }>;
export type M1V99Event=
  | M1V99Shot
  | Readonly<{schemaVersion:99;type:'full-time';id:'m1-v99-full-time';
    sequence:number;elapsedSeconds:5400}>;
export type M1V99Run=
  | Readonly<{ok:false;error:'INVALID_PREMATCH_OR_POLICY'|
      'INTERNAL_SOURCE_MISMATCH'|'UNSUPPORTED_CLOCK_TRANSITION'}>
  | Readonly<{ok:true;schemaVersion:99;fixtureId:string;
      status:'NEW_SUBPHASE_SHOT_SOURCE_NOT_CALIBRATED_OR_PLAYABLE';
      modelRngVersion:typeof RNG_VERSION;rngSeed:number;rngState:number;
      rngDraws:number;subphaseSlots:3;secondsPerSlot:100;
      events:readonly M1V99Event[];report:MatchLedgerReport;
      allShotActorsSourceEligibleAtEachRecordedSecond:true;
      allRunningTimesBoundedAndDistinct:true;
      sourceReplayDeterministic:true;
      medicalAndSubstitutionTransitionsSupported:false;
      refereeAndSpecialGoalsSupported:false;
      canPersistInV76CareerJournal:false;
      originalM0AndV8RngAndSavesUnchanged:true;
      releaseCalibrationAccepted:false}>;

export function simulateM1V99IntraphaseShots(
  prematch:unknown,policy:unknown,
):M1V99Run{
  if(!isPlainJsonTree(prematch)||!isPlainJsonTree(policy))
    return {ok:false,error:'INVALID_PREMATCH_OR_POLICY'};
  const start=startM1PlayerControl(prematch,policy);
  if(!start.ok)return {ok:false,error:'INVALID_PREMATCH_OR_POLICY'};
  const input=prematch as M1PrematchInput;
  const players=new Map<string,Player>(
    input.catalog.players.map(p=>[p.id,p]));
  const present={home:input.homeLineup.starters,
    away:input.awayLineup.starters};
  const rng=new SeededRng(input.rngSeed);
  let state=start.state;
  let home={goals:0,shots:0,shotsOnTarget:0,xgMilli:0};
  let away={goals:0,shots:0,shotsOnTarget:0,xgMilli:0};
  const events:M1V99Event[]=[];
  let lastSecond=-1;
  for(let phase=0;phase<M1_CLOCK_MAX_EVENTS;phase++){
    for(let slot=0;slot<M1_V99_SLOTS_PER_CHECKPOINT;slot++){
      const raw=computeM1V5PhaseShot(input,state,players,present,
        phase,rng,events.length+1);
      if(!raw)continue;
      const homeSide=raw.teamId===input.fixture.homeClubId;
      if(!homeSide&&raw.teamId!==input.fixture.awayClubId)
        return {ok:false,error:'INTERNAL_SOURCE_MISMATCH'};
      const active=homeSide?present.home:present.away;
      if(!active.includes(raw.playerId)||
          players.get(raw.playerId)?.primaryPosition==='GK')
        return {ok:false,error:'INTERNAL_SOURCE_MISMATCH'};
      const elapsedSeconds=phase*M1_CLOCK_STEP_SECONDS+
        (slot+1)*M1_V99_SECONDS_PER_SLOT-1;
      if(elapsedSeconds<=lastSecond||elapsedSeconds>=5400)
        return {ok:false,error:'INTERNAL_SOURCE_MISMATCH'};
      const team=homeSide?home:away;
      team.shots++;
      team.xgMilli+=raw.xgMilli;
      if(raw.outcome==='goal'){
        team.goals++;
        team.shotsOnTarget++;
      } else if(raw.outcome==='saved'){
        team.shotsOnTarget++;
      }
      const {schemaVersion:_oldSchema,id:_oldId,
        sequence:_oldSequence,elapsedSeconds:_oldTime,...detail}=raw;
      events.push({...detail,schemaVersion:M1_V99_INTRAPHASE_EVENT_SCHEMA,
        id:'m1-v99-shot-'+(phase+1)+'-'+(slot+1),
        sequence:events.length+1,elapsedSeconds});
      lastSecond=elapsedSeconds;
    }
    const next=advanceM1PlayerControl(input,policy,state);
    if(!next.ok)
      return {ok:false,error:'UNSUPPORTED_CLOCK_TRANSITION'};
    state=next.state;
  }
  events.push({schemaVersion:M1_V99_INTRAPHASE_EVENT_SCHEMA,
    type:'full-time',id:'m1-v99-full-time',
    sequence:events.length+1,elapsedSeconds:5400});
  if(home.goals+away.goals>home.shotsOnTarget+away.shotsOnTarget||
      home.shotsOnTarget>home.shots||away.shotsOnTarget>away.shots)
    return {ok:false,error:'INTERNAL_SOURCE_MISMATCH'};
  const report:MatchLedgerReport={
    fixtureId:input.fixture.id,home,away};
  return {ok:true,
    schemaVersion:M1_V99_INTRAPHASE_EVENT_SCHEMA,
    fixtureId:input.fixture.id,
    status:'NEW_SUBPHASE_SHOT_SOURCE_NOT_CALIBRATED_OR_PLAYABLE',
    modelRngVersion:RNG_VERSION,
    rngSeed:input.rngSeed,rngState:rng.snapshot(),
    rngDraws:M1_CLOCK_MAX_EVENTS*M1_V99_SLOTS_PER_CHECKPOINT*
      M1_V5_DRAWS_PER_PHASE,
    subphaseSlots:M1_V99_SLOTS_PER_CHECKPOINT,
    secondsPerSlot:M1_V99_SECONDS_PER_SLOT,
    events,report,
    allShotActorsSourceEligibleAtEachRecordedSecond:true,
    allRunningTimesBoundedAndDistinct:true,
    sourceReplayDeterministic:true,
    medicalAndSubstitutionTransitionsSupported:false,
    refereeAndSpecialGoalsSupported:false,
    canPersistInV76CareerJournal:false,
    originalM0AndV8RngAndSavesUnchanged:true,
    releaseCalibrationAccepted:false};
}
export function verifyM1V99IntraphaseShots(
  prematch:unknown,policy:unknown,candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const replay=simulateM1V99IntraphaseShots(prematch,policy);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
