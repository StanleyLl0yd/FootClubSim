import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileM1V7ConfirmedSanctions }
  from '../dist/core/m1-v7-sanction-review.js';
import { startM1V7MatchJournal, applyM1V7MatchResult }
  from '../dist/core/m1-v7-result-journal.js';
import { simulateM1V7Phases } from '../dist/core/m1-v7-adjudications.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { createInitialCareer } from '../dist/core/save.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const initial = createInitialCareer(catalog, catalog.clubs[0].id, 42, 'v7-sanction-review');
const schedule = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures);
const fixture = schedule[0];
const nextFixture = schedule.find(f => f.id !== fixture.id &&
  (f.homeClubId === fixture.homeClubId || f.awayClubId === fixture.homeClubId));
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function source(match = fixture) {
  return {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture: match, catalog,
    homeLineup: defaultSyntheticLineup(clubs.get(match.homeClubId)),
    awayLineup: defaultSyntheticLineup(clubs.get(match.awayClubId)),
    homeTactics: defaultTacticalPlan(match.homeClubId),
    awayTactics: defaultTacticalPlan(match.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
  };
}
const prematch = source();
const raw = startM1V7MatchJournal(initial);
assert.equal(raw.ok, true);
const empty = raw.journal;
const playing = prematch.homeLineup.starters[0];
const bench = prematch.homeLineup.bench[0];
assert.ok(nextFixture);
const ban = (playerId, ids, rulingId = 'confirmed-ruling') => ({
  schemaVersion: 1, rulingId, kind: 'match-suspension',
  clubId: fixture.homeClubId, playerId, affectedFixtureIds: ids,
});
function completed() {
  const result = simulateM1V7Phases(prematch, policy, [], []);
  assert.equal(result.ok, true);
  const stored = applyM1V7MatchResult(initial, empty, {
    schemaVersion: 3, commandId: 'record-first',
    careerId: initial.careerId, expectedRevision: 0,
    prematch, policy, plannedCommands: [], trustedDecisions: [], result,
  });
  assert.equal(stored.ok, true, JSON.stringify(stored));
  return stored.journal;
}
const check = (journal, rulings, match = prematch, career = initial) =>
  reconcileM1V7ConfirmedSanctions(career, journal, match, rulings);

test('verified empty sanction snapshot with no completed fixtures', () => {
  const out = check(empty, []);
  assert.deepEqual(out, { ok: true, review: {
    schemaVersion: 1, careerId: initial.careerId,
    journalRevision: 0, fixtureId: fixture.id,
    examinedCompletedFixtures: 0, rulingCount: 0,
    blockedHomePlayers: [], blockedAwayPlayers: [],
  } });
});
test('blocked starting or substitute player is rejected before a new match', () => {
  for (const id of [playing, bench]) {
    const outcome = check(empty, [ban(id, [fixture.id])]);
    assert.deepEqual(outcome, {
      ok: false, error: 'CURRENT_LINEUP_BLOCKED',
      affectedFixtureIds: [fixture.id], affectedPlayerIds: [id],
    });
  }
});
test('confirmed order for a different fixture leaves current lineup untouched', () => {
  const out = check(empty, [ban(playing, [nextFixture.id])]);
  assert.equal(out.ok, true);
  assert.deepEqual(out.review.blockedHomePlayers, []);
});
test('verified prior appearance cannot be silently overwritten by retroactive order', () => {
  const journal = completed();
  const outcome = check(journal, [ban(playing, [fixture.id])]);
  assert.deepEqual(outcome, {
    ok: false, error: 'HISTORICAL_PARTICIPATION_CONFLICT',
    affectedFixtureIds: [fixture.id], affectedPlayerIds: [playing],
  });
});
test('a missing appearance is not proof of an unused-bench clean record', () => {
  const journal = completed();
  const outcome = check(journal, [ban(bench, [fixture.id])]);
  assert.deepEqual(outcome, {
    ok: false, error: 'HISTORICAL_MATCH_SHEET_REQUIRED',
    affectedFixtureIds: [fixture.id], affectedPlayerIds: [bench],
  });
});
test('earlier fixture plus valid future ruling stays consistent', () => {
  const journal = completed();
  const out = check(journal, [ban(playing, [nextFixture.id])]);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.review.examinedCompletedFixtures, 1);
  assert.equal(out.review.rulingCount, 1);
});
test('bad trusted source, catalog substitution and malformed rulings fail closed', () => {
  const corrupted = { ...empty, revision: 1 };
  assert.deepEqual(check(corrupted, []), { ok: false, error: 'INVALID_JOURNAL' });
  const fakePrematch = { ...prematch, catalog: { ...catalog, clubs: [] } };
  assert.deepEqual(check(empty, [], fakePrematch),
    { ok: false, error: 'INVALID_PREMATCH' });
  assert.deepEqual(check(empty, [ban(playing, ['not-a-fixture'])]),
    { ok: false, error: 'INVALID_RULINGS' });
});
test('no input is mutated by conflict inspection', () => {
  const journal = completed();
  const orders = [ban(playing, [fixture.id])];
  const a = structuredClone(journal), b = structuredClone(orders);
  check(journal, orders);
  assert.deepEqual(journal, a);
  assert.deepEqual(orders, b);
});
