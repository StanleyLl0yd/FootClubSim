import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {SeededRng} from './rng.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {M1V7Decision} from './m1-v7-adjudications.js';
import {simulateM1V105SpecialGoalChronology,
  type M1V105Run} from './m1-v105-special-goal-chronology.js';
import {projectM1V179MatchClock} from './m1-v179-source-clock.js';

/** Research-only virtual referee special-goal decisions, NEVER admitted
 * to v188 career journals. Frequencies are exploratory, not calibrated.
 */
export const M1_V190_EXPERIMENTAL_SOURCE_VERSION=190 as const;
type Good=Extract<M1V105Run,{ok:true}>;
type ErrorKind='INVALID_SOURCE'|'INVALID_CLOCK'|'NO_LEGAL_ACTOR'|
  'SPECIAL_GOAL_SOURCE_REJECTED';
export type M1V190ExperimentalResult=
  | Readonly<{ok:false;error:ErrorKind}>
  | Readonly<{ok:true;schemaVersion:190;
    status:'EXPERIMENTAL_INTERNAL_REFEREE_NOT_CALIBRATED';
    fixtureId:string;decisions:readonly M1V7Decision[];
    result:Good;specialDecisionCount:number;
    originalV105RngUnchanged:true;
    internalDecisionModelAuthenticated:false;
    genuineFoulAndBoxPositionSource:false;
    historicalV188SaveAdmissionAllowed:false;
    releaseCalibrationAccepted:false}>;

function hashSource(seed:number,fixture:string):number{
  let value=0x811c9dc5;
  for(const char of seed+'/'+fixture+'/v190')
    value=Math.imul(value^char.charCodeAt(0),16777619)>>>0;
  return value||1;
}
function validRngSeed(v:unknown):v is number{
  return typeof v==='number'&&Number.isSafeInteger(v)&&
    v>=1&&v<=0xffffffff;
}
export function simulateM1V190ExperimentalSpecialGoals(
  prematch:unknown,policy:unknown,
  plannedCommands:unknown=[],checkpointMedical:unknown=[],
):M1V190ExperimentalResult{
  if(![prematch,policy,plannedCommands,checkpointMedical]
    .every(isPlainJsonTree))
    return{ok:false,error:'INVALID_SOURCE'};
  const source=simulateM1V105SpecialGoalChronology(
    prematch,policy,plannedCommands,checkpointMedical,[],[]);
  if(!source.ok)return{ok:false,error:'INVALID_SOURCE'};
  const input=prematch as M1PrematchInput;
  if(!validRngSeed(input.rngSeed)||
     typeof input.fixture?.id!=='string'||!input.fixture.id||
     !Array.isArray(input.catalog?.players))
    return{ok:false,error:'INVALID_SOURCE'};
  const physical=projectM1V179MatchClock(input,source);
  if(!physical.ok||physical.snapshots.length!==source.events.length)
    return{ok:false,error:'INVALID_CLOCK'};
  const rng=new SeededRng(hashSource(input.rngSeed,input.fixture.id));
  // Deliberately independent from original 270-draw open-play PRNG.
  // 0.26 and 0.06 are *research parameters*, not RPL incidence estimates.
  const havePenalty=rng.nextFloat()<0.26;
  const haveOwnGoal=rng.nextFloat()<0.06;
  const chooseTime=()=>300*(1+Math.floor(rng.nextFloat()*17));
  const penaltyTime=chooseTime();
  let ownTime=chooseTime();
  if(penaltyTime===ownTime)
    ownTime=ownTime===5100?300:ownTime+300;
  const positions=new Map(input.catalog.players.map(p=>[p.id,
    p.primaryPosition]));
  const onField=(seconds:number,side:'home'|'away')=>{
    const snapshot=physical.snapshots.filter(s=>s.runningSeconds<=seconds)
      .at(-1);
    return (side==='home'?snapshot?.homePresent:snapshot?.awayPresent)
      ?.filter(id=>positions.get(id)!=='GK')??[];
  };
  const chooseTeam=()=>rng.nextFloat()<0.5?'home' as const:'away' as const;
  const pick=(ids:readonly string[])=>ids[Math.floor(rng.nextFloat()*
    ids.length)];
  const idOf=(side:'home'|'away')=>
    side==='home'?input.fixture.homeClubId:input.fixture.awayClubId;
  const decisions:M1V7Decision[]=[];
  if(havePenalty){
    const team=chooseTeam(),eligible=onField(penaltyTime,team);
    // Physical source may legitimately leave no legal kicker. An internal
    // speculative incident must not abort an otherwise valid league fixture.
    if(eligible.length){
      const playerId=pick(eligible)!;
      const chance=rng.nextFloat();
      const outcome=chance<0.75?'scored' as const:
        chance<0.90?'saved' as const:'missed' as const;
      decisions.push({
        schemaVersion:1,decisionId:'v190-pen-'+input.fixture.id,
        fixtureId:input.fixture.id,elapsedSeconds:penaltyTime,
        teamId:idOf(team),playerId,kind:'penalty-kick',outcome,
      });
    }
  }
  if(haveOwnGoal){
    const team=chooseTeam(),defender=team==='home'?'away':'home';
    const eligible=onField(ownTime,defender);
    if(eligible.length)decisions.push({
      schemaVersion:1,decisionId:'v190-own-'+input.fixture.id,
      fixtureId:input.fixture.id,elapsedSeconds:ownTime,
      teamId:idOf(team),playerId:pick(eligible)!,kind:'own-goal',
    });
  }
  decisions.sort((a,b)=>a.elapsedSeconds-b.elapsedSeconds);
  // A simulated incident is only eligible when the exact physical/referee
  // source accepts it. In particular, two independently proposed decisions
  // may collide with each other or with a real source transition.
  // Validate cumulatively; reject only the speculative event, never a
  // previously accepted match. This is deterministic on replay.
  const admitted:M1V7Decision[]=[];
  let finished:Good=source;
  for(const candidate of decisions){
    const proposed=simulateM1V105SpecialGoalChronology(input,policy,
      plannedCommands,checkpointMedical,[],[...admitted,candidate]);
    if(!proposed.ok||proposed.specialDecisionCount!==admitted.length+1||
       proposed.rngState!==source.rngState||
       proposed.rngDraws!==source.rngDraws)continue;
    // The playable source also requires exactly one defending goalkeeper
    // whenever the current physical event creates a shot or awarded goal.
    // A legal referee decision alone is not enough to prove the complete
    // match ledger, so filter the speculative ruling before admission.
    const projected=projectM1V179MatchClock(input,proposed);
    if(!projected.ok)continue;
    const keeperValid=proposed.events.every((event,index)=>{
      const attacker=event.type==='adjudication'?event.decision.teamId:
        event.source.type==='shot'?event.source.teamId:null;
      if(attacker===null)return true;
      const defenders=attacker===input.fixture.homeClubId?
        projected.snapshots[index]?.awayPresent:
        attacker===input.fixture.awayClubId?
          projected.snapshots[index]?.homePresent:null;
      return !!defenders&&
        defenders.filter(id=>positions.get(id)==='GK').length===1;
    });
    if(!keeperValid)continue;
    admitted.push(candidate);
    finished=proposed;
  }
  return{ok:true,schemaVersion:M1_V190_EXPERIMENTAL_SOURCE_VERSION,
    status:'EXPERIMENTAL_INTERNAL_REFEREE_NOT_CALIBRATED',
    fixtureId:input.fixture.id,decisions:admitted,result:finished,
    specialDecisionCount:admitted.length,originalV105RngUnchanged:true,
    internalDecisionModelAuthenticated:false,
    genuineFoulAndBoxPositionSource:false,
    historicalV188SaveAdmissionAllowed:false,releaseCalibrationAccepted:false};
}
export function verifyM1V190ExperimentalSpecialGoals(
  prematch:unknown,policy:unknown,
  plannedCommands:unknown,checkpointMedical:unknown,
  claimed:unknown,
):boolean{
  if(!isPlainJsonTree(claimed))return false;
  const replay=simulateM1V190ExperimentalSpecialGoals(
    prematch,policy,plannedCommands,checkpointMedical);
  return replay.ok&&sameCanonicalValue(replay,claimed);
}
