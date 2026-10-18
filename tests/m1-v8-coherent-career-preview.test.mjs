import test from 'node:test';
import assert from 'node:assert/strict';
import { applyM1V8CoherentCareerPreviewBatch }
  from '../dist/core/m1-v8-coherent-career-preview.js';
import { applyM1V8MatchResultBatch, startM1V8MatchJournal }
  from '../dist/core/m1-v8-result-journal.js';
import { deriveM1VerifiedV8FixtureCoverage }
  from '../dist/core/m1-v8-fixture-coverage.js';
import { deriveM1VerifiedV8SeasonStats }
  from '../dist/core/m1-v8-season-statistics.js';
import { deriveM1VerifiedV8UnrankedPoints }
  from '../dist/core/m1-v8-unranked-points.js';
import { snapshotM1V8InterruptedMatch }
  from '../dist/core/m1-v8-interruption.js';
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
const career = createInitialCareer(catalog, catalog.clubs[0].id, 42,
  'v8-coherent-preview');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const fresh = startM1V8MatchJournal(career);
assert.equal(fresh.ok, true);

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
    { schemaVersion: 1, decisionId: 'explicit-penalty',
      fixtureId: fixture.id, teamId: fixture.homeClubId,
      playerId: taker, elapsedSeconds: 600,
      kind: 'penalty-kick', outcome: 'scored' },
    { schemaVersion: 1, decisionId: 'explicit-own-goal',
      fixtureId: fixture.id, teamId: fixture.homeClubId,
      playerId: defender, elapsedSeconds: 900, kind: 'own-goal' },
  ] : [];
  const result = simulateM1V8MedicalPhases(prematch, policy, [], decisions, []);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 160));
  return {
    schemaVersion: 4, commandId: 'coherent-' + fixture.id,
    careerId: career.careerId, expectedRevision: revision,
    prematch, policy, plannedCommands: [], trustedDecisions: decisions,
    medicalActions: [], result,
  };
}
const success = value => {
  assert.equal(value.ok, true, JSON.stringify(value).slice(0, 180));
  return value;
};

test('one pure batch exposes one coherent journal revision and 3 replayed views', () => {
  const commands = fixtures.slice(0, 3).map((fixture, index) =>
    request(fixture, index, index + 30, index === 0));
  const originalJournal = structuredClone(fresh.journal);
  const originalCareer = structuredClone(career);
  const originalRequests = structuredClone(commands);
  const accepted = success(applyM1V8CoherentCareerPreviewBatch(
    career, fresh.journal, commands));
  const direct = success(applyM1V8MatchResultBatch(
    career, fresh.journal, commands));
  assert.deepEqual(accepted.journal, direct.journal);
  assert.equal(accepted.journal.revision, 3);
  assert.equal(accepted.preview.schemaVersion, 1);
  assert.equal(accepted.preview.status,
    'SYNTHETIC_V8_COHERENT_PREVIEW_NO_CAREER_POSTING');
  assert.equal(accepted.preview.journalRevision, 3);
  assert.equal(accepted.preview.completedFixtures, 3);
  assert.equal(accepted.preview.careerId, career.careerId);
  const fixtureCoverage = success(deriveM1VerifiedV8FixtureCoverage(
    career, accepted.journal)).report;
  const seasonStatistics = success(deriveM1VerifiedV8SeasonStats(
    career, accepted.journal)).report;
  const unrankedPoints = success(deriveM1VerifiedV8UnrankedPoints(
    career, accepted.journal)).preview;
  assert.deepEqual(accepted.preview.fixtureCoverage, fixtureCoverage);
  assert.deepEqual(accepted.preview.seasonStatistics, seasonStatistics);
  assert.deepEqual(accepted.preview.unrankedPoints, unrankedPoints);
  assert.equal(fixtureCoverage.completedFixtures + fixtureCoverage.pendingFixtures,
    240);
  assert.equal(unrankedPoints.clubs.reduce((total, club) =>
    total + club.played, 0), 6);
  assert.equal(unrankedPoints.clubs.reduce((total, club) =>
    total + club.goalsFor, 0),
  seasonStatistics.teams.reduce((total, club) => total + club.goalsFor, 0));
  assert.equal(Object.hasOwn(accepted.journal, 'points'), false);
  assert.equal(Object.hasOwn(career, 'points'), false);
  assert.deepEqual(fresh.journal, originalJournal);
  assert.deepEqual(career, originalCareer);
  assert.deepEqual(commands, originalRequests);
});

test('invalid later batch member is typed and cannot expose a partial next career', () => {
  const first = request(fixtures[0], 0, 38, false);
  const second = request(fixtures[1], 1, 39, true);
  const original = structuredClone(fresh.journal);
  const forged = { ...second, result: {
    ...second.result, rngState: second.result.rngState ^ 1,
  } };
  assert.deepEqual(applyM1V8CoherentCareerPreviewBatch(
    career, fresh.journal, [first, forged]),
  { ok: false, error: 'INVALID_MATCH_RESULT' });
  assert.deepEqual(fresh.journal, original);
  assert.deepEqual(applyM1V8CoherentCareerPreviewBatch(
    career, fresh.journal, [first, { ...second, expectedRevision: 0 }]),
  { ok: false, error: 'STALE_REVISION' });
  assert.deepEqual(applyM1V8CoherentCareerPreviewBatch(
    career, fresh.journal, []),
  { ok: false, error: 'INVALID_BATCH' });
  const interrupted = snapshotM1V8InterruptedMatch(
    first.prematch, policy, [], first.trustedDecisions, [], 1200);
  assert.equal(interrupted.ok, true);
  assert.deepEqual(applyM1V8CoherentCareerPreviewBatch(
    career, fresh.journal, [{ ...first, result: interrupted.prefix }]),
  { ok: false, error: 'INVALID_MATCH_RESULT' });
});

test('retry, old revision and poisoned original journal cannot create points', () => {
  const first = request(fixtures[0], 0, 67, true);
  const applied = success(applyM1V8CoherentCareerPreviewBatch(
    career, fresh.journal, [first]));
  assert.deepEqual(applyM1V8CoherentCareerPreviewBatch(
    career, applied.journal, [first]),
  { ok: false, error: 'DUPLICATE_COMMAND' });
  const next = request(fixtures[1], 0, 68);
  assert.deepEqual(applyM1V8CoherentCareerPreviewBatch(
    career, applied.journal, [next]),
  { ok: false, error: 'STALE_REVISION' });
  const poisoned = { ...applied.journal, results: [
    { ...applied.journal.results[0], eventCount: 999 },
  ] };
  assert.deepEqual(applyM1V8CoherentCareerPreviewBatch(
    career, poisoned, [{ ...next, expectedRevision: 1 }]),
  { ok: false, error: 'INVALID_JOURNAL' });
  assert.equal(Object.hasOwn(applied.journal, 'preview'), false);
});
