import {deriveM1V188PhysicalExposure}
  from './m1-v188-physical-exposure.js';
import {selectM1V96EligibleRegisteredLineup}
  from './m1-v96-cap-safe-lineup.js';
import type {InitialCareerSave} from './save.js';
import type {M1V188Entry} from './m1-v188-league-source-journal.js';
import type {Club,MatchLineup,MatchRosterRules,Player}
  from './model.js';

/** This is an explicitly fictional fixture-step workload model, NOT
 * observed calendar-day recovery, a clinician's decision or an RPL rule.
 * Results are derived only from source-replayed physical player seconds.
 */
export const M1_V188_CONDITION_SCHEMA=1 as const;
export type M1V188ConditionState=ReadonlyMap<string,number>;
const MIN_CONDITION=35;
const MAX_CONDITION=100;

export function startM1V188Condition(
  initial:InitialCareerSave,
):Map<string,number>{
  return new Map(initial.catalog.players.map(p=>[p.id,100]));
}
function playerRecovery(player:Player):number{
  const fitness=player.attributes.naturalFitness;
  return 14+Math.max(0,Math.min(6,Math.floor(fitness/4)));
}
function workload(player:Player,seconds:number):number{
  if(seconds===0)return 0;
  const stamina=player.attributes.stamina;
  const basis=player.primaryPosition==='GK'?14:35;
  const resilience=Math.max(-4,Math.min(4,Math.floor((stamina-10)/3)));
  return Math.max(1,Math.ceil((basis-resilience)*seconds/5400));
}
export function recoverM1V188Condition(
  state:M1V188ConditionState,club:Club,
  players:ReadonlyMap<string,Player>,
):ReadonlyMap<string,number>|null{
  const next=new Map<string,number>();
  for(const id of club.registeredPlayerIds){
    const player=players.get(id),value=state.get(id);
    if(!player||value===undefined||!Number.isSafeInteger(value)||
        value<MIN_CONDITION||value>MAX_CONDITION)return null;
    next.set(id,Math.min(100,value+playerRecovery(player)));
  }
  if(new Set(club.registeredPlayerIds).size!==club.registeredPlayerIds.length)
    return null;
  return next;
}

/** Apply one independently validated v188 fixture to the previous state.
 * Recovery happens at each club's next own fixture; no unmodelled dates.
 * Never use a caller-supplied unverified entry as source of authority.
 */
export function advanceM1V188Condition(
  initial:InitialCareerSave,
  state:M1V188ConditionState,
  entry:M1V188Entry,
):Map<string,number>|null{
  const exposure=deriveM1V188PhysicalExposure(entry);
  if(!exposure)return null;
  const input=entry.source.prematch;
  const fixture=input.fixture as {homeClubId?:unknown;awayClubId?:unknown}|undefined;
  if(!fixture||typeof fixture.homeClubId!=='string'||
      typeof fixture.awayClubId!=='string'||
      fixture.homeClubId===fixture.awayClubId)return null;
  const clubs=new Map(initial.catalog.clubs.map(c=>[c.id,c]));
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const home=clubs.get(fixture.homeClubId);
  const away=clubs.get(fixture.awayClubId);
  if(!home||!away)return null;
  const result=new Map(state);
  const own=new Map<string,string>();
  for(const club of [home,away]){
    const recovered=recoverM1V188Condition(result,club,players);
    if(!recovered)return null;
    for(const [id,value] of recovered){
      if(own.has(id))return null;
      own.set(id,club.id);
      result.set(id,value);
    }
  }
  const visited=new Set<string>();
  for(const row of exposure.players){
    if(visited.has(row.playerId)||own.get(row.playerId)!==row.teamId||
        !Number.isSafeInteger(row.physicalSeconds)||
        row.physicalSeconds<0||row.physicalSeconds>5400)return null;
    const player=players.get(row.playerId),before=result.get(row.playerId);
    if(!player||before===undefined)return null;
    result.set(row.playerId,Math.max(MIN_CONDITION,
      before-workload(player,row.physicalSeconds)));
    visited.add(row.playerId);
  }
  return result;
}

/** For UI or audits after the owning career has been source-validated. */
export function deriveM1V188Condition(
  initial:InitialCareerSave,entries:readonly M1V188Entry[],
):Map<string,number>|null{
  let state=startM1V188Condition(initial);
  for(const entry of entries){
    const updated=advanceM1V188Condition(initial,state,entry);
    if(!updated)return null;
    state=updated;
  }
  return state;
}

/** Deterministic source-replayable automatic XI rotation for both teams.
 * Registered order remains a slight tie-break preference, and the v96
 * foreigner/keeper/bench legality validator is still authoritative.
 */
export function selectM1V188ConditionLineup(
  club:Club,players:ReadonlyMap<string,Player>,
  excluded:ReadonlySet<string>,rules:MatchRosterRules,
  state:M1V188ConditionState,
):MatchLineup|null{
  const recovered=recoverM1V188Condition(state,club,players);
  if(!recovered)return null;
  const sorted=[...club.registeredPlayerIds].map((id,index)=>({
    id,index,score:(recovered.get(id)??-100)-index/2,
  })).sort((a,b)=>b.score-a.score||a.index-b.index);
  return selectM1V96EligibleRegisteredLineup(
    {...club,registeredPlayerIds:sorted.map(row=>row.id)},
    players,excluded,rules);
}

/** A score alone is not a validated medical fitness-to-play decision. */
export function inspectM1V188ClubCondition(
  initial:InitialCareerSave,entries:readonly M1V188Entry[],
  clubId:string,
):Readonly<{
  schemaVersion:1;status:'FICTIONAL_FIXTURE_STEP_NOT_MEDICAL_CLEARANCE';
  players:readonly Readonly<{playerId:string;condition:number}>[];
}>|null{
  const club=initial.catalog.clubs.find(c=>c.id===clubId);
  if(!club)return null;
  const state=deriveM1V188Condition(initial,entries);
  if(!state)return null;
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const recovered=recoverM1V188Condition(state,club,players);
  if(!recovered)return null;
  return{schemaVersion:1,
    status:'FICTIONAL_FIXTURE_STEP_NOT_MEDICAL_CLEARANCE',
    players:club.registeredPlayerIds.map(id=>({
      playerId:id,condition:recovered.get(id)??0,
    }))};
}
