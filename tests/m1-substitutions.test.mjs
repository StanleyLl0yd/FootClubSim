import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceM1SubstitutionMatch, finishM1SubstitutionMatch,
  M1_NORMAL_OPPORTUNITY_LIMIT, M1_NORMAL_REPLACEMENTS_LIMIT,
  M1_RPL_NORMAL_SUBSTITUTION_RULES_ID, M1_SUBSTITUTION_SCHEMA_VERSION,
  startM1SubstitutionMatch, submitM1NormalSubstitution,
} from '../dist/core/m1-substitutions.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const home = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const away = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const players = new Map(catalog.players.map(p => [p.id, p]));
const homeOut = home.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const homeBench = home.bench.filter(id => players.get(id).primaryPosition !== 'GK');
const awayOut = away.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const awayBench = away.bench.filter(id => players.get(id).primaryPosition !== 'GK');
const homeKeeper = home.starters.find(id => players.get(id).primaryPosition === 'GK');
const input = {
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
    availableStaffIds: ['away-coach', 'other'] },
};
const requireSuccess = (value) => {
  assert.equal(value.ok, true, JSON.stringify(value).slice(0, 240));
  if (!value.ok) throw Error(value.error);
  return value.state;
};
function reject(value, error) {
  assert.deepEqual(value, { ok: false, error });
}
function kickoff() {
  return requireSuccess(startM1SubstitutionMatch(input, policy));
}
function go(state, seconds) {
  while (state.clock.elapsedSeconds < seconds) {
    state = requireSuccess(advanceM1SubstitutionMatch(input, policy, state));
  }
  return state;
}
function command(state, { id = 'sub-one', side = 'home', outIndex = 0, inIndex = 0,
  actor = side === 'home' ? { kind: 'player' } : { kind: 'staff', staffId: 'away-coach' },
  stoppage = state.clock.elapsedSeconds === 2700 ? 'half-time' : 'referee-authorized',
} = {}) {
  return {
    schemaVersion: M1_SUBSTITUTION_SCHEMA_VERSION, commandId: id,
    fixtureId: fixture.id,
    teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
    elapsedSeconds: state.clock.elapsedSeconds, actor, kind: 'substitute-normal',
    outPlayerId: side === 'home' ? homeOut[outIndex] : awayOut[outIndex],
    inPlayerId: side === 'home' ? homeBench[inIndex] : awayBench[inIndex],
    stoppage,
  };
}

test('2026/27 RPL 8.8 limited normal substitution contract is pinned and separated', () => {
  assert.equal(M1_SUBSTITUTION_SCHEMA_VERSION, 1);
  assert.equal(M1_RPL_NORMAL_SUBSTITUTION_RULES_ID, 'rpl-2026-27-art-8.8-normal');
  assert.equal(M1_NORMAL_REPLACEMENTS_LIMIT, 5);
  assert.equal(M1_NORMAL_OPPORTUNITY_LIMIT, 3);
  const state = kickoff();
  assert.deepEqual(state.teams.home.active, home.starters);
  assert.deepEqual(state.teams.home.bench, home.bench);
  assert.equal(state.teams.home.normalUsed, 0);
  assert.equal(state.clock.elapsedSeconds, 0);
  assert.deepEqual(state.commands, []);
});

test('two same-team changes at one authorized stoppage count one opportunity', () => {
  const before = go(kickoff(), 300);
  const one = requireSuccess(submitM1NormalSubstitution(input, policy, before,
    command(before, { id: 'first' })));
  const two = requireSuccess(submitM1NormalSubstitution(input, policy, one,
    command(one, { id: 'second', outIndex: 1, inIndex: 1 })));
  assert.equal(two.teams.home.normalUsed, 2);
  assert.deepEqual(two.teams.home.opportunityTimes, [300]);
  assert.equal(two.teams.home.active.length, 11);
  assert.equal(two.teams.home.bench.length, home.bench.length - 2);
  assert.ok(two.teams.home.active.includes(homeBench[0]));
  assert.ok(!two.teams.home.active.includes(homeOut[0]));
  assert.ok(two.teams.home.removed.includes(homeOut[0]));
  assert.deepEqual(before.teams.home.active, home.starters);
});

test('five normal changes, three gameplay windows and half-time exemption are enforced', () => {
  let state = go(kickoff(), 300);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'one' })));
  state = go(state, 600);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'two', outIndex: 1, inIndex: 1 })));
  state = go(state, 900);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'three', outIndex: 2, inIndex: 2 })));
  assert.deepEqual(state.teams.home.opportunityTimes, [300, 600, 900]);
  state = go(state, 1200);
  reject(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'fourth-window', outIndex: 3, inIndex: 3 })),
  'THREE_OPPORTUNITIES_USED');
  state = go(state, 2700);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'half-one', outIndex: 3, inIndex: 3 })));
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'half-two', outIndex: 4, inIndex: 4 })));
  assert.equal(state.teams.home.normalUsed, 5);
  assert.deepEqual(state.teams.home.opportunityTimes, [300, 600, 900]);
  reject(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'sixth', outIndex: 5, inIndex: 5 })),
  'FIVE_REPLACEMENTS_USED');
});

test('both sides at same second consume one separate opportunity each', () => {
  let state = go(kickoff(), 300);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'home-one' })));
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'away-one', side: 'away' })));
  assert.deepEqual(state.teams.home.opportunityTimes, [300]);
  assert.deepEqual(state.teams.away.opportunityTimes, [300]);
  assert.equal(state.teams.home.normalUsed, 1);
  assert.equal(state.teams.away.normalUsed, 1);
});

test('missing actual referee stoppage, halftime misuse and goalkeeper count fail closed', () => {
  const before = go(kickoff(), 300);
  const c = command(before);
  const goalkeeperChanged = { ...c, outPlayerId: homeKeeper };
  const beforeJson = JSON.stringify(before);
  for (const [candidate, error] of [
    [{ ...c, stoppage: 'half-time' }, 'NOT_AN_AUTHORIZED_STOPPAGE'],
    [{ ...c, outPlayerId: 'unknown-player' }, 'UNKNOWN_EXIT'],
    [{ ...c, inPlayerId: homeOut[6] }, 'UNAVAILABLE_SUBSTITUTE'],
    [goalkeeperChanged, 'INVALID_GOALKEEPER_COUNT'],
    [{ ...c, actor: { kind: 'staff', staffId: 'fake' } }, 'UNAUTHORIZED'],
    [{ ...c, actor: { kind: 'player', staffId: 'forged' } }, 'INVALID_COMMAND'],
    [{ ...c, fixtureId: 'wrong' }, 'WRONG_FIXTURE'],
    [{ ...c, teamId: 'wrong-team' }, 'UNKNOWN_TEAM'],
    [{ ...c, elapsedSeconds: 600 }, 'COMMAND_CLOCK_MISMATCH'],
    [{ ...c, kind: 'concussion' }, 'INVALID_COMMAND'],
    [{ ...c, kind: 'return-player' }, 'INVALID_COMMAND'],
    [{ ...c, extra: 1 }, 'INVALID_COMMAND'],
  ]) {
    reject(submitM1NormalSubstitution(input, policy, before, candidate), error);
    assert.equal(JSON.stringify(before), beforeJson);
  }
  const atHalf = go(kickoff(), 2700);
  reject(submitM1NormalSubstitution(input, policy, atHalf,
    command(atHalf, { stoppage: 'referee-authorized' })),
  'NOT_AN_AUTHORIZED_STOPPAGE');
});

test('bench member cannot enter twice and removed player cannot return', () => {
  let state = go(kickoff(), 300);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'first' })));
  reject(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'reentry', outIndex: 1, inIndex: 0 })),
  'UNAVAILABLE_SUBSTITUTE');
  reject(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'removed-player', outIndex: 0, inIndex: 1 })),
  'UNKNOWN_EXIT');
  reject(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'first', outIndex: 1, inIndex: 1 })),
  'DUPLICATE_COMMAND');
});

test('complete serialized substitution history is independently rebuilt on each step', () => {
  let state = go(kickoff(), 300);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'first' })));
  state = go(state, 2100);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state, { id: 'second', outIndex: 1, inIndex: 1 })));
  const restored = JSON.parse(JSON.stringify(state));
  const auto = requireSuccess(finishM1SubstitutionMatch(input, policy, restored));
  let manual = state;
  while (manual.clock.status !== 'full-time') {
    manual = requireSuccess(advanceM1SubstitutionMatch(input, policy, manual));
  }
  assert.deepEqual(auto, manual);
  assert.equal(auto.teams.home.normalUsed, 2);
  assert.equal(auto.clock.elapsedSeconds, 5400);
  assert.deepEqual(requireSuccess(advanceM1SubstitutionMatch(input, policy, auto)), auto);
  reject(submitM1NormalSubstitution(input, policy, auto,
    command(auto, { id: 'late' })), 'MATCH_FINISHED');
});

test('corrupted serialized authority/bench/events/commands never become match state', () => {
  let state = go(kickoff(), 300);
  state = requireSuccess(submitM1NormalSubstitution(input, policy, state,
    command(state)));
  for (const candidate of [
    null, {}, [], { ...state, schemaVersion: 2 },
    { ...state, rulesId: 'not-official' },
    { ...state, clock: { ...state.clock, elapsedSeconds: 600 } },
    { ...state, teams: { ...state.teams, home: {
      ...state.teams.home, active: [...state.teams.home.active, homeOut[0]],
    } } },
    { ...state, teams: { ...state.teams, home: { ...state.teams.home, normalUsed: 5 } } },
    { ...state, commands: [{ ...state.commands[0], sequence: 2 }] },
    { ...state, commands: [{ ...state.commands[0], outPlayerId: 'imposter' }] },
    { ...state, commands: [{ ...state.commands[0], actor: { kind: 'staff', staffId: 'fake' } }] },
    { ...state, authority: { ...state.authority, home: {
      ...state.authority.home, assignedActor: { kind: 'staff', staffId: 'fake' },
    } } },
    { ...state, extra: undefined },
    { ...state, commands: [...state.commands, undefined] },
  ]) {
    reject(advanceM1SubstitutionMatch(input, policy, candidate), 'INVALID_STATE');
  }
});

test('pre-kickoff replacements are not in-match substitutions and malformed source fails', () => {
  const start = kickoff();
  reject(submitM1NormalSubstitution(input, policy, start,
    command(start)), 'INVALID_COMMAND');
  reject(startM1SubstitutionMatch({ ...input, rngSeed: 0 }, policy), 'INVALID_PREMATCH');
  reject(startM1SubstitutionMatch(input, {}), 'INVALID_PREMATCH');
});
