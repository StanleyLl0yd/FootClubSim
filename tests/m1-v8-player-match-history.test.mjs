import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8PlayerMatchHistory }
  from '../dist/core/m1-v8-player-match-history.js';
import { applyM1V8MatchResultBatch, startM1V8MatchJournal }
  from '../dist/core/m1-v8-result-journal.js';
import { startM1V7MatchJournal }
  from '../dist/core/m1-v7-result-journal.js';
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
  catalog, catalog.clubs[0].id, 42, 'v8-player-history-career');
const all = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const club = catalog.clubs[0];
const clubId = club.id;
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const playerId = defaultSyntheticLineup(club).bench
  .find(id => positions.get(id) !== 'GK');
const schedule = all.filter(f =>
  f.homeClubId === clubId || f.awayClubId === clubId)
  .sort((a, b) => a.round - b.round);
const outsider = all.find(f =>
  f.homeClubId !== clubId && f.awayClubId !== clubId);
assert.ok(playerId && schedule.length === 30 && outsider);
const clubs = new Map(catalog.clubs.map(x => [x.id, x]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function command(fixture, revision, role = 'unused-substitute') {
  const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
  const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
  const isClubFixture = fixture.homeClubId === clubId ||
    fixture.awayClubId === clubId;
  const lineup = fixture.homeClubId === clubId ? homeLineup : awayLineup;
  if (isClubFixture && role === 'starter') {
    const target = lineup.starters.find(id => positions.get(id) !== 'GK');
    const i = lineup.bench.indexOf(playerId);
    assert.ok(target && i >= 0);
    lineup.starters[lineup.starters.indexOf(target)] = playerId;
    lineup.bench[i] = target;
  } else if (isClubFixture && role === 'not-named') {
    lineup.bench = lineup.bench.filter(id => id !== playerId);
  }
  const input = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog, homeLineup, awayLineup,
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: revision + 42,
  };
  const plannedCommands = [];
  if (role === 'used-substitute') {
    const outPlayerId = lineup.starters.find(id =>
      positions.get(id) !== 'GK');
    plannedCommands.push({
      schemaVersion: 1, commandId: 'history-sub-' + revision,
      fixtureId: fixture.id, teamId: clubId, elapsedSeconds: 300,
      actor: { kind: 'player' }, kind: 'substitute-normal',
      outPlayerId, inPlayerId: playerId, stoppage: 'referee-authorized',
    });
  }
  if (role === 'starter' || role === 'used-substitute') {
    plannedCommands.push({
      schemaVersion: 1, id: 'history-yellow-' + revision,
      fixtureId: fixture.id, teamId: clubId, playerId,
      elapsedSeconds: 600, kind: 'caution', origin: 'trusted-referee',
    });
  }
  const result = simulateM1V8MedicalPhases(
    input, policy, plannedCommands, [], []);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 240));
  return {
    schemaVersion: 4, commandId: 'history-' + revision,
    careerId: initial.careerId, expectedRevision: revision,
    prematch: input, policy, plannedCommands,
    trustedDecisions: [], medicalActions: [], result,
  };
}
function committed(inputs) {
  const empty = startM1V8MatchJournal(initial);
  assert.equal(empty.ok, true);
  if (!inputs.length) return empty.journal;
  const requests = inputs.map(([fixture, role], index) =>
    command(fixture, index, role));
  const applied = applyM1V8MatchResultBatch(initial, empty.journal, requests);
  assert.equal(applied.ok, true, JSON.stringify(applied).slice(0, 300));
  return applied.journal;
}
function report(journal, id = playerId) {
  const result = deriveM1VerifiedV8PlayerMatchHistory(initial, journal, id);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 270));
  return result.history;
}

test('empty journal does not invent a season appearance or a missed match', () => {
  const history = report(committed([]));
  assert.equal(history.status,
    'SYNTHETIC_V8_REPLAY_PLAYER_LOG_NOT_ELIGIBILITY');
  assert.equal(history.completedClubFixtures, 0);
  assert.equal(history.startingAppearances, 0);
  assert.equal(history.substituteAppearances, 0);
  assert.equal(history.notNamedSheets, 0);
  assert.deepEqual(history.matches, []);
});

test('chronological player log separates XI, used and unused bench and not named', () => {
  const [first, second, third, fourth] = schedule;
  const journal = committed([
    [fourth, 'used-substitute'],
    [second, 'unused-substitute'],
    [first, 'starter'],
    [third, 'not-named'],
    [outsider, 'unused-substitute'],
  ]);
  const before = structuredClone(journal);
  const history = report(journal);
  assert.equal(history.journalRevision, 5);
  assert.equal(history.completedClubFixtures, 4);
  assert.deepEqual(history.matches.map(x => x.fixtureId),
    [first, second, third, fourth].map(x => x.id));
  assert.deepEqual(history.matches.map(x => x.listing),
    ['starter', 'unused-substitute', 'not-named', 'used-substitute']);
  assert.equal(history.startingAppearances, 1);
  assert.equal(history.substituteAppearances, 1);
  assert.equal(history.unusedBenchListings, 1);
  assert.equal(history.notNamedSheets, 1);
  assert.equal(history.matches[0].participation.started, true);
  assert.equal(history.matches[0].participation.yellowCards, 1);
  assert.equal(history.matches[1].participation, null);
  assert.equal(history.matches[2].participation, null);
  assert.equal(history.matches[3].participation.started, false);
  assert.equal(history.matches[3].participation.yellowCards, 1);
  for (const row of history.matches) {
    const fixture = journal.results.find(x => x.fixtureId === row.fixtureId);
    assert.deepEqual(row.score, {
      home: fixture.dossier.match.home.goals,
      away: fixture.dossier.match.away.goals,
    });
    assert.equal(row.clubId, clubId);
  }
  assert.deepEqual(journal, before);
});

test('foreign player IDs, old journals and manipulated dossiers fail closed', () => {
  const valid = committed([[schedule[0], 'starter']]);
  assert.deepEqual(deriveM1VerifiedV8PlayerMatchHistory(initial, valid, ''),
    { ok: false, error: 'UNKNOWN_PLAYER' });
  assert.deepEqual(deriveM1VerifiedV8PlayerMatchHistory(
    initial, valid, 'nonexistent-player'),
  { ok: false, error: 'UNKNOWN_PLAYER' });
  const old = startM1V7MatchJournal(initial);
  assert.equal(old.ok, true);
  assert.deepEqual(deriveM1VerifiedV8PlayerMatchHistory(
    initial, old.journal, playerId),
  { ok: false, error: 'INVALID_JOURNAL' });
  const forged = structuredClone(valid);
  forged.results[0].dossier.players.find(x =>
    x.playerId === playerId).yellowCards += 1;
  const unchanged = structuredClone(forged);
  assert.deepEqual(deriveM1VerifiedV8PlayerMatchHistory(
    initial, forged, playerId),
  { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(forged, unchanged);
});
