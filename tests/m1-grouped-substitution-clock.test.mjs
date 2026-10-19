import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectM1GroupedSubstitutionDepartures }
  from '../dist/core/m1-grouped-substitution-clock.js';
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

const catalog = createSyntheticRplScaleCatalog(78);
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
const claim = () => ({
  schemaVersion: 2, kind: 'group-normal-departures',
  fixtureId: fixture.id, teamId: fixture.homeClubId,
  stoppageId: 'trusted-stoppage-claimed-1',
  finalSignalWallSeconds: 103, restartRunningSeconds: 300,
  departures: [
    { outPlayerId: home.starters[1], inPlayerId: home.bench[0],
      refereeSignalId: 'signal-a', signalWallSeconds: 100, exitWallSeconds: 110 },
    { outPlayerId: home.starters[2], inPlayerId: home.bench[1],
      refereeSignalId: 'signal-b', signalWallSeconds: 103, exitWallSeconds: 113 },
  ],
});
const inspect = (c, source = prematch) =>
  inspectM1GroupedSubstitutionDepartures(source, c);
const reject = (c, error) => assert.deepEqual(inspect(c), { ok: false, error });

test('group deadline starts on LAST board, at most ten seconds inclusive', () => {
  const before = structuredClone(claim());
  const result = inspect(before);
  assert.equal(result.ok, true);
  assert.equal(result.rulesId, 'ifab-2026-27-group-last-signal-limited');
  assert.equal(result.groupSize, 2);
  assert.deepEqual(result.outcomes.map(x => x.status),
    ['WITHIN_TEN_SECONDS', 'WITHIN_TEN_SECONDS']);
  assert.deepEqual(result.outcomes.map(x => x.conditionalEarliestLateEntryRunningSeconds),
    [null, null]);
  assert.equal(result.physicalStoppageAuthenticated, false);
  assert.equal(result.refereeAuthorityAuthenticated, false);
  assert.deepEqual(before, claim());
});

test('one late member has a conditional running-clock threshold, not field permission', () => {
  const raw = claim();
  raw.departures[0].exitWallSeconds = 114;
  const result = inspect(raw);
  assert.equal(result.ok, true);
  assert.deepEqual(result.outcomes.map(x => x.status),
    ['REFEREE_REVIEW_REQUIRED', 'WITHIN_TEN_SECONDS']);
  assert.deepEqual(result.outcomes.map(x => x.conditionalEarliestLateEntryRunningSeconds),
    [360, null]);
  assert.deepEqual(result.outcomes.map(x => x.refereeEntryApprovalRequired),
    [true, true]);
});

test('valid five-player group never claims five independent windows', () => {
  const raw = claim();
  raw.departures = Array.from({ length: 5 }, (_, i) => ({
    outPlayerId: home.starters[i + 1], inPlayerId: home.bench[i],
    refereeSignalId: 'signal-' + i, signalWallSeconds: 100 + i,
    exitWallSeconds: 109 + i,
  }));
  raw.finalSignalWallSeconds = 104;
  const outcome = inspect(raw);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.groupSize, 5);
  assert.ok(outcome.outcomes.every(x => x.status === 'WITHIN_TEN_SECONDS'));
  raw.departures.push({ ...raw.departures[0], refereeSignalId: 'sixth' });
  reject(raw, 'INVALID_CLAIM');
});

test('cross-team, unregistered and repeated in/out players reject', () => {
  reject({ ...claim(), fixtureId: 'other-fixture' }, 'WRONG_FIXTURE');
  reject({ ...claim(), teamId: 'other-club' }, 'UNKNOWN_TEAM');
  const wrong = claim();
  wrong.departures[1].inPlayerId = away.bench[0];
  reject(wrong, 'UNKNOWN_NAMED_PLAYER');
  for (const [key, value] of [
    ['outPlayerId', home.starters[1]],
    ['inPlayerId', home.bench[0]],
    ['refereeSignalId', 'signal-a'],
  ]) {
    const duplicate = claim();
    duplicate.departures[1][key] = value;
    reject(duplicate, 'DUPLICATE_PARTICIPANT');
  }
});

test('outgoing group chronology and last signal cannot be invented', () => {
  const reverse = claim();
  reverse.departures.reverse();
  reject(reverse, 'UNVERIFIABLE_SIGNAL_ORDER');
  reject({ ...claim(), finalSignalWallSeconds: 100 },
    'UNVERIFIABLE_SIGNAL_ORDER');
  const exitBeforeBoard = claim();
  exitBeforeBoard.departures[1].exitWallSeconds = 102;
  reject(exitBeforeBoard, 'INVALID_CLAIM');
  const outAsNewSub = claim();
  outAsNewSub.departures[1].outPlayerId = home.bench[0];
  reject(outAsNewSub, 'UNVERIFIABLE_SIGNAL_ORDER');
});

test('strict JSON rejects aliasing, getters, cycles and extra exceptions', () => {
  let called = 0;
  const getter = claim();
  Object.defineProperty(getter.departures[0], 'exitWallSeconds', {
    enumerable: true, get() { called++; return 110; },
  });
  reject(getter, 'INVALID_CLAIM');
  assert.equal(called, 0);
  const serializer = claim();
  serializer.toJSON = () => { called++; return claim(); };
  reject(serializer, 'INVALID_CLAIM');
  assert.equal(called, 0);
  const cycle = claim();
  cycle.extra = cycle;
  reject(cycle, 'INVALID_CLAIM');
  const alias = claim();
  alias.departures[1] = alias.departures[0];
  reject(alias, 'INVALID_CLAIM');
  reject({ ...claim(), injuryWaiver: true }, 'INVALID_CLAIM');
  reject({ ...claim(), schemaVersion: 1 }, 'INVALID_CLAIM');
  reject({ ...claim(), departures: [] }, 'INVALID_CLAIM');
  reject({ ...claim(), restartRunningSeconds: 5400 }, 'INVALID_CLAIM');
  assert.deepEqual(inspect(claim(), { ...prematch, rngSeed: 0 }),
    { ok: false, error: 'INVALID_PREMATCH' });
});

test('v1 original one-player contract remains isolated and rejects grouping', () => {
  const prior = inspectM1TimedSubstitutionDeparture(prematch, {
    schemaVersion: 1, fixtureId: fixture.id, teamId: fixture.homeClubId,
    outPlayerId: home.starters[1], inPlayerId: home.bench[0],
    refereeSignalId: 'one-signal', groupSize: 2,
    signalWallSeconds: 100, exitWallSeconds: 110,
    restartRunningSeconds: 300,
  });
  assert.deepEqual(prior, { ok: false, error: 'GROUPED_RULING_REQUIRED' });
});
