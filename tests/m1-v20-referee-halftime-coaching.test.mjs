import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V20InternalReferee as simulate,
  verifyM1V20InternalReferee as verify,
  M1_V20_REFEREE_DOMAIN_SALT }
  from '../dist/core/m1-v20-referee-halftime-coaching.js';
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
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const homeOut = home.starters.filter(id => positions.get(id) !== 'GK');
const awayOut = away.starters.filter(id => positions.get(id) !== 'GK');
const homeBench = home.bench.filter(id => positions.get(id) !== 'GK');
const prematch = (seed = 645) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const sub = (outPlayerId, inPlayerId, second = 2700) => ({
  schemaVersion: 1, kind: 'substitute-normal', fixtureId: fixture.id,
  commandId: 'v16-sub-' + second + '-' + outPlayerId,
  teamId: fixture.homeClubId, elapsedSeconds: second, actor: { kind: 'player' },
  stoppage: second === 2700 ? 'half-time' : 'referee-authorized',
  outPlayerId, inPlayerId,
});
const departure = (playerId, side = 'home', second = 0, id = 'v16-exit') => ({
  schemaVersion: 1, id, fixtureId: fixture.id,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  playerId, elapsedSeconds: second, kind: 'treatment-exit',
  reason: 'medical-staff-entered', restartAtRunningSeconds: second + 15,
});
const returning = (playerId, side = 'home', second = 300, id = 'v16-return') => ({
  schemaVersion: 1, id, fixtureId: fixture.id,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  playerId, elapsedSeconds: second, kind: 'treatment-return',
  returnContext: 'running-clock', ballInPlay: true, entryBoundary: 'touchline',
  refereeSignalId: 'claimed-v16-referee-signal',
});
const run = (seed = 645, commands = []) =>
  simulate(prematch(seed), policy, commands);
const ok = r => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 450)); return r; };
const bad = (r, error) => assert.equal(r.error, error, JSON.stringify(r));


test('autonomous referee and halftime substitution share source XI', () => {
  const command = sub(homeOut[0], homeBench[0]);
  const requested = [command];
  const copy = structuredClone(requested);
  const result = ok(run(8, requested));
  assert.equal(result.acceptedHalfTimeCommands, 1);
  assert.equal(result.refereeRngDraws, 90);
  assert.equal(result.match.halfTimeSubstitutions.home, 1);
  const half = result.match.events.find(e =>
    e.kind === 'half-time-substitution');
  assert.ok(half);
  assert.equal(half.runningSeconds, 2700);
  assert.ok(half.onField.home.includes(homeBench[0]));
  assert.ok(!half.onField.home.includes(homeOut[0]));
  assert.ok(result.match.finalOnField.home.includes(homeBench[0]));
  const injury = result.generatedIncidents.find(e =>
    e.sanction === 'injury-withdrawal');
  assert.ok(injury, 'seed 8 must retain autonomous injury evidence');
  const event = result.match.events.find(e => e.id === injury.sourceEventId);
  assert.equal(event.kind, 'injury-withdrawal');
  assert.equal(result.match.sourceRefereeEffects.injuryWithdrawn, 1);
  assert.equal(result.inPlayCoachingAndLateEntrySupported, false);
  assert.deepEqual(requested, copy);
  assert.equal(verify(prematch(8), policy, requested, result), true);
});

test('no coaching preserves v19 source RNG and score while keeping distinct version', async () => {
  const { simulateM1V19InternalReferee } =
    await import('../dist/core/m1-v19-internal-foul-injury.js');
  for (const seed of [1, 8, 645]) {
    const older = simulateM1V19InternalReferee(prematch(seed), policy);
    const current = ok(run(seed));
    assert.equal(older.ok, true);
    assert.deepEqual(current.match.finalScore, older.match.finalScore);
    assert.deepEqual(current.match.finalOnField, older.match.finalOnField);
    assert.deepEqual(current.match.sourceRefereeEffects,
      older.match.sourceRefereeEffects);
    assert.equal(current.refereeRngState, older.refereeRngState);
    assert.equal(current.match.rngState, older.match.rngState);
    assert.equal(current.refereeRngDraws, 90);
    assert.equal(current.acceptedHalfTimeCommands, 0);
  }
});

test('half-time player replacement cannot remain a later physical shooter', () => {
  const replacement = sub(homeOut[0], homeBench[0]);
  const current = ok(run(8, [replacement]));
  for (const event of current.match.events.filter(e =>
    e.kind === 'shot' && e.runningSeconds >= 2700)) {
    const side = event.teamId === fixture.homeClubId ? 'home' : 'away';
    assert.ok(event.onField[side].includes(event.playerId));
    if (side === 'home') assert.notEqual(event.playerId, homeOut[0]);
  }
  const regular = ok(run(8));
  assert.equal(current.refereeRngState, regular.refereeRngState);
  assert.equal(current.refereeRngDraws, regular.refereeRngDraws);
  assert.notDeepEqual(current.match.finalOnField, regular.match.finalOnField);
});

test('illegal coaching time, spoofed player and duplicate names fail closed', () => {
  const valid = sub(homeOut[0], homeBench[0]);
  bad(run(8, [{ ...valid, elapsedSeconds: 300 }]),
    'INVALID_HALF_TIME_COMMANDS');
  bad(run(8, [{ ...valid, stoppage: 'referee-authorized' }]),
    'INVALID_HALF_TIME_COMMANDS');
  bad(run(8, [{ ...valid, kind: 'caution' }]),
    'INVALID_HALF_TIME_COMMANDS');
  bad(run(8, [{ ...valid, actor: { kind: 'staff',
    staffId: 'unavailable' } }]), 'SOURCE_MATCH_REJECTED');
  bad(run(8, [{ ...valid, inPlayerId: 'alien-player' }]),
    'SOURCE_MATCH_REJECTED');
  const independentDuplicate = structuredClone(valid);
  independentDuplicate.commandId = 'duplicate-other-id';
  bad(run(8, [valid, independentDuplicate]), 'INVALID_HALF_TIME_COMMANDS');
  // Spreading preserves the nested actor reference; strict JSON tree
  // preflight rejects aliases before the domain-level duplicate guard.
  bad(run(8, [valid, { ...valid, commandId: 'duplicate-other-id' }]),
    'INVALID_SOURCE');
});

test('coaching replay tampering, getters and cycles cannot forge accepted XI', () => {
  const requested = [sub(homeOut[0], homeBench[0])];
  const result = ok(run(8, requested));
  for (const edit of [
    x => { x.acceptedHalfTimeCommands = 0; },
    x => { x.match.finalScore.away++; },
    x => { x.generatedIncidents[0].playerId = 'fake'; },
    x => { x.match.finalOnField.home.push('phantom'); },
  ]) {
    const altered = structuredClone(result);
    edit(altered);
    assert.equal(verify(prematch(8), policy, requested, altered), false);
  }
  assert.equal(verify(prematch(8), policy, [], result), false);
  let calls = 0;
  const getter = structuredClone(requested);
  Object.defineProperty(getter[0], 'outPlayerId', {
    enumerable: true, get() { calls++; return homeOut[0]; },
  });
  bad(run(8, getter), 'INVALID_SOURCE');
  assert.equal(calls, 0);
  const cyclic = [sub(homeOut[0], homeBench[0])];
  cyclic[0].self = cyclic;
  bad(run(8, cyclic), 'INVALID_SOURCE');
});
