import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8SeasonStats }
  from '../dist/core/m1-v8-season-statistics.js';
import { applyM1V8MatchResultBatch, startM1V8MatchJournal }
  from '../dist/core/m1-v8-result-journal.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';

const catalog = createSyntheticRplScaleCatalog(77);
const initial = createInitialCareer(
  catalog, catalog.clubs[0].id, 42, 'v8-season-diagnostics');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const empty = startM1V8MatchJournal(initial);
assert.equal(empty.ok, true);
function request(fixture, revision, seed = 42, special = true) {
  const home = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
  const away = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
  const prematch = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog, homeLineup: home, awayLineup: away,
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
  };
  const taker = home.starters.find(id => positions.get(id) !== 'GK');
  const defender = away.starters.find(id => positions.get(id) !== 'GK');
  const medicalActions = special ? [
    { schemaVersion: 1, id: 'medical-exit',
      fixtureId: fixture.id, teamId: fixture.homeClubId,
      playerId: taker, elapsedSeconds: 0,
      kind: 'treatment-exit', reason: 'medical-staff-entered',
      restartAtRunningSeconds: 15 },
    { schemaVersion: 1, id: 'medical-return',
      fixtureId: fixture.id, teamId: fixture.homeClubId,
      playerId: taker, elapsedSeconds: 300,
      kind: 'treatment-return', returnContext: 'running-clock',
      ballInPlay: true, entryBoundary: 'touchline',
      refereeSignalId: 'synthetic-signal-not-authenticated' },
  ] : [];
  const trustedDecisions = special ? [
    { schemaVersion: 1, decisionId: 'penalty',
      fixtureId: fixture.id, teamId: fixture.homeClubId,
      playerId: taker, elapsedSeconds: 600,
      kind: 'penalty-kick', outcome: 'scored' },
    { schemaVersion: 1, decisionId: 'own-goal',
      fixtureId: fixture.id, teamId: fixture.homeClubId,
      playerId: defender, elapsedSeconds: 900, kind: 'own-goal' },
  ] : [];
  const result = simulateM1V8MedicalPhases(
    prematch, policy, [], trustedDecisions, medicalActions);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 180));
  return { schemaVersion: 4, commandId: 'season-command-' + revision,
    careerId: initial.careerId, expectedRevision: revision,
    prematch, policy, plannedCommands: [],
    trustedDecisions, medicalActions, result };
}
function committed(requests) {
  const outcome = applyM1V8MatchResultBatch(initial, empty.journal, requests);
  assert.equal(outcome.ok, true, JSON.stringify(outcome).slice(0, 180));
  return outcome.journal;
}
function examine(journal) {
  const outcome = deriveM1VerifiedV8SeasonStats(initial, journal);
  assert.equal(outcome.ok, true, JSON.stringify(outcome).slice(0, 180));
  return outcome.report;
}
const team = (report, id) => report.teams.find(row => row.clubId === id);
const player = (report, id) => report.players.find(row => row.playerId === id);

test('empty journal preserves 16 clubs and no invented appearances', () => {
  const report = examine(empty.journal);
  assert.equal(report.status, 'SYNTHETIC_V8_REPLAY_AGGREGATE_NO_STANDINGS');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.journalRevision, 0);
  assert.equal(report.completedFixtures, 0);
  assert.equal(report.teams.length, catalog.clubs.length);
  assert.equal(report.players.length, 0);
  assert.ok(report.teams.every(row =>
    row.completedFixtures === 0 && row.goalsFor === 0 &&
    row.physicalPhasePersonSeconds === 0));
  assert.equal(Object.hasOwn(report, 'standings'), false);
  assert.equal(Object.hasOwn(report, 'points'), false);
});

test('one match reconciles real named bench with goal, penalty, own goal and medical time', () => {
  const req = request(fixtures[0], 0);
  const report = examine(committed([req]));
  const home = team(report, req.prematch.fixture.homeClubId);
  const away = team(report, req.prematch.fixture.awayClubId);
  const taker = req.prematch.homeLineup.starters.find(id =>
    positions.get(id) !== 'GK');
  const defender = req.prematch.awayLineup.starters.find(id =>
    positions.get(id) !== 'GK');
  assert.equal(report.completedFixtures, 1);
  assert.equal(report.journalRevision, 1);
  assert.equal(home.completedFixtures, 1);
  assert.equal(home.goalsFor, req.result.report.home.goals);
  assert.equal(home.goalsAgainst, req.result.report.away.goals);
  assert.equal(away.goalsAgainst, req.result.report.home.goals);
  assert.equal(home.penaltyGoals, 1);
  assert.equal(home.ownGoalsFor, 1);
  assert.equal(player(report, taker).penaltyGoals, 1);
  assert.equal(player(report, defender).ownGoals, 1);
  assert.equal(player(report, taker).temporarilyAbsentPhaseSeconds, 300);
  assert.equal(home.temporarilyAbsentPhasePersonSeconds, 300);
  assert.equal(home.registeredPhasePersonSeconds,
    home.physicalPhasePersonSeconds + 300);
  assert.equal(home.namedBenchSlots, req.prematch.homeLineup.bench.length);
  assert.equal(home.unusedBenchSlots, req.prematch.homeLineup.bench.length);
  assert.equal(home.usedSubstituteAppearances, 0);
  const unused = player(report, req.prematch.homeLineup.bench[0]);
  assert.equal(unused.namedMatchdaySheets, 1);
  assert.equal(unused.unusedBenchListings, 1);
  assert.equal(unused.startingAppearances, 0);
  assert.equal(unused.substituteAppearances, 0);
  assert.equal(unused.physicalPhaseSeconds, 0);
});

test('two fixtures combine only participating clubs without giving league points', () => {
  const a = request(fixtures[0], 0, 1, false);
  const b = request(fixtures[1], 1, 42, true);
  const report = examine(committed([a, b]));
  assert.equal(report.completedFixtures, 2);
  assert.equal(report.journalRevision, 2);
  assert.equal(report.teams.reduce((n, c) => n + c.completedFixtures, 0), 4);
  assert.equal(report.teams.reduce((n, c) => n + c.goalsFor, 0),
    a.result.report.home.goals + a.result.report.away.goals +
    b.result.report.home.goals + b.result.report.away.goals);
  assert.equal(report.teams.reduce((n, c) => n + c.goalsFor, 0),
    report.teams.reduce((n, c) => n + c.goalsAgainst, 0));
  assert.equal(report.players.reduce((n, p) => n + p.goals + p.ownGoals, 0),
    report.teams.reduce((n, c) => n + c.goalsFor, 0));
  assert.ok(report.players.every(p =>
    p.registeredPhaseSeconds ===
    p.physicalPhaseSeconds + p.temporarilyAbsentPhaseSeconds));
  assert.equal(Object.hasOwn(report, 'leagueTable'), false);
});

test('tampered v8 match source, player goal and legacy journal fail closed', () => {
  const journal = committed([request(fixtures[0], 0)]);
  for (const modified of [
    { ...journal, revision: 2 },
    { ...journal, results: [{ ...journal.results[0], rngState: 42 }] },
    { ...journal, results: [{ ...journal.results[0],
      dossier: { ...journal.results[0].dossier,
        players: [{ ...journal.results[0].dossier.players[0],
          goals: 999 }, ...journal.results[0].dossier.players.slice(1)] } }] },
    { ...journal, results: [{ ...journal.results[0],
      source: { ...journal.results[0].source, medicalActions: [] } }] },
  ]) assert.deepEqual(deriveM1VerifiedV8SeasonStats(initial, modified),
    { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(deriveM1VerifiedV8SeasonStats(initial, {
    ...journal, schemaVersion: 3,
  }), { ok: false, error: 'INVALID_JOURNAL' });
});

test('the season projection never aliases or mutates recorded match history', () => {
  const journal = committed([request(fixtures[0], 0)]);
  const original = structuredClone(journal);
  const first = examine(journal), second = examine(journal);
  assert.deepEqual(first, second);
  assert.deepEqual(journal, original);
});
