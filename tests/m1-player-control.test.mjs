import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceM1PlayerControl, finishM1PlayerControl, M1_PLAYER_COMMAND_VERSION,
  M1_PLAYER_INSTRUCTION_SCHEMA_VERSION, M1_MAX_PLAYER_COMMANDS,
  startM1PlayerControl, submitM1PlayerInstruction,
  submitM1TeamTacticsWithPlayerControl,
} from '../dist/core/m1-player-control.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION } from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const input = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup, awayLineup,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: ['coach-home'] },
  away: {
    assignedActor: { kind: 'staff', staffId: 'coach-away' },
    availableStaffIds: ['coach-away', 'physio-away'],
  },
};
const playerById = new Map(catalog.players.map(p => [p.id, p]));
const outfield = (lineup) => lineup.starters.find(id => playerById.get(id).primaryPosition !== 'GK');
const goalkeeper = (lineup) => lineup.starters.find(id => playerById.get(id).primaryPosition === 'GK');
function success(result) {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 250));
  if (!result.ok) throw Error(result.error);
  return result.state;
}
function rejected(result, error) {
  assert.deepEqual(result, { ok: false, error });
}
const initial = () => success(startM1PlayerControl(input, policy));
function cmd(state, {
  id = 'instruction-1', side = 'home',
  playerId = outfield(side === 'home' ? homeLineup : awayLineup),
  actor = side === 'home' ? { kind: 'player' } : { kind: 'staff', staffId: 'coach-away' },
  focus = 'attack', at = state.controlled.clock.elapsedSeconds,
} = {}) {
  return {
    schemaVersion: M1_PLAYER_COMMAND_VERSION, commandId: id,
    fixtureId: fixture.id,
    teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
    playerId, elapsedSeconds: at,
    actor, kind: 'set-player-focus', focus,
  };
}
function tactic(state, { id = 'tactics-1', side = 'home', tempo = 77 } = {}) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
    elapsedSeconds: state.controlled.clock.elapsedSeconds,
    actor: side === 'home' ? { kind: 'player' } : { kind: 'staff', staffId: 'coach-away' },
    kind: 'set-tactics',
    plan: { ...state.controlled.tactics[side], tempo },
  };
}

test('M1 individual command protocol is new and does not modify M0/clock schemas', () => {
  assert.equal(M1_PLAYER_COMMAND_VERSION, 1);
  assert.equal(M1_PLAYER_INSTRUCTION_SCHEMA_VERSION, 1);
  assert.equal(M1_MAX_PLAYER_COMMANDS, 64);
  const state = initial();
  assert.equal(state.controlled.clock.elapsedSeconds, 0);
  assert.deepEqual(state.instructions, []);
  assert.deepEqual(state.commands, []);
});

test('human and assigned staff only can set outfield focus at current virtual checkpoint', () => {
  const start = initial();
  const a = success(submitM1PlayerInstruction(input, policy, start, cmd(start)));
  assert.equal(a.instructions.length, 1);
  assert.equal(a.instructions[0].focus, 'attack');
  assert.equal(a.commands[0].sequence, 1);
  assert.equal(a.controlled.clock.elapsedSeconds, 0);
  assert.deepEqual(start.instructions, []);
  const later = success(advanceM1PlayerControl(input, policy, a));
  assert.equal(later.controlled.clock.elapsedSeconds, 300);
  const away = success(submitM1PlayerInstruction(input, policy, later,
    cmd(later, { id: 'away-1', side: 'away', focus: 'defend' })));
  assert.equal(away.instructions.length, 2);
  assert.deepEqual(away.commands.map(x => [x.sequence, x.elapsedSeconds]),
    [[1, 0], [2, 300]]);
});

test('team and individual orders can be interleaved, same ID cannot be reused', () => {
  const start = initial();
  const person = success(submitM1PlayerInstruction(input, policy, start, cmd(start, { id: 'shared' })));
  rejected(submitM1TeamTacticsWithPlayerControl(input, policy, person,
    tactic(person, { id: 'shared' })), 'DUPLICATE_COMMAND');
  const plan = success(submitM1TeamTacticsWithPlayerControl(input, policy, person,
    tactic(person, { id: 'tactic-only', tempo: 92 })));
  assert.equal(plan.controlled.tactics.home.tempo, 92);
  const after = success(submitM1PlayerInstruction(input, policy, plan,
    cmd(plan, { id: 'person-2', focus: 'defend' })));
  assert.equal(after.instructions.length, 1);
  assert.equal(after.instructions[0].focus, 'defend');
  assert.equal(after.controlled.commands.length, 1);
  assert.equal(after.commands.length, 2);
  const saved = JSON.parse(JSON.stringify(after));
  const advanced = success(advanceM1PlayerControl(input, policy, saved));
  assert.equal(advanced.controlled.tactics.home.tempo, 92);
  assert.equal(advanced.instructions[0].focus, 'defend');
  assert.equal(advanced.controlled.clock.elapsedSeconds, 300);
});

test('unauthorized, inactive, goalkeepers, mismatched fixture and malformed orders fail atomically', () => {
  const start = initial();
  const good = cmd(start);
  const cases = [
    [{ ...good, actor: { kind: 'staff', staffId: 'coach-home' } }, 'UNAUTHORIZED'],
    [{ ...good, actor: { kind: 'player', staffId: 'forged' } }, 'INVALID_COMMAND'],
    [{ ...good, playerId: homeLineup.bench[0] }, 'INACTIVE_PLAYER'],
    [{ ...good, playerId: goalkeeper(homeLineup) }, 'GOALKEEPER'],
    [{ ...good, playerId: awayLineup.starters[0] }, 'INACTIVE_PLAYER'],
    [{ ...good, fixtureId: 'other-fixture' }, 'WRONG_FIXTURE'],
    [{ ...good, teamId: 'other-club' }, 'UNKNOWN_TEAM'],
    [{ ...good, elapsedSeconds: 300 }, 'COMMAND_CLOCK_MISMATCH'],
    [{ ...good, focus: 'fly' }, 'INVALID_COMMAND'],
    [{ ...good, schemaVersion: 2 }, 'INVALID_COMMAND'],
    [{ ...good, unknown: true }, 'INVALID_COMMAND'],
    [{ ...good, playerId: undefined }, 'INVALID_COMMAND'],
    [null, 'INVALID_COMMAND'],
    [[], 'INVALID_COMMAND'],
  ];
  const before = JSON.stringify(start);
  for (const [candidate, error] of cases) {
    rejected(submitM1PlayerInstruction(input, policy, start, candidate), error);
    assert.equal(JSON.stringify(start), before);
  }
  rejected(submitM1PlayerInstruction(input, policy, start, cmd(start, {
    side: 'away', actor: { kind: 'staff', staffId: 'physio-away' },
  })), 'UNAUTHORIZED');
});

test('strict replay rejects mutated commands, instructions, authority, extra fields and clock', () => {
  let state = initial();
  state = success(submitM1PlayerInstruction(input, policy, state, cmd(state)));
  state = success(submitM1TeamTacticsWithPlayerControl(input, policy, state, tactic(state)));
  state = success(advanceM1PlayerControl(input, policy, state));
  for (const altered of [
    { ...state, schemaVersion: 2 },
    { ...state, instructions: [] },
    { ...state, instructions: [{ ...state.instructions[0], focus: 'defend' }] },
    { ...state, commands: [{ ...state.commands[0], sequence: 2 }] },
    { ...state, commands: [{ ...state.commands[0], elapsedSeconds: 600 }] },
    { ...state, commands: [{ ...state.commands[0], actor: { kind: 'staff', staffId: 'fake' } }] },
    { ...state, controlled: { ...state.controlled,
      tactics: { ...state.controlled.tactics, home: { ...state.controlled.tactics.home, tempo: 100 } } } },
    { ...state, controlled: { ...state.controlled, authority: { ...state.controlled.authority,
      home: { assignedActor: { kind: 'staff', staffId: 'forged' }, availableStaffIds: ['forged'] } } } },
    { ...state, controlled: { ...state.controlled, clock: { ...state.controlled.clock, elapsedSeconds: 600 } } },
    { ...state, extra: undefined },
    { ...state, commands: [...state.commands, undefined] },
  ]) {
    rejected(advanceM1PlayerControl(input, policy, altered), 'INVALID_STATE');
  }
  const changedPolicy = { ...policy, home: { assignedActor: { kind: 'staff', staffId: 'fake' },
    availableStaffIds: ['fake'] } };
  rejected(advanceM1PlayerControl(input, changedPolicy, state), 'INVALID_STATE');
});

test('JSON checkpoint and automatic finish equal repeated individual steps', () => {
  let first = initial();
  first = success(submitM1PlayerInstruction(input, policy, first,
    cmd(first, { focus: 'defend', id: 'first' })));
  for (let i = 0; i < 8; i++) first = success(advanceM1PlayerControl(input, policy, first));
  first = success(submitM1PlayerInstruction(input, policy, first,
    cmd(first, { focus: 'attack', id: 'later' })));
  const paused = JSON.parse(JSON.stringify(first));
  const auto = success(finishM1PlayerControl(input, policy, paused));
  let stepped = first;
  while (stepped.controlled.clock.status !== 'full-time') {
    stepped = success(advanceM1PlayerControl(input, policy, stepped));
  }
  assert.deepEqual(auto, stepped);
  assert.equal(auto.controlled.clock.elapsedSeconds, 5400);
  assert.equal(auto.controlled.clock.rngState, 42);
  rejected(submitM1PlayerInstruction(input, policy, auto,
    cmd(auto, { id: 'post-full-time', at: 5100 })), 'MATCH_FINISHED');
  assert.deepEqual(success(finishM1PlayerControl(input, policy, auto)), auto);
});

test('instruction IDs and actor payload are copied and not mutated by later edits', () => {
  const initialState = initial();
  const command = cmd(initialState);
  const applied = success(submitM1PlayerInstruction(input, policy, initialState, command));
  command.actor.kind = 'staff';
  command.focus = 'defend';
  assert.equal(applied.commands[0].actor.kind, 'player');
  assert.equal(applied.commands[0].focus, 'attack');
});
