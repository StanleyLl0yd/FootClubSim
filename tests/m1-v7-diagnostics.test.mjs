import test from 'node:test';
import assert from 'node:assert/strict';
import { runM1V7SyntheticDiagnostics }
  from '../dist/core/m1-v7-diagnostics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.awayClubId));
const nonKeeper = home.starters.find(id =>
  catalog.players.find(p => p.id === id).primaryPosition !== 'GK');
const source = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const run = (plan, decisions) =>
  runM1V7SyntheticDiagnostics(source, policy, plan, decisions);
function ok(result) {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 150));
  return result.report;
}

test('new v7 cohort is deterministic with explicit sample size, seed range and intervals', () => {
  const plan = { firstSeed: 40, matchCount: 12 };
  const a = ok(run(plan)), b = ok(run(plan));
  assert.deepEqual(a, b);
  assert.equal(a.engineVersion, '6');
  assert.equal(a.eventSchemaVersion, 7);
  assert.equal(a.firstSeed, 40);
  assert.equal(a.lastSeed, 51);
  assert.equal(a.referenceStatus, 'NO_LICENSED_EXTERNAL_REFERENCE');
  assert.equal(a.refereeModel, 'NOT_GENERATED');
  assert.equal(a.adjudicationScenario, 'NONE');
  assert.equal(a.xgCoverage, 'open-play-only');
  assert.equal(a.outcomes.homeWin.count + a.outcomes.draw.count +
    a.outcomes.awayWin.count, 12);
  assert.equal(a.totals.goals, a.totals.openPlayGoals);
  assert.equal(a.totals.penaltyGoals, 0);
  assert.equal(a.totals.ownGoals, 0);
  for (const row of Object.values(a.outcomes)) {
    assert.equal(row.denominator, 12);
    assert.ok(row.rate >= row.wilson95.lower);
    assert.ok(row.rate <= row.wilson95.upper);
  }
  for (const value of Object.values(a.means)) {
    assert.equal(value.count, 12);
    assert.ok(Number.isFinite(value.mean));
    assert.ok(Number.isFinite(value.sampleStdDev));
  }
});

test('forced referee scenario explicitly counts special goals, not generated foul rates', () => {
  const decisions = [{
    schemaVersion: 1, decisionId: 'penalty', fixtureId: fixture.id,
    elapsedSeconds: 300, teamId: fixture.homeClubId,
    playerId: nonKeeper, kind: 'penalty-kick', outcome: 'scored',
  }];
  const a = ok(run({ firstSeed: 1, matchCount: 6 }, decisions));
  const b = ok(run({ firstSeed: 1, matchCount: 6 }, []));
  assert.equal(a.adjudicationScenario, 'EXOGENOUS_FIXED');
  assert.equal(a.totals.penaltyGoals, 6);
  assert.equal(a.totals.penaltyAttempts, 6);
  assert.equal(a.totals.goals, b.totals.goals + 6);
  assert.equal(a.totals.shots, b.totals.shots + 6);
  assert.equal(a.means.openPlayXgPerMatch.mean, b.means.openPlayXgPerMatch.mean);
  assert.equal(a.refereeModel, 'NOT_GENERATED');
});

test('bounded seed plan rejects invalid and overflowing diagnostic ranges', () => {
  for (const plan of [
    null, {}, { firstSeed: 0, matchCount: 1 },
    { firstSeed: 1, matchCount: 0 },
    { firstSeed: 1, matchCount: 10001 },
    { firstSeed: 0xffffffff, matchCount: 2 },
    { firstSeed: 1, matchCount: 1.5 },
  ]) assert.deepEqual(run(plan), { ok: false, error: 'INVALID_PLAN' });
  assert.deepEqual(run({ firstSeed: 2, matchCount: 1 }, Array(19).fill({})),
    { ok: false, error: 'INVALID_PLAN' });
});
