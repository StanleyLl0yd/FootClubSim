import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8MedicalContinuity }
  from '../dist/core/m1-v8-medical-continuity.js';
import { startM1V8MatchJournal, applyM1V8MatchResult,
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
  catalog, catalog.clubs[0].id, 42, 'v8-medical-continuity');
const schedule = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const first = schedule[0];
const clubId = first.homeClubId;
const club = catalog.clubs.find(c => c.id === clubId);
const following = schedule.filter(f => f.round > first.round &&
  (f.homeClubId === clubId || f.awayClubId === clubId))
  .sort((a, b) => a.round - b.round);
assert.ok(following.length > 2);
const [second, third] = following;
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const playerId = defaultSyntheticLineup(club).starters
  .find(id => positions.get(id) !== 'GK');
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function source(fixture, seed = 42, unusedBench = false) {
  const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
  const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
  if (unusedBench) {
    const lineup = fixture.homeClubId === clubId ? homeLineup : awayLineup;
    const reserve = lineup.bench.find(id => positions.get(id) !== 'GK');
    assert.ok(reserve);
    const index = lineup.starters.indexOf(playerId);
    assert.ok(index >= 0);
    lineup.starters[index] = reserve;
    lineup.bench[lineup.bench.indexOf(reserve)] = playerId;
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
  const prematch = source(fixture, revision + 42, opts.unusedBench);
  const plannedCommands = opts.withdraw ? [{
    schemaVersion: 1, id: 'injury-' + id, fixtureId: fixture.id,
    teamId: clubId, playerId, elapsedSeconds: 1200,
    kind: 'injury-withdrawal', origin: 'trusted-medical',
  }] : [];
  const trustedDecisions = [], medicalActions = [];
  const result = simulateM1V8MedicalPhases(
    prematch, policy, plannedCommands, trustedDecisions, medicalActions);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 350));
  return {
    schemaVersion: 4, commandId: id, careerId: initial.careerId,
    expectedRevision: revision, prematch, policy,
    plannedCommands, trustedDecisions, medicalActions, result,
  };
}
function committed(requests) {
  const initialJournal = startM1V8MatchJournal(initial);
  assert.equal(initialJournal.ok, true);
  let journal = initialJournal.journal;
  requests.forEach((request, index) => {
    assert.equal(request.expectedRevision, index);
    const next = applyM1V8MatchResult(initial, journal, request);
    assert.equal(next.ok, true, JSON.stringify(next).slice(0, 350));
    journal = next.journal;
  });
  return journal;
}
function report(journal) {
  const checked = deriveM1VerifiedV8MedicalContinuity(initial, journal);
  assert.equal(checked.ok, true, JSON.stringify(checked).slice(0, 350));
  return checked.report;
}

test('empty and medical-free journals invent no illness or restrictions', () => {
  const empty = committed([]);
  const zero = report(empty);
  assert.equal(zero.status,
    'SYNTHETIC_V8_MEDICAL_HISTORY_REVIEW_NOT_ELIGIBILITY');
  assert.equal(zero.examinedCompletedFixtures, 0);
  assert.deepEqual(zero.permanentWithdrawals, []);
  assert.deepEqual(zero.laterMatchdayListings, []);
  const healthy = report(committed([
    request(first, 0, 'healthy-first'),
    request(second, 1, 'healthy-second'),
  ]));
  assert.deepEqual(healthy.permanentWithdrawals, []);
  assert.deepEqual(healthy.laterMatchdayListings, []);
});

test('chronology is defined by rounds, not commit order or future knowledge', () => {
  // Commit the future result first. The earlier withdrawal must still be
  // recognized by its source-verified round, without rewriting either match.
  const future = request(second, 0, 'future');
  const earlier = request(first, 1, 'earlier', { withdraw: true });
  const journal = committed([future, earlier]);
  const before = structuredClone(journal);
  const medical = report(journal);
  assert.equal(medical.examinedCompletedFixtures, 2);
  assert.deepEqual(medical.permanentWithdrawals, [{
    fixtureId: first.id, round: first.round, clubId, playerId,
  }]);
  assert.deepEqual(medical.laterMatchdayListings, [{
    precedingWithdrawalFixtureId: first.id,
    precedingWithdrawalRound: first.round,
    fixtureId: second.id, round: second.round,
    clubId, playerId, listing: 'starter',
  }]);
  assert.deepEqual(journal, before);
  assert.equal(validateM1V8MatchJournal(initial, journal).ok, true);
});

test('an unused substitute listing is flagged, not counted as an appearance', () => {
  const journal = committed([
    request(first, 0, 'withdrawn', { withdraw: true }),
    request(second, 1, 'bench', { unusedBench: true }),
  ]);
  const medical = report(journal);
  assert.equal(medical.permanentWithdrawals.length, 1);
  assert.equal(medical.laterMatchdayListings.length, 1);
  assert.equal(medical.laterMatchdayListings[0].listing, 'unused-substitute');
  assert.equal(journal.results[1].dossier.teams[
    second.homeClubId === clubId ? 'home' : 'away'
  ].unusedBench.includes(playerId), true);
});

test('most recent earlier withdrawal is used without creating a recovery date', () => {
  const journal = committed([
    request(first, 0, 'injury-a', { withdraw: true }),
    request(second, 1, 'injury-b', { withdraw: true }),
    request(third, 2, 'third-appearance'),
  ]);
  const medical = report(journal);
  assert.equal(medical.permanentWithdrawals.length, 2);
  assert.deepEqual(medical.laterMatchdayListings.map(x => ({
    round: x.round, preceding: x.precedingWithdrawalRound,
  })), [
    { round: second.round, preceding: first.round },
    { round: third.round, preceding: second.round },
  ]);
});

test('tampered, legacy and mismatched journals fail closed without mutation', () => {
  const journal = committed([
    request(first, 0, 'injury-a', { withdraw: true }),
    request(second, 1, 'second'),
  ]);
  const corrupt = structuredClone(journal);
  corrupt.results[0].dossier.players.find(p =>
    p.playerId === playerId).permanentlyMedicallyWithdrawn = false;
  const before = structuredClone(corrupt);
  assert.deepEqual(deriveM1VerifiedV8MedicalContinuity(initial, corrupt),
    { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(corrupt, before);
  const v7 = startM1V7MatchJournal(initial);
  assert.equal(v7.ok, true);
  assert.deepEqual(deriveM1VerifiedV8MedicalContinuity(initial, v7.journal),
    { ok: false, error: 'INVALID_JOURNAL' });
});
