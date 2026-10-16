import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8DisciplineContinuity }
  from '../dist/core/m1-v8-discipline-continuity.js';
import { applyM1V8MatchResult, startM1V8MatchJournal,
  validateM1V8MatchJournal } from '../dist/core/m1-v8-result-journal.js';
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
  catalog, catalog.clubs[0].id, 42, 'v8-discipline-continuity');
const schedule = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const first = schedule[0];
const clubId = first.homeClubId;
const upcoming = schedule.filter(f => f.round > first.round &&
  (f.homeClubId === clubId || f.awayClubId === clubId))
  .sort((a, b) => a.round - b.round);
const [second, third] = upcoming;
assert.ok(second && third);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const playerId = defaultSyntheticLineup(clubs.get(clubId)).starters
  .find(id => positions.get(id) !== 'GK');
assert.ok(playerId);
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};

function prematch(fixture, seed, role = 'starter') {
  const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
  const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
  if (role !== 'starter') {
    const lineup = fixture.homeClubId === clubId ? homeLineup : awayLineup;
    const replacement = lineup.bench.find(id => positions.get(id) !== 'GK');
    const originalIndex = lineup.starters.indexOf(playerId);
    assert.ok(replacement && originalIndex >= 0);
    lineup.starters[originalIndex] = replacement;
    lineup.bench[lineup.bench.indexOf(replacement)] = playerId;
  }
  return {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog, homeLineup, awayLineup,
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
  };
}
function request(fixture, revision, id, opts = {}) {
  const prematchInput = prematch(fixture, 42 + revision,
    opts.role ?? 'starter');
  const commands = [];
  if (opts.role === 'used-substitute') {
    const side = fixture.homeClubId === clubId ? 'homeLineup' : 'awayLineup';
    const active = prematchInput[side].starters.find(id =>
      positions.get(id) !== 'GK');
    assert.ok(active);
    commands.push({
      schemaVersion: 1, commandId: 'sub-' + id, fixtureId: fixture.id,
      teamId: clubId, elapsedSeconds: 300,
      actor: { kind: 'player' }, kind: 'substitute-normal',
      outPlayerId: active, inPlayerId: playerId,
      stoppage: 'referee-authorized',
    });
  }
  if (opts.dismissal === 'second-yellow' || opts.dismissal === 'yellow-only') {
    commands.push({
      schemaVersion: 1, id: 'yellow-1-' + id, fixtureId: fixture.id,
      teamId: clubId, playerId, elapsedSeconds: 600,
      kind: 'caution', origin: 'trusted-referee',
    });
  }
  if (opts.dismissal === 'second-yellow') {
    commands.push({
      schemaVersion: 1, id: 'yellow-2-' + id, fixtureId: fixture.id,
      teamId: clubId, playerId, elapsedSeconds: 900,
      kind: 'caution', origin: 'trusted-referee',
    });
  } else if (opts.dismissal === 'straight-red') {
    commands.push({
      schemaVersion: 1, id: 'straight-red-' + id,
      fixtureId: fixture.id, teamId: clubId,
      playerId, elapsedSeconds: 600,
      kind: 'direct-red', origin: 'trusted-referee',
    });
  }
  const result = simulateM1V8MedicalPhases(
    prematchInput, policy, commands, [], []);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 300));
  return {
    schemaVersion: 4, commandId: id, careerId: initial.careerId,
    expectedRevision: revision, prematch: prematchInput, policy,
    plannedCommands: commands, trustedDecisions: [],
    medicalActions: [], result,
  };
}
function commit(requests) {
  const empty = startM1V8MatchJournal(initial);
  assert.equal(empty.ok, true);
  let journal = empty.journal;
  for (const command of requests) {
    const applied = applyM1V8MatchResult(initial, journal, command);
    assert.equal(applied.ok, true, JSON.stringify(applied).slice(0, 280));
    journal = applied.journal;
  }
  return journal;
}
function review(journal) {
  const derived = deriveM1VerifiedV8DisciplineContinuity(initial, journal);
  assert.equal(derived.ok, true, JSON.stringify(derived).slice(0, 250));
  return derived.report;
}

test('empty, card-free and single-yellow games do not invent dismissal bans', () => {
  const blank = review(commit([]));
  assert.equal(blank.status, 'SYNTHETIC_V8_DISMISSAL_REVIEW_NOT_SUSPENSION');
  assert.equal(blank.examinedCompletedFixtures, 0);
  assert.deepEqual(blank.dismissals, []);
  assert.deepEqual(blank.laterMatchdayListings, []);
  const singleYellow = review(commit([
    request(first, 0, 'one-yellow', { dismissal: 'yellow-only' }),
    request(second, 1, 'next-game'),
  ]));
  assert.deepEqual(singleYellow.dismissals, []);
  assert.deepEqual(singleYellow.laterMatchdayListings, []);
});

test('second yellow followed by a later starting XI is a review observation', () => {
  // Results were committed in reverse round order intentionally.
  const journal = commit([
    request(second, 0, 'newer'),
    request(first, 1, 'earlier', { dismissal: 'second-yellow' }),
  ]);
  const before = structuredClone(journal);
  const report = review(journal);
  assert.deepEqual(report.dismissals, [{
    fixtureId: first.id, round: first.round, clubId, playerId,
    kind: 'second-yellow', cautionsInMatch: 2,
  }]);
  assert.deepEqual(report.laterMatchdayListings, [{
    precedingDismissalFixtureId: first.id,
    precedingDismissalRound: first.round,
    precedingDismissalKind: 'second-yellow',
    fixtureId: second.id, round: second.round,
    clubId, playerId, listing: 'starter',
  }]);
  assert.deepEqual(journal, before);
  assert.equal(validateM1V8MatchJournal(initial, journal).ok, true);
});

test('a straight red and an unused substitute remain distinct facts', () => {
  const journal = commit([
    request(first, 0, 'red', { dismissal: 'straight-red' }),
    request(second, 1, 'unused', { role: 'unused-substitute' }),
  ]);
  const report = review(journal);
  assert.equal(report.dismissals[0].kind, 'straight-red');
  assert.equal(report.dismissals[0].cautionsInMatch, 0);
  assert.equal(report.laterMatchdayListings[0].listing, 'unused-substitute');
  assert.equal(journal.results[1].dossier.teams[
    second.homeClubId === clubId ? 'home' : 'away'
  ].unusedBench.includes(playerId), true);
});

test('entered substitute is not confused with an unused bench entry', () => {
  const journal = commit([
    request(first, 0, 'red', { dismissal: 'straight-red' }),
    request(second, 1, 'entered', { role: 'used-substitute' }),
  ]);
  assert.equal(review(journal).laterMatchdayListings[0].listing, 'used-substitute');
});

test('a subsequent dismissal supersedes the previous event, not its history', () => {
  const journal = commit([
    request(first, 0, 'earlier', { dismissal: 'straight-red' }),
    request(second, 1, 'later', { dismissal: 'second-yellow' }),
    request(third, 2, 'third'),
  ]);
  const report = review(journal);
  assert.equal(report.dismissals.length, 2);
  assert.deepEqual(report.laterMatchdayListings.map(e => ({
    round: e.round, preceding: e.precedingDismissalRound,
    kind: e.precedingDismissalKind,
  })), [
    { round: second.round, preceding: first.round, kind: 'straight-red' },
    { round: third.round, preceding: second.round, kind: 'second-yellow' },
  ]);
});

test('modified dossier and old v7 journal fail closed without changing inputs', () => {
  const journal = commit([
    request(first, 0, 'red', { dismissal: 'straight-red' }),
    request(second, 1, 'next'),
  ]);
  const malformed = structuredClone(journal);
  malformed.results[0].dossier.players.find(p =>
    p.playerId === playerId).dismissal = null;
  const unchanged = structuredClone(malformed);
  assert.deepEqual(deriveM1VerifiedV8DisciplineContinuity(initial, malformed),
    { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(malformed, unchanged);
  const legacy = startM1V7MatchJournal(initial);
  assert.equal(legacy.ok, true);
  assert.deepEqual(deriveM1VerifiedV8DisciplineContinuity(
    initial, legacy.journal), { ok: false, error: 'INVALID_JOURNAL' });
});
