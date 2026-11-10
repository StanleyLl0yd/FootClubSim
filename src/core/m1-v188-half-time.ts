import {sameCanonicalValue} from './canonical-value.js';
import type {M1V105Run} from './m1-v105-special-goal-chronology.js';
import type {M1PrematchInput} from './m1-clock.js';

type Good=Extract<M1V105Run,{ok:true}>;
export type M1V188HalfTimeScore=Readonly<{
  fixtureId:string;elapsedSeconds:2700;
  homeGoals:number;awayGoals:number;
  homeShots:number;awayShots:number;
  sourceEventCount:number;
}>;
const cutoff=(result:Good)=>result.events.filter(e=>e.elapsedSeconds<2700);

/** All events already played before the interval are immutable.
 * Neither future substitutions nor tactical orders can rewrite them.
 */
export function sameM1V188FirstHalfSource(
  previous:Good,next:Good,
):boolean{
  return previous.fixtureId===next.fixtureId&&
    sameCanonicalValue(cutoff(previous),cutoff(next));
}

/** Derived only from the authoritative v105 event source. This intentionally
 * does not reveal any unplayed second-half result or probabilities.
 */
export function deriveM1V188HalfTimeScore(
  input:M1PrematchInput,result:Good,
):M1V188HalfTimeScore|null{
  if(result.fixtureId!==input.fixture.id||
      result.events.length===0)return null;
  let homeGoals=0,awayGoals=0,homeShots=0,awayShots=0;
  for(const event of cutoff(result)){
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
  return{fixtureId:input.fixture.id,elapsedSeconds:2700,
    homeGoals,awayGoals,homeShots,awayShots,
    sourceEventCount:cutoff(result).length};
}
