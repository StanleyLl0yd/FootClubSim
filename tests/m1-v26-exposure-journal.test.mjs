import test from 'node:test';
import assert from 'node:assert/strict';
import { startM1V26ExposureJournal as start,
  validateM1V26ExposureJournal as validate,
  applyM1V26ExposureBatch as apply }
  from '../dist/core/m1-v26-exposure-journal.js';
import { deriveM1V24PhysicalExposure as derive }
  from '../dist/core/m1-v24-physical-exposure.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { createInitialCareer } from '../dist/core/save.js';

const catalog = createSyntheticRplScaleCatalog(77);
const career = createInitialCareer(catalog, catalog.clubs[0].id,
  42, 'v26-exposure-career');
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures);
const policy = {
  home: {assignedActor: {kind: 'player'}, availableStaffIds: []},
  away: {assignedActor: {kind: 'player'}, availableStaffIds: []},
};
const prematch = (fixture, seed) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog,
  homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: {starterCount: 11, maxBench: 12, maxForeignersOnField: 7},
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const success = r => {
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  return r.journal;
};
const failed = (r, code) => assert.deepEqual(r, {ok: false, error: code});
function request(fixture, revision, seed = 1) {
  const input = prematch(fixture, seed);
  const result = derive(input, policy);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 250));
  return {
    schemaVersion: 5, commandId: 'apply-' + revision,
    careerId: career.careerId, expectedRevision: revision,
    prematch: input, policy,
    halfTimeCommands: [], inPlayCommands: [], result,
  };
}
const empty = () => success(start(career));

test('v26 isolated replay stores real source-derived exposure, never inferred authority', () => {
  const cmd = request(fixtures[0], 0);
  const inputCopy = structuredClone(cmd);
  const journal0 = empty();
  const journal = success(apply(career, journal0, [cmd], 0));
  assert.equal(journal.schemaVersion, 5);
  assert.equal(journal.revision, 1);
  assert.equal(journal0.revision, 0);
  const item = journal.results[0];
  assert.equal(item.fixtureId, fixtures[0].id);
  assert.equal(item.facts.rulesId, cmd.result.rulesId);
  assert.deepEqual(item.facts.score, cmd.result.match.match.finalScore);
  assert.deepEqual(item.facts.playerRows, cmd.result.playerRows);
  assert.deepEqual(item.facts.aggregatedEvents, cmd.result.aggregatedEvents);
  assert.deepEqual(item.facts.teamPhysicalPlayerSeconds,
    cmd.result.teamPhysicalPlayerSeconds);
  assert.equal(item.facts.eventCount, cmd.result.match.match.events.length);
  assert.equal(item.facts.fatigueDeltasCalibrated, false);
  assert.equal(item.facts.medicalAuthorityAuthenticated, false);
  assert.equal(item.facts.sanctionsAuthenticated, false);
  assert.equal(item.facts.officialLeaguePointsAwarded, false);
  assert.equal(Object.hasOwn(item.source.prematch, 'catalog'), false);
  assert.equal(Object.hasOwn(item, 'events'), false);
  assert.deepEqual(success(validate(career, JSON.parse(JSON.stringify(journal)))),
    journal);
  assert.deepEqual(cmd, inputCopy);
  cmd.prematch.rngSeed = 123456;
  assert.equal(item.source.prematch.rngSeed, 1);
});

test('all-or-nothing batch, stale revision, retries and fixture duplicates', () => {
  const first = request(fixtures[0], 0);
  const second = request(fixtures[1], 1, 2);
  const orig = empty(), before = structuredClone(orig);
  const accepted = success(apply(career, orig, [first, second], 0));
  assert.equal(accepted.revision, 2);
  assert.deepEqual(orig, before);
  assert.deepEqual(success(validate(career, accepted)), accepted);
  failed(apply(career, orig, [first, {...second, expectedRevision: 0}]),
    'STALE_REVISION');
  assert.deepEqual(orig, before);
  failed(apply(career, accepted, [first]), 'DUPLICATE_COMMAND');
  failed(apply(career, accepted,
    [{...request(fixtures[0], 2), commandId: 'different-id'}]),
    'DUPLICATE_FIXTURE');
  failed(apply(career, accepted, [request(fixtures[2], 2)], 1),
    'CAS_REVISION_MISMATCH');
  failed(apply(career, orig, []), 'INVALID_BATCH');
});

test('source/projection spoofing, old schemas and poisoned historical rows fail closed', () => {
  const cmd = request(fixtures[0], 0);
  const j = success(apply(career, empty(), [cmd]));
  const altered = structuredClone(j);
  altered.results[0].facts.playerRows[0].physicalSeconds++;
  failed(validate(career, altered), 'INVALID_JOURNAL');
  failed(apply(career, altered, [request(fixtures[1], 1)]),
    'INVALID_JOURNAL');
  const other = structuredClone(j);
  other.results[0].source.prematch.rngSeed++;
  failed(validate(career, other), 'INVALID_JOURNAL');
  const forgedScore = structuredClone(cmd);
  forgedScore.result.match.match.finalScore.home++;
  failed(apply(career, empty(), [forgedScore]), 'INVALID_MATCH_RESULT');
  failed(apply(career, empty(),
    [{...cmd, prematch: {...cmd.prematch, catalog: {...catalog,
      clubs: []}}}]), 'UNTRUSTED_PACK');
  failed(validate(career, {...j, schemaVersion: 4}), 'INVALID_JOURNAL');
  failed(apply(career, empty(),
    [{...cmd, prematch: {...cmd.prematch,
      fixture: {...fixtures[0], id: 'forged-fixture'}}}]),
    'UNKNOWN_FIXTURE');
});

test('strict JSON source boundary rejects cycles/getters without executing them', () => {
  const cmd = request(fixtures[0], 0);
  let reads = 0;
  const evil = {...cmd, prematch: {...cmd.prematch}};
  Object.defineProperty(evil.prematch, 'rngSeed', {
    enumerable: true, get() {reads++; return 1;},
  });
  failed(apply(career, empty(), [evil]), 'INVALID_APPLY_COMMAND');
  assert.equal(reads, 0);
  const cycle = {...cmd, policy: {...policy}};
  cycle.policy.cycle = cycle.policy;
  failed(apply(career, empty(), [cycle]), 'INVALID_APPLY_COMMAND');
  failed(start({...career, revision: 999}), 'INVALID_INITIAL_CAREER');
});
