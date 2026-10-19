import test from 'node:test';
import assert from 'node:assert/strict';
import {
  M1_V11_GOAL_CLOCK_RULES, M1_V11_GOAL_CLOCK_SCHEMA,
  startM1V11GoalClock, advanceM1V11GoalClock, runM1V11GoalClock,
} from '../dist/core/m1-v11-goal-clock.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
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
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const input = (rngSeed = 645) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog,
  homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed,
});
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const yes = x => { assert.equal(x.ok, true, JSON.stringify(x).slice(0, 350)); return x.state; };
const no = (x, error) => assert.deepEqual(x, {ok:false,error});
const full = (pause, seed = 645) => yes(runM1V11GoalClock(input(seed), policy, pause));

test('source-derived goal at second 299 pauses wall time without advancing running time', () => {
  const original = simulateM1V8MedicalPhases(input(), policy, [], [], []);
  assert.equal(original.ok, true);
  const openingGoal = original.events.find(x =>
    x.type === 'shot' && x.outcome === 'goal' && x.elapsedSeconds === 299);
  assert.ok(openingGoal);
  const first = yes(startM1V11GoalClock(input(), policy, 7));
  assert.equal(first.schemaVersion, M1_V11_GOAL_CLOCK_SCHEMA);
  assert.equal(first.rulesId, M1_V11_GOAL_CLOCK_RULES);
  assert.equal(first.status, 'running');
  assert.deepEqual([first.runningSeconds, first.wallSeconds], [0,0]);
  const stopped = yes(advanceM1V11GoalClock(input(), policy, first));
  assert.equal(stopped.status, 'stopped');
  assert.equal(stopped.events[1].kind, 'goal-whistle');
  assert.equal(stopped.events[1].sourceGoalId, openingGoal.id);
  assert.deepEqual([stopped.runningSeconds, stopped.wallSeconds], [299,299]);
  const resumed = yes(advanceM1V11GoalClock(input(), policy, stopped));
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.events[2].kind, 'restart-kickoff');
  assert.equal(resumed.events[2].scoringTeamId, openingGoal.teamId);
  assert.deepEqual([resumed.runningSeconds, resumed.wallSeconds], [299,306]);
});

test('autoplay is exactly identical to interactive continuation from a JSON round-trip', () => {
  const seed = 645, pause = 11;
  let s = yes(startM1V11GoalClock(input(seed), policy, pause));
  while (s.status !== 'full-time') {
    const plain = JSON.parse(JSON.stringify(s));
    s = yes(advanceM1V11GoalClock(input(seed), policy, plain));
  }
  const auto = full(pause, seed);
  assert.deepEqual(auto, s);
  assert.equal(auto.runningSeconds, 5400);
  assert.equal(auto.status, 'full-time');
  assert.equal(auto.events.at(-1).kind, 'full-time');
  const pauses = auto.events.filter(x => x.kind === 'goal-whistle').length;
  assert.equal(auto.wallSeconds, 5400 + 11 * pauses);
  assert.ok(pauses >= 1);
  assert.equal(auto.eventCursor, auto.events.length);
  const after = yes(advanceM1V11GoalClock(input(seed), policy, auto));
  assert.deepEqual(after, auto);
});

test('any finite source-only goal whistle maps one-to-one to a validated scored shot', () => {
  for (const seed of [1, 42, 49, 645, 965]) {
    const simulator = simulateM1V8MedicalPhases(input(seed), policy, [], [], []);
    assert.equal(simulator.ok, true);
    const goals = simulator.events.filter(x => x.type === 'shot' &&
      x.outcome === 'goal' && x.elapsedSeconds !== 5399);
    const s = full(0, seed);
    const whistles = s.events.filter(x => x.kind === 'goal-whistle');
    assert.deepEqual(whistles.map(x => x.sourceGoalId), goals.map(x => x.id));
    assert.deepEqual(whistles.map(x => x.runningSeconds),
      goals.map(x => x.elapsedSeconds));
    assert.equal(s.wallSeconds, 5400);
    assert.equal(s.runningSeconds, 5400);
  }
});

test('saved source replay rejects forged whistle, clock, fixture, seed and chronology', () => {
  const first = yes(startM1V11GoalClock(input(), policy, 5));
  const stop = yes(advanceM1V11GoalClock(input(), policy, first));
  const alter = update => {
    const c = structuredClone(stop);
    update(c);
    no(advanceM1V11GoalClock(input(), policy, c), 'INVALID_STATE');
    assert.equal(stop.events.length, 2);
  };
  for (const edit of [
    x => { x.fixtureId = 'forged'; },
    x => { x.rngSeed = 1; },
    x => { x.status = 'running'; },
    x => { x.runningSeconds = 300; },
    x => { x.wallSeconds += 1; },
    x => { x.pauseWallSeconds = 6; },
    x => { x.eventCursor += 1; },
    x => { x.events[1].sourceGoalId = 'fake-goal'; },
    x => { x.events[1].scoringTeamId = 'fake-team'; },
    x => { x.events[1].sequence = 1; },
    x => { x.events.push({...x.events[1]}); },
    x => { x.unknown = true; },
  ]) alter(edit);
  no(advanceM1V11GoalClock(input(1), policy, stop), 'INVALID_STATE');
});

test('malicious getters and cyclic snapshots are rejected without evaluation', () => {
  const first = yes(startM1V11GoalClock(input(), policy, 5));
  let visits = 0;
  const attacker = structuredClone(first);
  Object.defineProperty(attacker.events[0], 'id', {
    enumerable: true, get() { visits++; return 'v11-clock-1'; },
  });
  no(advanceM1V11GoalClock(input(), policy, attacker), 'INVALID_STATE');
  assert.equal(visits, 0);
  const cycle = structuredClone(first);
  cycle.events[0].cycle = cycle;
  no(advanceM1V11GoalClock(input(), policy, cycle), 'INVALID_STATE');
  const malicious = { ...input(), fixture: { ...fixture } };
  Object.defineProperty(malicious.fixture, 'id', {
    enumerable: true, get() { visits++; return fixture.id; },
  });
  no(startM1V11GoalClock(malicious, policy, 5), 'INVALID_SOURCE');
  assert.equal(visits, 0);
});

test('pause boundaries reject unsupported timings without changing v8 scoring', () => {
  for (const bad of [-1, 121, 2.5, NaN, Infinity, '5', null]) {
    no(startM1V11GoalClock(input(), policy, bad), 'INVALID_PAUSE');
  }
  const s = full(120);
  const whistles = s.events.filter(x => x.kind === 'goal-whistle').length;
  assert.equal(s.wallSeconds, 5400 + whistles * 120);
  assert.equal(s.events.filter(x => x.kind === 'restart-kickoff').length, whistles);
});
