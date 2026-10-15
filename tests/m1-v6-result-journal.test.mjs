import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyM1V6MatchResult, applyM1V6MatchResultBatch, startM1V6MatchJournal,
  validateM1V6MatchJournal, M1_V6_JOURNAL_SCHEMA_VERSION,
} from '../dist/core/m1-v6-result-journal.js';
import { startM1MatchResultJournal } from '../dist/core/m1-result-journal.js';
import { simulateM1V6Phases } from '../dist/core/m1-phases-v6.js';
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
const career = createInitialCareer(catalog, catalog.clubs[0].id, 42, 'v6-journal-career');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function input(fixture, seed = 42) {
  return {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog,
    homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
  };
}
function request(fixture, revision, id = 'commit-' + revision, commands = [], seed = 42) {
  const prematch = input(fixture, seed);
  const result = simulateM1V6Phases(prematch, policy, commands);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 220));
  return {
    schemaVersion: 2, commandId: id, careerId: career.careerId,
    expectedRevision: revision, prematch, policy,
    plannedCommands: commands, result,
  };
}
function good(v) {
  assert.equal(v.ok, true, JSON.stringify(v).slice(0, 200));
  return v.journal;
}
function bad(v, code) { assert.deepEqual(v, { ok: false, error: code }); }
const empty = () => good(startM1V6MatchJournal(career));
function incident(source, id, at, kind = 'caution') {
  return {
    schemaVersion: 1, id, fixtureId: source.fixture.id,
    teamId: source.fixture.homeClubId,
    playerId: source.homeLineup.starters.find(p => positions.get(p) !== 'GK'),
    elapsedSeconds: at, kind,
    origin: kind === 'injury-withdrawal' ? 'trusted-medical' : 'trusted-referee',
  };
}

test('v6 journal preserves independent v5 and M0 version boundaries', () => {
  const before = JSON.stringify(career);
  assert.equal(M1_V6_JOURNAL_SCHEMA_VERSION, 2);
  assert.equal(empty().schemaVersion, 2);
  assert.equal(good(startM1MatchResultJournal(career)).schemaVersion, 1);
  bad(validateM1V6MatchJournal(career, good(startM1MatchResultJournal(career))),
    'INVALID_JOURNAL');
  bad(startM1V6MatchJournal({ ...career, revision: 1 }), 'INVALID_INITIAL_CAREER');
  assert.equal(JSON.stringify(career), before);
});
test('v6 card, dismissal, match score and scorers commit exactly once', () => {
  const source = input(fixtures[0]);
  const commands = [incident(source, 'yellow-one', 300),
    incident(source, 'red-two', 600, 'direct-red')];
  const cmd = request(fixtures[0], 0, 'unique-command', commands);
  const original = empty();
  const done = good(applyM1V6MatchResult(career, original, cmd));
  assert.equal(done.revision, 1);
  assert.equal(original.revision, 0);
  const row = done.results[0];
  assert.equal(row.engineVersion, '5');
  assert.equal(row.eventSchemaVersion, 6);
  assert.equal(row.discipline.home.yellowCards, 1);
  assert.equal(row.discipline.home.dismissals, 1);
  assert.equal(row.report.home.goals, cmd.result.report.home.goals);
  assert.equal(row.rngState, cmd.result.rngState);
  assert.equal(row.goals.length, row.report.home.goals + row.report.away.goals);
  assert.deepEqual(good(validateM1V6MatchJournal(career,
    JSON.parse(JSON.stringify(done)))), done);
  bad(applyM1V6MatchResult(career, done, cmd), 'DUPLICATE_COMMAND');
  bad(applyM1V6MatchResult(career, done,
    { ...cmd, commandId: 'new-id', expectedRevision: 1 }), 'DUPLICATE_FIXTURE');
  bad(applyM1V6MatchResult(career, done,
    request(fixtures[1], 0, 'stale')), 'STALE_REVISION');
});
test('forged RNG, events, score, pack, schedule and policy reject without mutation', () => {
  const cmd = request(fixtures[0], 0);
  const original = empty();
  for (const changed of [
    { ...cmd, result: { ...cmd.result, rngState: 100 } },
    { ...cmd, result: { ...cmd.result, rngSeed: 100 } },
    { ...cmd, result: { ...cmd.result, events: cmd.result.events.slice(1) } },
    { ...cmd, result: { ...cmd.result, report: { ...cmd.result.report,
      home: { ...cmd.result.report.home, goals: 99 } } } },
    { ...cmd, policy: {} },
  ]) bad(applyM1V6MatchResult(career, original, changed), 'INVALID_MATCH_RESULT');
  bad(applyM1V6MatchResult(career, original, { ...cmd,
    prematch: { ...cmd.prematch, catalog: {
      ...catalog, packVersion: 'other',
    } } }), 'UNTRUSTED_PACK');
  bad(applyM1V6MatchResult(career, original, { ...cmd,
    prematch: { ...cmd.prematch, fixture: {
      ...cmd.prematch.fixture, id: 'unlisted',
    } } }), 'UNKNOWN_FIXTURE');
  assert.equal(original.revision, 0);
  assert.deepEqual(original.results, []);
});
test('persisted journal rejects structural tampering, unknown goals and duplicates', () => {
  const done = good(applyM1V6MatchResult(career, empty(), request(fixtures[0], 0)));
  const row = done.results[0];
  for (const candidate of [
    { ...done, schemaVersion: 1 },
    { ...done, revision: 2 },
    { ...done, extra: undefined },
    { ...done, results: [{ ...row, engineVersion: '4' }] },
    { ...done, results: [{ ...row, discipline: {
      home: { ...row.discipline.home, yellowCards: -1 },
      away: row.discipline.away,
    } }] },
    { ...done, results: [{ ...row, report: { ...row.report,
      home: { ...row.report.home, shotsOnTarget: 50 } } }] },
    { ...done, results: [{ ...row, goals: [{
      kind: 'synthetic-open-play-shot', eventId: 'fake',
      teamId: row.homeClubId, scorerId: 'missing',
      elapsedSeconds: 299,
    }] }] },
    { ...done, results: [row, row], revision: 2 },
  ]) bad(validateM1V6MatchJournal(career, candidate), 'INVALID_JOURNAL');
});
test('batch equals sequential, refuses late error without exposing partial revision', () => {
  const cmds = [
    request(fixtures[0], 0, 'first', [], 20),
    request(fixtures[1], 1, 'second', [], 21),
    request(fixtures[2], 2, 'third', [], 22),
  ];
  const previous = empty();
  const committed = good(applyM1V6MatchResultBatch(career, previous, cmds));
  let serial = empty();
  for (const cmd of cmds) serial = good(applyM1V6MatchResult(career, serial, cmd));
  assert.deepEqual(committed, serial);
  assert.equal(committed.revision, 3);
  const forged = { ...cmds[2], result: { ...cmds[2].result, rngDraws: 1 } };
  bad(applyM1V6MatchResultBatch(career, previous,
    [cmds[0], cmds[1], forged]), 'INVALID_MATCH_RESULT');
  bad(applyM1V6MatchResultBatch(career, previous,
    [cmds[0], { ...cmds[1], commandId: 'first' }]), 'DUPLICATE_COMMAND');
  bad(applyM1V6MatchResultBatch(career, previous, []), 'INVALID_BATCH');
  bad(applyM1V6MatchResultBatch(career, previous, Array(17).fill(cmds[0])),
    'INVALID_BATCH');
  assert.deepEqual(previous, empty());
});
