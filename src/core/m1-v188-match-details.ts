import type {M1V188Entry} from './m1-v188-league-source-journal.js';
import type {M1PrematchInput} from './m1-clock.js';

/** Read-only from the accepted v188 source-replayed entry. No estimates
 * for possession, corners, offside or fouls: they are not source events.
 */
export type M1V188MatchIncident=Readonly<{
  time:number;teamId:string;playerId:string;
  kind:'goal'|'penalty-goal'|'own-goal'|'penalty-saved'|
       'penalty-missed'|'yellow'|'red';
}>;
export type M1V188MatchDetails=Readonly<{
  fixtureId:string;homeClubId:string;awayClubId:string;
  home:Readonly<{goals:number;shots:number;shotsOnTarget:number;
    saves:number;penalties:number;yellow:number;red:number;xgMilli:number}>;
  away:Readonly<{goals:number;shots:number;shotsOnTarget:number;
    saves:number;penalties:number;yellow:number;red:number;xgMilli:number}>;
  incidents:readonly M1V188MatchIncident[];
}>;
export function deriveM1V188MatchDetails(
  entry:M1V188Entry,
):M1V188MatchDetails|null{
  const fixture=(entry.source.prematch as unknown as M1PrematchInput).fixture;
  const report=entry.result.report;
  if(fixture.id!==entry.fixtureId)return null;
  const home={...report.home,saves:0,penalties:report.home.penaltiesTaken,
    yellow:0,red:0};
  const away={...report.away,saves:0,penalties:report.away.penaltiesTaken,
    yellow:0,red:0};
  const incidents:M1V188MatchIncident[]=[];
  const goals={home:0,away:0};
  const byTeam=(id:string)=>id===fixture.homeClubId?'home':
    id===fixture.awayClubId?'away':null;
  for(const event of entry.result.events){
    if(event.type==='source'){
      const src=event.source;
      if(src.type==='shot'){
        const side=byTeam(src.teamId);
        if(!side)return null;
        if(src.outcome==='saved'){
          if(side==='home')away.saves++;
          else home.saves++;
        }else if(src.outcome==='goal'){
          goals[side]++;
          incidents.push({time:src.elapsedSeconds,teamId:src.teamId,
            playerId:src.playerId,kind:'goal'});
        }
      }else if(src.type==='physical-transition'&&
          src.source.type==='availability'){
        const record=src.source.source.entry;
        if(record.effect==='yellow'||record.effect==='second-yellow-red'||
            record.effect==='straight-red'){
          const action=record.action;
          if(!('playerId' in action))return null;
          const side=byTeam(action.teamId);
          if(!side)return null;
          const stats=side==='home'?home:away;
          if(record.effect!=='straight-red'){
            stats.yellow++;
            incidents.push({time:src.elapsedSeconds,teamId:action.teamId,
              playerId:action.playerId,kind:'yellow'});
          }
          if(record.effect!=='yellow'){
            stats.red++;
            incidents.push({time:src.elapsedSeconds,teamId:action.teamId,
              playerId:action.playerId,kind:'red'});
          }
        }
      }
    }else{
      const decision=event.decision,side=byTeam(decision.teamId);
      if(!side)return null;
      if(decision.kind==='own-goal'){
        goals[side]++;
        incidents.push({time:event.elapsedSeconds,teamId:decision.teamId,
          playerId:decision.playerId,kind:'own-goal'});
      }else{
        if(decision.outcome==='scored')goals[side]++;
        if(decision.outcome==='saved'){
          if(side==='home')away.saves++;
          else home.saves++;
        }
        incidents.push({time:event.elapsedSeconds,teamId:decision.teamId,
          playerId:decision.playerId,kind:
            decision.outcome==='scored'?'penalty-goal':
            decision.outcome==='saved'?'penalty-saved':'penalty-missed'});
      }
    }
  }
  if(goals.home!==home.goals||goals.away!==away.goals)return null;
  return{fixtureId:fixture.id,homeClubId:fixture.homeClubId,
    awayClubId:fixture.awayClubId,home,away,incidents};
}
