import test from 'node:test';
import assert from 'node:assert/strict';
import { admitM1OffFieldMedicalReturn }
  from '../dist/core/m1-medical-return.js';
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
const out = home.starters.find(id => catalog.players.find(p => p.id === id).primaryPosition !== 'GK');
const keeper = home.starters.find(id => catalog.players.find(p => p.id === id).primaryPosition === 'GK');
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
function event(changes = {}) {
  return {
    schemaVersion: 1, fixtureId: fixture.id, teamId: fixture.homeClubId,
    playerId: out, reason: 'injury-stopped-play',
    offFieldAtRunningSeconds: 300, restartAtRunningSeconds: 315,
    requestedAtRunningSeconds: 375, returnContext: 'running-clock',
    ballInPlay: true, entryBoundary: 'touchline', refereeSignalId: 'signal-1',
    ...changes,
  };
}
const attempt = (v, source = prematch) => admitM1OffFieldMedicalReturn(source, v);
const fail = (v, e) => assert.deepEqual(attempt(v), { ok: false, error: e });

test('one minute is counted after restart, not after off-field exit', () => {
  const accepted = attempt(event());
  assert.deepEqual(accepted, {
    ok: true, schemaVersion: 1,
    rulesId: 'ifab-2026-27-off-field-limited-v1',
    fixtureId: fixture.id, teamId: fixture.homeClubId, playerId: out,
    eligibleAtRunningSeconds: 375, returnContext: 'running-clock',
  });
  fail(event({ requestedAtRunningSeconds: 374 }), 'RETURN_TOO_EARLY');
  fail(event({ restartAtRunningSeconds: 320,
    requestedAtRunningSeconds: 375 }), 'RETURN_TOO_EARLY');
  fail(event({ restartAtRunningSeconds: 299 }), 'INVALID_DECISION');
  fail(event({ requestedAtRunningSeconds: 314 }), 'INVALID_DECISION');
});

test('referee permission and entry boundary depend on ball being in play', () => {
  fail(event({ refereeSignalId: '' }), 'REFEREE_SIGNAL_REQUIRED');
  fail(event({ ballInPlay: true, entryBoundary: 'goal-line' }),
    'WRONG_ENTRY_BOUNDARY');
  const stopped = attempt(event({ ballInPlay: false, entryBoundary: 'goal-line' }));
  assert.equal(stopped.ok, true);
});

test('half-time exception admits start of second half without a full minute', () => {
  const atHalf = event({
    offFieldAtRunningSeconds: 2670, restartAtRunningSeconds: 2690,
    requestedAtRunningSeconds: 2700, returnContext: 'half-time',
    ballInPlay: false,
  });
  const accepted = attempt(atHalf);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.eligibleAtRunningSeconds, 2700);
  fail({ ...atHalf, requestedAtRunningSeconds: 2699 }, 'INVALID_DECISION');
  fail({ ...atHalf, ballInPlay: true }, 'INVALID_DECISION');
  fail({ ...atHalf, restartAtRunningSeconds: 2600 }, 'INVALID_DECISION');
  fail({ ...atHalf, offFieldAtRunningSeconds: 2700 }, 'INVALID_DECISION');
});

test('goalkeeper and bench entry exceptions are not silently interpreted as ordinary exits', () => {
  fail(event({ playerId: keeper }), 'EXCEPTION_RULING_REQUIRED');
  fail(event({ playerId: home.bench[0] }), 'INELIGIBLE_PLAYER');
  fail(event({ teamId: fixture.awayClubId }), 'INELIGIBLE_PLAYER');
  fail(event({ reason: 'keeper-collision' }), 'INVALID_DECISION');
  fail(event({ exception: 'severe-injury' }), 'INVALID_DECISION');
});

test('invalid fixture, malformed times and forged fields reject without mutation', () => {
  const source = structuredClone(prematch);
  const raw = event();
  const before = structuredClone(raw);
  fail(event({ fixtureId: 'other' }), 'INVALID_DECISION');
  fail(event({ requestedAtRunningSeconds: -1 }), 'INVALID_DECISION');
  fail(event({ requestedAtRunningSeconds: 5400 }), 'INVALID_DECISION');
  fail(event({ restartAtRunningSeconds: 1.5 }), 'INVALID_DECISION');
  fail(event({ refereeSignalId: undefined }), 'REFEREE_SIGNAL_REQUIRED');
  fail(event({ schemaVersion: 2 }), 'INVALID_DECISION');
  assert.deepEqual(attempt(raw, { ...prematch, rngSeed: 0 }),
    { ok: false, error: 'INVALID_PREMATCH' });
  assert.deepEqual(prematch, source);
  assert.deepEqual(raw, before);
});
