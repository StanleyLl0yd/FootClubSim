import {projectM1V179MatchClock} from './m1-v179-source-clock.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {M1V188Entry} from './m1-v188-league-source-journal.js';

/** Live playing time only, derived from the same physical-XI source clock.
 * This is not fatigue, match readiness or authoritative medical clearance.
 * Callers must first validate the owning v188 career journal.
 */
export const M1_V188_PHYSICAL_EXPOSURE_SCHEMA=1 as const;
export type M1V188PhysicalExposure=Readonly<{
  schemaVersion:typeof M1_V188_PHYSICAL_EXPOSURE_SCHEMA;
  status:'SOURCE_CLOCK_PLAYER_SECONDS_NOT_FATIGUE';
  fixtureId:string;
  runningMatchSeconds:5400;
  teamPhysicalSeconds:Readonly<{home:number;away:number}>;
  players:readonly Readonly<{
    teamId:string;playerId:string;physicalSeconds:number;
    started:boolean;presentAtFullTime:boolean;
  }>[];
  fatigueAndConditionApplied:false;
}>;

/** Project intervals BEFORE each event using the preceding physical XI.
 * A substitution/removal at second t cannot rewrite exposure before t.
 */
export function deriveM1V188PhysicalExposure(
  entry:M1V188Entry,
):M1V188PhysicalExposure|null{
  const input=entry?.source?.prematch as unknown as M1PrematchInput;
  if(!input?.fixture||input.fixture.id!==entry.fixtureId||
      !input.homeLineup||!input.awayLineup||!entry.result)return null;
  const clock=projectM1V179MatchClock(input,entry.result);
  if(!clock.ok)return null;
  const sides=['home','away'] as const;
  const clubs={home:input.fixture.homeClubId,
    away:input.fixture.awayClubId};
  const lineups={home:input.homeLineup,away:input.awayLineup};
  const starters={home:[...lineups.home.starters],
    away:[...lineups.away.starters]};
  const roster={home:new Set([...lineups.home.starters,
      ...lineups.home.bench]),
    away:new Set([...lineups.away.starters,
      ...lineups.away.bench])};
  if(sides.some(side=>starters[side].length!==11||
      new Set(starters[side]).size!==11||
      roster[side].size!==lineups[side].starters.length+
        lineups[side].bench.length)||
      [...roster.home].some(id=>roster.away.has(id)))return null;
  const seconds={home:new Map<string,number>(),
    away:new Map<string,number>()};
  let active={home:starters.home,away:starters.away};
  for(const side of sides)for(const id of starters[side])
    seconds[side].set(id,0);
  let previous=0;
  for(const snapshot of clock.snapshots){
    const now=snapshot.runningSeconds;
    if(!Number.isSafeInteger(now)||now<previous||now>5400)
      return null;
    const delta=now-previous;
    for(const side of sides){
      for(const id of active[side]){
        const value=(seconds[side].get(id)??0)+delta;
        if(!Number.isSafeInteger(value)||value>5400)return null;
        seconds[side].set(id,value);
      }
    }
    const next={home:[...snapshot.homePresent],
      away:[...snapshot.awayPresent]};
    if(sides.some(side=>next[side].length>11||
        new Set(next[side]).size!==next[side].length||
        next[side].some(id=>!roster[side].has(id))))return null;
    active=next;
    previous=now;
  }
  if(previous!==5400)return null;
  const teamPhysicalSeconds={home:0,away:0};
  const players:Extract<M1V188PhysicalExposure,
    {schemaVersion:1}>['players'][number][]=[];
  for(const side of sides){
    for(const [playerId,physicalSeconds] of seconds[side]){
      if(physicalSeconds<0||physicalSeconds>5400)return null;
      teamPhysicalSeconds[side]+=physicalSeconds;
      players.push({teamId:clubs[side],playerId,physicalSeconds,
        started:starters[side].includes(playerId),
        presentAtFullTime:active[side].includes(playerId)});
    }
    if(!Number.isSafeInteger(teamPhysicalSeconds[side])||
        teamPhysicalSeconds[side]>11*5400)return null;
  }
  return{schemaVersion:1,
    status:'SOURCE_CLOCK_PLAYER_SECONDS_NOT_FATIGUE',
    fixtureId:entry.fixtureId,runningMatchSeconds:5400,
    teamPhysicalSeconds,players,
    fatigueAndConditionApplied:false};
}
