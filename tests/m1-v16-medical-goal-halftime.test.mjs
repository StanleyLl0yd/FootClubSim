import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V16MedicalGoalAndHalfTime as simulate,
  verifyM1V16MedicalGoalAndHalfTime as verify }
  from '../dist/core/m1-v16-medical-goal-halftime.js';
import { simulateM1V15GoalAndHalfTime as previous }
  from '../dist/core/m1-v15-goal-halftime-roster.js';
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

test('no-treatment mode preserves v15 physical history and v8 RNG', () => {
  const commands = [sub(homeOut[0], homeBench[0], 300),
    sub(homeOut[1], homeBench[1])];
  const current = ok(run(commands));
  const old = previous(prematch(), policy, commands, 0, 900);
  assert.equal(old.ok, true, JSON.stringify(old));
  assert.deepEqual(current.finalOnField, old.finalOnField);
  assert.deepEqual(current.finalScore, old.finalScore);
  assert.equal(current.rngState, old.rngState);
  assert.equal(current.rngDraws, old.rngDraws);
  assert.deepEqual(current.offFieldAtFullTime, []);
  assert.equal(current.medicalActionCount, 0);
  assert.equal(current.medicalAuthorityAuthenticated, false);
  assert.equal(current.ordinaryMedicalPresenceSupported, true);
});

test('temporary ten-player XI and returning starters affect one source simulation', () => {
  const medical = [departure(homeOut[2]), returning(homeOut[2])];
  const commands = [sub(homeOut[0], homeBench[0])];
  const original = structuredClone(medical);
  const current = ok(run(commands, medical));
  const source = simulateM1V8MedicalPhases(prematch(), policy, commands, [], medical);
  assert.equal(source.ok, true, JSON.stringify(source).slice(0, 250));
  assert.deepEqual(current.finalScore, {
    home: source.report.home.goals, away: source.report.away.goals,
  });
  assert.deepEqual(current.finalOnField, source.onFieldAtFullTime);
  assert.deepEqual(current.offFieldAtFullTime, source.offFieldAtFullTime);
  assert.equal(current.rngState, source.rngState);
  assert.equal(current.rngDraws, source.rngDraws);
  const exit = current.events.find(e => e.kind === 'treatment-exit');
  const enter = current.events.find(e => e.kind === 'treatment-return');
  assert.equal(exit.runningSeconds, 0);
  assert.equal(exit.onField.home.length, 10);
  assert.ok(!exit.onField.home.includes(homeOut[2]));
  assert.equal(enter.runningSeconds, 300);
  assert.equal(enter.onField.home.length, 11);
  assert.ok(enter.onField.home.includes(homeOut[2]));
  assert.equal(current.halfTimeSubstitutions.home, 1);
  for (const event of current.events.filter(e => e.kind === 'shot')) {
    const side = event.teamId === fixture.homeClubId ? 'home' : 'away';
    assert.ok(event.onField[side].includes(event.playerId));
  }
  assert.deepEqual(medical, original);
  assert.equal(verify(prematch(), policy, commands, medical, 0, 900, current), true);
});

test('goal substitution and treatment use the same post-goal XI', () => {
  const commands = [sub(homeOut[0], homeBench[0], 300)];
  const medical = [departure(homeOut[2], 'home', 300)];
  const current = ok(run(commands, medical, 645, 1, 900));
  const kinds = current.events.map(e => e.kind);
  const applied = kinds.indexOf('substitution-applied');
  const exit = kinds.indexOf('treatment-exit');
  assert.ok(applied >= 0 && exit > applied);
  assert.equal(current.events[exit].onField.home.length, 10);
  assert.ok(current.events[exit].onField.home.includes(homeBench[0]));
  assert.ok(!current.events[exit].onField.home.includes(homeOut[2]));
  assert.equal(current.offFieldAtFullTime.length, 1);
  assert.equal(current.finalOnField.home.length, 10);
  const source = simulateM1V8MedicalPhases(prematch(), policy, commands, [], medical);
  assert.equal(source.ok, true);
  assert.deepEqual(current.finalScore, {
    home: source.report.home.goals, away: source.report.away.goals,
  });
  assert.equal(current.rngState, source.rngState);
  for (let i = 1; i < current.events.length; i++) {
    assert.ok(current.events[i].wallSeconds >= current.events[i - 1].wallSeconds);
    assert.ok(current.events[i].runningSeconds >=
      current.events[i - 1].runningSeconds);
  }
});

test('simultaneous independent treatment actions preserve per-side physical XI', () => {
  const medical = [departure(homeOut[2], 'home', 0, 'home-exit'),
    departure(awayOut[2], 'away', 0, 'away-exit'),
    returning(homeOut[2], 'home', 300, 'home-return'),
    returning(awayOut[2], 'away', 300, 'away-return')];
  const current = ok(run([], medical));
  const exits = current.events.filter(e => e.kind === 'treatment-exit');
  assert.equal(exits.length, 2);
  assert.equal(exits[1].onField.home.length, 10);
  assert.equal(exits[1].onField.away.length, 10);
  assert.deepEqual(current.offFieldAtFullTime, []);
  assert.equal(current.finalOnField.home.length, 11);
  assert.equal(current.finalOnField.away.length, 11);
  assert.equal(current.medicalActionCount, 4);
});

test('invalid treatment, exceptions and same-player conflicts fail closed', () => {
  const med = [departure(homeOut[2]), returning(homeOut[2])];
  bad(run([], [{ ...med[0], playerId: home.starters.find(id =>
    positions.get(id) === 'GK') }]), 'SOURCE_MATCH_REJECTED');
  bad(run([], [returning(homeOut[2])]), 'SOURCE_MATCH_REJECTED');
  bad(run([], [med[0], { ...med[1], elapsedSeconds: 0 }]),
    'SOURCE_MATCH_REJECTED');
  bad(run([], [med[0], { ...med[1], entryBoundary: 'goal-line' }]),
    'SOURCE_MATCH_REJECTED');
  bad(run([], [med[0], { ...med[0], id: 'duplicate-exit' }]),
    'SOURCE_MATCH_REJECTED');
  bad(run([sub(homeOut[2], homeBench[2])], [med[0]]),
    'SOURCE_MATCH_REJECTED');
  bad(run([], med, 645, -1), 'INVALID_INTERVAL');
});

test('untrusted replay and getter-bearing action are rejected', () => {
  const medical = [departure(homeOut[2]), returning(homeOut[2])];
  const current = ok(run([], medical));
  for (const edit of [
    x => x.events.find(e => e.kind === 'treatment-exit').onField.home.push('ghost'),
    x => x.offFieldAtFullTime.push('ghost'),
    x => { x.rngState ^= 1; },
    x => { x.medicalActionCount++; },
  ]) {
    const forged = structuredClone(current);
    edit(forged);
    assert.equal(verify(prematch(), policy, [], medical, 0, 900, forged), false);
  }
  let calls = 0;
  const poisoned = structuredClone(medical);
  Object.defineProperty(poisoned[0], 'playerId', {
    enumerable: true, get() { calls++; return homeOut[2]; },
  });
  bad(run([], poisoned), 'INVALID_SOURCE');
  assert.equal(calls, 0);
  const cyclic = [departure(homeOut[2])];
  cyclic[0].other = cyclic;
  bad(run([], cyclic), 'INVALID_SOURCE');
});

test('half-time return precedes second-half kickoff and accepted substitution', () => {
  const exit = {
    ...departure(homeOut[2], 'home', 2400, 'half-exit'),
    restartAtRunningSeconds: 2680,
  };
  const back = {
    ...returning(homeOut[2], 'home', 2700, 'half-return'),
    returnContext: 'half-time', ballInPlay: false,
  };
  const commands = [sub(homeOut[0], homeBench[0])];
  const current = ok(run(commands, [exit, back]));
  const kinds = current.events.map(e => e.kind);
  const whistle = kinds.indexOf('half-time-whistle');
  const changed = kinds.indexOf('half-time-substitution');
  const returningAtHalf = kinds.indexOf('treatment-return');
  const kickoff = kinds.indexOf('second-half-kickoff');
  assert.ok(whistle >= 0 && changed > whistle);
  assert.ok(returningAtHalf > changed && returningAtHalf < kickoff);
  assert.equal(current.events[returningAtHalf].runningSeconds, 2700);
  assert.equal(current.events[returningAtHalf].onField.home.length, 11);
  assert.deepEqual(current.offFieldAtFullTime, []);
  assert.equal(verify(prematch(), policy, commands, [exit, back],
    0, 900, current), true);
});

test('substituting another player while one is off-field preserves ten men', () => {
  const medical = [departure(homeOut[2], 'home', 0, 'long-exit')];
  const commands = [sub(homeOut[0], homeBench[0])];
  const current = ok(run(commands, medical));
  const halfSub = current.events.find(e => e.kind === 'half-time-substitution');
  assert.equal(halfSub.runningSeconds, 2700);
  assert.equal(halfSub.onField.home.length, 10);
  assert.ok(halfSub.onField.home.includes(homeBench[0]));
  assert.ok(!halfSub.onField.home.includes(homeOut[2]));
  assert.equal(current.finalOnField.home.length, 10);
  assert.deepEqual(current.offFieldAtFullTime, [homeOut[2]]);
  const source = simulateM1V8MedicalPhases(prematch(), policy, commands, [], medical);
  assert.equal(source.ok, true, JSON.stringify(source));
  assert.deepEqual(current.finalOnField, source.onFieldAtFullTime);
  assert.equal(current.rngState, source.rngState);
  assert.equal(verify(prematch(), policy, commands, medical, 0, 900, current),
    true);
});
