import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V8MedicalPhases } from '../dist/core/m1-v8-medical-phases.js';
import { deriveM1VerifiedV8GoalAttribution }
  from '../dist/core/m1-v8-goal-attribution.js';
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
const homeOut = home.starters.find(id => positions.get(id) !== 'GK');
const awayOut = away.starters.find(id => positions.get(id) !== 'GK');
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
const decision = (id, time, kind, outcome) => ({
  schemaVersion: 1, decisionId: id, fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: kind === 'own-goal' ? awayOut : homeOut,
  elapsedSeconds: time, kind, ...(outcome ? { outcome } : {}),
});
const exit = {
  schemaVersion: 1, id: 'ex-1', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: homeOut, elapsedSeconds: 0,
  kind: 'treatment-exit', reason: 'medical-staff-entered',
  restartAtRunningSeconds: 15,
};
const back = {
  schemaVersion: 1, id: 'back-1', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: homeOut, elapsedSeconds: 300,
  kind: 'treatment-return', returnContext: 'running-clock',
  ballInPlay: true, entryBoundary: 'touchline', refereeSignalId: 'fixture-referee-1',
};
function examine(input = prematch, decisions = [], medical = []) {
  const simulation = simulateM1V8MedicalPhases(input, policy, [], decisions, medical);
  assert.equal(simulation.ok, true, JSON.stringify(simulation).slice(0, 180));
  const result = deriveM1VerifiedV8GoalAttribution(input, policy,
    [], decisions, medical, simulation);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 180));
  return { simulation, report: result.report };
}

test('multiple seeds reconcile all v8 open-play scoring, shots and xG', () => {
  for (const seed of [1, 42, 777, 0xffffffff]) {
    const { simulation, report } = examine({ ...prematch, rngSeed: seed });
    assert.deepEqual(report.match, simulation.report);
    assert.equal(report.players.length, 22);
    assert.equal(report.players.filter(p => p.started).length, 22);
    assert.equal(report.goals.length,
      simulation.report.home.goals + simulation.report.away.goals);
    assert.equal(report.players.reduce((n, p) => n + p.xgMilli, 0),
      simulation.report.home.xgMilli + simulation.report.away.xgMilli);
    assert.equal(report.goals.every(g => g.kind === 'open-play'), true);
  }
});

test('medical absence regenerates scoring and never credits an absent shooter', () => {
  const { simulation, report } = examine(prematch, [], [exit, back]);
  assert.equal(report.eventSchemaVersion, 8);
  assert.deepEqual(report.onFieldAtFullTime, simulation.onFieldAtFullTime);
  assert.deepEqual(report.offFieldAtFullTime, []);
  assert.equal(report.goals.some(g => g.scorerId === homeOut &&
    g.elapsedSeconds < 300), false);
  assert.deepEqual(report.match, simulation.report);
});

test('scored, saved and missed penalties, plus own goal, count once', () => {
  const decisions = [
    decision('pen-goal', 600, 'penalty-kick', 'scored'),
    decision('pen-save', 900, 'penalty-kick', 'saved'),
    decision('pen-miss', 1200, 'penalty-kick', 'missed'),
    decision('own', 1500, 'own-goal'),
  ];
  const { report } = examine(prematch, decisions, [exit, back]);
  const kicker = report.players.find(p => p.playerId === homeOut);
  const defender = report.players.find(p => p.playerId === awayOut);
  assert.equal(kicker.penaltiesTaken, 3);
  assert.equal(kicker.penaltyGoals, 1);
  assert.equal(defender.ownGoals, 1);
  assert.deepEqual(report.goals.filter(g => g.kind !== 'open-play'), [
    { kind: 'penalty', eventId: 'm1-v8-decision-pen-goal',
      teamId: fixture.homeClubId, scorerId: homeOut, elapsedSeconds: 600 },
    { kind: 'own-goal', eventId: 'm1-v8-decision-own',
      teamId: fixture.homeClubId, defenderId: awayOut, elapsedSeconds: 1500 },
  ]);
  assert.equal(report.match.home.penaltiesTaken, 3);
  assert.equal(report.match.home.penaltyGoals, 1);
  assert.equal(report.match.home.ownGoalsFor, 1);
  assert.equal(report.match.home.xgCoverage, 'open-play-only');
});

test('tampered v8 event streams and inconsistent original inputs fail closed', () => {
  const decisions = [decision('pen-goal', 600, 'penalty-kick', 'scored')];
  const medical = [exit, back];
  const { simulation } = examine(prematch, decisions, medical);
  const run = candidate => deriveM1VerifiedV8GoalAttribution(
    prematch, policy, [], decisions, medical, candidate);
  for (const forged of [
    { ...simulation, rngState: simulation.rngState ^ 1 },
    { ...simulation, report: { ...simulation.report,
      home: { ...simulation.report.home, goals: 99 } } },
    { ...simulation, events: [...simulation.events].reverse() },
    { ...simulation, offFieldAtFullTime: [homeOut] },
  ]) assert.deepEqual(run(forged),
    { ok: false, error: 'INVALID_MATCH_SOURCE' });
  assert.deepEqual(deriveM1VerifiedV8GoalAttribution(
    prematch, policy, [], decisions, [], simulation),
  { ok: false, error: 'INVALID_MATCH_SOURCE' });
});

test('an unreturned medical exit preserves physical absence without inventing a scorer', () => {
  const { simulation, report } = examine(prematch, [], [exit]);
  assert.deepEqual(report.offFieldAtFullTime, [homeOut]);
  assert.deepEqual(report.onFieldAtFullTime, simulation.onFieldAtFullTime);
  assert.equal(report.onFieldAtFullTime.home.includes(homeOut), false);
});

test('accepted substitutions and disciplinary removals change eligible scoring rows', () => {
  const secondOut = home.starters.filter(id => positions.get(id) !== 'GK')[1];
  const thirdOut = home.starters.filter(id => positions.get(id) !== 'GK')[2];
  const benchPlayer = home.bench.find(id => positions.get(id) !== 'GK');
  const commands = [
    { schemaVersion: 1, id: 'yellow', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: homeOut, elapsedSeconds: 0,
      kind: 'caution', origin: 'trusted-referee' },
    { schemaVersion: 1, commandId: 'bench', fixtureId: fixture.id,
      teamId: fixture.homeClubId, elapsedSeconds: 300,
      actor: { kind: 'player' }, kind: 'substitute-normal',
      outPlayerId: secondOut, inPlayerId: benchPlayer,
      stoppage: 'referee-authorized' },
    { schemaVersion: 1, id: 'red', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: benchPlayer, elapsedSeconds: 600,
      kind: 'direct-red', origin: 'trusted-referee' },
    { schemaVersion: 1, id: 'injury', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: thirdOut, elapsedSeconds: 900,
      kind: 'injury-withdrawal', origin: 'trusted-medical' },
  ];
  const simulation = simulateM1V8MedicalPhases(prematch, policy, commands, [], []);
  assert.equal(simulation.ok, true, JSON.stringify(simulation).slice(0, 180));
  const result = deriveM1VerifiedV8GoalAttribution(
    prematch, policy, commands, [], [], simulation);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 180));
  const substitute = result.report.players.find(p => p.playerId === benchPlayer);
  assert.equal(substitute.started, false);
  assert.equal(result.report.players.length, 23);
  assert.equal(result.report.onFieldAtFullTime.home.length, 9);
  assert.equal(result.report.onFieldAtFullTime.home.includes(benchPlayer), false);
  assert.equal(result.report.onFieldAtFullTime.home.includes(secondOut), false);
  assert.equal(result.report.onFieldAtFullTime.home.includes(thirdOut), false);
  assert.deepEqual(result.report.match, simulation.report);
});

test('attribution is a pure projection and cannot rewrite any source input', () => {
  const original = structuredClone(prematch);
  const actions = [structuredClone(exit), structuredClone(back)];
  const previous = structuredClone(actions);
  examine(prematch, [], actions);
  assert.deepEqual(prematch, original);
  assert.deepEqual(actions, previous);
});
