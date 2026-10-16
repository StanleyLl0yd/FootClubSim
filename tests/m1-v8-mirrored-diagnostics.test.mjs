import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { runM1V8MirroredHomeAwayDiagnostics }
  from '../dist/core/m1-v8-mirrored-diagnostics.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const homeFixture = fixtures[0];
const awayFixture = fixtures.find(f =>
  f.homeClubId === homeFixture.awayClubId &&
  f.awayClubId === homeFixture.homeClubId);
assert.ok(awayFixture);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function source(fixture) {
  return {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog,
    homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 1,
  };
}
const home = source(homeFixture), away = source(awayFixture);
const examine = (firstSeed = 1, count = 8) =>
  runM1V8MirroredHomeAwayDiagnostics(home, away, policy, firstSeed, count);

test('a pair of reverse fixtures is reproducible with honest provenance', () => {
  const first = examine();
  const again = examine();
  assert.deepEqual(first, again);
  assert.equal(first.ok, true);
  const report = first.report;
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.status, 'SYNTHETIC_MIRRORED_LEGS_NOT_CALIBRATED');
  assert.equal(report.referenceStatus, 'NO_LICENSED_EXTERNAL_REFERENCE');
  assert.equal(report.pairCount, 8);
  assert.equal(report.matchesSimulated, 16);
  assert.equal(report.firstClubId, homeFixture.homeClubId);
  assert.equal(report.secondClubId, homeFixture.awayClubId);
  assert.equal(report.homeLegFixtureId, homeFixture.id);
  assert.equal(report.awayLegFixtureId, awayFixture.id);
  for (const metric of [
    report.aggregateGoalsPerTwoLegPair,
    report.netHomeGoalsPerFixture,
    report.firstClubHomeAwayGoalDifference,
    report.secondClubHomeAwayGoalDifference,
  ]) {
    assert.equal(metric.count, 8);
    assert.ok(Number.isFinite(metric.mean));
    assert.ok(metric.sampleStdDev >= 0);
    assert.ok(Number.isFinite(metric.normalMean95.lower));
    assert.ok(Number.isFinite(metric.normalMean95.upper));
  }
});

test('paired club measures equal independent per-leg match results', () => {
  const pair = examine(19, 1);
  assert.equal(pair.ok, true);
  const first = simulateM1V8MedicalPhases(
    { ...home, rngSeed: 19 }, policy, [], [], []);
  const second = simulateM1V8MedicalPhases(
    { ...away, rngSeed: 19 }, policy, [], [], []);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const aHome = first.report.home.goals;
  const bAway = first.report.away.goals;
  const bHome = second.report.home.goals;
  const aAway = second.report.away.goals;
  assert.equal(pair.report.aggregateGoalsPerTwoLegPair.total,
    aHome + bAway + bHome + aAway);
  assert.equal(pair.report.netHomeGoalsPerFixture.mean,
    (aHome + bHome - bAway - aAway) / 2);
  assert.equal(pair.report.firstClubHomeAwayGoalDifference.mean,
    aHome - aAway);
  assert.equal(pair.report.secondClubHomeAwayGoalDifference.mean,
    bHome - bAway);
  assert.equal(pair.report.netHomeGoalsPerFixture.sampleStdDev, null);
  assert.equal(pair.report.netHomeGoalsPerFixture.normalMean95, null);
});

test('different seed windows and malformed pair inputs cannot be silently accepted', () => {
  const a = examine(1, 4), b = examine(21, 4);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.report.lastSeed, 4);
  assert.equal(b.report.lastSeed, 24);
  for (const [lhs, rhs, start, count] of [
    [home, home, 1, 2],
    [home, source(fixtures[1]), 1, 2],
    [home, { ...away, catalog: { ...catalog, packId: 'forged' } }, 1, 2],
    [home, { ...away, awayLineup: away.homeLineup }, 1, 2],
    [home, { ...away, rosterRules: {
      ...away.rosterRules, maxForeignersOnField: 8 } }, 1, 2],
    [home, { ...away, rulesPackVersion: 'unrelated-rule-edition' }, 1, 2],
    [home, { ...away, rngAlgorithmVersion: 'unrelated-prng' }, 1, 2],
    [home, { ...away, fixture: { ...away.fixture,
      round: away.fixture.round + 1 } }, 1, 2],
    [home, { ...away, fixture: { ...away.fixture,
      id: 'fabricated-second-leg' } }, 1, 2],
    [home, away, 0, 2],
    [home, away, 1, 0],
    [home, away, 1, 10001],
    [home, away, 0xffffffff, 2],
  ]) assert.deepEqual(
    runM1V8MirroredHomeAwayDiagnostics(lhs, rhs, policy, start, count),
    { ok: false, error: 'INVALID_PLAN' },
  );
});

test('CLI reports measured synthetic samples and rejects unknown parameters', () => {
  const output = JSON.parse(execFileSync(process.execPath,
    ['scripts/m1-v8-mirrored-diagnostics.mjs', '--count=2', '--first-seed=3'],
    { encoding: 'utf8' }));
  assert.equal(output.status, 'SYNTHETIC_MIRRORED_LEGS_NOT_CALIBRATED');
  assert.equal(output.pairCount, 2);
  assert.equal(output.matchesSimulated, 4);
  assert.equal(output.firstSeed, 3);
  assert.equal(output.lastSeed, 4);
  assert.ok(Number.isFinite(output.elapsedMs));
  assert.throws(() => execFileSync(process.execPath,
    ['scripts/m1-v8-mirrored-diagnostics.mjs', '--invalid=1'],
    { stdio: 'pipe' }));
});
