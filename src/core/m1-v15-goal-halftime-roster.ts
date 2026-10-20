import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import { simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * An isolated v15 referee subset: both internally generated goal restarts
 * and the mandatory interval use ONE v8 shot/RNG/roster calculation.
 * Delayed physical entry, other stoppages, special goals and medical
 * decisions are explicitly unsupported. No persisted format is changed.
 */
export const M1_V15_COMBINED_SCHEMA = 1 as const;
export const M1_V15_COMBINED_RULES =
  'ifab-2026-27-goal-and-halftime-unified-roster-subset' as const;
export type M1V15CombinedError =
  'INVALID_SOURCE' | 'INVALID_INTERVAL' | 'UNSUPPORTED_COMMAND' |
  'SOURCE_MATCH_REJECTED' | 'MISSING_INTERNAL_STOPPAGE' |
  'STOPPAGE_TOO_SHORT' | 'ROSTER_REPLAY_MISMATCH' |
  'SHOT_PARTICIPANT_MISMATCH' | 'UNSUPPORTED_SOURCE_EVENT';
type Kind = 'kickoff' | 'shot' | 'goal-whistle' |
  'board-signal' | 'substitution-applied' | 'restart-kickoff' |
  'half-time-whistle' | 'half-time-substitution' |
  'second-half-kickoff' | 'full-time';
export interface M1V15CombinedEvent {
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
export type M1V15CombinedRun =
  | Readonly<{ok:false;error:M1V15CombinedError}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V15_COMBINED_SCHEMA;
    rulesId:typeof M1_V15_COMBINED_RULES;
    status:'GOAL_AND_HALF_TIME_ONLY_IDEALIZED_SUBSTITUTIONS';
    fixtureId:string;
    goalPauseWallSeconds:number;
    halfTimeWallSeconds:number;
    inPlayOpportunitiesUsed:Readonly<{home:number;away:number}>;
    halfTimeSubstitutions:Readonly<{home:number;away:number}>;
    events:readonly M1V15CombinedEvent[];
    finalOnField:Readonly<{home:readonly string[];away:readonly string[]}>;
    finalScore:Readonly<{home:number;away:number}>;
    rngState:number;
    rngDraws:number;
    physicalDepartureTimingAuthenticated:false;
    otherRefereeStoppagesSupported:false;
    lateEntryAndMedicalSupported:false;
    generatedDisciplineAndPenaltiesSupported:false;
  }>;
const fail=(error:M1V15CombinedError):M1V15CombinedRun=>({ok:false,error});
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
export function simulateM1V15GoalAndHalfTime(
  prematch:unknown,policy:unknown,commands:unknown=[],
  goalPauseWallSeconds:unknown=0,halfTimeWallSeconds:unknown=900,
):M1V15CombinedRun{
  if(!interval(goalPauseWallSeconds,120)||
      !interval(halfTimeWallSeconds,900))return fail('INVALID_INTERVAL');
  const input=clone(prematch,10_000_000);
  const control=clone(policy,128_000);
  const raw=clone(commands,1_000_000);
  if(!record(input)||!record(input.fixture)||
      !record(input.homeLineup)||!record(input.awayLineup)||
      !Array.isArray(input.homeLineup.starters)||
      !Array.isArray(input.awayLineup.starters)||
      !Array.isArray(raw)||raw.length>10||control===null){
    return fail('INVALID_SOURCE');
  }
  for(const action of raw){
    if(!record(action)||action.kind!=='substitute-normal'||
        typeof action.elapsedSeconds!=='number'||
        !clockStep(action.elapsedSeconds)||
        (action.elapsedSeconds===2700?
          action.stoppage!=='half-time':
          action.stoppage!=='referee-authorized')){
      return fail('UNSUPPORTED_COMMAND');
    }
  }
  if(raw.some(x=>record(x)&&x.elapsedSeconds===2700)&&
      halfTimeWallSeconds===0)return fail('INVALID_INTERVAL');
  const source=simulateM1V8MedicalPhases(input,control,raw,[],[]);
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
  const available=source.events.filter(e=>e.type==='availability');
  if(available.length!==raw.length)return fail('ROSTER_REPLAY_MISMATCH');
  for(let i=0;i<raw.length;i++){
    const action=raw[i] as Record<string,unknown>;
    const evidence=available[i]!;
    if(evidence.type!=='availability'||
        !sameCanonicalValue(action,evidence.source.entry.action)||
        typeof action.teamId!=='string'||
        typeof action.outPlayerId!=='string'||
        typeof action.inPlayerId!=='string'){
      return fail('ROSTER_REPLAY_MISMATCH');
    }
    const side:Side|null=action.teamId===f.homeClubId?'home':
      action.teamId===f.awayClubId?'away':null;
    if(!side)return fail('ROSTER_REPLAY_MISMATCH');
    const time=action.elapsedSeconds as number;
    const group=changes.get(time)??[];
    group.push({side,teamId:action.teamId,
      outPlayerId:action.outPlayerId,inPlayerId:action.inPlayerId,
      sourceId:evidence.id});
    changes.set(time,group);
  }
  const shots=source.events.filter(e=>e.type==='shot');
  const goalRestarts=new Set(shots.filter(e=>
    e.type==='shot'&&e.outcome==='goal'&&
    e.elapsedSeconds+1!==2700&&e.elapsedSeconds+1<M1_CLOCK_END_SECONDS)
    .map(e=>e.elapsedSeconds+1));
  for(const [time,group] of changes){
    if(time!==2700&&!goalRestarts.has(time)){
      return fail('MISSING_INTERNAL_STOPPAGE');
    }
    if(time!==2700){
      const count={home:0,away:0};
      for(const change of group)count[change.side]++;
      if(Math.max(count.home,count.away)-1>goalPauseWallSeconds){
        return fail('STOPPAGE_TOO_SHORT');
      }
    }
  }
  const events:M1V15CombinedEvent[]=[];
  let running=0,wall=0,half=false;
  const opportunities={home:new Set<number>(),away:new Set<number>()};
  const halfChanges={home:0,away:0};
  function emit(kind:Kind,time:number,at:number,
    sourceEventId:string|null=null,teamId:string|null=null,
    playerId:string|null=null,replacedByPlayerId:string|null=null):void{
    events.push({id:'m1-v15-'+(events.length+1),
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
    xi.delete(change.outPlayerId);xi.add(change.inPlayerId);
    if(xi.size!==11)return false;
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
    emit('second-half-kickoff',running,wall);
    half=true;return true;
  }
  emit('kickoff',0,0);
  for(const event of source.events){
    if(event.type==='availability'||event.type==='full-time')continue;
    if(event.type!=='shot')return fail('UNSUPPORTED_SOURCE_EVENT');
    if(!half&&event.elapsedSeconds>=2700&&!halfTime()){
      return fail('ROSTER_REPLAY_MISMATCH');
    }
    if(!advance(event.elapsedSeconds))return fail('ROSTER_REPLAY_MISMATCH');
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
    emit('restart-kickoff',running,wall,event.id,event.teamId);
  }
  if(!half&&!halfTime())return fail('ROSTER_REPLAY_MISMATCH');
  if(changes.size!==0||!advance(M1_CLOCK_END_SECONDS)){
    return fail('ROSTER_REPLAY_MISMATCH');
  }
  emit('full-time',running,wall);
  const finalOnField={home:sorted(home),away:sorted(away)};
  if(events.length>256||
      !sameCanonicalValue(finalOnField,source.onFieldAtFullTime)||
      opportunities.home.size>3||opportunities.away.size>3){
    return fail('ROSTER_REPLAY_MISMATCH');
  }
  return{ok:true,schemaVersion:M1_V15_COMBINED_SCHEMA,
    rulesId:M1_V15_COMBINED_RULES,
    status:'GOAL_AND_HALF_TIME_ONLY_IDEALIZED_SUBSTITUTIONS',
    fixtureId:source.fixtureId,goalPauseWallSeconds,
    halfTimeWallSeconds,
    inPlayOpportunitiesUsed:{home:opportunities.home.size,
      away:opportunities.away.size},
    halfTimeSubstitutions:halfChanges,events,finalOnField,
    finalScore:{home:source.report.home.goals,away:source.report.away.goals},
    rngState:source.rngState,rngDraws:source.rngDraws,
    physicalDepartureTimingAuthenticated:false,
    otherRefereeStoppagesSupported:false,
    lateEntryAndMedicalSupported:false,
    generatedDisciplineAndPenaltiesSupported:false,
  };
}
export function verifyM1V15GoalAndHalfTime(
  prematch:unknown,policy:unknown,commands:unknown,
  goalPauseWallSeconds:unknown,halfTimeWallSeconds:unknown,
  candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const source=simulateM1V15GoalAndHalfTime(
    prematch,policy,commands,goalPauseWallSeconds,halfTimeWallSeconds);
  return source.ok&&sameCanonicalValue(source,candidate);
}
