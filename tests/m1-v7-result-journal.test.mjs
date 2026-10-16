import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startM1V7MatchJournal, validateM1V7MatchJournal, applyM1V7MatchResult,
  applyM1V7MatchResultBatch, M1_V7_JOURNAL_SCHEMA_VERSION,
} from '../dist/core/m1-v7-result-journal.js';
import { startM1V6MatchJournal } from '../dist/core/m1-v6-result-journal.js';
import { simulateM1V7Phases } from '../dist/core/m1-v7-adjudications.js';
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
const career = createInitialCareer(catalog, catalog.clubs[0].id, 42, 'v7-career');
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
function decisions(input) {
  const home = input.homeLineup.starters.find(id => positions.get(id) !== 'GK');
  const away = input.awayLineup.starters.find(id => positions.get(id) !== 'GK');
  return [
    { schemaVersion: 1, decisionId: 'penalty', fixtureId: input.fixture.id,
      elapsedSeconds: 300, teamId: input.fixture.homeClubId,
      playerId: home, kind: 'penalty-kick', outcome: 'scored' },
    { schemaVersion: 1, decisionId: 'own-goal', fixtureId: input.fixture.id,
      elapsedSeconds: 600, teamId: input.fixture.homeClubId,
      playerId: away, kind: 'own-goal' },
  ];
}
function request(fixture, revision, id = 'id-' + revision, seed = 42,
  commands = [], adjudications = null) {
  const source = prematch(fixture, seed);
  const trustedDecisions = adjudications ?? decisions(source);
  const result = simulateM1V7Phases(source, policy, commands, trustedDecisions);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 160));
  return { schemaVersion: 3, commandId: id, careerId: career.careerId,
    expectedRevision: revision, prematch: source, policy,
    plannedCommands: commands, trustedDecisions, result };
}
function good(result) {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 180));
  return result.journal;
}
const fail = (v, expected) => assert.deepEqual(v, { ok: false, error: expected });
const empty = () => good(startM1V7MatchJournal(career));

test('v7 journal is standalone and leaves M0/v6 identities untouched', () => {
  const before = JSON.stringify(career);
  assert.equal(M1_V7_JOURNAL_SCHEMA_VERSION, 3);
  assert.equal(empty().schemaVersion, 3);
  const old = startM1V6MatchJournal(career);
  assert.equal(old.ok, true);
  assert.equal(old.journal.schemaVersion, 2);
  fail(validateM1V7MatchJournal(career, old.journal), 'INVALID_JOURNAL');
  fail(startM1V7MatchJournal({ ...career, revision: 1 }), 'INVALID_INITIAL_CAREER');
  assert.equal(JSON.stringify(career), before);
});

test('v7 scores own goals without false extra shots and records each scorer once', () => {
  const cmd = request(fixtures[0], 0);
  const before = empty();
  const journal = good(applyM1V7MatchResult(career, before, cmd));
  assert.equal(before.revision, 0);
  assert.equal(journal.revision, 1);
  const saved = journal.results[0];
  assert.equal(saved.engineVersion, '6');
  assert.equal(saved.eventSchemaVersion, 7);
  assert.equal(saved.attribution.match.home.goals, cmd.result.report.home.goals);
  assert.equal(saved.attribution.match.home.ownGoalsFor, 1);
  assert.equal(saved.attribution.match.home.penaltyGoals, 1);
  assert.equal(saved.attribution.match.home.shots,
    cmd.result.base.report.home.shots + 1);
  assert.equal(saved.attribution.goals.length,
    saved.attribution.match.home.goals + saved.attribution.match.away.goals);
  assert.ok(saved.attribution.goals.some(g => g.kind === 'own-goal' &&
    g.defenderId && !Object.hasOwn(g, 'scorerId')));
  assert.deepEqual(good(validateM1V7MatchJournal(career,
    JSON.parse(JSON.stringify(journal)))), journal);
  fail(applyM1V7MatchResult(career, journal, cmd), 'DUPLICATE_COMMAND');
  fail(applyM1V7MatchResult(career, journal,
    { ...cmd, commandId: 'different', expectedRevision: 1 }), 'DUPLICATE_FIXTURE');
  fail(applyM1V7MatchResult(career, journal,
    request(fixtures[1], 0, 'stale')), 'STALE_REVISION');
});

test('empty decisions remain valid, historical v6 journal never accepts this schema', () => {
  const result = good(applyM1V7MatchResult(career, empty(),
    request(fixtures[0], 0, 'zero', 44, [], [])));
  assert.equal(result.results[0].attribution.match.home.ownGoalsFor, 0);
  assert.equal(result.results[0].attribution.match.home.penaltiesTaken, 0);
});

test('invalid seed, result, policy, catalog, fixture reject without side effects', () => {
  const cmd = request(fixtures[0], 0);
  const original = empty(), snapshot = structuredClone(original);
  for (const changed of [
    { ...cmd, result: { ...cmd.result, events: [] } },
    { ...cmd, result: { ...cmd.result, base: { ...cmd.result.base, rngState: 99 } } },
    { ...cmd, result: { ...cmd.result, report: {
      ...cmd.result.report, home: { ...cmd.result.report.home, goals: 99 },
    } } },
    { ...cmd, policy: {} },
    { ...cmd, trustedDecisions: [] },
  ]) fail(applyM1V7MatchResult(career, original, changed), 'INVALID_MATCH_RESULT');
  fail(applyM1V7MatchResult(career, original, { ...cmd,
    prematch: { ...cmd.prematch, catalog: { ...catalog, packVersion: 'faked' } } }),
  'UNTRUSTED_PACK');
  fail(applyM1V7MatchResult(career, original, { ...cmd,
    prematch: { ...cmd.prematch, fixture: { ...cmd.prematch.fixture, id: 'fake' } } }),
  'UNKNOWN_FIXTURE');
  assert.deepEqual(original, snapshot);
});

test('read-back rejects forged attribution, unknown actors and contradictory totals', () => {
  const journal = good(applyM1V7MatchResult(career, empty(), request(fixtures[0], 0)));
  const row = journal.results[0];
  const attribution = row.attribution;
  const mutant = changed => ({ ...journal, results: [{
    ...row, attribution: changed,
  }] });
  for (const invalid of [
    { ...attribution, match: { ...attribution.match,
      home: { ...attribution.match.home, goals: 99 } } },
    { ...attribution, match: { ...attribution.match,
      home: { ...attribution.match.home, xgCoverage: 'complete' } } },
    { ...attribution, goals: [{ kind: 'penalty', eventId: 'fake', teamId: row.homeClubId,
      scorerId: 'unknown', elapsedSeconds: 300 }] },
    { ...attribution, appearances: attribution.appearances.map((p, i) =>
      i === 0 ? { ...p, ownGoals: p.ownGoals + 1 } : p) },
    { ...attribution, teams: { ...attribution.teams,
      home: { ...attribution.teams.home, playedSeconds: -1 } } },
    { ...attribution, status: 'CONFIRMED_UNLIMITED_SANCTIONS' },
  ]) fail(validateM1V7MatchJournal(career, mutant(invalid)), 'INVALID_JOURNAL');
  for (const changed of [
    { ...journal, schemaVersion: 2 },
    { ...journal, revision: 2 },
    { ...journal, results: [row, row], revision: 2 },
    { ...journal, results: [{ ...row, eventSchemaVersion: 6 }] },
  ]) fail(validateM1V7MatchJournal(career, changed), 'INVALID_JOURNAL');
});

test('all-or-nothing batch equals serial results including special goals', () => {
  const cmds = [request(fixtures[0], 0, 'one', 51),
    request(fixtures[1], 1, 'two', 52),
    request(fixtures[2], 2, 'three', 53)];
  const before = empty();
  const batch = good(applyM1V7MatchResultBatch(career, before, cmds));
  let serial = empty();
  for (const cmd of cmds) serial = good(applyM1V7MatchResult(career, serial, cmd));
  assert.deepEqual(batch, serial);
  assert.equal(batch.revision, 3);
  fail(applyM1V7MatchResultBatch(career, before, [
    cmds[0], cmds[1], { ...cmds[2], result: { ...cmds[2].result, events: [] } },
  ]), 'INVALID_MATCH_RESULT');
  fail(applyM1V7MatchResultBatch(career, before,
    [cmds[0], { ...cmds[1], commandId: 'one' }]), 'DUPLICATE_COMMAND');
  fail(applyM1V7MatchResultBatch(career, before, []), 'INVALID_BATCH');
  fail(applyM1V7MatchResultBatch(career, before,
    Array(17).fill(cmds[0])), 'INVALID_BATCH');
  assert.deepEqual(before, empty());
});
