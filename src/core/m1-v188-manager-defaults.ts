import type {InitialCareerSave} from './save.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {M1V188Journal,M1V188ManagedXI}
  from './m1-v188-league-source-journal.js';
import {validateLineup} from './validation.js';

const RULES={starterCount:11,maxBench:12,maxForeignersOnField:7};

/** Previous managed club's verified PREMATCH configuration; never borrow
 * the last opponent fixture. No additional storage/schema is needed.
 */
export function deriveM1V188RememberedXI(
  initial:InitialCareerSave,journal:M1V188Journal,
  upcoming:M1PrematchInput,
):M1V188ManagedXI|null{
  const clubId=initial.selectedClubId;
  if(journal.careerId!==initial.careerId||
      journal.selectedClubId!==clubId||
      upcoming.fixture.homeClubId!==clubId&&
      upcoming.fixture.awayClubId!==clubId)return null;
  const own=journal.entries.findLast(entry=>{
    const fixture=entry.source.prematch.fixture;
    return fixture.homeClubId===clubId||fixture.awayClubId===clubId;
  });
  if(!own)return null;
  const previous=own.source.prematch;
  const atHome=previous.fixture.homeClubId===clubId;
  const lastLineup=atHome?previous.homeLineup:previous.awayLineup;
  const lastTactics=atHome?previous.homeTactics:previous.awayTactics;
  const baseline=upcoming.fixture.homeClubId===clubId?
    upcoming.homeLineup:upcoming.awayLineup;
  const preferred=own.source.managedXI?.starters??lastLineup.starters;
  const tactics=own.source.managedXI?.tactics??lastTactics;
  const playerMap=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const club=initial.catalog.clubs.find(c=>c.id===clubId);
  if(!club)return null;
  const eligible=[...baseline.starters,...baseline.bench];
  const allowed=new Set(eligible);
  const goalkeeper=[...preferred,...eligible].find(id=>
    allowed.has(id)&&playerMap.get(id)?.primaryPosition==='GK');
  if(!goalkeeper)return null;
  const chosen=[goalkeeper];
  let foreigners=Number(playerMap.get(goalkeeper)?.foreignerForCompetition);
  for(const id of [...preferred,...eligible]){
    const player=playerMap.get(id);
    if(!allowed.has(id)||chosen.includes(id)||!player||
        player.primaryPosition==='GK'||chosen.length===11)continue;
    if(player.foreignerForCompetition&&foreigners===7)continue;
    chosen.push(id);
    foreigners+=Number(player.foreignerForCompetition);
  }
  const bench=eligible.filter(id=>!chosen.includes(id));
  if(validateLineup({clubId,starters:chosen,bench},
      club,playerMap,RULES).length)return null;
  return{schemaVersion:1,clubId,starters:chosen,
    tactics:{...tactics,clubId}};
}
