import test from 'node:test';
import assert from 'node:assert/strict';
import { m1Wilson95, M1_DIAGNOSTICS_SCHEMA_VERSION, runM1SyntheticDiagnostics }
  from '../dist/core/m1-diagnostics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const input = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog,
  homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};

test('Wilson intervals are bounded, symmetric and reject malformed denominators', () => {
  const all = m1Wilson95(50, 50);
  const none = m1Wilson95(0, 50);
  const half = m1Wilson95(25, 50);
  assert.ok(all.lower > 0.9 && all.upper <= 1);
  assert.ok(none.lower >= 0 && none.upper < 0.1);
  assert.ok(Math.abs(all.lower - (1 - none.upper)) < 1e-12);
  assert.ok(half.lower < 0.5 && half.upper > 0.5);
  for (const pair of [[0, 0], [-1, 10], [11, 10], [1.5, 4], [1, NaN]]) {
    assert.equal(m1Wilson95(...pair), null);
  }
});

test('synthetic cohort outputs deterministic counts, uncertainty and no invented reference PASS', () => {
  assert.equal(M1_DIAGNOSTICS_SCHEMA_VERSION, 1);
  const a = runM1SyntheticDiagnostics(input, policy, { firstSeed: 1, matchCount: 32 });
  const b = runM1SyntheticDiagnostics(structuredClone(input), structuredClone(policy),
    { firstSeed: 1, matchCount: 32 });
  assert.equal(a.ok, true);
  assert.deepEqual(a, b);
  if (!a.ok) return;
  const report = a.report;
  assert.equal(report.status, 'SYNTHETIC_INTERNAL_ONLY_NOT_CALIBRATED');
  assert.equal(report.referenceStatus, 'NO_LICENSED_EXTERNAL_REFERENCE');
  assert.equal(report.matchCount, 32);
  assert.equal(report.firstSeed, 1);
  assert.equal(report.lastSeed, 32);
  assert.equal(report.actionEngineVersion, '2');
  const outcomes = report.outcomes;
  assert.equal(outcomes.homeWin.count + outcomes.draw.count + outcomes.awayWin.count, 32);
  assert.ok(outcomes.scorelessDraw.count <= outcomes.draw.count);
  assert.equal(report.meanGoalsPerMatch.count, 32);
  assert.equal(report.totalGoals, report.meanGoalsPerMatch.total);
  assert.equal(report.totalShots, report.meanShotsPerMatch.total);
  assert.ok(report.meanGoalsPerMatch.mean >= 0);
  assert.ok(report.meanShotsOnTargetPerMatch.total <= report.totalShots);
  assert.ok(report.meanGoalsPerMatch.total <= report.meanShotsOnTargetPerMatch.total);
  assert.equal(report.qualityBuckets.length, 10);
  assert.equal(report.qualityBuckets.reduce((sum, bucket) => sum + bucket.shots, 0),
    report.totalShots);
  assert.equal(report.qualityBuckets.reduce((sum, bucket) => sum + bucket.goals, 0),
    report.totalGoals);
  for (const bucket of report.qualityBuckets) {
    assert.ok(bucket.shots >= bucket.goals);
    assert.equal(bucket.lowSample, bucket.shots < 30);
    if (bucket.shots > 0) {
      assert.ok(bucket.predictedGoalRate >= 0 && bucket.predictedGoalRate <= 1);
      assert.ok(bucket.observedGoalRate >= 0 && bucket.observedGoalRate <= 1);
    } else {
      assert.equal(bucket.predictedGoalRate, null);
      assert.equal(bucket.observedGoalRate, null);
    }
  }
  assert.ok(report.brierScoreForShotGoal >= 0 && report.brierScoreForShotGoal <= 1);
  assert.ok(report.meanGoalsPerMatch.normalMean95.lower <= report.meanGoalsPerMatch.mean);
  assert.ok(report.meanGoalsPerMatch.normalMean95.upper >= report.meanGoalsPerMatch.mean);
});

test('bounded nonzero seed cohort rejects overflow, negative and huge workloads', () => {
  for (const config of [
    { firstSeed: 0, matchCount: 1 },
    { firstSeed: -1, matchCount: 1 },
    { firstSeed: 1, matchCount: 0 },
    { firstSeed: 1, matchCount: 10001 },
    { firstSeed: 0xffffffff, matchCount: 2 },
    { firstSeed: 1.5, matchCount: 3 },
    { firstSeed: 1, matchCount: Infinity },
  ]) {
    const result = runM1SyntheticDiagnostics(input, policy, config);
    assert.deepEqual(result, { ok: false, error: 'INVALID_PLAN' });
  }
});

test('invalid lineup/policy fail as diagnostic error rather than a synthesized score', () => {
  const corrupted = {
    ...input, homeLineup: { ...input.homeLineup, starters: ['forged-player'] },
  };
  assert.deepEqual(
    runM1SyntheticDiagnostics(corrupted, policy, { firstSeed: 1, matchCount: 1 }),
    { ok: false, error: 'MATCH_FAILED' },
  );
  assert.deepEqual(
    runM1SyntheticDiagnostics(input, {}, { firstSeed: 1, matchCount: 1 }),
    { ok: false, error: 'MATCH_FAILED' },
  );
});

test('seed range is an explicit immutable plan, not global randomness', () => {
  const first = runM1SyntheticDiagnostics(input, policy, { firstSeed: 80, matchCount: 12 });
  const second = runM1SyntheticDiagnostics(input, policy, { firstSeed: 80, matchCount: 12 });
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.report.firstSeed, 80);
    assert.equal(first.report.lastSeed, 91);
    assert.equal(first.report.meanShotsPerMatch.count, 12);
  }
});
