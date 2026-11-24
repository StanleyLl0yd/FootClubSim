import {deriveM1V188MatchDetails} from './m1-v188-match-details.js';
import type {M1V188Entry} from './m1-v188-league-source-journal.js';
import type {Fixture} from './fixtures.js';
import type {InitialCareerSave} from './save.js';

export type M1V188ScorerRow=Readonly<{
  playerId:string;clubId:string;goals:number;penaltyGoals:number;
}>;
export type M1V188ScorerStandings=Readonly<{
  matches:number;totalGoals:number;ownGoals:number;
  rows:readonly M1V188ScorerRow[];
}>;

/**
 * Provisional league scorers from committed source entries only. Own goals
 * contribute to the fixture score but never to a player's scorer tally.
 * The caller supplies the already validated journal and versioned calendar;
 * this read-only projection never advances a match or mutates a career.
 */
export function deriveM1V188ScorerStandings(
  initial:InitialCareerSave,fixtures:readonly Fixture[],
  entries:readonly M1V188Entry[],
):M1V188ScorerStandings|null{
  if(entries.length>fixtures.length)return null;
  const playerClub=new Map<string,string>();
  for(const club of initial.catalog.clubs)
    for(const playerId of club.registeredPlayerIds){
      if(playerClub.has(playerId))return null;
      playerClub.set(playerId,club.id);
    }
  const scorers=new Map<string,{
    playerId:string;clubId:string;goals:number;penaltyGoals:number;
  }>();
  let totalGoals=0,ownGoals=0;
  for(let i=0;i<entries.length;i++){
    const fixture=fixtures[i],entry=entries[i];
    if(!fixture||!entry||entry.fixtureId!==fixture.id||
        entry.round!==fixture.round)return null;
    const details=deriveM1V188MatchDetails(entry);
    if(!details||details.homeClubId!==fixture.homeClubId||
        details.awayClubId!==fixture.awayClubId)return null;
    totalGoals+=details.home.goals+details.away.goals;
    for(const event of details.incidents){
      if(event.kind==='own-goal'){
        const actorClub=event.teamId===fixture.homeClubId?
          fixture.awayClubId:fixture.homeClubId;
        if(playerClub.get(event.playerId)!==actorClub)return null;
        ownGoals++;
      }else if(event.kind==='goal'||event.kind==='penalty-goal'){
        const clubId=playerClub.get(event.playerId);
        if(!clubId||clubId!==event.teamId)return null;
        let player=scorers.get(event.playerId);
        if(!player){
          player={playerId:event.playerId,clubId,goals:0,penaltyGoals:0};
          scorers.set(event.playerId,player);
        }
        player.goals++;
        if(event.kind==='penalty-goal')player.penaltyGoals++;
      }
    }
  }
  const rows=[...scorers.values()].sort((a,b)=>
    b.goals-a.goals||a.playerId.localeCompare(b.playerId));
  if(rows.reduce((sum,row)=>sum+row.goals,0)+ownGoals!==totalGoals)
    return null;
  return{matches:entries.length,totalGoals,ownGoals,rows};
}
