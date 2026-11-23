import type {Fixture} from './fixtures.js';
import type {M1V188Entry} from './m1-v188-league-source-journal.js';

export type M1V188FormResult='win'|'draw'|'loss';
export type M1V188RecentResult=Readonly<{
  round:number;opponentClubId:string;home:boolean;
  goalsFor:number;goalsAgainst:number;outcome:M1V188FormResult;
}>;
export type M1V188PrematchBrief=Readonly<{
  ownForm:readonly M1V188RecentResult[];
  opponentForm:readonly M1V188RecentResult[];
  headToHead:Readonly<{played:number;won:number;drawn:number;lost:number}>;
}>;

/**
 * Read-only preview of committed results. The caller supplies a verified
 * journal and its exact versioned calendar; unplayed fixtures are not used.
 * Form is oldest-to-newest. It is not a win-probability forecast.
 */
export function deriveM1V188PrematchBrief(
  fixtures:readonly Fixture[],
  entries:readonly Pick<M1V188Entry,'fixtureId'|'result'>[],
  selectedClubId:string,opponentClubId:string,
):M1V188PrematchBrief|null{
  if(selectedClubId===opponentClubId||entries.length>fixtures.length)
    return null;
  const ownForm:M1V188RecentResult[]=[];
  const opponentForm:M1V188RecentResult[]=[];
  const headToHead={played:0,won:0,drawn:0,lost:0};
  for(let i=0;i<entries.length;i++){
    const fixture=fixtures[i],entry=entries[i];
    if(!fixture||!entry||entry.fixtureId!==fixture.id)return null;
    const homeGoals=entry.result.report.home.goals;
    const awayGoals=entry.result.report.away.goals;
    if(!Number.isSafeInteger(homeGoals)||!Number.isSafeInteger(awayGoals)||
        homeGoals<0||awayGoals<0)return null;
    for(const [clubId,results] of [
      [selectedClubId,ownForm],[opponentClubId,opponentForm],
    ] as const){
      const home=fixture.homeClubId===clubId;
      if(!home&&fixture.awayClubId!==clubId)continue;
      const goalsFor=home?homeGoals:awayGoals;
      const goalsAgainst=home?awayGoals:homeGoals;
      results.push({
        round:fixture.round,
        opponentClubId:home?fixture.awayClubId:fixture.homeClubId,
        home,goalsFor,goalsAgainst,
        outcome:goalsFor>goalsAgainst?'win':
          goalsFor<goalsAgainst?'loss':'draw',
      });
    }
    if((fixture.homeClubId===selectedClubId&&
        fixture.awayClubId===opponentClubId)||
       (fixture.awayClubId===selectedClubId&&
        fixture.homeClubId===opponentClubId)){
      headToHead.played++;
      const ownGoals=fixture.homeClubId===selectedClubId?
        homeGoals:awayGoals;
      const theirGoals=fixture.homeClubId===selectedClubId?
        awayGoals:homeGoals;
      if(ownGoals>theirGoals)headToHead.won++;
      else if(ownGoals<theirGoals)headToHead.lost++;
      else headToHead.drawn++;
    }
  }
  return {
    ownForm:ownForm.slice(-5),
    opponentForm:opponentForm.slice(-5),
    headToHead,
  };
}
