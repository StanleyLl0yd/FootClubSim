import {sameCanonicalValue} from './canonical-value.js';
import type {M1V105Run} from './m1-v105-special-goal-chronology.js';
import type {M1PrematchInput} from './m1-clock.js';

type Good=Extract<M1V105Run,{ok:true}>;
export type M1V188HalfTimeScore=Readonly<{
  fixtureId:string;elapsedSeconds:number;
  homeGoals:number;awayGoals:number;
  homeShots:number;awayShots:number;
  sourceEventCount:number;
}>;
const validSeconds=(seconds:number)=>Number.isSafeInteger(seconds)&&
  seconds>=300&&seconds<=5100&&seconds%300===0;
const cutoff=(result:Good,seconds:number)=>
  result.events.filter(e=>e.elapsedSeconds<seconds);

/** All events already played before the interval are immutable.
 * Neither future substitutions nor tactical orders can rewrite them.
 */
export function sameM1V188CheckpointPrefix(
  previous:Good,next:Good,seconds:number,
):boolean{
  return validSeconds(seconds)&&
    previous.fixtureId===next.fixtureId&&
    sameCanonicalValue(cutoff(previous,seconds),cutoff(next,seconds));
}
export const sameM1V188FirstHalfSource=(previous:Good,next:Good)=>
  sameM1V188CheckpointPrefix(previous,next,2700);

/** Derived only from the authoritative v105 event source. This intentionally
 * does not reveal any unplayed second-half result or probabilities.
 */
export function deriveM1V188CheckpointScore(
  input:M1PrematchInput,result:Good,seconds:number,
):M1V188HalfTimeScore|null{
  if(!validSeconds(seconds)||result.fixtureId!==input.fixture.id||
      result.events.length===0)return null;
  let homeGoals=0,awayGoals=0,homeShots=0,awayShots=0;
  for(const event of cutoff(result,seconds)){
    let teamId:string|null=null;
    let goal=false,shot=false;
    if(event.type==='source'&&event.source.type==='shot'){
      teamId=event.source.teamId;
      shot=true;
      goal=event.source.outcome==='goal';
    }else if(event.type==='adjudication'){
      teamId=event.decision.teamId;
      if(event.decision.kind==='own-goal')goal=true;
      else if(event.decision.kind==='penalty-kick'){
        shot=true;
        goal=event.decision.outcome==='scored';
      }
    }
    if(teamId===null)continue;
    if(teamId!==input.fixture.homeClubId&&
        teamId!==input.fixture.awayClubId)return null;
    const home=teamId===input.fixture.homeClubId;
    if(shot){if(home)homeShots++;else awayShots++;}
    if(goal){if(home)homeGoals++;else awayGoals++;}
  }
  return{fixtureId:input.fixture.id,elapsedSeconds:seconds,
    homeGoals,awayGoals,homeShots,awayShots,
    sourceEventCount:cutoff(result,seconds).length};
}
export const deriveM1V188HalfTimeScore=(
  input:M1PrematchInput,result:Good,
)=>deriveM1V188CheckpointScore(input,result,2700);
