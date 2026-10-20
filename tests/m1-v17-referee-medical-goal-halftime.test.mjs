import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V17RefereeMedicalGoalAndHalfTime as simulate,
  verifyM1V17RefereeMedicalGoalAndHalfTime as verify }
  from '../dist/core/m1-v17-referee-medical-goal-halftime.js';
import { simulateM1V8MedicalPhases } from '../dist/core/m1-v8-medical-phases.js';
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
const run = (commands = [], medical = [], seed = 645, pause = 0, half = 900) =>
  simulate(prematch(seed), policy, commands, medical, pause, half);
const ok = r => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 450)); return r; };
const bad = (r, error) => assert.equal(r.error, error, JSON.stringify(r));

const referee = (kind, playerId, second = 0, id = 'v17-referee-1',
  side = 'home') => ({
  schemaVersion: 1, id, fixtureId: fixture.id,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  playerId, elapsedSeconds: second, kind,
  origin: kind === 'injury-withdrawal' ? 'trusted-medical' : 'trusted-referee',
});

test('red dismissal, half-time substitution and treatment use one RNG replay', () => {
  const cards = [referee('direct-red', homeOut[1])];
  const commands = [...cards, sub(homeOut[0], homeBench[0])];
  const medical = [departure(awayOut[2], 'away', 0),
    returning(awayOut[2], 'away', 300)];
  const current = ok(run(commands, medical));
  const source = simulateM1V8MedicalPhases(prematch(), policy,
    commands, [], medical);
  assert.equal(source.ok, true, JSON.stringify(source));
  assert.deepEqual(current.finalScore, {
    home: source.report.home.goals, away: source.report.away.goals,
  });
  assert.deepEqual(current.finalOnField, source.onFieldAtFullTime);
  assert.deepEqual(current.offFieldAtFullTime, source.offFieldAtFullTime);
  assert.equal(current.rngState, source.rngState);
  assert.equal(current.rngDraws, source.rngDraws);
  assert.deepEqual(current.sourceRefereeEffects, {
    yellow: 0, secondYellowRed: 0, straightRed: 1, injuryWithdrawn: 0,
  });
  const red = current.events.find(e => e.kind === 'straight-red-dismissal');
  assert.equal(red.onField.home.length, 10);
  assert.ok(!red.onField.home.includes(homeOut[1]));
  const replaced = current.events.find(e => e.kind === 'half-time-substitution');
  assert.equal(replaced.onField.home.length, 10);
  assert.ok(replaced.onField.home.includes(homeBench[0]));
  for (const shot of current.events.filter(e => e.kind === 'shot')) {
    const side = shot.teamId === fixture.homeClubId ? 'home' : 'away';
    assert.ok(shot.onField[side].includes(shot.playerId));
  }
  assert.equal(current.refereeAuthorityAuthenticated, false);
  assert.equal(current.medicalAuthorityAuthenticated, false);
  assert.equal(verify(prematch(), policy, commands, medical, 0, 900, current),
    true);
});

test('two cautions dismiss only on the second yellow and alter subsequent shots', () => {
  const commands = [referee('caution', homeOut[2], 0, 'first-yellow'),
    referee('caution', homeOut[2], 300, 'second-yellow')];
  const current = ok(run(commands));
  const first = current.events.find(e => e.kind === 'caution');
  const second = current.events.find(e => e.kind === 'second-yellow-dismissal');
  assert.equal(first.onField.home.length, 11);
  assert.equal(second.onField.home.length, 10);
  assert.ok(!second.onField.home.includes(homeOut[2]));
  assert.deepEqual(current.sourceRefereeEffects, {
    yellow: 1, secondYellowRed: 1, straightRed: 0, injuryWithdrawn: 0,
  });
  const source = simulateM1V8MedicalPhases(prematch(), policy, commands, [], []);
  assert.equal(source.ok, true);
  assert.deepEqual(current.finalOnField, source.onFieldAtFullTime);
  assert.equal(current.rngState, source.rngState);
});

test('medical withdrawal and independent treatment yield a nine-player XI', () => {
  const commands = [referee('injury-withdrawal', homeOut[1])];
  const medical = [departure(homeOut[2], 'home', 300, 'independent-exit')];
  const current = ok(run(commands, medical));
  assert.equal(current.sourceRefereeEffects.injuryWithdrawn, 1);
  assert.equal(current.finalOnField.home.length, 9);
  assert.deepEqual(current.offFieldAtFullTime, [homeOut[2]]);
  assert.ok(!current.finalOnField.home.includes(homeOut[1]));
  assert.ok(!current.finalOnField.home.includes(homeOut[2]));
  const source = simulateM1V8MedicalPhases(prematch(), policy, commands, [], medical);
  assert.equal(source.ok, true);
  assert.deepEqual(current.finalOnField, source.onFieldAtFullTime);
  assert.equal(current.rngState, source.rngState);
});

test('mixed same-checkpoint referee and substitution claims fail closed', () => {
  const commands = [sub(homeOut[0], homeBench[0], 300),
    referee('caution', homeOut[2], 300)];
  bad(run(commands), 'UNSUPPORTED_COMMAND');
});

test('invalid asserted origins, duplicates and unavailable participants fail closed', () => {
  bad(run([{ ...referee('direct-red', homeOut[0]),
    origin: 'trusted-medical' }]), 'SOURCE_MATCH_REJECTED');
  bad(run([{ ...referee('injury-withdrawal', homeOut[0]),
    origin: 'trusted-referee' }]), 'SOURCE_MATCH_REJECTED');
  const card = referee('direct-red', homeOut[0]);
  bad(run([card, card]), 'SOURCE_MATCH_REJECTED');
  bad(run([referee('caution', 'alien-player')]), 'SOURCE_MATCH_REJECTED');
  bad(run([referee('direct-red', home.starters.find(id =>
    positions.get(id) === 'GK'))]), 'SOURCE_MATCH_REJECTED');
});

test('forged disciplinary replay and getter-backed inputs are rejected', () => {
  const commands = [referee('direct-red', homeOut[1])];
  const result = ok(run(commands));
  for (const mutate of [
    x => x.sourceRefereeEffects.straightRed++,
    x => x.events.find(e => e.kind === 'straight-red-dismissal')
      .onField.home.push('ghost'),
    x => x.finalScore.away++,
    x => { x.refereeAuthorityAuthenticated = true; },
  ]) {
    const candidate = structuredClone(result);
    mutate(candidate);
    assert.equal(verify(prematch(), policy, commands, [], 0, 900, candidate),
      false);
  }
  let calls = 0;
  const forged = structuredClone(commands);
  Object.defineProperty(forged[0], 'playerId', {
    enumerable: true, get() { calls++; return homeOut[1]; },
  });
  bad(run(forged), 'INVALID_SOURCE');
  assert.equal(calls, 0);
});
