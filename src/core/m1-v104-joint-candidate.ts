import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {startM1PlayerControl,advanceM1PlayerControl}
  from './m1-player-control.js';
import {computeM1V104ResearchPhaseShot,validM1V104ResearchParameters,
  type M1V104ResearchParameters,type M1V5Shot}
  from './m1-phases-v5.js';
import {M1_CLOCK_MAX_EVENTS,M1_CLOCK_STEP_SECONDS,
  type M1PrematchInput} from './m1-clock.js';
import {M1_V99_SLOTS_PER_CHECKPOINT,M1_V99_SECONDS_PER_SLOT}
  from './m1-v99-intraphase-shots.js';
import {SeededRng,RNG_VERSION} from './rng.js';
import type {MatchLedgerReport} from './match-contracts.js';
import type {Player} from './model.js';

/** Research-only joint shot, xG and save candidate; not a gameplay source. */
export const M1_V104_SCHEMA=104 as const;
export type M1V104Event=
  | Readonly<Omit<M1V5Shot,'schemaVersion'> & {schemaVersion:104}>
  | Readonly<{schemaVersion:104;type:'full-time';id:'m1-v104-full-time';
      sequence:number;elapsedSeconds:5400}>;
export type M1V104Run=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'INVALID_PARAMETERS'|
      'SOURCE_REJECTED'|'SOURCE_MISMATCH'|'CLOCK_REJECTED'}>
  | Readonly<{ok:true;schemaVersion:104;
      status:'RESEARCH_JOINT_PARAMETERS_NOT_CALIBRATED';
      fixtureId:string;parameters:M1V104ResearchParameters;
      rngSeed:number;rngState:number;rngDraws:270;modelRngVersion:typeof RNG_VERSION;
      events:readonly M1V104Event[];report:MatchLedgerReport;
      medicalRefereeSubstitutionsIncluded:false;
      legacyEngineChanged:false;careerCasAdmissionSupported:false;
      blockedShotTaxonomyHarmonized:false;
      realGoalDefinitionHarmonized:false;holdout2024_25Used:false;
      releaseCalibrationAccepted:false}>;

export function simulateM1V104JointCandidate(
  prematch:unknown,policy:unknown,parameters:unknown,
):M1V104Run{
  if(!isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
      !isPlainJsonTree(parameters))return {ok:false,error:'INVALID_INPUT'};
  if(!validM1V104ResearchParameters(parameters))
    return {ok:false,error:'INVALID_PARAMETERS'};
  const started=startM1PlayerControl(prematch,policy);
  if(!started.ok)return {ok:false,error:'SOURCE_REJECTED'};
  const input=prematch as M1PrematchInput;
  const players=new Map<string,Player>(input.catalog.players.map(p=>[p.id,p]));
  const active={home:input.homeLineup.starters,away:input.awayLineup.starters};
  const rng=new SeededRng(input.rngSeed);
  const totals={
    home:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0},
    away:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0},
  };
  const events:M1V104Event[]=[];
  let state=started.state;
  for(let phase=0;phase<M1_CLOCK_MAX_EVENTS;phase++){
    for(let slot=0;slot<M1_V99_SLOTS_PER_CHECKPOINT;slot++){
      const raw=computeM1V104ResearchPhaseShot(input,state,players,active,
        phase,rng,events.length+1,parameters);
      if(!raw)continue;
      const side=raw.teamId===input.fixture.homeClubId?'home':
        raw.teamId===input.fixture.awayClubId?'away':null;
      if(!side||!active[side].includes(raw.playerId)||
          players.get(raw.playerId)?.primaryPosition==='GK')
        return {ok:false,error:'SOURCE_MISMATCH'};
      const stats=totals[side];
      stats.shots++;
      stats.xgMilli+=raw.xgMilli;
      if(raw.outcome==='goal'||raw.outcome==='saved')stats.shotsOnTarget++;
      if(raw.outcome==='goal')stats.goals++;
      events.push({...raw,schemaVersion:104,
        id:'m1-v104-shot-'+(phase+1)+'-'+(slot+1),
        sequence:events.length+1,
        elapsedSeconds:phase*M1_CLOCK_STEP_SECONDS+
          (slot+1)*M1_V99_SECONDS_PER_SLOT-1});
    }
    const next=advanceM1PlayerControl(input,policy,state);
    if(!next.ok)return {ok:false,error:'CLOCK_REJECTED'};
    state=next.state;
  }
  if(events.some((e,i)=>e.sequence!==i+1||
      (i>0&&e.elapsedSeconds<=events[i-1]!.elapsedSeconds)))
    return {ok:false,error:'SOURCE_MISMATCH'};
  events.push({schemaVersion:104,type:'full-time',
    id:'m1-v104-full-time',sequence:events.length+1,elapsedSeconds:5400});
  const immutableParameters={shotOpportunityMultiplier:parameters.shotOpportunityMultiplier,
    xgMultiplier:parameters.xgMultiplier,saveMultiplier:parameters.saveMultiplier};
  return {ok:true,schemaVersion:104,
    status:'RESEARCH_JOINT_PARAMETERS_NOT_CALIBRATED',
    fixtureId:input.fixture.id,parameters:immutableParameters,
    rngSeed:input.rngSeed,rngState:rng.snapshot(),rngDraws:270,
    modelRngVersion:RNG_VERSION,events,
    report:{fixtureId:input.fixture.id,...totals},
    medicalRefereeSubstitutionsIncluded:false,
    legacyEngineChanged:false,careerCasAdmissionSupported:false,
    blockedShotTaxonomyHarmonized:false,
    realGoalDefinitionHarmonized:false,holdout2024_25Used:false,
    releaseCalibrationAccepted:false};
}
export function verifyM1V104JointCandidate(
  prematch:unknown,policy:unknown,parameters:unknown,candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const replay=simulateM1V104JointCandidate(prematch,policy,parameters);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
