import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeM1V84MedicallyAndAutomaticallyEligibleLineups as propose}
  from '../dist/core/m1-v84-automatically-eligible-lineups.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V32ExposureJournal}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const original=createInitialCareer(catalog,catalog.clubs[0].id,42,'m1-v84-case');
const start=startM1V32ExposureJournal(original);
assert.equal(start.ok,true);
const schedule=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id));
const prematch=(fixture,seed=1)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,
  homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});

test('v84 empty-history first match proposes both valid source-gated squads without mutation',()=>{
  const originalSnapshot=structuredClone(original);
  const journalSnapshot=structuredClone(start.journal);
  const input=prematch(schedule[0].fixtures[0]);
  const result=propose(original,start.journal,input);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.deepEqual(result.homeLineup,input.homeLineup);
  assert.deepEqual(result.awayLineup,input.awayLineup);
  assert.deepEqual(result.excludedMedicalPlayers,[]);
  assert.deepEqual(result.excludedAutomaticBanPlayers,[]);
  assert.equal(result.bothClubsAutomaticBansVerified,true);
  assert.equal(result.subsequentV76AdmissionStillRequired,true);
  assert.equal(result.noMedicalRecoveryOrTreatmentGranted,true);
  assert.equal(result.stateOrJournalModified,false);
  assert.deepEqual(original,originalSnapshot);
  assert.deepEqual(start.journal,journalSnapshot);
});

test('v84 incomplete history cannot be treated as absence of synthetic bans',()=>{
  const response=propose(original,start.journal,
    prematch(schedule[1].fixtures[0]));
  assert.equal(response.ok,false);
  assert.equal(response.error,'DISCIPLINE_NOT_RESOLVABLE');
  assert.equal(response.sourceError,'PRIOR_CLUB_MATCHES_MISSING');
});

test('v84 tampering, invalid seed, wrong fixture and malformed source fail closed',()=>{
  assert.equal(propose(original,start.journal,null).error,'INVALID_INPUT');
  const bad=structuredClone(start.journal);
  bad.revision=1;
  assert.equal(propose(original,bad,prematch(schedule[0].fixtures[0])).error,
    'MEDICAL_OR_JOURNAL_DENIED');
  const malformed=prematch(schedule[0].fixtures[0],0);
  const response=propose(original,start.journal,malformed);
  assert.equal(response.ok,false);
  assert.equal(response.error,'DISCIPLINE_NOT_RESOLVABLE');
  assert.equal(response.sourceError,'INVALID_PREMATCH');
  const altered=prematch({...schedule[0].fixtures[0],round:43});
  assert.equal(propose(original,start.journal,altered).error,
    'MEDICAL_OR_JOURNAL_DENIED');
});
