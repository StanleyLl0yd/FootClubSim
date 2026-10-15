import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceM1Clock, m1ClockIsFullMatchSimulation, M1_CLOCK_END_SECONDS,
  M1_CLOCK_MAX_EVENTS, M1_CLOCK_SCHEMA_VERSION, M1_ENGINE_VERSION,
  runM1Clock, startM1Clock,
} from '../dist/core/m1-clock.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import {
  MATCH_LEDGER_VERSION, M0_ENGINE_VERSION, M0_RULES_PACK_ID,
  M0_RULES_PACK_VERSION, deriveMatchLedger,
} from '../dist/core/match-contracts.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const base = {
  schemaVersion: MATCH_LEDGER_VERSION,
  engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID,
  rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture,
  catalog,
  homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION,
  rngSeed: 42,
};

test('M1 P1 has an explicitly new engine and clock-event schema, without touching M0', () => {
  assert.equal(M1_ENGINE_VERSION, '1');
  assert.equal(M1_CLOCK_SCHEMA_VERSION, 2);
  assert.equal(M1_CLOCK_MAX_EVENTS, 18);
  assert.equal(m1ClockIsFullMatchSimulation(), false);
  assert.equal(deriveMatchLedger({
    ...base, engineVersion: M0_ENGINE_VERSION,
    events: [{ id: 'end', sequence: 1, elapsedSeconds: 5400, type: 'full-time' }],
  }).ok, true);
  assert.equal(deriveMatchLedger({
    ...base,
    events: [{ id: 'end', sequence: 1, elapsedSeconds: 5400, type: 'full-time' }],
  }).ok, false);
});

test('clock starts at zero with validated club identifiers and explicit untouched PRNG state', () => {
  const start = startM1Clock(base);
  assert.equal(start.ok, true);
  if (!start.ok) return;
  assert.deepEqual(start.state, {
    schemaVersion: 2, engineVersion: '1',
    fixtureId: fixture.id, homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 42, rngState: 42,
    elapsedSeconds: 0, status: 'running', events: [],
  });
});

test('automatic and 18 explicit interactive steps produce identical byte-for-byte JSON', () => {
  const automatic = runM1Clock(base);
  const start = startM1Clock(base);
  assert.equal(start.ok, true);
  assert.equal(automatic.ok, true);
  if (!automatic.ok || !start.ok) return;
  let state = start.state;
  for (let i = 1; i <= M1_CLOCK_MAX_EVENTS; i++) {
    const result = advanceM1Clock(state);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.events.length, i);
    assert.equal(result.state.elapsedSeconds, i * 300);
    assert.equal(result.report === null, i < M1_CLOCK_MAX_EVENTS);
    state = result.state;
  }
  assert.equal(JSON.stringify(state), JSON.stringify(automatic.state));
  assert.equal(state.elapsedSeconds, M1_CLOCK_END_SECONDS);
  assert.equal(state.status, 'full-time');
  assert.deepEqual(automatic.report, {
    fixtureId: fixture.id,
    home: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
    away: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
  });
  assert.deepEqual(state.events[0], {
    schemaVersion: 2, id: 'm1-clock-1', sequence: 1,
    elapsedSeconds: 300, type: 'checkpoint',
  });
  assert.deepEqual(state.events.at(-1), {
    schemaVersion: 2, id: 'm1-clock-18', sequence: 18,
    elapsedSeconds: 5400, type: 'full-time',
  });
  assert.equal(state.rngState, 42, 'clock-only checkpoints consume zero random draws');
});

test('JSON serialization and restart from an intermediate checkpoint preserve continuation', () => {
  const start = startM1Clock(base);
  assert.equal(start.ok, true);
  if (!start.ok) return;
  let state = start.state;
  for (let i = 0; i < 7; i++) {
    const step = advanceM1Clock(state);
    assert.equal(step.ok, true);
    if (!step.ok) return;
    state = step.state;
  }
  state = JSON.parse(JSON.stringify(state));
  for (let i = 7; i < M1_CLOCK_MAX_EVENTS; i++) {
    const step = advanceM1Clock(state);
    assert.equal(step.ok, true);
    if (!step.ok) return;
    state = step.state;
  }
  const auto = runM1Clock(base);
  assert.equal(auto.ok, true);
  if (auto.ok) assert.deepEqual(state, auto.state);
  const idempotent = advanceM1Clock(state);
  assert.equal(idempotent.ok, true);
  if (idempotent.ok) assert.deepEqual(idempotent.state, state);
});

test('initial preflight refuses mismatched fixture/tactics, corrupted player data, bad seeds and versions', () => {
  for (const patch of [
    { rngSeed: 0 }, { rngSeed: 0x100000000 }, { rngAlgorithmVersion: 'not-xorshift' },
    { engineVersion: M0_ENGINE_VERSION }, { schemaVersion: 2 }, { rulesPackVersion: '2026' },
    { fixture: { ...fixture, awayClubId: fixture.homeClubId } },
    { homeTactics: { ...base.homeTactics, tempo: 110 } },
    { homeLineup: { ...base.homeLineup, starters: [] } },
    { catalog: { ...catalog, players: [null] } },
    { catalog: { ...catalog, clubs: [] } },
  ]) {
    const result = startM1Clock({ ...base, ...patch });
    assert.equal(result.ok, false, JSON.stringify(patch).slice(0, 90));
  }
  for (const value of [null, undefined, [], {}, { ...base, extra: true }]) {
    assert.equal(startM1Clock(value).ok, false);
  }
});

test('an accepted start captures identities/seed without retaining mutable pre-match input', () => {
  const input = structuredClone(base);
  const started = startM1Clock(input);
  assert.equal(started.ok, true);
  if (!started.ok) return;
  input.fixture.id = 'changed-fixture';
  input.homeLineup.starters[0] = 'ineligible-player';
  input.rngSeed = 87;
  const next = advanceM1Clock(started.state);
  assert.equal(next.ok, true);
  if (next.ok) {
    assert.equal(next.state.fixtureId, fixture.id);
    assert.equal(next.state.rngSeed, 42);
    assert.equal(next.state.events[0].id, 'm1-clock-1');
  }
});

test('invalid or tampered serialized continuation fails closed and cannot advance', () => {
  const start = startM1Clock(base);
  assert.equal(start.ok, true);
  if (!start.ok) return;
  const first = advanceM1Clock(start.state);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const valid = first.state;
  const wrong = [
    null, [], {}, { ...valid, schemaVersion: 1 }, { ...valid, engineVersion: '0' },
    { ...valid, rngState: 7 }, { ...valid, rngSeed: 0 },
    { ...valid, elapsedSeconds: 301 }, { ...valid, elapsedSeconds: 5400 },
    { ...valid, status: 'full-time' }, { ...valid, events: [] },
    { ...valid, events: Array(1) },
    { ...valid, events: [...valid.events, valid.events[0]] },
    { ...valid, events: [{ ...valid.events[0], elapsedSeconds: 301 }] },
    { ...valid, events: [{ ...valid.events[0], id: 'fake' }] },
    { ...valid, events: [{ ...valid.events[0], type: 'shot' }] },
    { ...valid, events: [{ ...valid.events[0], unknown: 'injected' }] },
    { ...valid, fixtureId: 'bad id with spaces' },
    { ...valid, homeClubId: valid.awayClubId },
    { ...valid, unknown: 123 },
  ];
  for (const candidate of wrong) {
    const result = advanceM1Clock(candidate);
    assert.equal(result.ok, false, JSON.stringify(candidate));
    if (!result.ok) assert.equal(result.errors[0].code, 'INVALID_M1_STATE');
  }
});

test('P1 does not secretly assign goals from RNG or mutate the M0 synthetic catalog', () => {
  const before = JSON.stringify(catalog);
  const resultA = runM1Clock(base);
  const resultB = runM1Clock({ ...base, rngSeed: 12345 });
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  if (resultA.ok && resultB.ok) {
    assert.deepEqual(resultA.report, resultB.report);
    assert.notEqual(resultA.state.rngSeed, resultB.state.rngSeed);
  }
  assert.equal(JSON.stringify(catalog), before);
});
