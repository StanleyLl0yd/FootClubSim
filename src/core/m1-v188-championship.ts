import {generateDoubleRoundRobin} from './fixtures.js';
import type {InitialCareerSave} from './save.js';
import type {M1V188Journal} from './m1-v188-league-source-journal.js';

/** Conservative title confirmation: points alone must be unreachable.
 * This deliberately does NOT invent an official equal-points tie-break.
 */
export type M1V188Champion=Readonly<{
  clubId:string;clinchedRound:number;remainingRounds:number;
  seasonComplete:boolean;points:number;
}>;
export function deriveM1V188Champion(
  initial:InitialCareerSave,journal:M1V188Journal,
):M1V188Champion|null{
  if(journal.careerId!==initial.careerId||
      journal.revision!==journal.entries.length||
      journal.revision<0||journal.revision>240||
      initial.catalog.clubs.length!==16)return null;
  const fixtures=generateDoubleRoundRobin(
    initial.catalog.clubs.map(club=>club.id)).flatMap(round=>round.fixtures);
  if(fixtures.length!==240)return null;
  const teams=new Map(initial.catalog.clubs.map(club=>[
    club.id,{played:0,points:0}]));
  let clinched:{id:string;round:number}|null=null;
  for(let index=0;index<journal.entries.length;index++){
    const fixture=fixtures[index]!,entry=journal.entries[index]!;
    if(entry.fixtureId!==fixture.id)return null;
    const home=teams.get(fixture.homeClubId),away=teams.get(fixture.awayClubId);
    const hg=entry.result.report.home.goals;
    const ag=entry.result.report.away.goals;
    if(!home||!away||!Number.isSafeInteger(hg)||!Number.isSafeInteger(ag)||
        hg<0||ag<0)return null;
    home.played++;away.played++;
    if(hg===ag){home.points++;away.points++;}
    else if(hg>ag)home.points+=3;
    else away.points+=3;
    if(!clinched){
      // Even if all remaining opponents win every game, they cannot catch up.
      for(const [id,leader] of teams){
        if([...teams].every(([otherId,other])=>otherId===id||
          leader.points>other.points+3*(30-other.played))){
          clinched={id,round:fixture.round};
          break;
        }
      }
    }
  }
  if(!clinched)return null;
  const winner=teams.get(clinched.id);
  if(!winner)return null;
  return{clubId:clinched.id,clinchedRound:clinched.round,
    remainingRounds:30-clinched.round,seasonComplete:journal.revision===240,
    points:winner.points};
}
