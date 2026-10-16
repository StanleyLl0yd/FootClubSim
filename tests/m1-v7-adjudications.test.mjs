import test from 'node:test';
import assert from 'node:assert/strict';
import {
  M1_V7_ENGINE_VERSION, M1_V7_EVENT_SCHEMA_VERSION,
  simulateM1V7Phases, verifyM1V7Result,
} from '../dist/core/m1-v7-adjudications.js';
import { simulateM1V6Phases } from '../dist/core/m1-phases-v6.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const homeClub = catalog.clubs.find(c => c.id === fixture.homeClubId);
const awayClub = catalog.clubs.find(c => c.id === fixture.awayClubId);
const home = defaultSyntheticLineup(homeClub);
const away = defaultSyntheticLineup(awayClub);
const players = new Map(catalog.players.map(p => [p.id, p]));
const homeField = home.starters.find(id => players.get(id).primaryPosition !== 'GK');
const awayField = away.starters.find(id => players.get(id).primaryPosition !== 'GK');
const homeBench = home.bench.find(id => players.get(id).primaryPosition !== 'GK');
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'staff', staffId: 'away-coach' },
    availableStaffIds: ['away-coach'] },
};
function penalty(id, at = 300, outcome = 'scored', playerId = homeField) {
  return {
    schemaVersion: 1, decisionId: id, fixtureId: fixture.id,
    elapsedSeconds: at, teamId: fixture.homeClubId, playerId,
    kind: 'penalty-kick', outcome,
  };
}
function ownGoal(id, at = 600, playerId = awayField) {
  return {
    schemaVersion: 1, decisionId: id, fixtureId: fixture.id,
    elapsedSeconds: at, teamId: fixture.homeClubId, playerId,
    kind: 'own-goal',
  };
}
function red(id, playerId, time = 300) {
  return {
    schemaVersion: 1, id, fixtureId: fixture.id, teamId: fixture.homeClubId,
    playerId, elapsedSeconds: time, kind: 'direct-red', origin: 'trusted-referee',
  };
}
function sub(id, time = 300) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, elapsedSeconds: time,
    kind: 'substitute-normal', actor: { kind: 'player' },
    outPlayerId: homeField, inPlayerId: homeBench, stoppage: 'referee-authorized',
  };
}
function match(commands = [], decisions = [], input = prematch) {
  const result = simulateM1V7Phases(input, policy, commands, decisions);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 150));
  return result;
}

test('v7 is isolated: no decisions preserve all v6 events, RNG and open-play score', () => {
  assert.equal(M1_V7_ENGINE_VERSION, '6');
  assert.equal(M1_V7_EVENT_SCHEMA_VERSION, 7);
  for (const seed of [1, 42, 777, 0xffffffff]) {
    const input = { ...prematch, rngSeed: seed };
    const v6 = simulateM1V6Phases(input, policy);
    const v7 = match([], [], input);
    assert.equal(v6.ok, true);
    assert.deepEqual(v7.base, v6);
    assert.deepEqual(v7.events.map(e => e.type === 'v6-event' ? e.source : null),
      v6.events);
    for (const side of ['home', 'away']) {
      assert.equal(v7.report[side].goals, v6.report[side].goals);
      assert.equal(v7.report[side].openPlayGoals, v6.report[side].goals);
      assert.equal(v7.report[side].penaltiesTaken, 0);
      assert.equal(v7.report[side].ownGoalsFor, 0);
      assert.equal(v7.report[side].xgCoverage, 'open-play-only');
    }
    assert.ok(verifyM1V7Result(input, policy, [], [], v7));
  }
});

test('scored, saved and missed penalties change only adjudicated counts', () => {
  const decisions = [penalty('p1', 300), penalty('p2', 600, 'saved'),
    penalty('p3', 900, 'missed')];
  const v7 = match([], decisions);
  assert.equal(v7.report.home.goals, v7.base.report.home.goals + 1);
  assert.equal(v7.report.home.penaltiesTaken, 3);
  assert.equal(v7.report.home.penaltyGoals, 1);
  assert.equal(v7.report.home.shots, v7.base.report.home.shots + 3);
  assert.equal(v7.report.home.shotsOnTarget, v7.base.report.home.shotsOnTarget + 2);
  assert.equal(v7.report.home.xgMilli, v7.base.report.home.xgMilli);
  assert.equal(v7.report.home.xgCoverage, 'open-play-only');
  assert.equal(v7.base.rngDraws, 90);
  assert.equal(v7.events.filter(e => e.type === 'adjudication').length, 3);
  assert.ok(verifyM1V7Result(prematch, policy, [], decisions, v7));
});

test('own goal credits opponents without inventing a shooter or xG', () => {
  const v7 = match([], [ownGoal('og1')]);
  assert.equal(v7.report.home.goals, v7.base.report.home.goals + 1);
  assert.equal(v7.report.home.ownGoalsFor, 1);
  assert.equal(v7.report.away.goals, v7.base.report.away.goals);
  assert.equal(v7.report.home.openPlayGoals, v7.base.report.home.goals);
  assert.equal(v7.report.home.shots, v7.base.report.home.shots);
  assert.equal(v7.report.home.shotsOnTarget, v7.base.report.home.shotsOnTarget);
});

test('a penalized player must belong to scoring side, an own-goal defender to other side', () => {
  const a = simulateM1V7Phases(prematch, policy, [], [penalty('wrong', 300, 'scored', awayField)]);
  const b = simulateM1V7Phases(prematch, policy, [], [ownGoal('wrong', 300, homeField)]);
  assert.deepEqual(a, { ok: false, error: 'REJECTED_DECISION' });
  assert.deepEqual(b, { ok: false, error: 'REJECTED_DECISION' });
});

test('red at checkpoint removes player before a same-checkpoint penalty', () => {
  const result = simulateM1V7Phases(prematch, policy, [red('r', homeField)],
    [penalty('p', 300, 'scored', homeField)]);
  assert.deepEqual(result, { ok: false, error: 'REJECTED_DECISION' });
  const ok = match([red('r', homeField)], [penalty('p', 0, 'scored', homeField)]);
  assert.ok(ok.events.find(e => e.type === 'adjudication' && e.elapsedSeconds === 0));
});

test('substitution has effect before adjudication at the same time', () => {
  const commands = [sub('sub-1')];
  const replaced = simulateM1V7Phases(prematch, policy, commands,
    [penalty('old', 300, 'scored', homeField)]);
  assert.deepEqual(replaced, { ok: false, error: 'REJECTED_DECISION' });
  const accepted = match(commands, [penalty('new', 300, 'scored', homeBench)]);
  const events300 = accepted.events.filter(e => e.elapsedSeconds === 300);
  assert.deepEqual(events300.map(e => e.type), ['v6-event', 'adjudication']);
});

test('reject duplicate, malformed, out-of-order and unsupported penalty decisions', () => {
  const cases = [
    [penalty('a'), penalty('a', 600)],
    [penalty('a', 600), penalty('b', 300)],
    [penalty('a'), penalty('b', 300)],
    [penalty('a', 301)],
    [{ ...penalty('a'), fixtureId: 'other-fixture' }],
    [{ ...penalty('a'), outcome: 'retake' }],
    [{ ...penalty('a'), extra: true }],
    [{ ...ownGoal('a'), outcome: 'scored' }],
    [ownGoal('a', 5400)],
    [penalty('r', 600)],
  ];
  for (const decisions of cases) {
    const cmds = decisions.at(-1)?.decisionId === 'r' ? [red('r', homeField)] : [];
    const result = simulateM1V7Phases(prematch, policy, cmds, decisions);
    assert.equal(result.ok, false, JSON.stringify(decisions));
  }
});

test('mixed v7 event sequence and replay verification detect tampering', () => {
  const decisions = [penalty('p', 0), ownGoal('og', 600)];
  const v7 = match([], decisions);
  assert.deepEqual(v7.events.map(e => e.sequence),
    Array.from({ length: v7.events.length }, (_, i) => i + 1));
  assert.equal(v7.events.at(-1).source.type, 'full-time');
  assert.deepEqual(v7.events.filter(e => e.type === 'adjudication')
    .map(e => e.elapsedSeconds), [0, 600]);
  assert.ok(verifyM1V7Result(prematch, policy, [], decisions, v7));
  assert.equal(verifyM1V7Result(prematch, policy, [], decisions,
    { ...v7, report: { ...v7.report,
      home: { ...v7.report.home, goals: v7.report.home.goals + 1 } } }), false);
  assert.equal(verifyM1V7Result(prematch, policy, [], decisions,
    { ...v7, events: [...v7.events].reverse() }), false);
  assert.equal(verifyM1V7Result(prematch, policy, [], [], v7), false);
});
