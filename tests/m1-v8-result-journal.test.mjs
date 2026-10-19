import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startM1V8MatchJournal, validateM1V8MatchJournal,
  applyM1V8MatchResult, applyM1V8MatchResultBatch,
  applyM1V8MatchResultBatchAtRevision,
  M1_V8_JOURNAL_SCHEMA_VERSION,
} from '../dist/core/m1-v8-result-journal.js';
import { startM1V7MatchJournal } from '../dist/core/m1-v7-result-journal.js';
import { snapshotM1V8InterruptedMatch }
  from '../dist/core/m1-v8-interruption.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { createInitialCareer } from '../dist/core/save.js';

const catalog = createSyntheticRplScaleCatalog(77);
const career = createInitialCareer(
  catalog, catalog.clubs[0].id, 42, 'v8-source-career');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const prematch = (fixture, seed = 42) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog,
  homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
function medical(input) {
  const playerId = input.homeLineup.starters.find(id =>
    positions.get(id) !== 'GK');
  return [{
    schemaVersion: 1, id: 'medical-exit', fixtureId: input.fixture.id,
    teamId: input.fixture.homeClubId, playerId, elapsedSeconds: 0,
    kind: 'treatment-exit', reason: 'medical-staff-entered',
    restartAtRunningSeconds: 15,
  }, {
    schemaVersion: 1, id: 'medical-return', fixtureId: input.fixture.id,
    teamId: input.fixture.homeClubId, playerId, elapsedSeconds: 300,
    kind: 'treatment-return', returnContext: 'running-clock',
    ballInPlay: true, entryBoundary: 'touchline',
    refereeSignalId: 'unverified-controller-claim',
  }];
}
function decisions(input) {
  const taker = input.homeLineup.starters.find(id =>
    positions.get(id) !== 'GK');
  const defender = input.awayLineup.starters.find(id =>
    positions.get(id) !== 'GK');
  return [{
    schemaVersion: 1, decisionId: 'penalty',
    fixtureId: input.fixture.id, teamId: input.fixture.homeClubId,
    elapsedSeconds: 600, kind: 'penalty-kick', playerId: taker,
    outcome: 'scored',
  }, {
    schemaVersion: 1, decisionId: 'own-goal',
    fixtureId: input.fixture.id, teamId: input.fixture.homeClubId,
    elapsedSeconds: 900, kind: 'own-goal', playerId: defender,
  }];
}
function request(fixture, revision, id = 'command-' + revision,
  seed = 42, withMedical = true) {
  const input = prematch(fixture, seed);
  const medicalActions = withMedical ? medical(input) : [];
  const trustedDecisions = withMedical ? decisions(input) : [];
  const result = simulateM1V8MedicalPhases(
    input, policy, [], trustedDecisions, medicalActions);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 200));
  return {
    schemaVersion: 4, commandId: id, careerId: career.careerId,
    expectedRevision: revision, prematch: input, policy,
    plannedCommands: [], trustedDecisions, medicalActions, result,
  };
}
function success(value) {
  assert.equal(value.ok, true, JSON.stringify(value).slice(0, 220));
  return value.journal;
}
const failed = (actual, error) =>
  assert.deepEqual(actual, { ok: false, error });
const empty = () => success(startM1V8MatchJournal(career));

test('schema-4 journal is isolated from M0 save and previous v7 journals', () => {
  const old = structuredClone(career);
  assert.equal(M1_V8_JOURNAL_SCHEMA_VERSION, 4);
  assert.equal(empty().schemaVersion, 4);
  const v7 = startM1V7MatchJournal(career);
  assert.equal(v7.ok, true);
  failed(validateM1V8MatchJournal(career, v7.journal), 'INVALID_JOURNAL');
  failed(startM1V8MatchJournal({ ...career, revision: 1 }),
    'INVALID_INITIAL_CAREER');
  assert.deepEqual(career, old);
});

test('new replay journal retains unused bench, source, specials and medical history', () => {
  const source = request(fixtures[0], 0);
  const before = empty();
  const applied = success(applyM1V8MatchResult(career, before, source));
  assert.equal(before.revision, 0);
  assert.equal(applied.revision, 1);
  const saved = applied.results[0];
  assert.equal(saved.eventSchemaVersion, 8);
  assert.equal(saved.engineVersion, '7');
  assert.equal(saved.rngDraws, 90);
  assert.equal(saved.dossier.match.home.penaltyGoals, 1);
  assert.equal(saved.dossier.match.home.ownGoalsFor, 1);
  assert.equal(saved.dossier.teams.home.benchNamed.length,
    source.prematch.homeLineup.bench.length);
  assert.deepEqual(saved.dossier.teams.home.unusedBench,
    source.prematch.homeLineup.bench);
  assert.equal(saved.source.medicalActions.length, 2);
  assert.equal(saved.source.trustedDecisions.length, 2);
  assert.equal(Object.hasOwn(saved.source.prematch, 'catalog'), false);
  assert.equal(Object.hasOwn(saved, 'events'), false);
  assert.deepEqual(success(validateM1V8MatchJournal(
    career, JSON.parse(JSON.stringify(applied)))), applied);
  // Even with the original request mutated, stored replay source remains intact.
  source.medicalActions[0].id = 'changed-after-commit';
  assert.equal(saved.source.medicalActions[0].id, 'medical-exit');
});

test('empty medical/referee streams support strict deterministic 0-0 or any score', () => {
  const cmd = request(fixtures[0], 0, 'normal', 1, false);
  const journal = success(applyM1V8MatchResult(career, empty(), cmd));
  assert.equal(journal.results[0].dossier.match.home.ownGoalsFor, 0);
  assert.equal(journal.results[0].dossier.match.home.penaltyGoals, 0);
  assert.equal(journal.results[0].source.medicalActions.length, 0);
  assert.deepEqual(success(validateM1V8MatchJournal(career, journal)), journal);
});

test('retries, old revisions and repeated fixture are explicitly rejected', () => {
  const command = request(fixtures[0], 0);
  const journal = success(applyM1V8MatchResult(career, empty(), command));
  failed(applyM1V8MatchResult(career, journal, command), 'DUPLICATE_COMMAND');
  failed(applyM1V8MatchResult(career, journal,
    { ...command, commandId: 'different', expectedRevision: 1 }),
  'DUPLICATE_FIXTURE');
  failed(applyM1V8MatchResult(career, journal,
    request(fixtures[1], 0, 'stale')), 'STALE_REVISION');
  failed(applyM1V8MatchResult(career, journal,
    { ...request(fixtures[1], 1, 'wrong-career'), careerId: 'other-career' }),
  'WRONG_CAREER');
});

test('candidate false goals, altered RNG, catalog and fixture cannot post a career', () => {
  const cmd = request(fixtures[0], 0);
  const source = empty();
  const cloned = structuredClone(source);
  for (const changed of [
    { ...cmd, result: { ...cmd.result, rngState: cmd.result.rngState ^ 1 } },
    { ...cmd, result: { ...cmd.result, events: cmd.result.events.slice(1) } },
    { ...cmd, result: { ...cmd.result, report: { ...cmd.result.report,
      home: { ...cmd.result.report.home, goals: 999 } } } },
    { ...cmd, result: { ...cmd.result, offFieldAtFullTime: ['fake'] } },
  ]) failed(applyM1V8MatchResult(career, source, changed),
    'INVALID_MATCH_RESULT');
  failed(applyM1V8MatchResult(career, source, {
    ...cmd, prematch: { ...cmd.prematch,
      catalog: { ...catalog, packVersion: 'injected' } },
  }), 'UNTRUSTED_PACK');
  failed(applyM1V8MatchResult(career, source, {
    ...cmd, prematch: { ...cmd.prematch,
      fixture: { ...cmd.prematch.fixture, round: 999 } },
  }), 'UNKNOWN_FIXTURE');
  assert.deepEqual(source, cloned);
});

test('saved journal is recomputed, not merely trusted as plausible JSON', () => {
  const applied = success(applyM1V8MatchResult(career, empty(),
    request(fixtures[0], 0)));
  const row = applied.results[0];
  const invalid = [
    { ...applied, revision: 2 },
    { ...applied, additional: true },
    { ...applied, results: [row, row] },
    { ...applied, results: [{ ...row, eventCount: row.eventCount + 1 }] },
    { ...applied, results: [{ ...row, rngState: row.rngState ^ 1 }] },
    { ...applied, results: [{ ...row, dossier: { ...row.dossier,
      match: { ...row.dossier.match,
        home: { ...row.dossier.match.home, goals: 99 } } } }] },
    { ...applied, results: [{ ...row, dossier: { ...row.dossier,
      teams: { ...row.dossier.teams, home: {
        ...row.dossier.teams.home, unusedBench: [] } } } }] },
    { ...applied, results: [{ ...row, source: { ...row.source,
      medicalActions: [] } }] },
    { ...applied, results: [{ ...row, source: { ...row.source,
      prematch: { ...row.source.prematch, rngSeed: 11 } } }] },
    { ...applied, results: [{ ...row, source: { ...row.source,
      plannedCommands: [,] } }] },
    { ...applied, results: [{ ...row, extra: undefined }] },
  ];
  for (const candidate of invalid) {
    failed(validateM1V8MatchJournal(career, candidate), 'INVALID_JOURNAL');
  }
  const circular = { ...row, source: { ...row.source } };
  circular.source.self = circular;
  failed(validateM1V8MatchJournal(career,
    { ...applied, results: [circular] }), 'INVALID_JOURNAL');
});

test('two-fixture batch equals sequential; failure on second item is atomic', () => {
  const first = request(fixtures[0], 0, 'one');
  const second = request(fixtures[1], 1, 'two', 99, false);
  const origin = empty();
  const firstState = success(applyM1V8MatchResult(career, origin, first));
  const sequential = success(applyM1V8MatchResult(
    career, firstState, second));
  assert.deepEqual(success(applyM1V8MatchResultBatch(
    career, origin, [first, second])), sequential);
  const prior = structuredClone(origin);
  failed(applyM1V8MatchResultBatch(career, origin, [
    first, { ...second, result: { ...second.result, rngState: 123 } },
  ]), 'INVALID_MATCH_RESULT');
  assert.deepEqual(origin, prior);
  failed(applyM1V8MatchResultBatch(career, origin, []), 'INVALID_BATCH');
  failed(applyM1V8MatchResultBatch(career, origin,
    Array(17).fill(first)), 'INVALID_BATCH');
});

test('interrupted prefix never masquerades as an accepted final match', () => {
  const req = request(fixtures[0], 0);
  const interrupted = snapshotM1V8InterruptedMatch(
    req.prematch, policy, [], req.trustedDecisions,
    req.medicalActions, 1200);
  assert.equal(interrupted.ok, true);
  failed(applyM1V8MatchResult(career, empty(),
    { ...req, result: interrupted.prefix }), 'INVALID_MATCH_RESULT');
});

test('JSON compatibility is required for retained match sources', () => {
  const req = request(fixtures[0], 0);
  failed(applyM1V8MatchResult(career, empty(), {
    ...req, policy: { ...policy, hidden: undefined },
  }), 'INVALID_APPLY_COMMAND');
  const cyclic = { ...policy };
  cyclic.loop = cyclic;
  failed(applyM1V8MatchResult(career, empty(),
    { ...req, policy: cyclic }), 'INVALID_APPLY_COMMAND');
});

test('a v8 replay source never invokes attacker-defined accessors or toJSON', () => {
  const command = request(fixtures[0], 0);
  let invocations = 0;
  const accessorPolicy = { ...policy };
  Object.defineProperty(accessorPolicy, 'injected', {
    enumerable: true, get() { invocations++; return 'hidden-source'; },
  });
  failed(applyM1V8MatchResult(career, empty(),
    { ...command, policy: accessorPolicy }), 'INVALID_APPLY_COMMAND');
  assert.equal(invocations, 0);
  const serializerPolicy = {
    ...policy,
    toJSON() { invocations++; return policy; },
  };
  failed(applyM1V8MatchResult(career, empty(),
    { ...command, policy: serializerPolicy }), 'INVALID_APPLY_COMMAND');
  assert.equal(invocations, 0);
});

test('hidden, symbolic and aliased JSON fields cannot disappear in v8 replay', () => {
  const journal = success(applyM1V8MatchResult(career, empty(),
    request(fixtures[0], 0)));
  const before = structuredClone(journal);
  const hidden = structuredClone(journal);
  Object.defineProperty(hidden, 'unrecorded', {
    value: 'covert', enumerable: false,
  });
  failed(validateM1V8MatchJournal(career, hidden), 'INVALID_JOURNAL');
  const symbolic = structuredClone(journal);
  symbolic[Symbol('unrecorded')] = 'covert';
  failed(validateM1V8MatchJournal(career, symbolic), 'INVALID_JOURNAL');
  const getter = structuredClone(journal);
  let calls = 0;
  Object.defineProperty(getter, 'surprise', {
    enumerable: true, get() { calls++; return 1; },
  });
  failed(validateM1V8MatchJournal(career, getter), 'INVALID_JOURNAL');
  assert.equal(calls, 0);
  const aliased = structuredClone(journal);
  aliased.results[0].source.trustedDecisions =
    aliased.results[0].source.medicalActions;
  failed(validateM1V8MatchJournal(career, aliased), 'INVALID_JOURNAL');
  assert.deepEqual(journal, before);
});

test('exotic objects cannot masquerade as plain v8 journal JSON', () => {
  const command = request(fixtures[0], 0);
  failed(applyM1V8MatchResult(career, empty(), {
    ...command, policy: { ...policy, metadata: new Map() },
  }), 'INVALID_APPLY_COMMAND');
  const modified = structuredClone(command);
  Object.setPrototypeOf(modified.policy, new Map());
  failed(applyM1V8MatchResult(career, empty(), modified),
    'INVALID_APPLY_COMMAND');
});

test('four-item batch preserves sequential verified journal and all-or-nothing rejection', () => {
  const commands = fixtures.slice(0, 4).map((fixture, index) =>
    request(fixture, index, 'batch-' + index, 42 + index, index % 2 === 0));
  const original = empty();
  let sequential = original;
  for (const command of commands) {
    sequential = success(applyM1V8MatchResult(career, sequential, command));
  }
  const batched = success(applyM1V8MatchResultBatch(career, original, commands));
  assert.deepEqual(batched, sequential);
  assert.equal(batched.revision, 4);
  assert.equal(batched.results.length, 4);
  const forged = { ...commands[2], result: {
    ...commands[2].result, rngState: commands[2].result.rngState ^ 1,
  } };
  failed(applyM1V8MatchResultBatch(career, original, [
    commands[0], commands[1], forged, commands[3],
  ]), 'INVALID_MATCH_RESULT');
  assert.equal(original.revision, 0);
  assert.equal(original.results.length, 0);
  const poisoned = { ...batched, results: [
    { ...batched.results[0], rngState: batched.results[0].rngState ^ 1 },
    ...batched.results.slice(1),
  ] };
  failed(applyM1V8MatchResultBatch(career, poisoned, [
    request(fixtures[4], 4, 'after-poisoned-history', 55, false),
  ]), 'INVALID_JOURNAL');
});

test('sixteen-fixture batch matches two verified commits and never trusts a poisoned prefix', () => {
  const commands = fixtures.slice(0, 16).map((fixture, index) =>
    request(fixture, index, 'sixteen-' + index, index + 17, index % 4 === 0));
  const first = success(applyM1V8MatchResultBatch(
    career, empty(), commands.slice(0, 8)));
  const second = success(applyM1V8MatchResultBatch(
    career, first, commands.slice(8)));
  const whole = success(applyM1V8MatchResultBatch(career, empty(), commands));
  assert.deepEqual(whole, second);
  assert.deepEqual(success(validateM1V8MatchJournal(career, whole)), whole);
  const corrupt = structuredClone(first);
  corrupt.results[3].dossier.match.home.goals++;
  failed(applyM1V8MatchResultBatch(career, corrupt, commands.slice(8)),
    'INVALID_JOURNAL');
  const tamperedCommand = structuredClone(commands[15]);
  tamperedCommand.result.rngState ^= 1;
  failed(applyM1V8MatchResultBatch(career, empty(), [
    ...commands.slice(0, 15), tamperedCommand,
  ]), 'INVALID_MATCH_RESULT');
  assert.equal(first.revision, 8);
});

test('revision-bound batch preserves parity and untrusted-journal rejection order', () => {
  const first = request(fixtures[0], 0, 'revision-1', 71, false);
  const second = request(fixtures[1], 1, 'revision-2', 72, false);
  const source = empty();
  const before = structuredClone(source);
  const expected = success(applyM1V8MatchResultBatch(
    career, source, [first, second]));
  const actual = success(applyM1V8MatchResultBatchAtRevision(
    career, source, 0, [first, second]));
  assert.deepEqual(actual, expected);
  assert.deepEqual(source, before);

  failed(applyM1V8MatchResultBatchAtRevision(
    career, actual, 0, []), 'STALE_REVISION');
  failed(applyM1V8MatchResultBatchAtRevision(
    career, actual, 2, []), 'INVALID_BATCH');
  const damaged = structuredClone(actual);
  damaged.results[0].dossier.match.home.goals += 1;
  failed(applyM1V8MatchResultBatchAtRevision(
    career, damaged, 0, []), 'INVALID_JOURNAL');
  failed(applyM1V8MatchResultBatchAtRevision(
    career, actual, 2, [first]), 'DUPLICATE_COMMAND');
  const forged = request(fixtures[2], 2, 'revision-forged', 73, false);
  forged.result.rngState ^= 1;
  failed(applyM1V8MatchResultBatchAtRevision(
    career, actual, 2, [forged]), 'INVALID_MATCH_RESULT');
  assert.deepEqual(source, before);
});
