import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8FixtureCoverage }
  from '../dist/core/m1-v8-fixture-coverage.js';
import { startM1V8MatchJournal, applyM1V8MatchResultBatch }
  from '../dist/core/m1-v8-result-journal.js';
import { startM1V7MatchJournal }
  from '../dist/core/m1-v7-result-journal.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';

const catalog = createSyntheticRplScaleCatalog(77);
const initial = createInitialCareer(
  catalog, catalog.clubs[0].id, 42, 'v8-fixture-coverage');
const rounds = generateDoubleRoundRobin(catalog.clubs.map(c => c.id));
const byId = new Map(catalog.clubs.map(c => [c.id, c]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function source(fixture, revision) {
  const prematch = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog,
    homeLineup: defaultSyntheticLineup(byId.get(fixture.homeClubId)),
    awayLineup: defaultSyntheticLineup(byId.get(fixture.awayClubId)),
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: revision + 42,
  };
  const result = simulateM1V8MedicalPhases(prematch, policy, [], [], []);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 200));
  return {
    schemaVersion: 4, commandId: 'fixture-cov-' + revision,
    careerId: initial.careerId, expectedRevision: revision,
    prematch, policy, plannedCommands: [], trustedDecisions: [],
    medicalActions: [], result,
  };
}
function empty() {
  const started = startM1V8MatchJournal(initial);
  assert.equal(started.ok, true);
  return started.journal;
}
function applied(fixtures) {
  const commands = fixtures.map((fixture, index) => source(fixture, index));
  const result = applyM1V8MatchResultBatch(initial, empty(), commands);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 250));
  return result.journal;
}
function examine(journal) {
  const result = deriveM1VerifiedV8FixtureCoverage(initial, journal);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 250));
  return result.report;
}
test('empty replay journal shows 30 pending rounds and all 240 fixtures', () => {
  const report = examine(empty());
  assert.equal(report.status,
    'SYNTHETIC_V8_SOURCE_REPLAY_COVERAGE_NO_STANDINGS');
  assert.equal(report.expectedFixtures, 240);
  assert.equal(report.completedFixtures, 0);
  assert.equal(report.pendingFixtures, 240);
  assert.equal(report.completedRounds, 0);
  assert.equal(report.firstIncompleteRound, 1);
  assert.equal(report.seasonComplete, false);
  assert.equal(report.rounds.length, 30);
  assert.ok(report.rounds.every(r => r.expectedFixtures === 8));
  assert.equal(report.clubs.length, 16);
  for (const club of report.clubs) {
    assert.deepEqual([
      club.completedHome, club.completedAway,
      club.pendingHome, club.pendingAway,
    ], [0, 0, 15, 15]);
  }
});
test('fixture coverage is independent of the journal insertion order', () => {
  const a = rounds[0].fixtures[0];
  const b = rounds[0].fixtures[1];
  const journal = applied([b, a]);
  const saved = structuredClone(journal);
  const report = examine(journal);
  assert.equal(report.journalRevision, 2);
  assert.equal(report.completedFixtures, 2);
  assert.equal(report.pendingFixtures, 238);
  assert.equal(report.rounds[0].complete, false);
  assert.deepEqual(report.rounds[0].completedFixtureIds, [a.id, b.id]);
  assert.deepEqual(report.rounds[0].pendingFixtureIds,
    rounds[0].fixtures.slice(2).map(x => x.id));
  assert.equal(report.completedRounds, 0);
  assert.equal(report.firstIncompleteRound, 1);
  assert.equal(report.clubs.reduce((n, c) => n + c.completedHome, 0), 2);
  assert.equal(report.clubs.reduce((n, c) => n + c.completedAway, 0), 2);
  assert.deepEqual(journal, saved);
});
test('fully completed first synthetic round is reported without league points', () => {
  const journal = applied(rounds[0].fixtures);
  const report = examine(journal);
  assert.equal(report.completedFixtures, 8);
  assert.equal(report.pendingFixtures, 232);
  assert.equal(report.completedRounds, 1);
  assert.equal(report.firstIncompleteRound, 2);
  assert.equal(report.rounds[0].complete, true);
  assert.deepEqual(report.rounds[0].pendingFixtureIds, []);
  assert.deepEqual(report.rounds[0].completedFixtureIds,
    rounds[0].fixtures.map(f => f.id));
  assert.equal(Object.hasOwn(report, 'standings'), false);
  assert.equal(Object.hasOwn(report, 'points'), false);
});
test('out-of-order round completion keeps earliest pending round visible', () => {
  const later = rounds[2].fixtures[0];
  const report = examine(applied([later]));
  assert.equal(report.rounds[2].completedFixtureIds[0], later.id);
  assert.equal(report.completedRounds, 0);
  assert.equal(report.firstIncompleteRound, 1);
});
test('corrupted and legacy journals cannot make a fixture appear completed', () => {
  const valid = applied([rounds[0].fixtures[0]]);
  const corrupt = structuredClone(valid);
  corrupt.results[0].dossier.match.home.goals++;
  const before = structuredClone(corrupt);
  assert.deepEqual(deriveM1VerifiedV8FixtureCoverage(initial, corrupt),
    { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(corrupt, before);
  const old = startM1V7MatchJournal(initial);
  assert.equal(old.ok, true);
  assert.deepEqual(deriveM1VerifiedV8FixtureCoverage(initial, old.journal),
    { ok: false, error: 'INVALID_JOURNAL' });
});
