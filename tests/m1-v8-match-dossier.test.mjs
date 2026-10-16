import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8MatchDossier, verifyM1V8MatchDossier }
  from '../dist/core/m1-v8-match-dossier.js';
import { simulateM1V8MedicalPhases } from '../dist/core/m1-v8-medical-phases.js';
import { deriveM1VerifiedV8GoalAttribution }
  from '../dist/core/m1-v8-goal-attribution.js';
import { deriveM1VerifiedV8PhasePresence }
  from '../dist/core/m1-v8-phase-presence.js';
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
const hOut = home.starters.filter(id => positions.get(id) !== 'GK');
const aOut = away.starters.find(id => positions.get(id) !== 'GK');
const bench = home.bench.find(id => positions.get(id) !== 'GK');
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
const exit = {
  schemaVersion: 1, id: 'exit', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: hOut[0], elapsedSeconds: 0,
  kind: 'treatment-exit', reason: 'medical-staff-entered',
  restartAtRunningSeconds: 15,
};
const back = {
  schemaVersion: 1, id: 'back', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: hOut[0], elapsedSeconds: 300,
  kind: 'treatment-return', returnContext: 'running-clock',
  ballInPlay: true, entryBoundary: 'touchline',
  refereeSignalId: 'externally-proven-integration-required',
};
const decisions = [
  { schemaVersion: 1, decisionId: 'pen', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: hOut[0], elapsedSeconds: 600,
    kind: 'penalty-kick', outcome: 'scored' },
  { schemaVersion: 1, decisionId: 'own', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: aOut, elapsedSeconds: 900,
    kind: 'own-goal' },
];
function examine(input = prematch, commands = [], medical = [], referee = []) {
  const match = simulateM1V8MedicalPhases(input, policy, commands, referee, medical);
  assert.equal(match.ok, true, JSON.stringify(match).slice(0, 160));
  const derived = deriveM1VerifiedV8MatchDossier(
    input, policy, commands, referee, medical, match);
  assert.equal(derived.ok, true, JSON.stringify(derived).slice(0, 160));
  assert.ok(verifyM1V8MatchDossier(
    input, policy, commands, referee, medical, match, derived.dossier));
  return { match, dossier: derived.dossier };
}

test('the entire matchday bench is preserved even when never used', () => {
  for (const seed of [1, 42, 777]) {
    const { match, dossier } = examine({ ...prematch, rngSeed: seed });
    assert.equal(dossier.schemaVersion, 1);
    assert.equal(dossier.eventSchemaVersion, 8);
    assert.equal(dossier.match.fixtureId, fixture.id);
    assert.deepEqual(dossier.match, match.report);
    assert.equal(dossier.players.length, 22);
    assert.equal(dossier.teams.home.participants.length, 11);
    assert.equal(dossier.teams.away.participants.length, 11);
    assert.deepEqual(dossier.teams.home.benchNamed, home.bench);
    assert.deepEqual(dossier.teams.home.unusedBench, home.bench);
    assert.deepEqual(dossier.teams.away.unusedBench, away.bench);
    assert.equal(dossier.teams.home.namedPlayerIds.length, 11 + home.bench.length);
    assert.equal(dossier.teams.away.namedPlayerIds.length, 11 + away.bench.length);
    assert.ok(dossier.players.every(p =>
      p.registeredPhaseSeconds === p.physicalPhaseSeconds &&
      p.temporarilyAbsentPhaseSeconds === 0 &&
      p.yellowCards === 0 && p.dismissal === null));
  }
});

test('medical absences, goals, penalty and own goal reconcile inside one dossier', () => {
  const { match, dossier } = examine(prematch, [], [exit, back], decisions);
  const patient = dossier.players.find(p => p.playerId === hOut[0]);
  const defender = dossier.players.find(p => p.playerId === aOut);
  assert.equal(patient.registeredPhaseSeconds, 5400);
  assert.equal(patient.physicalPhaseSeconds, 5100);
  assert.equal(patient.temporarilyAbsentPhaseSeconds, 300);
  assert.equal(patient.penaltiesTaken, 1);
  assert.equal(patient.penaltyGoals, 1);
  assert.equal(defender.ownGoals, 1);
  assert.equal(dossier.goalAttributions.some(g => g.kind === 'own-goal'), true);
  assert.equal(dossier.goalAttributions.some(g => g.kind === 'penalty'), true);
  assert.equal(dossier.match.home.goals, match.report.home.goals);
  assert.equal(dossier.teams.home.temporarilyOffFieldAtFullTime.length, 0);
  assert.equal(dossier.status,
    'SYNTHETIC_V8_UNAUTHENTICATED_MATCH_DOSSIER_NO_CAREER_POSTING');
  assert.ok(!Object.hasOwn(dossier, 'careerRevision'));
  assert.ok(!Object.hasOwn(dossier, 'standingsPoints'));
});

test('unused bench remains named, entered bench counts and discipline is physical', () => {
  const commands = [
    { schemaVersion: 1, commandId: 'sub', fixtureId: fixture.id,
      teamId: fixture.homeClubId, elapsedSeconds: 300,
      actor: { kind: 'player' }, kind: 'substitute-normal',
      outPlayerId: hOut[1], inPlayerId: bench, stoppage: 'referee-authorized' },
    { schemaVersion: 1, id: 'yellow', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: bench, elapsedSeconds: 600,
      kind: 'caution', origin: 'trusted-referee' },
    { schemaVersion: 1, id: 'second-yellow', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: bench, elapsedSeconds: 900,
      kind: 'caution', origin: 'trusted-referee' },
    { schemaVersion: 1, id: 'injury', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: hOut[2], elapsedSeconds: 1200,
      kind: 'injury-withdrawal', origin: 'trusted-medical' },
  ];
  const { dossier } = examine(prematch, commands);
  const player = dossier.players.find(p => p.playerId === bench);
  assert.equal(player.started, false);
  assert.equal(player.benchNamed, true);
  assert.equal(player.yellowCards, 2);
  assert.equal(player.dismissal, 'second-yellow');
  assert.equal(player.physicalPhaseSeconds, 600);
  assert.equal(dossier.players.find(p => p.playerId === hOut[2])
    .permanentlyMedicallyWithdrawn, true);
  assert.equal(dossier.teams.home.yellowCards, 2);
  assert.equal(dossier.teams.home.dismissals, 1);
  assert.equal(dossier.teams.home.permanentMedicalWithdrawals, 1);
  assert.equal(dossier.teams.home.participants.length, 12);
  assert.equal(dossier.teams.home.unusedBench.includes(bench), false);
  assert.equal(dossier.teams.home.unusedBench.length, home.bench.length - 1);
  assert.equal(dossier.teams.home.physicallyOnFieldAtFullTime.length, 9);
});

test('unreturned ordinary treatment is not a permanent injury or dismissal', () => {
  const { dossier } = examine(prematch, [], [exit]);
  assert.deepEqual(dossier.teams.home.temporarilyOffFieldAtFullTime, [hOut[0]]);
  assert.equal(dossier.teams.home.physicallyOnFieldAtFullTime.length, 10);
  assert.equal(dossier.teams.home.permanentMedicalWithdrawals, 0);
  const patient = dossier.players.find(p => p.playerId === hOut[0]);
  assert.equal(patient.permanentlyMedicallyWithdrawn, false);
  assert.equal(patient.temporarilyAbsentPhaseSeconds, 5400);
});

test('tampered match, different source and forged dossier all fail closed', () => {
  const { match, dossier } = examine(prematch, [], [exit, back], decisions);
  for (const fake of [
    { ...dossier, match: { ...dossier.match, home: { ...dossier.match.home,
      goals: 99 } } },
    { ...dossier, teams: { ...dossier.teams, home: { ...dossier.teams.home,
      unusedBench: [] } } },
    { ...dossier, players: [...dossier.players].reverse() },
    { ...dossier, status: 'official' },
    { ...dossier, additional: true },
  ]) assert.equal(verifyM1V8MatchDossier(
    prematch, policy, [], decisions, [exit, back], match, fake), false);
  assert.deepEqual(deriveM1VerifiedV8MatchDossier(
    prematch, policy, [], decisions, [], match),
  { ok: false, error: 'INVALID_MATCH_SOURCE' });
  assert.deepEqual(deriveM1VerifiedV8MatchDossier(
    prematch, policy, [], decisions, [exit, back],
    { ...match, rngState: match.rngState ^ 1 }),
  { ok: false, error: 'INVALID_MATCH_SOURCE' });
});

test('projection does not change pre-match or input source history', () => {
  const input = structuredClone(prematch);
  const medical = structuredClone([exit, back]);
  const originalMedical = structuredClone(medical);
  examine(prematch, [], medical, decisions);
  assert.deepEqual(prematch, input);
  assert.deepEqual(medical, originalMedical);
});

test('shared verified replay equals two independently verified public projections', () => {
  for (const seed of [1, 42, 777]) {
    const input = { ...prematch, rngSeed: seed };
    const { match, dossier } = examine(input, [], [exit, back], decisions);
    const goals = deriveM1VerifiedV8GoalAttribution(
      input, policy, [], decisions, [exit, back], match);
    const presence = deriveM1VerifiedV8PhasePresence(
      input, policy, [], decisions, [exit, back], match);
    assert.equal(goals.ok, true);
    assert.equal(presence.ok, true);
    assert.deepEqual(dossier.goalAttributions, goals.report.goals);
    assert.deepEqual(dossier.match, goals.report.match);
    for (const row of dossier.players) {
      const {
        benchNamed, registeredPhaseSeconds, physicalPhaseSeconds,
        temporarilyAbsentPhaseSeconds, yellowCards, dismissal,
        permanentlyMedicallyWithdrawn, ...goalFields
      } = row;
      assert.equal(typeof benchNamed, 'boolean');
      assert.ok(yellowCards >= 0 && dismissal === null);
      assert.equal(permanentlyMedicallyWithdrawn, false);
      assert.deepEqual(goalFields, goals.report.players.find(p =>
        p.playerId === row.playerId));
      assert.deepEqual({
        teamId: row.teamId, playerId: row.playerId, started: row.started,
        registeredPhaseSeconds, physicalPhaseSeconds,
        temporarilyAbsentPhaseSeconds,
      }, presence.report.players.find(p => p.playerId === row.playerId));
    }
  }
});
