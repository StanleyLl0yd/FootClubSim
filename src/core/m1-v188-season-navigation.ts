import {inspectM1V188LeagueCalendar} from './m1-v188-league-source-journal.js';
import type {InitialCareerSave} from './save.js';
import type {M1V188Journal} from './m1-v188-league-source-journal.js';

export type M1V188NextOwnMatch=Readonly<{
  targetRevision:number;fixtureId:string|null;automaticMatches:number;
}>;

/**
 * Auto-advance commits only other-club fixtures. The next managed fixture
 * must remain for the player; after the last managed game, complete the tail.
 * This is a read-only calendar view; actual writes still use v188 CAS.
 */
export function planM1V188NextOwnMatch(
  initial:InitialCareerSave,journal:M1V188Journal,
  newCareerCalendarPolicy:2|undefined=undefined,
):M1V188NextOwnMatch|null{
  if(journal.careerId!==initial.careerId||
      journal.selectedClubId!==initial.selectedClubId||
      journal.revision!==journal.entries.length||
      !Number.isSafeInteger(journal.revision)||
      journal.revision<0||journal.revision>=240)return null;
  // The store already verifies committed source history. Do not replay it
  // inside the read-only navigation call on every automatic fixture.
  const calendarVersion=journal.revision===0?newCareerCalendarPolicy:
    journal.entries[0]?.source?.fixtureCalendarPolicyVersion===2?
      2:undefined;
  const inspected=inspectM1V188LeagueCalendar(
    initial,undefined,calendarVersion);
  if(!inspected.ok)return null;
  const schedule=inspected.fixtures;
  const target=schedule.findIndex((fixture,index)=>
    index>=journal.revision&&
    (fixture.homeClubId===initial.selectedClubId||
      fixture.awayClubId===initial.selectedClubId));
  const targetRevision=target<0?schedule.length:target;
  return{targetRevision,fixtureId:target<0?null:schedule[target]!.id,
    automaticMatches:targetRevision-journal.revision};
}
