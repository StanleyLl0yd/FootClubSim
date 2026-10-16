import test from 'node:test';
import assert from 'node:assert/strict';
import { runM1V7PairedFinishingExperiment }
  from '../dist/core/m1-v7-attribute-diagnostics.js';
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
const map = new Map(catalog.players.map(p => [p.id, p]));
const pick = home.starters.find(id => map.get(id).primaryPosition !== 'GK' &&
  map.get(id).attributes.finishing <= 80);
assert.ok(pick);
const keeper = home.starters.find(id => map.get(id).primaryPosition === 'GK');
const prematch = {
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
const plan = (count = 16, delta = 10, playerId = pick) => ({
  firstSeed: 1, matchCount: count, finishingDelta: delta, playerId,
});
const diagnose = (options = plan(), source = prematch) =>
  runM1V7PairedFinishingExperiment(source, policy, options);
test('one valid paired cohort records exact sample, deltas and confidence metadata', () => {
  const before = structuredClone(prematch);
  const first = diagnose(plan());
  const second = diagnose(plan());
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.deepEqual(first, second);
  assert.equal(first.report.matchCount, 16);
  assert.equal(first.report.lastSeed, 16);
  assert.equal(first.report.playerId, pick);
  assert.equal(first.report.variantFinishing,
    first.report.originalFinishing + 10);
  assert.equal(first.report.status, 'SYNTHETIC_COUNTERFACTUAL_NOT_CALIBRATED');
  assert.equal(first.report.referenceStatus, 'NO_LICENSED_EXTERNAL_REFERENCE');
  for (const metric of Object.values(first.report.pairedChanges)) {
    assert.equal(metric.count, 16);
    assert.ok(Number.isFinite(metric.total) && Number.isFinite(metric.mean));
    assert.ok(metric.normalMean95 !== null);
    assert.ok(metric.normalMean95.lower <= metric.mean + 1e-9);
    assert.ok(metric.normalMean95.upper >= metric.mean - 1e-9);
  }
  const signs = first.report.selectedShotDirection;
  assert.equal(signs.increased.count + signs.unchanged.count + signs.decreased.count, 16);
  assert.deepEqual(prematch, before);
});
test('valid boundary cohorts and negative finishing perturbation are explicit', () => {
  const result = diagnose({ ...plan(1, -1), firstSeed: 0xffffffff });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.report.firstSeed, 0xffffffff);
  assert.equal(result.report.lastSeed, 0xffffffff);
  assert.equal(result.report.pairedChanges.clubGoals.normalMean95, null);
});
test('reject invalid seed, unreasonable delta, missing/goalkeeper and inactive actors', () => {
  const examples = [
    { ...plan(), firstSeed: 0 },
    { ...plan(), matchCount: 0 },
    { ...plan(), matchCount: 10001 },
    { ...plan(), firstSeed: 0xffffffff, matchCount: 2 },
    { ...plan(), finishingDelta: 0 },
    { ...plan(), finishingDelta: 21 },
  ];
  for (const candidate of examples) {
    assert.deepEqual(diagnose(candidate), { ok: false, error: 'INVALID_PLAN' });
  }
  for (const playerId of [keeper, home.bench[0], 'unknown-player']) {
    assert.deepEqual(diagnose(plan(1, 1, playerId)),
      { ok: false, error: 'INVALID_PLAYER' });
  }
  assert.deepEqual(diagnose(plan(1, 1), { ...prematch, rngSeed: 0 }),
    { ok: false, error: 'INVALID_SOURCE' });
});
