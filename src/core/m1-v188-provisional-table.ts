import {generateDoubleRoundRobin} from './fixtures.js';
import type {InitialCareerSave} from './save.js';
import type {M1V188Journal} from './m1-v188-league-source-journal.js';

/** Read-only game preview. This is NOT an official RPL ranking or tie-breaker. */
export type M1V188TableRow=Readonly<{
  clubId:string;played:number;won:number;drawn:number;lost:number;
  goalsFor:number;goalsAgainst:number;goalDifference:number;points:number;
}>;

/**
 * Project a provisional 3/1/0 table from a validated v188 career journal.
 * Persistence verifies the journal before returning it; this helper never
 * alters the journal or attempts to authenticate real competition standings.
 */
export function deriveM1V188ProvisionalTable(
  initial:InitialCareerSave,journal:M1V188Journal,
):readonly M1V188TableRow[]|null{
  if(journal.careerId!==initial.careerId||
      journal.revision!==journal.entries.length||
      journal.revision<0||journal.revision>240)return null;
  const schedule=generateDoubleRoundRobin(
    initial.catalog.clubs.map(club=>club.id)).flatMap(round=>round.fixtures);
  const rows=initial.catalog.clubs.map(club=>({
    clubId:club.id,played:0,won:0,drawn:0,lost:0,
    goalsFor:0,goalsAgainst:0,goalDifference:0,points:0,
  }));
  const byId=new Map(rows.map(row=>[row.clubId,row]));
  for(let i=0;i<journal.entries.length;i++){
    const entry=journal.entries[i],fixture=schedule[i];
    if(!entry||!fixture||entry.fixtureId!==fixture.id)return null;
    const home=byId.get(fixture.homeClubId);
    const away=byId.get(fixture.awayClubId);
    if(!home||!away)return null;
    const hg=entry.result.report.home.goals;
    const ag=entry.result.report.away.goals;
    if(!Number.isSafeInteger(hg)||!Number.isSafeInteger(ag)||
        hg<0||ag<0)return null;
    home.played++;away.played++;
    home.goalsFor+=hg;home.goalsAgainst+=ag;
    away.goalsFor+=ag;away.goalsAgainst+=hg;
    if(hg===ag){
      home.drawn++;away.drawn++;
      home.points++;away.points++;
    }else if(hg>ag){
      home.won++;away.lost++;home.points+=3;
    }else{
      away.won++;home.lost++;away.points+=3;
    }
  }
  for(const row of rows)
    row.goalDifference=row.goalsFor-row.goalsAgainst;
  return rows.sort((a,b)=>b.points-a.points||
    b.goalDifference-a.goalDifference||
    b.goalsFor-a.goalsFor||
    a.clubId.localeCompare(b.clubId));
}
