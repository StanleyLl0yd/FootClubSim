import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS } from './m1-clock.js';
import { simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/** IFAB 2026/27 Laws 3 and 7: internal half-time whistle, no in-play window. */
export const M1_V14_HALF_TIME_SCHEMA = 1 as const;
export const M1_V14_HALF_TIME_RULES =
  'ifab-2026-27-half-time-rpl-5-inplay3' as const;
export type M1V14HalfTimeError =
  'INVALID_SOURCE' | 'INVALID_INTERVAL' | 'UNSUPPORTED_COMMAND' |
  'INVALID_MATCH' | 'ROSTER_EVENT_MISMATCH' | 'SHOT_PARTICIPANT_MISMATCH';
type Kind = 'kickoff' | 'shot' | 'half-time-whistle' |
  'half-time-substitution' | 'second-half-kickoff' | 'full-time';
export interface M1V14HalfTimeEvent {
  readonly id: string;
  readonly sequence: number;
  readonly kind: Kind;
  readonly runningSeconds: number;
  readonly wallSeconds: number;
  readonly sourceEventId: string | null;
  readonly teamId: string | null;
  readonly playerId: string | null;
  readonly replacedByPlayerId: string | null;
  readonly onField: Readonly<{home: readonly string[]; away: readonly string[]}>;
}
export type M1V14HalfTimeRun =
  | Readonly<{ok:false;error:M1V14HalfTimeError}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V14_HALF_TIME_SCHEMA;
    rulesId:typeof M1_V14_HALF_TIME_RULES;
    fixtureId:string;
    halftimeIntervalWallSeconds:number;
    status:'INTERNAL_HALF_TIME_ONLY_NORMAL_SUBS';
    inPlayOpportunitiesUsed:0;
    homeNormalSubstitutions:number;
    awayNormalSubstitutions:number;
    events:readonly M1V14HalfTimeEvent[];
    finalOnField:Readonly<{home:readonly string[];away:readonly string[]}>;
    finalScore:Readonly<{home:number;away:number}>;
    rngState:number;
    rngDraws:number;
    refereePhysicalProcedureAuthenticated:false;
    nonHalfTimeWhistlesAuthenticated:false;
    extraTimeSupported:false;
  }>;
const fail = (error:M1V14HalfTimeError):M1V14HalfTimeRun=>({ok:false,error});
const rec=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const sorted=(xs:Iterable<string>):string[]=>[...xs].sort();
function snapshot(v:unknown,max:number):unknown|null{
  if(!isPlainJsonTree(v))return null;
  try{const text=JSON.stringify(v);if(text.length>max)return null;
    return JSON.parse(text) as unknown;}catch{return null;}
}
/**
 * Sources from v8 current legal roster engine; unlike v10, there is
 * no caller-supplied goal/stoppage reason or time. Law 3 explicitly
 * excludes normal halftime substitutions from the three in-play windows.
 */
export function simulateM1V14HalfTimeSubstitutions(
  prematch:unknown,policy:unknown,plannedCommands:unknown=[],
  intervalWallSeconds:unknown=900,
):M1V14HalfTimeRun{
  if(typeof intervalWallSeconds!=='number' ||
      !Number.isSafeInteger(intervalWallSeconds) ||
      intervalWallSeconds<0 || intervalWallSeconds>900){
    return fail('INVALID_INTERVAL');
  }
  const input=snapshot(prematch,10_000_000);
  const control=snapshot(policy,128_000);
  const requests=snapshot(plannedCommands,1_000_000);
  if(!rec(input)||!rec(input.fixture)||!rec(input.homeLineup)||
      !rec(input.awayLineup)||
      !Array.isArray(input.homeLineup.starters)||
      !Array.isArray(input.awayLineup.starters)||
      !Array.isArray(requests)||requests.length>10||
      control===null)return fail('INVALID_SOURCE');
  if(requests.some(x=>!rec(x)||x.kind!=='substitute-normal'||
      x.elapsedSeconds!==2700||x.stoppage!=='half-time')){
    return fail('UNSUPPORTED_COMMAND');
  }
  if(requests.length>0&&intervalWallSeconds===0){
    return fail('INVALID_INTERVAL');
  }
  const simulated=simulateM1V8MedicalPhases(input,control,requests,[],[]);
  if(!simulated.ok)return fail('INVALID_MATCH');
  const match=simulated;
  const fixture=input.fixture;
  if(typeof fixture.id!=='string'||
      typeof fixture.homeClubId!=='string'||
      typeof fixture.awayClubId!=='string'||
      fixture.id!==match.fixtureId)return fail('INVALID_MATCH');
  const home=new Set(input.homeLineup.starters as string[]);
  const away=new Set(input.awayLineup.starters as string[]);
  if(home.size!==11||away.size!==11)return fail('INVALID_MATCH');
  const events:M1V14HalfTimeEvent[]=[];
  function append(kind:Kind,runningSeconds:number,wallSeconds:number,
    sourceEventId:string|null=null,teamId:string|null=null,
    playerId:string|null=null,replacedByPlayerId:string|null=null):void{
    events.push({
      id:'m1-v14-'+(events.length+1),sequence:events.length+1,
      kind,runningSeconds,wallSeconds,sourceEventId,teamId,playerId,
      replacedByPlayerId,onField:{home:sorted(home),away:sorted(away)},
    });
  }
  append('kickoff',0,0);
  const available=match.events.filter(e=>e.type==='availability');
  if(available.length!==requests.length)return fail('ROSTER_EVENT_MISMATCH');
  const substitutionEvents:typeof available=[];
  let index=0,halftime=false,homeUsed=0,awayUsed=0;
  for(const event of match.events){
    if(event.type==='medical'||event.type==='adjudication'){
      return fail('UNSUPPORTED_COMMAND');
    }
    if(event.type==='availability'){
      if(event.elapsedSeconds!==2700||
          !sameCanonicalValue(event.source.entry.action,requests[index])){
        return fail('ROSTER_EVENT_MISMATCH');
      }
      substitutionEvents.push(event);
      index++;
    }
  }
  if(index!==requests.length)return fail('ROSTER_EVENT_MISMATCH');
  for(const event of match.events){
    if(event.type==='availability'||event.type==='full-time')continue;
    if(event.type!=='shot')return fail('UNSUPPORTED_COMMAND');
    if(!halftime&&event.elapsedSeconds>=2700){
      append('half-time-whistle',2700,2700);
      for(const replaced of substitutionEvents){
        const action=replaced.source.entry.action;
        if(action.kind!=='substitute-normal')return fail('ROSTER_EVENT_MISMATCH');
        const side=action.teamId===fixture.homeClubId?'home':
          action.teamId===fixture.awayClubId?'away':null;
        if(!side)return fail('ROSTER_EVENT_MISMATCH');
        const xi=side==='home'?home:away;
        if(!xi.has(action.outPlayerId)||xi.has(action.inPlayerId)){
          return fail('ROSTER_EVENT_MISMATCH');
        }
        xi.delete(action.outPlayerId);xi.add(action.inPlayerId);
        if(xi.size!==11)return fail('ROSTER_EVENT_MISMATCH');
        if(side==='home')homeUsed++;else awayUsed++;
        append('half-time-substitution',2700,
          2700, replaced.id,action.teamId,action.outPlayerId,action.inPlayerId);
      }
      append('second-half-kickoff',2700,2700+intervalWallSeconds);
      halftime=true;
    }
    const side=event.teamId===fixture.homeClubId?'home':
      event.teamId===fixture.awayClubId?'away':null;
    if(!side||!(side==='home'?home:away).has(event.playerId)){
      return fail('SHOT_PARTICIPANT_MISMATCH');
    }
    append('shot',event.elapsedSeconds,
      event.elapsedSeconds+(halftime?intervalWallSeconds:0),
      event.id,event.teamId,event.playerId);
  }
  if(!halftime){
    append('half-time-whistle',2700,2700);
    for(const replaced of substitutionEvents){
      const action=replaced.source.entry.action;
      if(action.kind!=='substitute-normal')return fail('ROSTER_EVENT_MISMATCH');
      const side=action.teamId===fixture.homeClubId?'home':
        action.teamId===fixture.awayClubId?'away':null;
      if(!side)return fail('ROSTER_EVENT_MISMATCH');
      const xi=side==='home'?home:away;
      if(!xi.has(action.outPlayerId)||xi.has(action.inPlayerId)){
        return fail('ROSTER_EVENT_MISMATCH');
      }
      xi.delete(action.outPlayerId);xi.add(action.inPlayerId);
      if(xi.size!==11)return fail('ROSTER_EVENT_MISMATCH');
      if(side==='home')homeUsed++;else awayUsed++;
      append('half-time-substitution',2700,2700,
        replaced.id,action.teamId,action.outPlayerId,action.inPlayerId);
    }
    append('second-half-kickoff',2700,2700+intervalWallSeconds);
  }
  append('full-time',M1_CLOCK_END_SECONDS,
    M1_CLOCK_END_SECONDS+intervalWallSeconds);
  const finalOnField={home:sorted(home),away:sorted(away)};
  if(!sameCanonicalValue(finalOnField,match.onFieldAtFullTime)){
    return fail('ROSTER_EVENT_MISMATCH');
  }
  return{
    ok:true,schemaVersion:M1_V14_HALF_TIME_SCHEMA,
    rulesId:M1_V14_HALF_TIME_RULES,fixtureId:match.fixtureId,
    halftimeIntervalWallSeconds:intervalWallSeconds,
    status:'INTERNAL_HALF_TIME_ONLY_NORMAL_SUBS',
    inPlayOpportunitiesUsed:0,homeNormalSubstitutions:homeUsed,
    awayNormalSubstitutions:awayUsed,events,finalOnField,
    finalScore:{home:match.report.home.goals,away:match.report.away.goals},
    rngState:match.rngState,rngDraws:match.rngDraws,
    refereePhysicalProcedureAuthenticated:false,
    nonHalfTimeWhistlesAuthenticated:false,extraTimeSupported:false,
  };
}
export function verifyM1V14HalfTimeSubstitutions(
  prematch:unknown,policy:unknown,commands:unknown,interval:unknown,
  candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const computed=simulateM1V14HalfTimeSubstitutions(
    prematch,policy,commands,interval);
  return computed.ok&&sameCanonicalValue(candidate,computed);
}
