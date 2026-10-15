import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceM1ControlledMatch, finishM1ControlledMatch, M1_CONTROL_SCHEMA_VERSION,
  M1_MAX_TACTICAL_COMMANDS, M1_TACTICS_COMMAND_VERSION,
  startM1ControlledMatch, submitM1TacticalCommand,
} from '../dist/core/m1-control.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION } from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(club => club.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(club => [club.id, club]));
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog,
  homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: ['coach-home'] },
  away: { assignedActor: { kind: 'staff', staffId: 'coach-away' },
    availableStaffIds: ['coach-away', 'physio-away'] },
};
const start = () => startM1ControlledMatch(prematch, policy);
function command(state, {
  id = 'tactic-1', side = 'home',
  actor = side === 'home' ? { kind: 'player' } : { kind: 'staff', staffId: 'coach-away' },
  changes = {}, at = state.clock.elapsedSeconds,
} = {}) {
  const teamId = side === 'home' ? fixture.homeClubId : fixture.awayClubId;
  const current = state.tactics[side];
  return {
    schemaVersion: M1_TACTICS_COMMAND_VERSION, commandId: id,
    fixtureId: fixture.id, teamId, elapsedSeconds: at,
    actor, kind: 'set-tactics', plan: { ...current, ...changes },
  };
}
function requireStart() {
  const result = start();
  assert.equal(result.ok, true);
  if (!result.ok) throw Error(result.error);
  return result.state;
}
function requireSuccess(result) {
  assert.equal(result.ok, true);
  if (!result.ok) throw Error(result.error);
  return result.state;
}
function requireFailure(result, code) {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, code);
}

test('versioned control state starts with isolated authority and independently copied tactics', () => {
  assert.equal(M1_CONTROL_SCHEMA_VERSION, 1);
  assert.equal(M1_TACTICS_COMMAND_VERSION, 1);
  const p = structuredClone(policy);
  const input = structuredClone(prematch);
  const result = startM1ControlledMatch(input, p);
  const state = requireSuccess(result);
  assert.deepEqual(state.commands, []);
  assert.equal(state.clock.elapsedSeconds, 0);
  p.away.assignedActor.staffId = 'tampered';
  input.homeTactics.tempo = 100;
  assert.equal(state.authority.away.assignedActor.staffId, 'coach-away');
  assert.equal(state.tactics.home.tempo, 50);
  assert.equal(state.initialTactics.home.tempo, 50);
});

test('authorized home player command at kickoff applies to future state only', () => {
  const before = requireStart();
  const candidate = command(before, { changes: { tempo: 88, mentality: 2 } });
  const state = requireSuccess(submitM1TacticalCommand(before, candidate));
  assert.equal(state.clock.elapsedSeconds, 0);
  assert.equal(state.tactics.home.tempo, 88);
  assert.equal(state.tactics.home.mentality, 2);
  assert.equal(state.initialTactics.home.tempo, 50);
  assert.equal(before.tactics.home.tempo, 50);
  assert.equal(state.commands[0].sequence, 1);
  assert.equal(state.commands[0].elapsedSeconds, 0);
  assert.equal(state.commands[0].teamId, fixture.homeClubId);
  assert.deepEqual(before.commands, []);
  candidate.plan.tempo = 1;
  assert.equal(state.commands[0].plan.tempo, 88);
  assert.equal(state.tactics.home.tempo, 88);
  const step = requireSuccess(advanceM1ControlledMatch(state));
  assert.equal(step.clock.elapsedSeconds, 300);
  assert.equal(step.tactics.home.tempo, 88);
  assert.equal(step.clock.rngState, 42, 'clock and tactical orders consume zero random draws');
});

test('delegated away staff may change its own tactics but human or other staff cannot', () => {
  const initial = requireStart();
  requireFailure(submitM1TacticalCommand(initial, command(initial, {
    id: 'unauthorized-home', side: 'away', actor: { kind: 'player' },
  })), 'UNAUTHORIZED');
  requireFailure(submitM1TacticalCommand(initial, command(initial, {
    id: 'unauthorized-staff', side: 'away', actor: { kind: 'staff', staffId: 'physio-away' },
  })), 'UNAUTHORIZED');
  requireFailure(submitM1TacticalCommand(initial, command(initial, {
    id: 'home-staff', actor: { kind: 'staff', staffId: 'coach-home' },
  })), 'UNAUTHORIZED');
  const accepted = requireSuccess(submitM1TacticalCommand(initial, command(initial, {
    id: 'away-coach', side: 'away', changes: { formation: '4-4-2', pressing: 67 },
  })));
  assert.equal(accepted.tactics.away.formation, '4-4-2');
  assert.equal(accepted.tactics.home.formation, '4-2-3-1');
  assert.equal(accepted.commands[0].actor.staffId, 'coach-away');
});

test('multiple same-time orders preserve exact user-supplied order through JSON roundtrip', () => {
  const initial = requireStart();
  const a = requireSuccess(submitM1TacticalCommand(initial,
    command(initial, { id: 'first', changes: { tempo: 71 } })));
  const b = requireSuccess(submitM1TacticalCommand(a,
    command(a, { id: 'second', changes: { tempo: 74 } })));
  const c = requireSuccess(submitM1TacticalCommand(b,
    command(b, { id: 'third', side: 'away', changes: { pressing: 60 } })));
  assert.deepEqual(c.commands.map(x => [x.sequence, x.commandId, x.elapsedSeconds]), [
    [1, 'first', 0], [2, 'second', 0], [3, 'third', 0],
  ]);
  assert.equal(c.tactics.home.tempo, 74);
  assert.equal(c.tactics.away.pressing, 60);
  const loaded = JSON.parse(JSON.stringify(c));
  const next = requireSuccess(advanceM1ControlledMatch(loaded));
  assert.deepEqual(next.commands, c.commands);
  assert.equal(next.clock.elapsedSeconds, 300);
  const nextAuto = requireSuccess(finishM1ControlledMatch(next));
  assert.equal(nextAuto.clock.elapsedSeconds, 5400);
  assert.equal(nextAuto.tactics.home.tempo, 74);
});

test('same command sequence plus clock produces byte-for-byte equal auto and interactive completion', () => {
  const kickoff = requireStart();
  const first = requireSuccess(submitM1TacticalCommand(kickoff,
    command(kickoff, { id: 'kickoff', changes: { mentality: 1, tempo: 60 } })));
  let stepped = first;
  for (let i = 0; i < 7; i++) stepped = requireSuccess(advanceM1ControlledMatch(stepped));
  stepped = requireSuccess(submitM1TacticalCommand(stepped,
    command(stepped, { id: 'halfish', side: 'away', changes: { defensiveLine: 20 } })));
  const saved = JSON.parse(JSON.stringify(stepped));
  const fast = finishM1ControlledMatch(saved);
  assert.equal(fast.ok, true);
  let oneAtATime = stepped;
  while (oneAtATime.clock.status !== 'full-time') {
    oneAtATime = requireSuccess(advanceM1ControlledMatch(oneAtATime));
  }
  assert.equal(JSON.stringify(fast.state), JSON.stringify(oneAtATime));
  assert.deepEqual(fast.report, {
    fixtureId: fixture.id,
    home: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
    away: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
  });
  assert.equal(fast.state.clock.rngState, 42);
});

test('strict input shape, proper authorization and available assigned staff are mandatory at start', () => {
  for (const badPolicy of [
    null, [], {}, { ...policy, unknown: 1 },
    { ...policy, home: null },
    { ...policy, home: { assignedActor: { kind: 'player', staffId: 'spoof' }, availableStaffIds: [] } },
    { ...policy, away: { assignedActor: { kind: 'staff', staffId: 'missing' }, availableStaffIds: [] } },
    { ...policy, away: { assignedActor: { kind: 'staff', staffId: 'coach-away' },
      availableStaffIds: ['coach-away', 'coach-away'] } },
    { ...policy, away: { assignedActor: { kind: 'staff', staffId: 'coach-away' },
      availableStaffIds: Array(33).fill('coach-away') } },
  ]) {
    requireFailure(startM1ControlledMatch(prematch, badPolicy), 'INVALID_CONTROL_CONFIG');
  }
  requireFailure(startM1ControlledMatch({ ...prematch, rngSeed: 0 }, policy), 'INVALID_CONTROL_CONFIG');
});

test('malformed, changed-time and invalid tactical orders fail without updating state', () => {
  const state = requireStart();
  const original = JSON.stringify(state);
  const valid = command(state);
  const cases = [
    [null, 'INVALID_COMMAND'],
    [[], 'INVALID_COMMAND'],
    [{ ...valid, schemaVersion: 2 }, 'INVALID_COMMAND'],
    [{ ...valid, kind: 'substitute' }, 'INVALID_COMMAND'],
    [{ ...valid, commandId: '' }, 'INVALID_COMMAND'],
    [{ ...valid, actor: { kind: 'player', staffId: 'forged' } }, 'INVALID_COMMAND'],
    [{ ...valid, plan: { ...valid.plan, tempo: 101 } }, 'INVALID_COMMAND'],
    [{ ...valid, plan: { ...valid.plan, unknown: 1 } }, 'INVALID_COMMAND'],
    [{ ...valid, fixtureId: 'different-fixture' }, 'WRONG_FIXTURE'],
    [{ ...valid, teamId: 'other-team', plan: { ...valid.plan, clubId: 'other-team' } }, 'UNKNOWN_TEAM'],
    [{ ...valid, elapsedSeconds: 300 }, 'COMMAND_CLOCK_MISMATCH'],
    [{ ...valid, unknown: 1 }, 'INVALID_COMMAND'],
  ];
  for (const [candidate, expected] of cases) {
    requireFailure(submitM1TacticalCommand(state, candidate), expected);
    assert.equal(JSON.stringify(state), original);
  }
});

test('future and backdated commands are rejected at a resumed checkpoint', () => {
  const start = requireStart();
  const after = requireSuccess(advanceM1ControlledMatch(start));
  requireFailure(submitM1TacticalCommand(after,
    command(after, { at: 0 })), 'COMMAND_CLOCK_MISMATCH');
  requireFailure(submitM1TacticalCommand(after,
    command(after, { at: 600 })), 'COMMAND_CLOCK_MISMATCH');
  const accepted = requireSuccess(submitM1TacticalCommand(after,
    command(after, { id: 'checkpoint-300' })));
  assert.equal(accepted.commands.at(-1).elapsedSeconds, 300);
  requireFailure(submitM1TacticalCommand(accepted,
    command(accepted, { id: 'checkpoint-300' })), 'DUPLICATE_COMMAND');
});

test('tampered or sparse command history fails closed on next step or future command', () => {
  const kickoff = requireStart();
  const valid = requireSuccess(submitM1TacticalCommand(kickoff, command(kickoff)));
  const suspicious = [
    null, {}, { ...valid, schemaVersion: 2 },
    { ...valid, clock: { ...valid.clock, elapsedSeconds: 600 } },
    { ...valid, tactics: { ...valid.tactics, home: { ...valid.tactics.home, tempo: 99 } } },
    { ...valid, authority: { ...valid.authority, home: { assignedActor: { kind: 'staff', staffId: 'X' },
      availableStaffIds: [] } } },
    { ...valid, commands: [{ ...valid.commands[0], sequence: 2 }] },
    { ...valid, commands: [{ ...valid.commands[0], elapsedSeconds: 300 }] },
    { ...valid, commands: [{ ...valid.commands[0], actor: { kind: 'staff', staffId: 'coach-home' } }] },
    { ...valid, commands: [{ ...valid.commands[0], plan: { ...valid.commands[0].plan, tempo: 70 } }] },
    { ...valid, commands: [null] },
    { ...valid, commands: Array(1) },
    { ...valid, commands: Array(M1_MAX_TACTICAL_COMMANDS + 1).fill(valid.commands[0]) },
    { ...valid, commands: [{ ...valid.commands[0], unknown: 1 }] },
    { ...valid, unexpected: 1 },
  ];
  for (const candidate of suspicious) {
    requireFailure(advanceM1ControlledMatch(candidate), 'INVALID_CONTROL_STATE');
    requireFailure(submitM1TacticalCommand(candidate, command(valid)), 'INVALID_CONTROL_STATE');
  }
});

test('command quota is bounded, without partial mutation or duplicate acceptance', () => {
  let state = requireStart();
  for (let i = 0; i < M1_MAX_TACTICAL_COMMANDS; i++) {
    state = requireSuccess(submitM1TacticalCommand(state,
      command(state, { id: 'c-' + i, changes: { tempo: i % 101 } })));
  }
  assert.equal(state.commands.length, M1_MAX_TACTICAL_COMMANDS);
  const before = JSON.stringify(state);
  requireFailure(submitM1TacticalCommand(state, command(state, { id: 'excess' })), 'COMMAND_LIMIT');
  assert.equal(JSON.stringify(state), before);
  assert.equal(requireSuccess(finishM1ControlledMatch(state)).clock.status, 'full-time');
});

test('full-time rejects late interventions, but advancing completed clock is idempotent', () => {
  const finished = requireSuccess(finishM1ControlledMatch(requireStart()));
  assert.equal(finished.clock.status, 'full-time');
  requireFailure(submitM1TacticalCommand(finished, command(finished, { id: 'late' })), 'MATCH_FINISHED');
  const again = advanceM1ControlledMatch(finished);
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(JSON.stringify(again.state), JSON.stringify(finished));
  const autoAgain = finishM1ControlledMatch(finished);
  assert.equal(autoAgain.ok, true);
  if (autoAgain.ok) assert.deepEqual(autoAgain.report, {
    fixtureId: fixture.id,
    home: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
    away: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
  });
});
