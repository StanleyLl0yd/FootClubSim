import type {M1V105Run} from './m1-v105-special-goal-chronology.js';
import {M1_MODELLED_GOAL_STOP_SECONDS,
  M1_MODELLED_FOUL_STOP_SECONDS,
  M1_MODELLED_HALF_TIME_STOP_SECONDS} from './m1-clock.js';

/** A non-persisted clock from the SAME v105 event stream accepted by v120.
 * Wall delays below are fictional game parameters, not observed timing.
 */
export const M1_V179_CLOCK_SCHEMA=179 as const;
type Good=Extract<M1V105Run,{ok:true}>;
type Side='home'|'away';
export type M1V179ClockSnapshot=Readonly<{
  sourceEventId:string;runningSeconds:number;wallSeconds:number;
  sourceKind:string;modelledStopAfterSeconds:number;
  homePresent:readonly string[];awayPresent:readonly string[];
}>;
export type M1V179ClockResult=
  | Readonly<{ok:false;error:'INVALID_MATCH_CLOCK_SOURCE'|
      'INVALID_XI_CHRONOLOGY'}>
  | Readonly<{ok:true;schemaVersion:179;
      status:'MODELLED_WALL_SECONDS_FROM_REPLAYED_V105_SOURCE';
      fixtureId:string;runningFullTimeSeconds:5400;
      wallFullTimeSeconds:number;modelledPausedSeconds:number;
      managerStopsFromSource:readonly number[];
      snapshots:readonly M1V179ClockSnapshot[];
      sourceReplayRequired:true;officialRefereeTimingAuthenticated:false;
      medicalExceptionsAuthenticated:false;releaseCalibrationAccepted:false}>;

const record=(x:unknown):x is Record<string,unknown>=>
  x!==null&&typeof x==='object'&&!Array.isArray(x);
const bad=(error:'INVALID_MATCH_CLOCK_SOURCE'|'INVALID_XI_CHRONOLOGY'):
  M1V179ClockResult=>({ok:false,error});
const sorted=(items:Iterable<string>)=>[...items].sort();

/** Project source-verified physical XI, run time and fictional stopped time.
 * Does not make unknown real-world stoppage duration or clinical authority
 * into certified input, and does not change v120 save/replay formats.
 */
export function projectM1V179MatchClock(
  prematch:unknown,result:Good,
):M1V179ClockResult{
  if(!record(prematch)||!record(prematch.fixture)||
      !record(prematch.homeLineup)||!record(prematch.awayLineup))
    return bad('INVALID_MATCH_CLOCK_SOURCE');
  const fixture=prematch.fixture;
  const homeId=fixture.homeClubId,awayId=fixture.awayClubId;
  const home=prematch.homeLineup.starters;
  const away=prematch.awayLineup.starters;
  if(typeof fixture.id!=='string'||typeof homeId!=='string'||
      typeof awayId!=='string'||homeId===awayId||
      !Array.isArray(home)||!Array.isArray(away)||
      !home.every(x=>typeof x==='string')||
      !away.every(x=>typeof x==='string')||
      result.fixtureId!==fixture.id||!Array.isArray(result.events)||
      result.events.length===0||result.events.length>1500)
    return bad('INVALID_MATCH_CLOCK_SOURCE');
  const active={home:new Set<string>(home),away:new Set<string>(away)};
  const absent=new Set<string>();
  const stops=new Set<number>([2700]);
  const sideFor=(id:string):Side|null=>
    id===homeId?'home':id===awayId?'away':null;
  const present=(side:Side,id:string)=>
    active[side].has(id)&&!absent.has(id);
  const medical=(action:{kind:string;teamId:string;playerId:string})=>{
    const side=sideFor(action.teamId);
    if(!side||!active[side].has(action.playerId))return false;
    if(action.kind==='treatment-exit'){
      if(absent.has(action.playerId))return false;
      absent.add(action.playerId);
    }else if(action.kind==='treatment-return'){
      if(!absent.delete(action.playerId))return false;
    }else return false;
    return true;
  };
  let offset=0,halfTimeAdded=false,lastRunning=-1,lastWall=-1;
  // Attribute the carded-foul pause after the same-second physical exit.
  let deferredFoulDelay=0;
  const preciseExitSeconds=new Set(result.events.filter(event=>
    event.type==='source'&&
    event.source.type==='intraphase-medical'&&
    event.source.action.kind==='treatment-exit'&&
    event.source.action.id==='m1-v36-exit-'+event.elapsedSeconds)
    .map(event=>event.elapsedSeconds));
  const ids=new Set<string>();
  const snapshots:M1V179ClockSnapshot[]=[];
  for(let i=0;i<result.events.length;i++){
    const event=result.events[i]!;
    const sec=event.elapsedSeconds;
    if(sec>lastRunning&&deferredFoulDelay!==0)
      return bad('INVALID_MATCH_CLOCK_SOURCE');
    const preciseExit=event.type==='source'&&
      event.source.type==='intraphase-medical'&&
      event.source.action.kind==='treatment-exit'&&
      event.source.action.id==='m1-v36-exit-'+sec;
    if(event.sequence!==i+1||ids.has(event.id)||
        !Number.isSafeInteger(sec)||sec<lastRunning||
        sec<0||sec>5400)
      return bad('INVALID_MATCH_CLOCK_SOURCE');
    if(event.type==='source'&&event.source.type==='full-time'&&
        i!==result.events.length-1)
      return bad('INVALID_MATCH_CLOCK_SOURCE');
    if(!halfTimeAdded&&sec>=2700){
      offset+=M1_MODELLED_HALF_TIME_STOP_SECONDS;
      halfTimeAdded=true;
    }
    const wall=sec+offset;
    if(wall<lastWall)return bad('INVALID_MATCH_CLOCK_SOURCE');
    let delay=0;
    if(event.type==='adjudication'){
      const d=event.decision;
      const beneficiary=sideFor(d.teamId);
      if(!beneficiary)return bad('INVALID_XI_CHRONOLOGY');
      const actor=d.kind==='own-goal'?
        beneficiary==='home'?'away':'home':beneficiary;
      if(!present(actor,d.playerId))
        return bad('INVALID_XI_CHRONOLOGY');
      delay=M1_MODELLED_GOAL_STOP_SECONDS;
    }else{
      const e=event.source;
      if(e.type==='physical-transition'){
        const transition=e.source;
        if(transition.type==='availability'){
          const action=transition.source.entry.action;
          const side=sideFor(action.teamId);
          if(!side)return bad('INVALID_XI_CHRONOLOGY');
          if(action.kind==='substitute-normal'){
            if(!present(side,action.outPlayerId)||
                active[side].has(action.inPlayerId))
              return bad('INVALID_XI_CHRONOLOGY');
            active[side].delete(action.outPlayerId);
            active[side].add(action.inPlayerId);
            // A referee stop already covers this physical replacement.
          }else if(transition.source.entry.effect==='yellow'){
            delay=M1_MODELLED_FOUL_STOP_SECONDS;
            stops.add(sec);
          }else{
            if(!present(side,action.playerId))
              return bad('INVALID_XI_CHRONOLOGY');
            active[side].delete(action.playerId);
            if(action.kind==='caution'||action.kind==='direct-red'){
              delay=M1_MODELLED_FOUL_STOP_SECONDS;
              stops.add(sec);
            }
          }
        }else{
          if(!medical(transition.action))
            return bad('INVALID_XI_CHRONOLOGY');
          // Medical movement uses the original source stoppage.
        }
      }else if(e.type==='intraphase-medical'){
        if(!medical(e.action))return bad('INVALID_XI_CHRONOLOGY');
        // A medical transition creates no extra unverified whistle.
      }else if(e.type==='shot'){
        const side=sideFor(e.teamId);
        if(!side||!present(side,e.playerId))
          return bad('INVALID_XI_CHRONOLOGY');
        if(e.outcome==='goal'){
          delay=sec+1===2700||sec+1>=5400?0:
            M1_MODELLED_GOAL_STOP_SECONDS;
          if(sec+1<5400&&sec+1!==2700)stops.add(sec+1);
        }
      }else if(e.type==='full-time'){
        if(sec!==5400)return bad('INVALID_MATCH_CLOCK_SOURCE');
      }else return bad('INVALID_MATCH_CLOCK_SOURCE');
    }
    ids.add(event.id);lastRunning=sec;lastWall=wall;
    snapshots.push({sourceEventId:event.id,runningSeconds:sec,
      wallSeconds:wall,sourceKind:event.type==='adjudication'?
        'adjudication':event.source.type,modelledStopAfterSeconds:delay,
      homePresent:sorted([...active.home].filter(id=>!absent.has(id))),
      awayPresent:sorted([...active.away].filter(id=>!absent.has(id)))});
    if(delay===M1_MODELLED_FOUL_STOP_SECONDS&&
        preciseExitSeconds.has(sec)){
      if(deferredFoulDelay!==0)
        return bad('INVALID_MATCH_CLOCK_SOURCE');
      deferredFoulDelay=delay;
    }else offset+=delay;
    if(preciseExit){
      if(deferredFoulDelay!==M1_MODELLED_FOUL_STOP_SECONDS)
        return bad('INVALID_MATCH_CLOCK_SOURCE');
      offset+=deferredFoulDelay;
      deferredFoulDelay=0;
    }
  }
  const last=result.events.at(-1)!;
  if(last.type!=='source'||last.source.type!=='full-time'||
      !halfTimeAdded||deferredFoulDelay!==0||
      snapshots.at(-1)!.runningSeconds!==5400)
    return bad('INVALID_MATCH_CLOCK_SOURCE');
  return {ok:true,schemaVersion:M1_V179_CLOCK_SCHEMA,
    status:'MODELLED_WALL_SECONDS_FROM_REPLAYED_V105_SOURCE',
    fixtureId:result.fixtureId,runningFullTimeSeconds:5400,
    wallFullTimeSeconds:snapshots.at(-1)!.wallSeconds,
    modelledPausedSeconds:offset,
    managerStopsFromSource:[...stops].sort((a,b)=>a-b),
    snapshots,sourceReplayRequired:true,
    officialRefereeTimingAuthenticated:false,
    medicalExceptionsAuthenticated:false,releaseCalibrationAccepted:false};
}
