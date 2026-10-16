import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotM1V7InterruptedMatch, verifyM1V7InterruptedMatch }
  from '../dist/core/m1-v7-interruption.js';
import { simulateM1V7Phases } from '../dist/core/m1-v7-adjudications.js';
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
const taker = home.starters.find(id => positions.get(id) !== 'GK');
const defender = away.starters.find(id => positions.get(id) !== 'GK');
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
const decisions = [
  { schemaVersion: 1, decisionId: 'p1', fixtureId: fixture.id,
    elapsedSeconds: 300, teamId: fixture.homeClubId, playerId: taker,
    kind: 'penalty-kick', outcome: 'scored' },
  { schemaVersion: 1, decisionId: 'og1', fixtureId: fixture.id,
    elapsedSeconds: 600, teamId: fixture.homeClubId, playerId: defender,
    kind: 'own-goal' },
];
const take = (commands, refereeing, second) =>
  snapshotM1V7InterruptedMatch(prematch, policy, commands, refereeing, second);
function good(result) {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 160));
  return result.prefix;
}

test('interrupted prefix has only elapsed events and provisional goals, never full time', () => {
  const prefix = good(take([], decisions, 900));
  const full = simulateM1V7Phases(prematch, policy, [], decisions);
  assert.equal(full.ok, true);
  assert.equal(prefix.schemaVersion, 1);
  assert.equal(prefix.status, 'interrupted-awaiting-ruling');
  assert.equal(prefix.interruptedAtSeconds, 900);
  assert.equal(prefix.rngDraws, 15);
  const rng = new SeededRng(42);
  for (let i = 0; i < 15; i++) rng.nextFloat();
  assert.equal(prefix.rngState, rng.snapshot());
  assert.deepEqual(prefix.events, full.events.filter(e => e.elapsedSeconds < 900));
  assert.equal(prefix.events.some(e => e.type === 'v6-event' &&
    e.source.type === 'full-time'), false);
  assert.equal(prefix.provisionalScore.home,
    full.events.filter(e => e.type === 'v6-event' && e.source.type === 'shot' &&
      e.source.teamId === fixture.homeClubId && e.source.outcome === 'goal' &&
      e.elapsedSeconds < 900).length + 2);
  assert.ok(verifyM1V7InterruptedMatch(prematch, policy, [],
    decisions, 900, prefix));
});

test('future referee decisions and commands cannot enter earlier snapshots', () => {
  const future = { ...decisions[1], elapsedSeconds: 900 };
  assert.deepEqual(take([], [decisions[0], future], 900),
    { ok: false, error: 'FUTURE_ACTION' });
  const card = { schemaVersion: 1, id: 'later', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: taker, kind: 'caution',
    origin: 'trusted-referee', elapsedSeconds: 900 };
  assert.deepEqual(take([card], [], 900),
    { ok: false, error: 'FUTURE_ACTION' });
  assert.deepEqual(take([{}], [], 900),
    { ok: false, error: 'FUTURE_ACTION' });
});

test('interruptions are only at already elapsed legal clock checkpoints', () => {
  for (const t of [undefined, -300, 0, 1, 301, 5400, 5700, NaN, Infinity]) {
    assert.deepEqual(take([], [], t), { ok: false, error: 'INVALID_INTERRUPTION' });
  }
  const earliest = good(take([], [], 300));
  assert.equal(earliest.rngDraws, 5);
  assert.equal(earliest.interruptedAtSeconds, 300);
});

test('a saved changed score, order, clock or RNG is never accepted by replay', () => {
  const prefix = good(take([], decisions, 900));
  for (const altered of [
    { ...prefix, status: 'full-time' },
    { ...prefix, interruptedAtSeconds: 1200 },
    { ...prefix, rngState: 1 },
    { ...prefix, events: [...prefix.events].reverse() },
    { ...prefix, provisionalScore: { ...prefix.provisionalScore, home: 99 } },
    { ...prefix, events: [...prefix.events, { ...prefix.events[0], id: 'late',
      elapsedSeconds: 3900 }] },
  ]) assert.equal(verifyM1V7InterruptedMatch(prematch, policy,
    [], decisions, 900, altered), false);
  assert.equal(verifyM1V7InterruptedMatch(prematch, policy,
    [], [], 900, prefix), false);
});

test('source remains immutable and status is never a career result', () => {
  const original = structuredClone(prematch);
  const orders = structuredClone(decisions);
  const prefix = good(take([], decisions, 1200));
  assert.equal(prefix.status, 'interrupted-awaiting-ruling');
  assert.equal(Object.hasOwn(prefix, 'report'), false);
  assert.equal(Object.hasOwn(prefix, 'points'), false);
  assert.deepEqual(prematch, original);
  assert.deepEqual(decisions, orders);
});
