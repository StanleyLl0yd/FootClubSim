import test from 'node:test';
import assert from 'node:assert/strict';
import { admitM1ConfirmedSuspensions, M1_SUSPENSION_GATE_SCHEMA_VERSION }
  from '../dist/core/m1-confirmed-suspensions.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const schedule = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures);
const fixture = schedule[0];
const homeClub = catalog.clubs.find(c => c.id === fixture.homeClubId);
const awayClub = catalog.clubs.find(c => c.id === fixture.awayClubId);
const home = defaultSyntheticLineup(homeClub);
const away = defaultSyntheticLineup(awayClub);
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const ruling = (id, playerId = home.starters[0], affectedFixtureIds = [fixture.id]) => ({
  schemaVersion: M1_SUSPENSION_GATE_SCHEMA_VERSION, rulingId: id,
  kind: 'match-suspension', clubId: fixture.homeClubId,
  playerId, affectedFixtureIds,
});
const check = orders => admitM1ConfirmedSuspensions(prematch, orders);

test('the separately authorized empty fixture feed is a bounded valid snapshot', () => {
  const result = check([]);
  assert.deepEqual(result, {
    ok: true, schemaVersion: 1, fixtureId: fixture.id,
    blockedHomePlayers: [], blockedAwayPlayers: [],
  });
});

test('confirmed suspension denies both XI and named bench, not just starters', () => {
  const starter = check([ruling('r1', home.starters[0])]);
  assert.deepEqual(starter, {
    ok: false, error: 'SUSPENDED_PLAYER', playerIds: [home.starters[0]],
  });
  const bench = check([ruling('r2', home.bench[0])]);
  assert.deepEqual(bench, {
    ok: false, error: 'SUSPENDED_PLAYER', playerIds: [home.bench[0]],
  });
});

test('future suspension of registered unselected player is returned for lineup UI', () => {
  const named = new Set([...home.starters, ...home.bench]);
  const reserve = homeClub.registeredPlayerIds.find(id => !named.has(id));
  assert.ok(reserve);
  const result = check([ruling('future', reserve)]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.blockedHomePlayers, [reserve]);
});

test('explicit ban fixtures never imply automatic suspension in unrelated matches', () => {
  const future = schedule.find(f => f.id !== fixture.id &&
    [f.homeClubId, f.awayClubId].includes(fixture.homeClubId));
  assert.ok(future);
  const result = check([ruling('future-fixture', home.starters[0], [future.id])]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.blockedHomePlayers, []);
});

test('reject ambiguous overlapping rulings even if both are valid individual orders', () => {
  const orders = [ruling('a'), ruling('b')];
  assert.deepEqual(check(orders), { ok: false, error: 'OVERLAPPING_RULINGS' });
  assert.deepEqual(check([ruling('a'), ruling('a', home.starters[1])]),
    { ok: false, error: 'DUPLICATE_RULING' });
  assert.deepEqual(check([ruling('a', home.starters[0], [fixture.id, fixture.id])]),
    { ok: false, error: 'INVALID_RULINGS' });
});

test('wrong club, wrong fixture, extra fields or invalid provenance fail closed', () => {
  const other = schedule.find(f => ![f.homeClubId, f.awayClubId]
    .includes(fixture.homeClubId));
  assert.ok(other);
  for (const order of [
    { ...ruling('x'), playerId: away.starters[0] },
    ruling('x', home.starters[0], [other.id]),
    ruling('x', home.starters[0], ['nonexistent']),
    { ...ruling('x'), schemaVersion: 999 },
    { ...ruling('x'), kind: 'appeal' },
    { ...ruling('x'), origin: 'signed-trusted' },
    { ...ruling('x'), affectedFixtureIds: [] },
    { ...ruling('x'), affectedFixtureIds: Array.from({ length: 31 }, (_, i) => 'i-' + i) },
  ]) {
    assert.deepEqual(check([order]), { ok: false, error: 'INVALID_RULINGS' });
  }
  assert.deepEqual(check(null), { ok: false, error: 'INVALID_RULINGS' });
});

test('fixture mismatch and corrupt prematch fail before all suspension processing', () => {
  assert.deepEqual(admitM1ConfirmedSuspensions(
    { ...prematch, fixture: { ...fixture, id: 'not-scheduled' } }, []),
  { ok: false, error: 'WRONG_FIXTURE' });
  assert.deepEqual(admitM1ConfirmedSuspensions(
    { ...prematch, rngSeed: 0 }, []),
  { ok: false, error: 'INVALID_PREMATCH' });
});

test('gate never mutates the validated prematch or external ruling snapshot', () => {
  const input = structuredClone(prematch);
  const orders = [ruling('r1')];
  const before = structuredClone(orders);
  check(orders);
  assert.deepEqual(orders, before);
  assert.deepEqual(prematch, input);
});
