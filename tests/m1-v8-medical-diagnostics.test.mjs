import test from 'node:test';
import assert from 'node:assert/strict';
import { runM1V8PairedMedicalDiagnostics }
  from '../dist/core/m1-v8-medical-diagnostics.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
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
const byId = new Map(catalog.players.map(p => [p.id, p]));
const playerId = home.starters.find(id => byId.get(id).primaryPosition !== 'GK');
const keeper = home.starters.find(id => byId.get(id).primaryPosition === 'GK');
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
function medical(player = playerId) {
  return [
    { schemaVersion: 1, id: 'exit', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: player, elapsedSeconds: 0,
      kind: 'treatment-exit', reason: 'medical-staff-entered',
      restartAtRunningSeconds: 15 },
    { schemaVersion: 1, id: 'return', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: player, elapsedSeconds: 1500,
      kind: 'treatment-return', returnContext: 'running-clock',
      ballInPlay: true, entryBoundary: 'touchline',
      refereeSignalId: 'external-proof-required' },
  ];
}
const run = (options, actions = medical()) =>
  runM1V8PairedMedicalDiagnostics(prematch, policy, options, actions);

test('medical/no-medical paired seeds produce reproducible counterfactual intervals', () => {
  const options = { firstSeed: 11, matchCount: 24 };
  const first = run(options);
  const second = run(options);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.deepEqual(first, second);
  const report = first.report;
  assert.equal(report.engineVersion, '7');
  assert.equal(report.eventSchemaVersion, 8);
  assert.equal(report.matchCount, 24);
  assert.equal(report.medicalActionCount, 2);
  assert.equal(report.lastSeed, 34);
  assert.equal(report.referenceStatus, 'NO_LICENSED_EXTERNAL_REFERENCE');
  assert.equal(report.scenario, 'EXOGENOUS_FIXED_MEDICAL_ACTIONS_NOT_GENERATED');
  for (const item of Object.values(report.pairedDifferences)) {
    assert.equal(item.count, 24);
    assert.ok(Number.isFinite(item.mean));
    assert.ok(item.normalMean95.lower <= item.mean);
    assert.ok(item.normalMean95.upper >= item.mean);
  }
  for (const item of [report.shotLedgerChanged, report.changedScoreline]) {
    assert.equal(item.denominator, 24);
    assert.equal(item.rate, item.count / 24);
    // Wilson endpoint arithmetic can differ from exact 0/1 rates by
    // machine epsilon when every paired seed has the same outcome.
    assert.ok(item.wilson95.lower - 1e-12 <= item.rate);
    assert.ok(item.wilson95.upper + 1e-12 >= item.rate);
  }
});

test('one-seed confidence intervals are explicitly unavailable', () => {
  const result = run({ firstSeed: 0xffffffff, matchCount: 1 });
  assert.equal(result.ok, true, JSON.stringify(result));
  for (const metric of Object.values(result.report.pairedDifferences)) {
    assert.equal(metric.sampleStdDev, null);
    assert.equal(metric.normalMean95, null);
  }
});

test('invalid plans and unverifiable medical actions fail closed', () => {
  for (const p of [
    null, {}, { firstSeed: 0, matchCount: 1 },
    { firstSeed: 1, matchCount: 0 },
    { firstSeed: 1, matchCount: 10001 },
    { firstSeed: 0xffffffff, matchCount: 2 },
    { firstSeed: 1, matchCount: 1.1 },
  ]) assert.deepEqual(run(p), { ok: false, error: 'INVALID_PLAN' });
  assert.deepEqual(run({ firstSeed: 1, matchCount: 1 }, []),
    { ok: false, error: 'INVALID_PLAN' });
  assert.deepEqual(run({ firstSeed: 1, matchCount: 1 }, medical(keeper)),
    { ok: false, error: 'MATCH_FAILED' });
});

test('diagnostics do not mutate prematch or asserted medical action sources', () => {
  const before = structuredClone(prematch);
  const actions = medical();
  const saved = structuredClone(actions);
  const result = run({ firstSeed: 1, matchCount: 4 }, actions);
  assert.equal(result.ok, true);
  assert.deepEqual(prematch, before);
  assert.deepEqual(actions, saved);
});

test('medical event insertion alone is not reported as a changed shot ledger', () => {
  const short = medical();
  short[1] = { ...short[1], elapsedSeconds: 300 };
  let unchangedSeed = null;
  const facts = events => events.filter(e => e.type === 'shot')
    .map(({ sequence, ...shot }) => shot);
  for (let seed = 1; seed <= 128; seed++) {
    const input = { ...prematch, rngSeed: seed };
    const normal = simulateM1V8MedicalPhases(input, policy, [], [], []);
    const variant = simulateM1V8MedicalPhases(input, policy, [], [], short);
    assert.equal(normal.ok, true);
    assert.equal(variant.ok, true);
    if (JSON.stringify(facts(normal.events)) === JSON.stringify(facts(variant.events))) {
      unchangedSeed = seed;
      break;
    }
  }
  assert.notEqual(unchangedSeed, null, 'a no-shot-treatment phase exists');
  const result = run({ firstSeed: unchangedSeed, matchCount: 1 }, short);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.report.shotLedgerChanged.count, 0);
  assert.equal(result.report.changedScoreline.count, 0);
});
