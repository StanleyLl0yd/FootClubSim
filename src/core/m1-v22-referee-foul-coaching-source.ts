import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import { simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * Isolated v17: goals, halftime, ordinary treatment and asserted
 * referee/withdrawal events use ONE v8 shot/RNG/physical-roster replay.
 * Claimed origin strings are NOT authentication. Old saves stay unchanged.
 */
export const M1_V22_REFEREE_SCHEMA = 1 as const;
export const M1_V22_REFEREE_RULES =
  'ifab-2026-27-source-linked-generated-foul-coaching-subset' as const;
export type M1V22RefereeError =
  'INVALID_SOURCE' | 'INVALID_INTERVAL' | 'UNSUPPORTED_COMMAND' |
  'SOURCE_MATCH_REJECTED' | 'MISSING_INTERNAL_STOPPAGE' |
  'STOPPAGE_TOO_SHORT' | 'ROSTER_REPLAY_MISMATCH' |
  'SHOT_PARTICIPANT_MISMATCH' | 'UNSUPPORTED_SOURCE_EVENT';
type Kind = 'kickoff' | 'shot' | 'treatment-exit' | 'treatment-return' |
  'caution' | 'second-yellow-dismissal' | 'straight-red-dismissal' |
  'injury-withdrawal' | 'synthetic-foul-whistle' |
  'synthetic-foul-restart' | 'goal-whistle' |
  'board-signal' | 'substitution-applied' | 'restart-kickoff' |
  'half-time-whistle' | 'half-time-substitution' |
  'second-half-kickoff' | 'full-time';
export interface M1V22RefereeEvent {
  readonly id: string;
  readonly sequence: number;
  readonly kind: Kind;
  readonly runningSeconds: number;
  readonly wallSeconds: number;
  readonly sourceEventId: string | null;
  readonly teamId: string | null;
  readonly playerId: string | null;
  readonly replacedByPlayerId: string | null;
  readonly onField: Readonly<{home: readonly string[];away: readonly string[]}>;
}
export type M1V22RefereeRun =
  | Readonly<{ok:false;error:M1V22RefereeError}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V22_REFEREE_SCHEMA;
    rulesId:typeof M1_V22_REFEREE_RULES;
    status:'GOAL_HALFTIME_AND_UNAUTHENTICATED_REFEREE_MEDICAL_CLAIMS';
    fixtureId:string;
    goalPauseWallSeconds:number;
    halfTimeWallSeconds:number;
    foulStoppageWallSeconds:number;
    generatedFoulStoppages:number;
    inPlayOpportunitiesUsed:Readonly<{home:number;away:number}>;
    halfTimeSubstitutions:Readonly<{home:number;away:number}>;
    medicalActionCount:number;
    sourceRefereeEffects:Readonly<{yellow:number;secondYellowRed:number;
      straightRed:number;injuryWithdrawn:number}>;
    offFieldAtFullTime:readonly string[];
    events:readonly M1V22RefereeEvent[];
    finalOnField:Readonly<{home:readonly string[];away:readonly string[]}>;
    finalScore:Readonly<{home:number;away:number}>;
    rngState:number;
    rngDraws:number;
    physicalDepartureTimingAuthenticated:false;
    otherRefereeStoppagesSupported:false;
    lateEntrySupported:false;
    ordinaryMedicalPresenceSupported:true;
    assertedRefereeDecisionsSupported:true;
    refereeAuthorityAuthenticated:false;
    medicalAuthorityAuthenticated:false;
    generatedDisciplineAndPenaltiesSupported:false;
    internallyVerifiedFoulStoppageCoachingSupported:true;
  }>;
const fail=(error:M1V22RefereeError):M1V22RefereeRun=>({ok:false,error});
const record=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const sorted=(v:Iterable<string>):string[]=>[...v].sort();
const interval=(v:unknown,max:number):v is number=>
  typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
function clone(value:unknown,max:number):unknown|null{
  if(!isPlainJsonTree(value))return null;
  try{
    const encoded=JSON.stringify(value);
    return encoded.length<=max?JSON.parse(encoded) as unknown:null;
  }catch{return null;}
}
type Side='home'|'away';
interface Change {
  readonly side:Side;
  readonly teamId:string;
  readonly outPlayerId:string;
  readonly inPlayerId:string;
  readonly sourceId:string;
}
const clockStep=(time:number):boolean=>time>=M1_CLOCK_STEP_SECONDS&&
  time<M1_CLOCK_END_SECONDS&&time%M1_CLOCK_STEP_SECONDS===0;

/**
 * All events use one source-derived clock. Goal-restart opportunities require
 * an actual goal at checkpoint-1 from that SAME v8 run. Half-time at 2700
 * is automatic, even when no goal exists. A goal at 2699 cannot create an
 * additional in-play window at 2700: the interval takes precedence.
 *
 * Synthetic stopped-wall durations do not claim measured physical timings.
 */
export function simulateM1V22RefereeMedicalFoulCoaching(
  prematch:unknown,policy:unknown,commands:unknown=[],
  medicalActions:unknown=[],goalPauseWallSeconds:unknown=0,
  halfTimeWallSeconds:unknown=900,foulStopSeconds:unknown=[],
  foulPauseWallSeconds:unknown=20,
):M1V22RefereeRun{
  if(!interval(goalPauseWallSeconds,120)||
      !interval(halfTimeWallSeconds,900)||
      !interval(foulPauseWallSeconds,120)||
      foulPauseWallSeconds===0)return fail('INVALID_INTERVAL');
  const input=clone(prematch,10_000_000);
  const control=clone(policy,128_000);
  const raw=clone(commands,1_000_000);
  const medical=clone(medicalActions,1_000_000);
  const authorized=clone(foulStopSeconds,1024);
  if(!Array.isArray(authorized)||authorized.length>18||
      authorized.some(x=>!clockStep(x as number))||
      new Set(authorized).size!==authorized.length){
    return fail('UNSUPPORTED_COMMAND');
  }
  const foulTimes=new Set<number>(authorized as number[]);
  if(!record(input)||!record(input.fixture)||
      !record(input.homeLineup)||!record(input.awayLineup)||
      !Array.isArray(input.homeLineup.starters)||
      !Array.isArray(input.awayLineup.starters)||
      !Array.isArray(raw)||raw.length>74||
      !Array.isArray(medical)||medical.length>36||control===null){
    return fail('INVALID_SOURCE');
  }
  for(const action of raw){
    if(!record(action)||typeof action.elapsedSeconds!=='number'||
        !Number.isSafeInteger(action.elapsedSeconds)||
        action.elapsedSeconds<0||
        action.elapsedSeconds>=M1_CLOCK_END_SECONDS||
        action.elapsedSeconds%M1_CLOCK_STEP_SECONDS!==0){
      return fail('UNSUPPORTED_COMMAND');
    }
    if(action.kind==='substitute-normal'){
      if(!clockStep(action.elapsedSeconds)||
          (action.elapsedSeconds===2700?
            action.stoppage!=='half-time':
            action.stoppage!=='referee-authorized')){
        return fail('UNSUPPORTED_COMMAND');
      }
    }else if(action.kind!=='caution'&&action.kind!=='direct-red'&&
        action.kind!=='injury-withdrawal'){
      return fail('UNSUPPORTED_COMMAND');
    }
  }
  if(raw.some(x=>record(x)&&x.kind==='substitute-normal'&&
      x.elapsedSeconds===2700)&&
      halfTimeWallSeconds===0)return fail('INVALID_INTERVAL');
  const source=simulateM1V8MedicalPhases(input,control,raw,[],medical);
  if(!source.ok)return fail('SOURCE_MATCH_REJECTED');
  const f=input.fixture;
  if(typeof f.id!=='string'||typeof f.homeClubId!=='string'||
      typeof f.awayClubId!=='string'||f.id!==source.fixtureId||
      f.homeClubId===f.awayClubId)return fail('INVALID_SOURCE');
  const home=new Set(input.homeLineup.starters as string[]);
  const away=new Set(input.awayLineup.starters as string[]);
  if(home.size!==11||away.size!==11)return fail('INVALID_SOURCE');
  const teams={home,away};
  const changes=new Map<number,Change[]>();
  const absent=new Set<string>();
  const sourceMedical=source.events.filter(e=>e.type==='medical');
  if(sourceMedical.length!==medical.length)return fail('ROSTER_REPLAY_MISMATCH');
  for(let i=0;i<medical.length;i++){
    const evidence=sourceMedical[i];
    if(!evidence||evidence.type!=='medical'||
        !sameCanonicalValue(evidence.action,medical[i])){
      return fail('ROSTER_REPLAY_MISMATCH');
    }
  }
  const available=source.events.filter(e=>e.type==='availability');
  if(available.length!==raw.length)return fail('ROSTER_REPLAY_MISMATCH');
  for(let i=0;i<raw.length;i++){
    const action=raw[i] as Record<string,unknown>;
    const evidence=available[i]!;
    if(evidence.type!=='availability'||
        !sameCanonicalValue(action,evidence.source.entry.action)||
        typeof action.teamId!=='string'){
      return fail('ROSTER_REPLAY_MISMATCH');
    }
    const side:Side|null=action.teamId===f.homeClubId?'home':
      action.teamId===f.awayClubId?'away':null;
    if(!side)return fail('ROSTER_REPLAY_MISMATCH');
    if(action.kind!=='substitute-normal'){
      if(typeof action.playerId!=='string'){
        return fail('ROSTER_REPLAY_MISMATCH');
      }
      continue;
    }
    if(typeof action.outPlayerId!=='string'||
        typeof action.inPlayerId!=='string'){
      return fail('ROSTER_REPLAY_MISMATCH');
    }
    const time=action.elapsedSeconds as number;
    const group=changes.get(time)??[];
    group.push({side,teamId:action.teamId,
      outPlayerId:action.outPlayerId,inPlayerId:action.inPlayerId,
      sourceId:evidence.id});
    changes.set(time,group);
  }
  // Mixed same-checkpoint referee/substitute procedure ordering lacks
  // a verified whistle and board source, so it must fail closed.
  const refereeTimes=new Set(available.filter(e=>
    e.type==='availability'&&e.source.entry.action.kind!=='substitute-normal')
    .map(e=>e.elapsedSeconds));
  if([...changes.keys()].some(t=>refereeTimes.has(t)&&!foulTimes.has(t))){
    return fail('UNSUPPORTED_COMMAND');
  }
  const generatedFouls=available.filter(e=>
    e.type==='availability'&&
    (e.source.entry.action.kind==='caution'||
     e.source.entry.action.kind==='direct-red'));
  if(generatedFouls.length!==foulTimes.size||
      generatedFouls.some(e=>!foulTimes.has(e.elapsedSeconds))){
    return fail('UNSUPPORTED_COMMAND');
  }
  // A goal restart and a synthetic foul may not both be claimed at
  // exactly the same running second without subsecond source evidence.
  if([...foulTimes].some(t=>goalRestarts.has(t)))return fail('UNSUPPORTED_COMMAND');
  const foulOffendingTeam=new Map<number,string>(
    generatedFouls.map(e=>[e.elapsedSeconds,e.source.entry.action.teamId]));
  const shots=source.events.filter(e=>e.type==='shot');
  const goalRestarts=new Set(shots.filter(e=>
    e.type==='shot'&&e.outcome==='goal'&&
    e.elapsedSeconds+1!==2700&&e.elapsedSeconds+1<M1_CLOCK_END_SECONDS)
    .map(e=>e.elapsedSeconds+1));
  for(const [time,group] of changes){
    if(time!==2700&&!goalRestarts.has(time)&&!foulTimes.has(time)){
      return fail('MISSING_INTERNAL_STOPPAGE');
    }
    if(time!==2700){
      const count={home:0,away:0};
      for(const change of group)count[change.side]++;
      const duration=foulTimes.has(time)?foulPauseWallSeconds:
        goalPauseWallSeconds;
      if(Math.max(count.home,count.away)-1>(duration as number)){
        return fail('STOPPAGE_TOO_SHORT');
      }
    }
  }
  const events:M1V22RefereeEvent[]=[];
  let running=0,wall=0,half=false,kickoffPending=false;
  const foulSeen=new Set<number>();
  const opportunities={home:new Set<number>(),away:new Set<number>()};
  const halfChanges={home:0,away:0};
  const effects={yellow:0,secondYellowRed:0,straightRed:0,
    injuryWithdrawn:0};
  function emit(kind:Kind,time:number,at:number,
    sourceEventId:string|null=null,teamId:string|null=null,
    playerId:string|null=null,replacedByPlayerId:string|null=null):void{
    events.push({id:'m1-v22-'+(events.length+1),
      sequence:events.length+1,kind,runningSeconds:time,wallSeconds:at,
      sourceEventId,teamId,playerId,replacedByPlayerId,
      onField:{home:sorted(home),away:sorted(away)}});
  }
  function advance(time:number):boolean{
    if(time<running)return false;
    wall+=time-running;running=time;
    return true;
  }
  function replace(change:Change,kind:Kind,time:number,at:number):boolean{
    const xi=teams[change.side];
    if(!xi.has(change.outPlayerId)||xi.has(change.inPlayerId))return false;
    // Another starter may already be temporarily off for treatment.
    const physicalCount=xi.size;
    xi.delete(change.outPlayerId);xi.add(change.inPlayerId);
    if(xi.size!==physicalCount||xi.size<7||xi.size>11)return false;
    emit(kind,time,at,change.sourceId,change.teamId,
      change.outPlayerId,change.inPlayerId);
    return true;
  }
  function halfTime():boolean{
    if(!advance(2700))return false;
    emit('half-time-whistle',running,wall);
    for(const change of changes.get(2700)??[]){
      if(!replace(change,'half-time-substitution',running,wall))return false;
      halfChanges[change.side]++;
    }
    changes.delete(2700);
    wall+=halfTimeWallSeconds as number;
    // Treatment returns at 2700 must precede the second-half kick-off.
    // v8 processes all same-checkpoint medical actions before its shot.
    half=true;kickoffPending=true;return true;
  }
  emit('kickoff',0,0);
  for(const event of source.events){
    if(event.type==='full-time')continue;
    if(event.type==='availability'&&
        event.source.entry.action.kind==='substitute-normal'){
      const time=event.elapsedSeconds;
      if(!foulTimes.has(time))continue;
      const group=changes.get(time);
      if(!group)continue;
      if(!foulSeen.has(time)||!advance(time)){
        return fail('ROSTER_REPLAY_MISMATCH');
      }
      const counts={home:0,away:0};
      const boards=group.map((change,index)=>({
        change,index,offset:counts[change.side]++,
      })).sort((a,b)=>a.offset-b.offset||a.index-b.index);
      for(const {change,offset} of boards){
        emit('board-signal',running,wall+offset,
          change.sourceId,change.teamId,change.outPlayerId,
          change.inPlayerId);
      }
      for(const change of group){
        if(!replace(change,'substitution-applied',running,
          wall+(foulPauseWallSeconds as number))){
          return fail('ROSTER_REPLAY_MISMATCH');
        }
        opportunities[change.side].add(time);
      }
      changes.delete(time);
      wall+=foulPauseWallSeconds as number;
      const offender=foulOffendingTeam.get(time);
      if(!offender)return fail('ROSTER_REPLAY_MISMATCH');
      const beneficiary=offender===f.homeClubId?f.awayClubId:f.homeClubId;
      emit('synthetic-foul-restart',running,wall,null,beneficiary);
      continue;
    }
    if(!half&&event.elapsedSeconds>=2700&&!halfTime()){
      return fail('ROSTER_REPLAY_MISMATCH');
    }
    if(kickoffPending&&event.elapsedSeconds>2700){
      emit('second-half-kickoff',2700,wall);
      kickoffPending=false;
    }
    if(!advance(event.elapsedSeconds))return fail('ROSTER_REPLAY_MISMATCH');
    if(event.type==='availability'){
      const entry=event.source.entry;
      const action=entry.action;
      if(action.kind==='substitute-normal'){
        return fail('UNSUPPORTED_SOURCE_EVENT');
      }
      const side:Side|null=action.teamId===f.homeClubId?'home':
        action.teamId===f.awayClubId?'away':null;
      if(!side||!teams[side].has(action.playerId)){
        return fail('ROSTER_REPLAY_MISMATCH');
      }
      let kind:Kind;
      if(entry.effect==='yellow'){
        kind='caution';effects.yellow++;
      }else if(entry.effect==='second-yellow-red'){
        kind='second-yellow-dismissal';effects.secondYellowRed++;
      }else if(entry.effect==='straight-red'){
        kind='straight-red-dismissal';effects.straightRed++;
      }else if(entry.effect==='injury-withdrawn'){
        kind='injury-withdrawal';effects.injuryWithdrawn++;
      }else{return fail('UNSUPPORTED_SOURCE_EVENT');}
      if(foulTimes.has(running)){
        if(foulSeen.has(running)||
            (kind!=='caution'&&kind!=='second-yellow-dismissal'&&
              kind!=='straight-red-dismissal')){
          return fail('ROSTER_REPLAY_MISMATCH');
        }
        foulSeen.add(running);
        const recipient=side==='home'?f.awayClubId:f.homeClubId;
        emit('synthetic-foul-whistle',running,wall,event.id,
          recipient,action.playerId);
      }
      if(kind!=='caution')teams[side].delete(action.playerId);
      emit(kind,running,wall,event.id,action.teamId,action.playerId);
      if(foulTimes.has(running)&&!changes.has(running)){
        wall+=foulPauseWallSeconds as number;
        const recipient=side==='home'?f.awayClubId:f.homeClubId;
        emit('synthetic-foul-restart',running,wall,event.id,recipient);
      }
      continue;
    }
    if(event.type==='medical'){
      const action=event.action;
      const side:Side|null=action.teamId===f.homeClubId?'home':
        action.teamId===f.awayClubId?'away':null;
      if(!side)return fail('ROSTER_REPLAY_MISMATCH');
      const xi=teams[side];
      if(action.kind==='treatment-exit'){
        if(!xi.has(action.playerId)||absent.has(action.playerId)){
          return fail('ROSTER_REPLAY_MISMATCH');
        }
        xi.delete(action.playerId);
        absent.add(action.playerId);
      }else{
        if(!absent.has(action.playerId)||xi.has(action.playerId)){
          return fail('ROSTER_REPLAY_MISMATCH');
        }
        absent.delete(action.playerId);
        xi.add(action.playerId);
        if(xi.size>11)return fail('ROSTER_REPLAY_MISMATCH');
      }
      emit(action.kind,running,wall,event.id,action.teamId,action.playerId);
      continue;
    }
    if(event.type!=='shot')return fail('UNSUPPORTED_SOURCE_EVENT');
    const side:Side|null=event.teamId===f.homeClubId?'home':
      event.teamId===f.awayClubId?'away':null;
    if(!side||!teams[side].has(event.playerId)){
      return fail('SHOT_PARTICIPANT_MISMATCH');
    }
    emit('shot',running,wall,event.id,event.teamId,event.playerId);
    if(event.outcome!=='goal')continue;
    emit('goal-whistle',running,wall,event.id,event.teamId,event.playerId);
    const restart=event.elapsedSeconds+1;
    if(restart===2700||restart===M1_CLOCK_END_SECONDS)continue;
    if(!clockStep(restart))return fail('ROSTER_REPLAY_MISMATCH');
    const group=changes.get(restart)??[];
    const signals={home:0,away:0};
    const boards=group.map((change,index)=>({
      change,index,offset:signals[change.side]++,
    })).sort((a,b)=>a.offset-b.offset||a.index-b.index);
    for(const {change,offset} of boards){
      emit('board-signal',running,wall+offset,
        change.sourceId,change.teamId,change.outPlayerId,
        change.inPlayerId);
    }
    for(const change of group){
      if(!replace(change,'substitution-applied',running,
        wall+goalPauseWallSeconds))return fail('ROSTER_REPLAY_MISMATCH');
      opportunities[change.side].add(restart);
    }
    changes.delete(restart);
    wall+=goalPauseWallSeconds;
    if(!advance(restart))return fail('ROSTER_REPLAY_MISMATCH');
    const concedingTeamId=event.teamId===f.homeClubId?
      f.awayClubId:f.homeClubId;
    emit('restart-kickoff',running,wall,event.id,concedingTeamId);
  }
  if(!half&&!halfTime())return fail('ROSTER_REPLAY_MISMATCH');
  if(kickoffPending){
    emit('second-half-kickoff',2700,wall);
    kickoffPending=false;
  }
  if(changes.size!==0||!advance(M1_CLOCK_END_SECONDS)){
    return fail('ROSTER_REPLAY_MISMATCH');
  }
  emit('full-time',running,wall);
  const finalOnField={home:sorted(home),away:sorted(away)};
  if(events.length>320||foulSeen.size!==foulTimes.size||
      !sameCanonicalValue(sorted(absent),source.offFieldAtFullTime)||
      !sameCanonicalValue(finalOnField,source.onFieldAtFullTime)||
      opportunities.home.size>3||opportunities.away.size>3){
    return fail('ROSTER_REPLAY_MISMATCH');
  }
  return{ok:true,schemaVersion:M1_V22_REFEREE_SCHEMA,
    rulesId:M1_V22_REFEREE_RULES,
    status:'GOAL_HALFTIME_AND_UNAUTHENTICATED_REFEREE_MEDICAL_CLAIMS',
    fixtureId:source.fixtureId,goalPauseWallSeconds,
    halfTimeWallSeconds,foulStoppageWallSeconds:
      foulPauseWallSeconds as number,generatedFoulStoppages:foulSeen.size,
    inPlayOpportunitiesUsed:{home:opportunities.home.size,
      away:opportunities.away.size},
    halfTimeSubstitutions:halfChanges,medicalActionCount:medical.length,
    sourceRefereeEffects:effects,
    offFieldAtFullTime:sorted(absent),events,finalOnField,
    finalScore:{home:source.report.home.goals,away:source.report.away.goals},
    rngState:source.rngState,rngDraws:source.rngDraws,
    physicalDepartureTimingAuthenticated:false,
    otherRefereeStoppagesSupported:false,
    lateEntrySupported:false,ordinaryMedicalPresenceSupported:true,
    assertedRefereeDecisionsSupported:true,
    refereeAuthorityAuthenticated:false,medicalAuthorityAuthenticated:false,
    generatedDisciplineAndPenaltiesSupported:false,
    internallyVerifiedFoulStoppageCoachingSupported:true,
  };
}
export function verifyM1V22RefereeMedicalFoulCoaching(
  prematch:unknown,policy:unknown,commands:unknown,
  medicalActions:unknown,goalPauseWallSeconds:unknown,
  halfTimeWallSeconds:unknown,foulStopSeconds:unknown,
  foulPauseWallSeconds:unknown,candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const source=simulateM1V22RefereeMedicalFoulCoaching(
    prematch,policy,commands,medicalActions,goalPauseWallSeconds,
    halfTimeWallSeconds,foulStopSeconds,foulPauseWallSeconds);
  return source.ok&&sameCanonicalValue(source,candidate);
}
