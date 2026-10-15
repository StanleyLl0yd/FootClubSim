import test from 'node:test';
import assert from 'node:assert/strict';
import {
  M1_REFEREE_EVENT_LIMIT, M1_REFEREE_RULES_ID, M1_REFEREE_SCHEMA_VERSION,
  advanceM1RefereeState, startM1RefereeState, submitM1RefereeDecision,
} from '../dist/core/m1-referee-decisions.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { RNG_VERSION } from '../dist/core/rng.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const home = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const away = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const player = new Map(catalog.players.map(p => [p.id, p]));
const homeOutfield = home.starters.filter(id => player.get(id).primaryPosition !== 'GK');
const awayOutfield = away.starters.filter(id => player.get(id).primaryPosition !== 'GK');
const homeGoalkeeper = home.starters.find(id => player.get(id).primaryPosition === 'GK');
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const good = result => {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 230));
  if (!result.ok) throw Error(result.error);
  return result.state;
};
const bad = (result, error) => assert.deepEqual(result, { ok: false, error });
const start = () => good(startM1RefereeState(prematch));
const step = s => good(advanceM1RefereeState(prematch, s));
function at(state, seconds) {
  while (state.clock.elapsedSeconds < seconds) state = step(state);
  return state;
}
function decision(state, { id = 'r-1', kind = 'caution', side = 'home',
  playerId = side === 'home' ? homeOutfield[0] : awayOutfield[0],
  origin = kind === 'injury-withdrawal' ? 'trusted-medical' : 'trusted-referee',
} = {}) {
  return { schemaVersion: M1_REFEREE_SCHEMA_VERSION, id,
    fixtureId: fixture.id,
    teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
    playerId, elapsedSeconds: state.clock.elapsedSeconds, kind, origin };
}
const apply = (s, opts) => good(submitM1RefereeDecision(prematch, s, decision(s, opts)));

test('IFAB-limited discipline contract has separate schema and no hidden random draws', () => {
  assert.equal(M1_REFEREE_SCHEMA_VERSION, 1);
  assert.equal(M1_REFEREE_RULES_ID, 'ifab-2026-27-laws-3-12-limited');
  assert.equal(M1_REFEREE_EVENT_LIMIT, 64);
  const initial = start();
  assert.equal(initial.status, 'playing');
  assert.equal(initial.clock.rngSeed, 42);
  assert.equal(initial.clock.rngState, 42);
  assert.deepEqual(initial.teams.home.onField, home.starters);
  assert.deepEqual(initial.decisions, []);
});

test('first caution retains on-field player; second yellow records dismissal once', () => {
  let state = at(start(), 300);
  const old = state;
  state = apply(state, { id: 'yellow-1' });
  assert.equal(state.teams.home.onField.length, 11);
  assert.deepEqual(state.teams.home.cautions, [{ playerId: homeOutfield[0], count: 1 }]);
  assert.equal(state.decisions[0].effect, 'yellow');
  assert.deepEqual(old.teams.home.cautions, []);
  state = at(state, 600);
  state = apply(state, { id: 'yellow-2' });
  assert.equal(state.decisions[1].effect, 'second-yellow-red');
  assert.equal(state.teams.home.onField.length, 10);
  assert.deepEqual(state.teams.home.dismissed, [homeOutfield[0]]);
  assert.deepEqual(state.teams.home.cautions, [{ playerId: homeOutfield[0], count: 2 }]);
  bad(submitM1RefereeDecision(prematch, state,
    decision(state, { id: 'yellow-3' })), 'INELIGIBLE_PLAYER');
  assert.equal(step(state).clock.elapsedSeconds, 900);
});

test('straight red removes player immediately, does not invent 2 yellow cards', () => {
  let state = at(start(), 4500);
  state = apply(state, { id: 'straight', kind: 'direct-red', side: 'away' });
  assert.equal(state.teams.away.onField.length, 10);
  assert.equal(state.teams.away.dismissed[0], awayOutfield[0]);
  assert.deepEqual(state.teams.away.cautions, []);
  assert.equal(state.decisions[0].effect, 'straight-red');
  bad(submitM1RefereeDecision(prematch, state, decision(state, {
    id: 'repeat', side: 'away', kind: 'direct-red',
  })), 'INELIGIBLE_PLAYER');
});

test('medical-confirmed permanent withdrawal is not a yellow/red event', () => {
  let state = at(start(), 1200);
  state = apply(state, { id: 'medical', kind: 'injury-withdrawal' });
  assert.deepEqual(state.teams.home.injuredWithdrawn, [homeOutfield[0]]);
  assert.deepEqual(state.teams.home.dismissed, []);
  assert.deepEqual(state.teams.home.cautions, []);
  assert.equal(state.decisions[0].effect, 'injury-withdrawn');
  bad(submitM1RefereeDecision(prematch, state, decision(state, {
    id: 'rejoin', playerId: homeOutfield[0], kind: 'caution',
  })), 'INELIGIBLE_PLAYER');
});

test('referee and medical provenance labels are not interchangeable', () => {
  const state = at(start(), 300);
  bad(submitM1RefereeDecision(prematch, state, decision(state, {
    kind: 'caution', origin: 'trusted-medical',
  })), 'UNSUPPORTED_AUTHORITY');
  bad(submitM1RefereeDecision(prematch, state, decision(state, {
    kind: 'injury-withdrawal', origin: 'trusted-referee',
  })), 'UNSUPPORTED_AUTHORITY');
  assert.equal(state.teams.home.onField.length, 11);
});

test('goalkeeper dismissal leaves unresolved goalkeeper assignment, blocking further play', () => {
  let state = at(start(), 300);
  state = apply(state, { id: 'keeper-dismissed', kind: 'direct-red',
    playerId: homeGoalkeeper });
  assert.equal(state.teams.home.onField.length, 10);
  assert.equal(state.status, 'awaiting-goalkeeper');
  bad(advanceM1RefereeState(prematch, state), 'REFEREE_RULING_REQUIRED');
  bad(submitM1RefereeDecision(prematch, state,
    decision(state, { id: 'other', playerId: homeOutfield[1] })),
  'REFEREE_RULING_REQUIRED');
});

test('below seven players is a non-final hold requiring an official ruling', () => {
  let state = at(start(), 900);
  for (let i = 0; i < 5; i++) {
    state = apply(state, { id: 'red-' + i, kind: 'direct-red', playerId: homeOutfield[i] });
  }
  assert.equal(state.teams.home.onField.length, 6);
  assert.equal(state.status, 'below-seven');
  assert.notEqual(state.clock.status, 'full-time');
  bad(advanceM1RefereeState(prematch, state), 'REFEREE_RULING_REQUIRED');
  assert.equal(state.decisions.length, 5);
  assert.equal(state.teams.away.onField.length, 11);
});

test('reject wrong team, fixture, timestamp, duplicate ID, bench and malformed unknown data', () => {
  const initial = at(start(), 300);
  const original = JSON.stringify(initial);
  const v = decision(initial);
  for(const [candidate, error] of [
    [{ ...v, fixtureId: 'other' }, 'WRONG_FIXTURE'],
    [{ ...v, teamId: 'unknown-club' }, 'UNKNOWN_TEAM'],
    [{ ...v, elapsedSeconds: 600 }, 'WRONG_CLOCK'],
    [{ ...v, playerId: home.bench[0] }, 'INELIGIBLE_PLAYER'],
    [{ ...v, playerId: away.starters[0] }, 'INELIGIBLE_PLAYER'],
    [{ ...v, kind: 'sin-bin' }, 'INVALID_DECISION'],
    [{ ...v, origin: 'manager' }, 'INVALID_DECISION'],
    [{ ...v, elapsedSeconds: 299 }, 'INVALID_DECISION'],
    [{ ...v, id: '' }, 'INVALID_DECISION'],
    [{ ...v, extra: true }, 'INVALID_DECISION'],
    [null, 'INVALID_DECISION'],
    [[], 'INVALID_DECISION'],
  ]) {
    bad(submitM1RefereeDecision(prematch, initial, candidate), error);
    assert.equal(JSON.stringify(initial), original);
  }
  const after = apply(initial, { id: 'same-id' });
  bad(submitM1RefereeDecision(prematch, after,
    decision(after, { id: 'same-id', playerId: homeOutfield[1] })), 'DUPLICATE_ID');
});

test('JSON saved state replay rejects modified clock, records, on-field and unknown fields', () => {
  let state = at(start(), 300);
  state = apply(state, { id: 'one' });
  state = at(state, 1200);
  state = apply(state, { id: 'two', kind: 'direct-red', side: 'away' });
  const restored = JSON.parse(JSON.stringify(state));
  const verified = step(restored);
  assert.equal(verified.clock.elapsedSeconds, 1500);
  assert.deepEqual(verified.decisions, state.decisions);
  for (const forged of [
    null, {}, { ...state, schemaVersion: 2 },
    { ...state, rulesId: 'wrong' },
    { ...state, clock: { ...state.clock, elapsedSeconds: 1500 } },
    { ...state, teams: { ...state.teams, home: { ...state.teams.home,
      onField: [...state.teams.home.onField, home.bench[0]] } } },
    { ...state, teams: { ...state.teams, away: { ...state.teams.away,
      cautions: [{ playerId: awayOutfield[0], count: 2 }] } } },
    { ...state, decisions: [{ ...state.decisions[0], sequence: 2 }, state.decisions[1]] },
    { ...state, decisions: [{ ...state.decisions[0], effect: 'straight-red' }, state.decisions[1]] },
    { ...state, decisions: [{ ...state.decisions[0], playerId: homeOutfield[1] },
      state.decisions[1]] },
    { ...state, decisions: [...state.decisions, undefined] },
    { ...state, hidden: undefined },
  ]) bad(advanceM1RefereeState(prematch, forged), 'INVALID_STATE');
});

test('no decision at full-time, previously replayed outcome remains stable', () => {
  let state = start();
  for (let i=0;i<18;i++) state = step(state);
  assert.equal(state.status, 'full-time');
  assert.equal(state.clock.elapsedSeconds, 5400);
  assert.deepEqual(step(state), state);
  bad(submitM1RefereeDecision(prematch, state, decision(state)), 'MATCH_FINISHED');
});

test('source preflight rejects malformed starter data, does not alter input', () => {
  const before = JSON.stringify(prematch);
  bad(startM1RefereeState({ ...prematch, rngSeed: 0 }), 'INVALID_PREMATCH');
  bad(startM1RefereeState({ ...prematch, awayLineup: { ...away, starters: [] } }),
    'INVALID_PREMATCH');
  let state = at(start(), 300);
  state = apply(state, { id: 'caution' });
  assert.equal(state.clock.rngState, 42);
  assert.equal(JSON.stringify(prematch), before);
});
