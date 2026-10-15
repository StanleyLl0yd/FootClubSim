import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyM1MatchResult, M1_APPLY_COMMAND_SCHEMA_VERSION,
  M1_RESULT_JOURNAL_SCHEMA_VERSION, startM1MatchResultJournal,
} from '../dist/core/m1-result-journal.js';
import { simulateM1V5Phases } from '../dist/core/m1-phases-v5.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { createInitialCareer } from '../dist/core/save.js';

const catalog = createSyntheticRplScaleCatalog(77);
const career = createInitialCareer(catalog, catalog.clubs[0].id, 42, 'm1-career-journal');
const fixtureGroups = generateDoubleRoundRobin(catalog.clubs.map(c => c.id));
const fixtures = fixtureGroups.flatMap(round => round.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function inputFor(fixture, seed = 42) {
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
function request(fixture, revision, commandId = 'commit-' + fixture.id, seed = 42) {
  const prematch = inputFor(fixture, seed);
  const result = simulateM1V5Phases(prematch, policy);
  assert.equal(result.ok, true);
  return {
    schemaVersion: M1_APPLY_COMMAND_SCHEMA_VERSION,
    commandId, careerId: career.careerId, expectedRevision: revision,
    prematch, policy, plannedCommands: [], result,
  };
}
function good(value) {
  assert.equal(value.ok, true, JSON.stringify(value).slice(0, 240));
  if (!value.ok) throw Error(value.error);
  return value.journal;
}
function refuse(value, code) {
  assert.deepEqual(value, { ok: false, error: code });
}
const zero = () => good(startM1MatchResultJournal(career));

test('new M1 journal is separate from historical M0 save revision zero', () => {
  assert.equal(M1_RESULT_JOURNAL_SCHEMA_VERSION, 1);
  assert.equal(M1_APPLY_COMMAND_SCHEMA_VERSION, 1);
  const m0Before = JSON.stringify(career);
  const journal = zero();
  assert.equal(journal.revision, 0);
  assert.equal(journal.careerId, career.careerId);
  assert.equal(journal.controlledClubId, career.selectedClubId);
  assert.deepEqual(journal.results, []);
  assert.equal(JSON.stringify(career), m0Before);
  assert.equal(career.saveSchemaVersion, 1);
  assert.equal(career.revision, 0);
});

test('full-time result is replayed from seed and applied in one immutable revision', () => {
  const before = zero();
  const command = request(fixtures[0], 0);
  const after = good(applyM1MatchResult(career, before, command));
  assert.equal(after.revision, 1);
  assert.equal(after.results.length, 1);
  const applied = after.results[0];
  assert.equal(applied.fixtureId, fixtures[0].id);
  assert.equal(applied.round, fixtures[0].round);
  assert.equal(applied.homeClubId, fixtures[0].homeClubId);
  assert.equal(applied.awayClubId, fixtures[0].awayClubId);
  assert.equal(applied.engineVersion, '4');
  assert.equal(applied.eventSchemaVersion, 5);
  assert.equal(applied.rngSeed, 42);
  assert.equal(applied.rngState, command.result.rngState);
  assert.equal(applied.eventCount, command.result.events.length);
  assert.deepEqual(applied.report, command.result.report);
  assert.equal(before.revision, 0);
  assert.deepEqual(before.results, []);
});

test('same match/command cannot apply twice even with retries or a newer revision', () => {
  const before = zero();
  const first = request(fixtures[0], 0);
  const committed = good(applyM1MatchResult(career, before, first));
  const frozen = JSON.stringify(committed);
  refuse(applyM1MatchResult(career, committed, first), 'DUPLICATE_COMMAND');
  refuse(applyM1MatchResult(career, committed, {
    ...first, commandId: 'changed-request', expectedRevision: 1,
  }), 'DUPLICATE_FIXTURE');
  refuse(applyM1MatchResult(career, committed,
    request(fixtures[1], 0)), 'STALE_REVISION');
  assert.equal(JSON.stringify(committed), frozen);
});

test('forged score, events, engine and seed are not accepted as final results', () => {
  const before = zero();
  const valid = request(fixtures[0], 0);
  const fixtureId = valid.prematch.fixture.id;
  const candidates = [
    { ...valid.result, report: {
      ...valid.result.report,
      home: { ...valid.result.report.home, goals: valid.result.report.home.goals + 1 },
    } },
    { ...valid.result, rngSeed: valid.result.rngSeed + 1 },
    { ...valid.result, rngDraws: 85 },
    { ...valid.result, engineVersion: '3' },
    { ...valid.result, events: valid.result.events.slice(1) },
    { ...valid.result, events: valid.result.events.map(e =>
      e.type === 'full-time' ? { ...e, fixtureId } : e) },
    { ...valid.result, injected: undefined },
  ];
  for (const candidate of candidates) {
    refuse(applyM1MatchResult(career, before,
      { ...valid, result: candidate }), 'INVALID_MATCH_RESULT');
  }
  assert.equal(before.revision, 0);
});

test('wrong career, unauthorized pack and nonexistent fixture preserve old journal', () => {
  const before = zero();
  const valid = request(fixtures[0], 0);
  const original = JSON.stringify(before);
  refuse(applyM1MatchResult(career, before,
    { ...valid, careerId: 'different-career' }), 'WRONG_CAREER');
  refuse(applyM1MatchResult(career, before,
    { ...valid, prematch: { ...valid.prematch,
      catalog: { ...catalog, packVersion: 'different' } } }), 'UNTRUSTED_PACK');
  refuse(applyM1MatchResult(career, before,
    { ...valid, prematch: { ...valid.prematch,
      fixture: { ...fixtures[0], id: 'invented-match' } } }), 'UNKNOWN_FIXTURE');
  assert.equal(JSON.stringify(before), original);
});

test('serial multi-fixture batch commits exact revisions and copies result summaries', () => {
  let journal = zero();
  const initialSource = JSON.stringify(career);
  for (let index = 0; index < 4; index++) {
    const fixture = fixtures[index];
    const command = request(fixture, index, 'fixture-commit-' + index, 42 + index);
    journal = good(applyM1MatchResult(career, journal, command));
    assert.equal(journal.revision, index + 1);
    assert.equal(journal.results[index].fixtureId, fixture.id);
    assert.deepEqual(journal.results[index].report, command.result.report);
  }
  assert.equal(new Set(journal.results.map(x => x.fixtureId)).size, 4);
  assert.equal(new Set(journal.results.map(x => x.commandId)).size, 4);
  assert.equal(JSON.stringify(career), initialSource);
  const roundtripped = JSON.parse(JSON.stringify(journal));
  const next = request(fixtures[4], 4, 'fixture-commit-4', 46);
  assert.equal(good(applyM1MatchResult(career, roundtripped, next)).revision, 5);
});

test('match journal accepts a derived real 0-0 without inventing a win', () => {
  const fixture = fixtures[5];
  let chosen = null;
  for (let seed = 1; seed <= 60; seed++) {
    const attempt = request(fixture, 0, 'nil-nil-' + seed, seed);
    if (attempt.result.report.home.goals === 0 &&
        attempt.result.report.away.goals === 0) {
      chosen = attempt;
      break;
    }
  }
  assert.ok(chosen, 'at least one paired synthetic seed must naturally produce 0-0');
  const result = good(applyM1MatchResult(career, zero(), chosen));
  assert.equal(result.results[0].report.home.goals, 0);
  assert.equal(result.results[0].report.away.goals, 0);
  assert.ok(result.results[0].report.home.shots >= 0);
});

test('malformed journal metadata, repeated results and changed pack are rejected', () => {
  const committed = good(applyM1MatchResult(career, zero(), request(fixtures[0], 0)));
  const next = request(fixtures[1], 1);
  for (const candidate of [
    null, [], {}, { ...committed, revision: 2 },
    { ...committed, schemaVersion: 2 },
    { ...committed, basePackVersion: 'forged' },
    { ...committed, results: [{ ...committed.results[0], report: {
      ...committed.results[0].report,
      away: { ...committed.results[0].report.away, shotsOnTarget: 200 },
    } }] },
    { ...committed, results: [{ ...committed.results[0], commandId: '' }] },
    { ...committed, results: [{ ...committed.results[0], eventCount: 100 }] },
    { ...committed, results: [{ ...committed.results[0], fixtureId: 'ghost' }] },
    { ...committed, hidden: undefined },
    { ...committed, results: [undefined] },
  ]) refuse(applyM1MatchResult(career, candidate, next), 'INVALID_JOURNAL');
});

test('invalid initial M0 snapshot is never implicitly upgraded or overwritten', () => {
  const saved = zero();
  refuse(startM1MatchResultJournal({ ...career, revision: 1 }), 'INVALID_INITIAL_CAREER');
  refuse(startM1MatchResultJournal({ ...career, engineVersion: '4' }),
    'INVALID_INITIAL_CAREER');
  refuse(startM1MatchResultJournal({ ...career, catalog: { ...catalog, source: 'real' } }),
    'INVALID_INITIAL_CAREER');
  refuse(applyM1MatchResult({ ...career, saveSchemaVersion: 2 }, saved,
    request(fixtures[0], 0)), 'INVALID_INITIAL_CAREER');
});
