import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotM1V8InterruptedMatch, verifyM1V8InterruptedMatch }
  from '../dist/core/m1-v8-interruption.js';
import { isPlainJsonTree } from '../dist/core/plain-json-tree.js';
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
const caution = {
  schemaVersion: 1, id: 'yellow', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: home.starters[1],
  elapsedSeconds: 300, kind: 'caution', origin: 'trusted-referee',
};
const attempt = (commands = [], referee = [], medical = [], seconds = 900) =>
  snapshotM1V8InterruptedMatch(
    prematch, policy, commands, referee, medical, seconds);
const check = (candidate, commands = [], referee = [], medical = []) =>
  verifyM1V8InterruptedMatch(
    prematch, policy, commands, referee, medical, 900, candidate);

test('ordinary synthetic interruption and JSON backup verify identically', () => {
  const observed = attempt([caution]);
  assert.equal(observed.ok, true, JSON.stringify(observed).slice(0, 250));
  assert.equal(isPlainJsonTree(observed.prefix), true);
  const saved = JSON.parse(JSON.stringify(observed.prefix));
  assert.deepEqual(saved, observed.prefix);
  assert.equal(check(observed.prefix, [caution]), true);
  assert.equal(check(saved, [caution]), true);
  assert.equal(saved.status, 'interrupted-awaiting-ruling');
  assert.equal(Object.hasOwn(saved, 'report'), false);
});

test('action getters and toJSON functions cannot run during source inspection', () => {
  let invoked = 0;
  const getter = { ...caution };
  Object.defineProperty(getter, 'elapsedSeconds', {
    enumerable: true, get() { invoked++; throw Error('getter invoked'); },
  });
  const withJson = { ...caution, toJSON() {
    invoked++;
    throw Error('toJSON invoked');
  } };
  const sparse = Array(1);
  const cycle = { ...caution };
  cycle.self = cycle;
  const cases = [[getter], [withJson], sparse, [cycle],
    [{ ...caution, invisible: undefined }]];
  for (const raw of cases) {
    assert.deepEqual(attempt(raw), { ok: false, error: 'FUTURE_ACTION' });
    assert.deepEqual(attempt([], raw), { ok: false, error: 'FUTURE_ACTION' });
    assert.deepEqual(attempt([], [], raw),
      { ok: false, error: 'FUTURE_ACTION' });
  }
  assert.equal(invoked, 0);
});

test('forged candidate snapshot cannot execute nested getter or fake result', () => {
  const observed = attempt();
  assert.equal(observed.ok, true);
  const prefix = observed.prefix;
  let invoked = 0;
  const payload = { ...prefix };
  Object.defineProperty(payload, 'events', {
    enumerable: true, get() { invoked++; throw Error('read forged events'); },
  });
  assert.equal(check(payload), false);
  const nested = structuredClone(prefix);
  nested.provisionalScore = { home: 0, away: 0 };
  Object.defineProperty(nested.provisionalScore, 'home', {
    enumerable: true, get() { invoked++; return 0; },
  });
  assert.equal(check(nested), false);
  const extra = { ...prefix, extra: Symbol('invisible') };
  assert.equal(check(extra), false);
  assert.equal(invoked, 0);
});

test('medical JSON sources are rejected before hidden metadata is dropped', () => {
  const altered = { ...caution };
  Object.defineProperty(altered, 'hidden', { value: 'secret' });
  const alias = { ...caution };
  assert.deepEqual(attempt([], [], [altered]),
    { ok: false, error: 'FUTURE_ACTION' });
  assert.deepEqual(attempt([], [], [alias, alias]),
    { ok: false, error: 'FUTURE_ACTION' });
  assert.deepEqual(attempt([], [], [{ ...caution, bad: Infinity }]),
    { ok: false, error: 'FUTURE_ACTION' });
});
