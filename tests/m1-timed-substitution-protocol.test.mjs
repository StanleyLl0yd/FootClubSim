import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectM1TimedSubstitutionDeparture }
  from '../dist/core/m1-timed-substitution-protocol.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(79);
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
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 43,
};
const evidence = (changes = {}) => ({
  schemaVersion: 1, fixtureId: fixture.id, teamId: fixture.homeClubId,
  outPlayerId: home.starters[0], inPlayerId: home.bench[0],
  refereeSignalId: 'verified-externally-1', groupSize: 1,
  signalWallSeconds: 100, exitWallSeconds: 110,
  restartRunningSeconds: 300, ...changes,
});
const inspect = (v, original = prematch) =>
  inspectM1TimedSubstitutionDeparture(original, v);
const failure = (v, error) =>
  assert.deepEqual(inspect(v), { ok: false, error });

test('IFAB 2026/27 10-second boundary is inclusive and wall-clock based', () => {
  const ready = inspect(evidence());
  assert.deepEqual(ready, {
    ok: true, schemaVersion: 1,
    rulesId: 'ifab-2026-27-single-departure-limited',
    fixtureId: fixture.id,
    outPlayerId: home.starters[0], inPlayerId: home.bench[0],
    status: 'WITHIN_TEN_SECONDS',
    conditionalEarliestLateEntryRunningSeconds: null,
    refereeEntryApprovalRequired: true,
  });
  assert.deepEqual(inspect(evidence({ exitWallSeconds: 100 })), ready);
  const delayed = inspect(evidence({ exitWallSeconds: 111 }));
  assert.equal(delayed.ok, true);
  assert.equal(delayed.status, 'REFEREE_REVIEW_REQUIRED');
  assert.equal(delayed.conditionalEarliestLateEntryRunningSeconds, 360);
  assert.equal(delayed.refereeEntryApprovalRequired, true);
});

test('late entry minimum is a conditional running-clock threshold, not permission', () => {
  const delayed = inspect(evidence({
    signalWallSeconds: 1000, exitWallSeconds: 1200,
    restartRunningSeconds: 5399,
  }));
  assert.equal(delayed.status, 'REFEREE_REVIEW_REQUIRED');
  assert.equal(delayed.conditionalEarliestLateEntryRunningSeconds, 5459);
  assert.equal(delayed.refereeEntryApprovalRequired, true);
});

test('unverified exceptional procedures and group substitutions fail closed', () => {
  failure(evidence({ groupSize: 2 }), 'GROUPED_RULING_REQUIRED');
  failure(evidence({ groupSize: 0 }), 'GROUPED_RULING_REQUIRED');
  failure(evidence({ refereeSignalId: '' }), 'REFEREE_SIGNAL_REQUIRED');
  failure(evidence({ refereeSignalId: null }), 'REFEREE_SIGNAL_REQUIRED');
  failure(evidence({ injuryException: true }), 'INVALID_EVIDENCE');
  failure(evidence({ firstEligibleStoppage: true }), 'INVALID_EVIDENCE');
  failure(evidence({ groupSize: 1.5 }), 'GROUPED_RULING_REQUIRED');
});

test('outgoing/incoming must be named for the claimed side; eligibility remains external', () => {
  failure(evidence({ teamId: 'other-team' }), 'UNKNOWN_TEAM');
  failure(evidence({ fixtureId: 'other-fixture' }), 'WRONG_FIXTURE');
  failure(evidence({ outPlayerId: 'unknown' }), 'UNKNOWN_NAMED_PLAYER');
  failure(evidence({ inPlayerId: away.bench[0] }), 'UNKNOWN_NAMED_PLAYER');
  failure(evidence({ inPlayerId: home.starters[1] }), 'UNKNOWN_NAMED_PLAYER');
  failure(evidence({ outPlayerId: home.bench[0], inPlayerId: home.bench[0] }),
    'INVALID_EVIDENCE');
  const incomingThenRemoved = inspect(evidence({
    outPlayerId: home.bench[1], inPlayerId: home.bench[0],
  }));
  assert.equal(incomingThenRemoved.ok, true);
  // A prior substituted-in player must be checked against the actual
  // replay-verified active XI, not declared ineligible by the initial lineup.
});

test('malformed inputs cannot invoke attacker getters, serializers or mutate source', () => {
  const original = structuredClone(prematch), raw = evidence();
  const clone = structuredClone(raw);
  for (const variant of [
    { ...raw, signalWallSeconds: -1 },
    { ...raw, exitWallSeconds: 99 },
    { ...raw, exitWallSeconds: Number.POSITIVE_INFINITY },
    { ...raw, signalWallSeconds: 86401 },
    { ...raw, restartRunningSeconds: 5400 },
    { ...raw, restartRunningSeconds: 300.5 },
    { ...raw, schemaVersion: 2 },
    { ...raw, extra: undefined },
  ]) failure(variant, 'INVALID_EVIDENCE');
  let hits = 0;
  const getter = evidence();
  Object.defineProperty(getter, 'exitWallSeconds', {
    enumerable: true, get() { hits++; return 110; },
  });
  failure(getter, 'INVALID_EVIDENCE');
  const serializer = { ...raw,
    toJSON() { hits++; return raw; },
  };
  failure(serializer, 'INVALID_EVIDENCE');
  assert.equal(hits, 0);
  const cyclic = evidence();
  cyclic.extra = cyclic;
  failure(cyclic, 'INVALID_EVIDENCE');
  assert.deepEqual(inspect(raw, { ...prematch, rngSeed: 0 }),
    { ok: false, error: 'INVALID_PREMATCH' });
  assert.deepEqual(prematch, original);
  assert.deepEqual(raw, clone);
});
