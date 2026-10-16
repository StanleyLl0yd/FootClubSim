import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotM1V8InterruptedMatch, verifyM1V8InterruptedMatch }
  from '../dist/core/m1-v8-interruption.js';
import { simulateM1V8MedicalPhases } from '../dist/core/m1-v8-medical-phases.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const home = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.awayClubId));
const homeOut = home.starters.filter(id => positions.get(id) !== 'GK');
const awayOut = away.starters.find(id => positions.get(id) !== 'GK');
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
const exit = {
  schemaVersion: 1, id: 'medical-exit', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: homeOut[0], elapsedSeconds: 0,
  kind: 'treatment-exit', reason: 'medical-staff-entered',
  restartAtRunningSeconds: 15,
};
const returned = {
  schemaVersion: 1, id: 'medical-return', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: homeOut[0], elapsedSeconds: 300,
  kind: 'treatment-return', returnContext: 'running-clock', ballInPlay: true,
  entryBoundary: 'touchline', refereeSignalId: 'synthetic-trusted-claim',
};
const decisions = [
  { schemaVersion: 1, decisionId: 'own', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: awayOut, elapsedSeconds: 300,
    kind: 'own-goal' },
  { schemaVersion: 1, decisionId: 'pen', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: homeOut[0], elapsedSeconds: 600,
    kind: 'penalty-kick', outcome: 'scored' },
];
const take = (commands = [], referee = decisions, medical = [exit, returned],
  cutoff = 900, input = prematch) =>
  snapshotM1V8InterruptedMatch(input, policy, commands, referee, medical, cutoff);
function good(result) {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 220));
  return result.prefix;
}

test('v8 interruption includes medical events and special goals without full time', () => {
  const prefix = good(take());
  const full = simulateM1V8MedicalPhases(
    prematch, policy, [], decisions, [exit, returned]);
  assert.equal(full.ok, true);
  assert.equal(prefix.engineVersion, '7');
  assert.equal(prefix.eventSchemaVersion, 8);
  assert.equal(prefix.status, 'interrupted-awaiting-ruling');
  assert.equal(prefix.interruptedAtSeconds, 900);
  assert.equal(prefix.rngDraws, 15);
  const rng = new SeededRng(42);
  for (let i = 0; i < 15; i++) rng.nextFloat();
  assert.equal(prefix.rngState, rng.snapshot());
  assert.deepEqual(prefix.events, full.events.filter(e => e.elapsedSeconds < 900));
  assert.equal(prefix.events.some(e => e.type === 'full-time'), false);
  assert.equal(prefix.events.filter(e => e.type === 'medical').length, 2);
  assert.equal(prefix.events.filter(e => e.type === 'adjudication').length, 2);
  const open = prefix.events.filter(e => e.type === 'shot' &&
    e.teamId === fixture.homeClubId && e.outcome === 'goal').length;
  assert.equal(prefix.provisionalScore.home, open + 2);
  assert.equal(prefix.onFieldAtInterruption.home.length, 11);
  assert.deepEqual(prefix.offFieldAtInterruption, []);
  assert.ok(verifyM1V8InterruptedMatch(
    prematch, policy, [], decisions, [exit, returned], 900, prefix));
  assert.equal(Object.hasOwn(prefix, 'report'), false);
  assert.equal(Object.hasOwn(prefix, 'points'), false);
});

test('unfinished ordinary treatment remains an absence at the interruption', () => {
  const prefix = good(take([], [], [exit], 300));
  assert.deepEqual(prefix.offFieldAtInterruption, [homeOut[0]]);
  assert.equal(prefix.onFieldAtInterruption.home.length, 10);
  assert.equal(prefix.onFieldAtInterruption.home.includes(homeOut[0]), false);
  assert.equal(prefix.rngDraws, 5);
  assert.equal(prefix.events.filter(e => e.type === 'medical').length, 1);
  assert.equal(prefix.events.some(e => e.type === 'shot' &&
    e.playerId === homeOut[0]), false);
});

test('future medical actions, retrospective commands and unobserved restarts fail', () => {
  assert.deepEqual(take([], decisions, [exit, returned], 600),
    { ok: false, error: 'FUTURE_ACTION' });
  assert.deepEqual(take([], [], [exit, returned], 300),
    { ok: false, error: 'FUTURE_ACTION' });
  assert.deepEqual(take([], [], [{ ...exit, restartAtRunningSeconds: 1500 }], 300),
    { ok: false, error: 'FUTURE_ACTION' });
  assert.deepEqual(take([], [decisions[1]], [], 600),
    { ok: false, error: 'FUTURE_ACTION' });
  assert.deepEqual(take([{}], [], [], 300),
    { ok: false, error: 'FUTURE_ACTION' });
});

test('cutoff restricted to completed virtual phases before full time', () => {
  for (const t of [undefined, 0, -300, 1, 301, 5399, 5400, 5700, NaN, Infinity]) {
    assert.deepEqual(take([], [], [], t),
      { ok: false, error: 'INVALID_INTERRUPTION' });
  }
  const earliest = good(take([], [], [], 300));
  assert.equal(earliest.events.some(e => e.elapsedSeconds >= 300), false);
});

test('candidate forgery and changed trusted medical sources cannot pass replay', () => {
  const prefix = good(take());
  for (const forged of [
    { ...prefix, status: 'full-time' },
    { ...prefix, rngState: prefix.rngState ^ 1 },
    { ...prefix, interruptedAtSeconds: 1200 },
    { ...prefix, provisionalScore: { home: 99, away: 0 } },
    { ...prefix, offFieldAtInterruption: [homeOut[0]] },
    { ...prefix, events: prefix.events.slice(1) },
    { ...prefix, events: [...prefix.events].reverse() },
    { ...prefix, extra: true },
  ]) assert.equal(verifyM1V8InterruptedMatch(
    prematch, policy, [], decisions, [exit, returned], 900, forged), false);
  assert.equal(verifyM1V8InterruptedMatch(
    prematch, policy, [], decisions, [exit], 900, prefix), false);
});

test('interruption snapshot never mutates medical actions or pre-match inputs', () => {
  const saved = structuredClone(prematch);
  const medical = structuredClone([exit, returned]);
  const originalMedical = structuredClone(medical);
  good(take([], decisions, medical, 1200));
  assert.deepEqual(prematch, saved);
  assert.deepEqual(medical, originalMedical);
});
