import {generateDoubleRoundRobin} from './fixtures.js';
import type {InitialCareerSave} from './save.js';
import type {M1V188Journal} from './m1-v188-league-source-journal.js';

export type M1V188NextOwnMatch=Readonly<{
  targetRevision:number;fixtureId:string;automaticMatches:number;
}>;

/**
 * Only other clubs may be skipped by the one-click season advance.
 * The selected club's next fixture always remains for the player to manage.
 * This is a read-only calendar view; actual writes still use v188 CAS.
 */
export function planM1V188NextOwnMatch(
  initial:InitialCareerSave,journal:M1V188Journal,
):M1V188NextOwnMatch|null{
  if(journal.careerId!==initial.careerId||
      journal.selectedClubId!==initial.selectedClubId||
      journal.revision!==journal.entries.length||
      !Number.isSafeInteger(journal.revision)||
      journal.revision<0||journal.revision>=240)return null;
  const schedule=generateDoubleRoundRobin(
    initial.catalog.clubs.map(club=>club.id)).flatMap(r=>r.fixtures);
  const target=schedule.findIndex((fixture,index)=>
    index>=journal.revision&&
    (fixture.homeClubId===initial.selectedClubId||
      fixture.awayClubId===initial.selectedClubId));
  if(target<0)return null;
  return{targetRevision:target,fixtureId:schedule[target]!.id,
    automaticMatches:target-journal.revision};
}
