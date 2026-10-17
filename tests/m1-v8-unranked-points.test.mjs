import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8UnrankedPoints }
  from '../dist/core/m1-v8-unranked-points.js';
import { applyM1V8MatchResultBatch, startM1V8MatchJournal }
  from '../dist/core/m1-v8-result-journal.js';
import { deriveM1VerifiedV8SeasonStats }
  from '../dist/core/m1-v8-season-statistics.js';
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
  catalog, catalog.clubs[0].id, 42, 'v8-points-preview');
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

function request(fixture, revision, seed, special = false) {
  const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
  const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
  const prematch = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog, homeLineup, awayLineup,
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
  };
  const taker = homeLineup.starters.find(id => positions.get(id) !== 'GK');
  const defender = awayLineup.starters.find(id => positions.get(id) !== 'GK');
  const decisions = special ? [
    { schemaVersion: 1, decisionId: 'explicit-penalty', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: taker,
      elapsedSeconds: 600, kind: 'penalty-kick', outcome: 'scored' },
    { schemaVersion: 1, decisionId: 'explicit-own-goal', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: defender,
      elapsedSeconds: 900, kind: 'own-goal' },
  ] : [];
  const result = simulateM1V8MedicalPhases(prematch, policy, [], decisions, []);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 180));
  return { schemaVersion: 4, commandId: 'points-' + fixture.id,
    careerId: initial.careerId, expectedRevision: revision, prematch, policy,
    plannedCommands: [], trustedDecisions: decisions, medicalActions: [], result };
}
function committed(requests) {
  const outcome = applyM1V8MatchResultBatch(initial, empty.journal, requests);
  assert.equal(outcome.ok, true, JSON.stringify(outcome).slice(0, 180));
  return outcome.journal;
}
function preview(journal) {
  const outcome = deriveM1VerifiedV8UnrankedPoints(initial, journal);
  assert.equal(outcome.ok, true, JSON.stringify(outcome).slice(0, 180));
  return outcome.preview;
}
function expectedRows(requests) {
  const map = new Map(catalog.clubs.map(club => [club.id, {
    clubId: club.id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0,
    goalsAgainst: 0, goalDifference: 0, points: 0,
  }]));
  for (const req of requests) {
    const home = map.get(req.prematch.fixture.homeClubId);
    const away = map.get(req.prematch.fixture.awayClubId);
    const hg = req.result.report.home.goals, ag = req.result.report.away.goals;
    home.played++; away.played++;
    home.goalsFor += hg; home.goalsAgainst += ag;
    away.goalsFor += ag; away.goalsAgainst += hg;
    if (hg === ag) { home.drawn++; away.drawn++; home.points++; away.points++; }
    else if (hg > ag) { home.won++; away.lost++; home.points += 3; }
    else { away.won++; home.lost++; away.points += 3; }
  }
  for (const row of map.values()) row.goalDifference = row.goalsFor - row.goalsAgainst;
  return [...map.values()];
}

test('empty v8 journal has all 16 unranked clubs and no invented points', () => {
  const result = preview(empty.journal);
  assert.equal(result.status, 'SYNTHETIC_V8_UNRANKED_POINTS_PREVIEW_NOT_OFFICIAL');
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.completedFixtures, 0);
  assert.equal(result.journalRevision, 0);
  assert.deepEqual(result.clubs.map(row => row.clubId),
    catalog.clubs.map(club => club.id));
  assert.ok(result.clubs.every(row => row.played === 0 && row.points === 0));
  assert.equal(Object.hasOwn(result, 'standings'), false);
  assert.equal(Object.hasOwn(result, 'rank'), false);
  assert.equal(Object.hasOwn(result, 'officialPoints'), false);
});

test('verified v8 match scores, including own goals and penalty, give exact 3/1/0 preview', () => {
  const requests = fixtures.slice(0, 8).map((fixture, i) =>
    request(fixture, i, 101 + i, i % 3 === 0));
  const journal = committed(requests);
  const report = preview(journal);
  assert.equal(report.completedFixtures, requests.length);
  assert.equal(report.journalRevision, requests.length);
  assert.deepEqual(report.clubs, expectedRows(requests));
  assert.equal(report.clubs.reduce((sum, row) => sum + row.played, 0), 16);
  const scored = report.clubs.reduce((sum, row) => sum + row.goalsFor, 0);
  assert.equal(scored, report.clubs.reduce((sum, row) => sum + row.goalsAgainst, 0));
  const matchesWon = requests.filter(req =>
    req.result.report.home.goals !== req.result.report.away.goals).length;
  const draws = requests.length - matchesWon;
  assert.equal(report.clubs.reduce((sum, row) => sum + row.points, 0),
    matchesWon * 3 + draws * 2);

  const season = deriveM1VerifiedV8SeasonStats(initial, journal);
  assert.equal(season.ok, true);
  for (const club of report.clubs) {
    const source = season.report.teams.find(row => row.clubId === club.clubId);
    assert.equal(club.played, source.completedFixtures);
    assert.equal(club.goalsFor, source.goalsFor);
    assert.equal(club.goalsAgainst, source.goalsAgainst);
  }
  assert.equal(Object.hasOwn(journal, 'points'), false);
});

test('fixture insertion order is not a ranking or a hidden scoring input', () => {
  const first = request(fixtures[0], 1, 29, true);
  const second = request(fixtures[1], 0, 30, false);
  const reverse = committed([second, first]);
  const forward = committed([
    { ...first, expectedRevision: 0 },
    { ...second, expectedRevision: 1 },
  ]);
  assert.deepEqual(preview(reverse).clubs, preview(forward).clubs);
});

test('forged score, source, revision and older schema cannot create points', () => {
  const journal = committed([request(fixtures[0], 0, 91, true)]);
  const entry = journal.results[0];
  for (const forged of [
    { ...journal, revision: 2 },
    { ...journal, results: [{
      ...entry, dossier: { ...entry.dossier, match: {
        ...entry.dossier.match, home: {
          ...entry.dossier.match.home, goals: entry.dossier.match.home.goals + 1,
        },
      } },
    }] },
    { ...journal, results: [{
      ...entry, source: { ...entry.source, trustedDecisions: [] },
    }] },
    { ...journal, schemaVersion: 3 },
  ]) assert.deepEqual(deriveM1VerifiedV8UnrankedPoints(initial, forged),
    { ok: false, error: 'INVALID_JOURNAL' });
});

test('read-only points projection is deterministic and never aliases source history', () => {
  const journal = committed([request(fixtures[0], 0, 34, false)]);
  const original = structuredClone(journal);
  assert.deepEqual(preview(journal), preview(journal));
  assert.deepEqual(journal, original);
  assert.equal(Object.hasOwn(journal.results[0], 'points'), false);
});
