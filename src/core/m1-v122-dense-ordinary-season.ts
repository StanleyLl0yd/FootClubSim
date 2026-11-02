import {generateDoubleRoundRobin,type Fixture} from './fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from './match-contracts.js';
import {M1_ENGINE_VERSION,type M1PrematchInput} from './m1-clock.js';
import {selectM1V96EligibleRegisteredLineup}
  from './m1-v96-cap-safe-lineup.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';
import {validateM1V120Journal,type M1V120Journal,type M1V120Apply}
  from './m1-v120-playable-journal.js';
import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {RNG_VERSION} from './rng.js';
import type {MatchRosterRules} from './model.js';
import type {InitialCareerSave} from './save.js';
import {defaultTacticalPlan} from './tactics.js';

export const M1_V122_DENSE_ORDINARY_SCHEMA=122 as const;
export type M1V122DenseProposal=
  | Readonly<{ok:false;error:'INVALID_JOURNAL'|
      'PREVIOUS_EXCEPTION_NOT_SUPPORTED'|'NO_LEGAL_LINEUP'|
      'SOURCE_GENERATION_REJECTED'}>
  | Readonly<{ok:true;schemaVersion:122;fixture:Fixture;
      request:M1V120Apply;remainingClubFixtures:number;
      status:'ORDINARY_ONLY_DENSE_CAREER_NO_DISCIPLINE_RECOVERY';
      previousExceptionsCannotBeSilentlyCleared:true;
      v8AndM0Unchanged:true}>;

const RULES:MatchRosterRules={
  starterCount:11,maxBench:12,maxForeignersOnField:7,
};
const POLICY={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};

/**
 * A deliberately narrow continuation of an ordinary-only v120 career.
 * Any previous referee, medical or substitution event blocks automatic
 * advancement rather than silently expiring sanctions or clearing injuries.
 * Full P3 cross-match incident lifecycle is still REQUIRED.
 */
export function prepareM1V122DenseOrdinaryMatch(
  initial:InitialCareerSave,candidate:M1V120Journal,
):M1V122DenseProposal|null {
  const verified=validateM1V120Journal(initial,candidate);
  if(!verified.ok)return {ok:false,error:'INVALID_JOURNAL'};
  const prior=verified.journal;
  if(prior.entries.some(entry=>
    entry.source.plannedCommands.length!==0||
    entry.source.checkpointMedical.length!==0||
    entry.source.intraphaseMedical.length!==0||
    entry.source.trustedDecisions.length!==0))
    return {ok:false,error:'PREVIOUS_EXCEPTION_NOT_SUPPORTED'};
  return buildM1V122NextOrdinaryFromVerified(initial,prior,new Set());
}

/** Only builds a candidate; caller must separately verify the full source
 * journal and all intermatch holds. Never an authority or admission gate.
 */
export function buildM1V122NextOrdinaryFromVerified(
  initial:InitialCareerSave,prior:M1V120Journal,
  controlledExcluded:ReadonlySet<string>,
):M1V122DenseProposal|null {
  const schedule=generateDoubleRoundRobin(initial.catalog.clubs.map(c=>c.id))
    .flatMap(round=>round.fixtures)
    .filter(f=>f.homeClubId===initial.selectedClubId||
      f.awayClubId===initial.selectedClubId);
  const fixture=schedule[prior.revision];
  if(!fixture)return null;
  const clubs=new Map(initial.catalog.clubs.map(c=>[c.id,c]));
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const home=clubs.get(fixture.homeClubId),away=clubs.get(fixture.awayClubId);
  if(!home||!away)return {ok:false,error:'NO_LEGAL_LINEUP'};
  const excludedHome=fixture.homeClubId===initial.selectedClubId?
    controlledExcluded:new Set<string>();
  const excludedAway=fixture.awayClubId===initial.selectedClubId?
    controlledExcluded:new Set<string>();
  const homeLineup=selectM1V96EligibleRegisteredLineup(
    home,players,excludedHome,RULES);
  const awayLineup=selectM1V96EligibleRegisteredLineup(
    away,players,excludedAway,RULES);
  if(!homeLineup||!awayLineup)
    return {ok:false,error:'NO_LEGAL_LINEUP'};
  const prematch:M1PrematchInput={
    schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog:initial.catalog,homeLineup,awayLineup,
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:RULES,rngAlgorithmVersion:RNG_VERSION,
    rngSeed:deriveM1FixtureSeed(initial.rngState,fixture.id),
  };
  const result=simulateM1V105SpecialGoalChronology(prematch,POLICY);
  if(!result.ok)return {ok:false,error:'SOURCE_GENERATION_REJECTED'};
  return {ok:true,schemaVersion:M1_V122_DENSE_ORDINARY_SCHEMA,
    status:'ORDINARY_ONLY_DENSE_CAREER_NO_DISCIPLINE_RECOVERY',
    fixture,remainingClubFixtures:schedule.length-prior.revision-1,
    request:{schemaVersion:120,commandId:'v122-ordinary-'+fixture.id,
      careerId:initial.careerId,expectedRevision:prior.revision,
      prematch,policy:POLICY,plannedCommands:[],checkpointMedical:[],
      intraphaseMedical:[],trustedDecisions:[],result},
    previousExceptionsCannotBeSilentlyCleared:true,v8AndM0Unchanged:true,
  };
}
