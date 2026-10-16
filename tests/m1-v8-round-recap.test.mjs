import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8RoundRecap }
  from '../dist/core/m1-v8-round-recap.js';
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
  catalog, catalog.clubs[0].id, 42, 'v8-round-recap-career');
const rounds = generateDoubleRoundRobin(catalog.clubs.map(c => c.id));
const club = new Map(catalog.clubs.map(x => [x.id, x]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function request(fixture, i) {
  const input = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog,
    homeLineup: defaultSyntheticLineup(club.get(fixture.homeClubId)),
    awayLineup: defaultSyntheticLineup(club.get(fixture.awayClubId)),
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 42 + i,
  };
  const result = simulateM1V8MedicalPhases(input, policy, [], [], []);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 260));
  return {
    schemaVersion: 4, commandId: 'round-recap-' + i,
    careerId: initial.careerId, expectedRevision: i,
    prematch: input, policy, plannedCommands: [],
    trustedDecisions: [], medicalActions: [], result,
  };
}
function saved(fixtures) {
  const start = startM1V8MatchJournal(initial);
  assert.equal(start.ok, true);
  if (!fixtures.length) return start.journal;
  const requests = fixtures.map((f, i) => request(f, i));
  const next = applyM1V8MatchResultBatch(initial, start.journal, requests);
  assert.equal(next.ok, true, JSON.stringify(next).slice(0, 240));
  return next.journal;
}
function recap(journal, round = 1) {
  const result = deriveM1VerifiedV8RoundRecap(initial, journal, round);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 270));
  return result.recap;
}

test('empty round keeps all eight fixtures pending with no invented 0-0', () => {
  const report = recap(saved([]));
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.status,
    'SYNTHETIC_V8_SOURCE_REPLAY_ROUND_NO_STANDINGS');
  assert.equal(report.round, 1);
  assert.equal(report.expectedFixtures, 8);
  assert.equal(report.completedFixtures, 0);
  assert.equal(report.pendingFixtures, 8);
  assert.equal(report.complete, false);
  assert.deepEqual(report.matches.map(x => x.fixtureId),
    rounds[0].fixtures.map(x => x.id));
  assert.ok(report.matches.every(x => x.status === 'pending' &&
    x.score === null && x.goalAttributions === null &&
    x.yellowCards === null && x.dismissals === null &&
    x.eventCount === null));
  assert.equal(Object.hasOwn(report, 'standings'), false);
  assert.equal(Object.hasOwn(report, 'points'), false);
});

test('out-of-order committed results appear in the canonical matchday order', () => {
  const f = rounds[0].fixtures;
  const journal = saved([f[2], rounds[2].fixtures[0], f[0]]);
  const before = structuredClone(journal);
  const report = recap(journal);
  assert.equal(report.journalRevision, 3);
  assert.equal(report.completedFixtures, 2);
  assert.equal(report.pendingFixtures, 6);
  assert.equal(report.matches[0].status, 'completed');
  assert.equal(report.matches[1].status, 'pending');
  assert.equal(report.matches[2].status, 'completed');
  assert.deepEqual(report.matches.map(x => x.fixtureId), f.map(x => x.id));
  for (const id of [f[0].id, f[2].id]) {
    const expected = journal.results.find(x => x.fixtureId === id);
    const displayed = report.matches.find(x => x.fixtureId === id);
    assert.deepEqual(displayed.score, {
      home: expected.dossier.match.home.goals,
      away: expected.dossier.match.away.goals,
    });
    assert.deepEqual(displayed.goalAttributions,
      expected.dossier.goalAttributions);
    assert.equal(displayed.eventCount, expected.eventCount);
  }
  const third = recap(journal, 3);
  assert.equal(third.completedFixtures, 1);
  assert.equal(third.matches[0].status, 'completed');
  assert.deepEqual(journal, before);
});

test('complete synthetic round requires all eight source-replayed results', () => {
  const journal = saved(rounds[0].fixtures);
  const report = recap(journal);
  assert.equal(report.complete, true);
  assert.equal(report.completedFixtures, 8);
  assert.equal(report.pendingFixtures, 0);
  assert.ok(report.matches.every(x => x.status === 'completed' &&
    Number.isSafeInteger(x.score.home) &&
    Number.isSafeInteger(x.score.away) &&
    x.eventCount >= 1));
  assert.equal(Object.hasOwn(report, 'table'), false);
  assert.equal(Object.hasOwn(report, 'awardedPoints'), false);
});

test('invalid rounds, legacy history and corrupted match scores fail closed', () => {
  const empty = saved([]);
  for (const bad of [-1, 0, 31, NaN, Infinity, '1', 1.5]) {
    assert.deepEqual(deriveM1VerifiedV8RoundRecap(initial, empty, bad),
      { ok: false, error: 'INVALID_ROUND' });
  }
  const old = startM1V7MatchJournal(initial);
  assert.equal(old.ok, true);
  assert.deepEqual(deriveM1VerifiedV8RoundRecap(initial, old.journal, 1),
    { ok: false, error: 'INVALID_JOURNAL' });
  const good = saved([rounds[0].fixtures[0]]);
  const corrupted = structuredClone(good);
  corrupted.results[0].dossier.match.home.goals++;
  const before = structuredClone(corrupted);
  assert.deepEqual(deriveM1VerifiedV8RoundRecap(initial, corrupted, 1),
    { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(corrupted, before);
});
