import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V18InternalReferee as simulate,
  verifyM1V18InternalReferee as verify,
  M1_V18_REFEREE_DOMAIN_SALT }
  from '../dist/core/m1-v18-internal-referee.js';
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
const run = (seed = 645) => simulate(prematch(seed), policy);
const ok = r => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 450)); return r; };
const bad = (r, error) => assert.equal(r.error, error, JSON.stringify(r));


test('fixed seed generates internally attributed fouls and stable replay', () => {
  const first = ok(run(645));
  const repeated = ok(run(645));
  assert.deepEqual(first, repeated);
  assert.equal(first.generatedFouls.length, 2);
  assert.equal(first.refereeRngDraws, 72);
  assert.equal(first.refereeRngSeed, ((645 ^ M1_V18_REFEREE_DOMAIN_SALT) >>> 0));
  assert.equal(first.status, 'SYNTHETIC_FOUL_ENGINE_NOT_CALIBRATED');
  assert.equal(first.inGameRefereeGenerated, true);
  assert.equal(first.externalRefereeAuthorityAuthenticated, false);
  assert.equal(first.syntheticFoulRatesCalibrated, false);
  assert.equal(first.match.refereeAuthorityAuthenticated, false);
  assert.equal(first.match.generatedDisciplineAndPenaltiesSupported, false);
  assert.equal(verify(prematch(), policy, first), true);
});

test('every synthetic foul links to one resulting discipline event', () => {
  for (const seed of [1, 2, 3, 42, 645, 777, 0xffffffff]) {
    const result = ok(run(seed));
    const events = result.match.events;
    const decisions = events.filter(e => e.kind === 'caution' ||
      e.kind === 'second-yellow-dismissal' ||
      e.kind === 'straight-red-dismissal');
    assert.equal(decisions.length, result.generatedFouls.length);
    assert.equal(result.refereeRngDraws, 72);
    for (const foul of result.generatedFouls) {
      const event = decisions.find(e => e.id === foul.sourceEventId);
      assert.ok(event, 'missing event ' + foul.sourceEventId);
      assert.equal(event.teamId, foul.teamId);
      assert.equal(event.playerId, foul.playerId);
      assert.equal(event.runningSeconds, foul.elapsedSeconds);
      assert.equal(foul.id.startsWith('m1-v18-foul-'), true);
      assert.ok(foul.elapsedSeconds >= 300 && foul.elapsedSeconds < 5400);
      assert.notEqual(foul.elapsedSeconds, 2700);
      assert.equal(foul.sanction === 'direct-red',
        event.kind === 'straight-red-dismissal');
      assert.equal(foul.offence, foul.sanction === 'direct-red' ?
        'serious-foul-play' : 'reckless-challenge');
      assert.ok(result.match.finalScore.home >= 0);
      assert.ok(result.match.finalScore.away >= 0);
    }
    for (const event of events.filter(e => e.kind === 'shot')) {
      const side = event.teamId === fixture.homeClubId ? 'home' : 'away';
      assert.ok(event.onField[side].includes(event.playerId),
        'shooter not physically present');
    }
  }
});

test('a synthetic direct red excludes offender from later on-field events', () => {
  const result = ok(run(3));
  const red = result.match.events.find(e =>
    e.kind === 'straight-red-dismissal');
  assert.ok(red, 'pinned seed must generate an internally seeded direct red');
  const side = red.teamId === fixture.homeClubId ? 'home' : 'away';
  assert.equal(red.onField[side].includes(red.playerId), false);
  for (const event of result.match.events.filter(e =>
    e.runningSeconds > red.runningSeconds)) {
    assert.equal(event.onField[side].includes(red.playerId), false);
  }
  assert.equal(result.match.sourceRefereeEffects.straightRed > 0, true);
});

test('changing the seed changes referee incidents, preserves fixed draw budget', () => {
  const a = ok(run(645));
  const b = ok(run(777));
  assert.notDeepEqual(a.generatedFouls, b.generatedFouls);
  assert.equal(a.refereeRngDraws, b.refereeRngDraws);
  assert.equal(verify(prematch(777), policy, a), false);
  assert.equal(verify(prematch(645), policy, b), false);
});

test('replay validation rejects modified foul evidence or match results', () => {
  const original = ok(run(645));
  for (const mutate of [
    x => { x.generatedFouls[0].sourceEventId = 'fake'; },
    x => { x.generatedFouls[0].playerId = 'ghost'; },
    x => { x.refereeRngState ^= 1; },
    x => { x.refereeRngDraws--; },
    x => { x.syntheticFoulRatesCalibrated = true; },
    x => { x.match.finalScore.home++; },
    x => { x.match.events[0].onField.home.push('ghost'); },
  ]) {
    const candidate = structuredClone(original);
    mutate(candidate);
    assert.equal(verify(prematch(), policy, candidate), false);
  }
});

test('invalid sources fail before user getters, without throwing', () => {
  bad(simulate({ ...prematch(), rngSeed: 0 }, policy), 'INVALID_SOURCE');
  bad(simulate({ ...prematch(), rngSeed: 0x100000000 }, policy),
    'INVALID_SOURCE');
  bad(simulate(prematch(), { home: null, away: [] }), 'SOURCE_MATCH_REJECTED');
  let calls = 0;
  const poisoned = structuredClone(prematch());
  Object.defineProperty(poisoned.fixture, 'homeClubId', {
    enumerable: true, get() { calls++; return fixture.homeClubId; },
  });
  bad(simulate(poisoned, policy), 'INVALID_SOURCE');
  assert.equal(calls, 0);
  const cyclic = structuredClone(prematch());
  cyclic.malicious = cyclic;
  bad(simulate(cyclic, policy), 'INVALID_SOURCE');
  const candidate = ok(run());
  const getter = structuredClone(candidate);
  Object.defineProperty(getter.match.finalScore, 'home', {
    enumerable: true, get() { calls++; return 1; },
  });
  assert.equal(verify(prematch(), policy, getter), false);
  assert.equal(calls, 0);
});
