import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveM1V5Ledger, M1_V5_ENGINE_VERSION, M1_V5_EVENT_SCHEMA_VERSION,
  M1_V5_DRAWS_PER_PHASE, simulateM1V5Phases,
} from '../dist/core/m1-phases-v5.js';
import { simulateM1V4Phases } from '../dist/core/m1-phases-v4.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const byClub = new Map(catalog.clubs.map(c => [c.id, c]));
const homeLineup = defaultSyntheticLineup(byClub.get(fixture.homeClubId));
const awayLineup = defaultSyntheticLineup(byClub.get(fixture.awayClubId));
const players = new Map(catalog.players.map(p => [p.id, p]));
const homeOutfield = homeLineup.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const awayOutfield = awayLineup.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const homeBench = homeLineup.bench.filter(id => players.get(id).primaryPosition !== 'GK');
const awayBench = awayLineup.bench.filter(id => players.get(id).primaryPosition !== 'GK');
const initial = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup, awayLineup,
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
function substitute(id, time, {
  side = 'home', outIndex = 0, inIndex = 0,
  stoppage = time === 2700 ? 'half-time' : 'referee-authorized',
} = {}) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
    elapsedSeconds: time, actor: side === 'home' ? { kind: 'player' } :
      { kind: 'staff', staffId: 'away-coach' },
    kind: 'substitute-normal',
    outPlayerId: side === 'home' ? homeOutfield[outIndex] : awayOutfield[outIndex],
    inPlayerId: side === 'home' ? homeBench[inIndex] : awayBench[inIndex],
    stoppage,
  };
}
function playerOrder(id, time, playerId, focus = 'attack') {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, elapsedSeconds: time,
    actor: { kind: 'player' }, kind: 'set-player-focus', playerId, focus,
  };
}
function tacticsOrder(id, time, tempo = 95) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, elapsedSeconds: time,
    actor: { kind: 'player' }, kind: 'set-tactics',
    plan: { ...initial.homeTactics, tempo },
  };
}
function good(x) {
  assert.equal(x.ok, true, JSON.stringify(x).slice(0, 240));
  if (!x.ok) throw Error(x.error);
  return x;
}

test('v5 keeps historical v3/v4 and M0 event meanings immutable', () => {
  assert.equal(M1_V5_ENGINE_VERSION, '4');
  assert.equal(M1_V5_EVENT_SCHEMA_VERSION, 5);
  assert.equal(M1_V5_DRAWS_PER_PHASE, 5);
  const v4 = good(simulateM1V4Phases(initial, policy));
  const v5 = good(simulateM1V5Phases(initial, policy));
  assert.equal(v4.engineVersion, '3');
  assert.equal(v4.schemaVersion, 4);
  assert.equal(v5.engineVersion, '4');
  assert.equal(v5.schemaVersion, 5);
  assert.equal(v5.events.at(-1).type, 'full-time');
  assert.equal(v5.rngDraws, 90);
  assert.equal(v4.rngState, v5.rngState);
  assert.deepEqual(v4.report, v5.report,
    'without replacement, v5 score probabilities must remain equivalent to v4');
});

test('two-side normal substitutions change actual XI, unused bench and v5 ledger', () => {
  const homeChange = substitute('home-first', 300);
  const awayChange = substitute('away-first', 300, { side: 'away' });
  const run = good(simulateM1V5Phases(initial, policy, [homeChange, awayChange]));
  const substitutions = run.events.filter(x => x.type === 'substitution');
  assert.equal(substitutions.length, 2);
  assert.deepEqual(substitutions.map(x => [x.elapsedSeconds, x.command.commandId]),
    [[300, 'home-first'], [300, 'away-first']]);
  assert.deepEqual(run.substitutions.teams.home.opportunityTimes, [300]);
  assert.deepEqual(run.substitutions.teams.away.opportunityTimes, [300]);
  assert.equal(run.substitutions.teams.home.normalUsed, 1);
  assert.equal(run.substitutions.teams.away.normalUsed, 1);
  assert.ok(!run.substitutions.teams.home.active.includes(homeChange.outPlayerId));
  assert.ok(run.substitutions.teams.home.active.includes(homeChange.inPlayerId));
  assert.ok(!run.substitutions.teams.home.bench.includes(homeChange.inPlayerId));
  assert.ok(!run.substitutions.teams.away.active.includes(awayChange.outPlayerId));
  assert.ok(run.substitutions.teams.away.active.includes(awayChange.inPlayerId));
  const shots = run.events.filter(x => x.type === 'shot');
  assert.ok(shots.every(x => x.elapsedSeconds <= 299 ||
    (x.playerId !== homeChange.outPlayerId && x.playerId !== awayChange.outPlayerId)));
  assert.ok(shots.every(x => x.elapsedSeconds >= 300 ||
    (x.playerId !== homeChange.inPlayerId && x.playerId !== awayChange.inPlayerId)));
  const derived = deriveM1V5Ledger(initial, policy, run.events);
  assert.equal(derived.ok, true);
  if (derived.ok) assert.deepEqual(derived.report, run.report);
});

test('substituted-in starter can take actual v5 shots; no removed starter shoots later', () => {
  const change = substitute('bench-striker', 300, { outIndex: 9, inIndex: 1 });
  let appeared = false;
  for (let seed = 1; seed <= 160; seed++) {
    const run = good(simulateM1V5Phases({ ...initial, rngSeed: seed }, policy, [change]));
    for (const shot of run.events.filter(x => x.type === 'shot' && x.elapsedSeconds >= 300)) {
      assert.notEqual(shot.playerId, change.outPlayerId);
      if (shot.playerId === change.inPlayerId) appeared = true;
    }
    if (appeared) break;
  }
  assert.ok(appeared, 'bench player must be sampled as a legitimate on-field v5 shooter');
});

test('mixed tactics/focus/substitution scheduled at same valid checkpoint are deterministic', () => {
  const commands = [
    playerOrder('focus-early', 0, homeOutfield[0], 'attack'),
    substitute('change-300', 300),
    tacticsOrder('tempo-300', 300, 100),
  ];
  const a = good(simulateM1V5Phases(initial, policy, commands));
  const b = good(simulateM1V5Phases(structuredClone(initial), structuredClone(policy),
    structuredClone(commands)));
  assert.deepEqual(a, b);
  assert.equal(a.substitutions.teams.home.normalUsed, 1);
  assert.equal(a.controlled.controlled.tactics.home.tempo, 100);
  assert.equal(a.controlled.instructions[0].focus, 'attack');
  const baseline = good(simulateM1V5Phases(initial, policy, [playerOrder(
    'focus-early', 0, homeOutfield[0], 'attack',
  )]));
  assert.deepEqual(a.events.filter(x => x.elapsedSeconds < 300),
    baseline.events.filter(x => x.elapsedSeconds < 300));
});

test('random state is seed-pinned with identical 90 draws regardless of substitutions', () => {
  for (const seed of [1, 17, 42, 0xdeadbeef, 0xffffffff]) {
    const input = { ...initial, rngSeed: seed };
    const baseline = good(simulateM1V5Phases(input, policy));
    const changed = good(simulateM1V5Phases(input, policy,
      [substitute('one', 300), substitute('two', 2700, { outIndex: 1, inIndex: 1 })]));
    const rng = new SeededRng(seed);
    for (let i = 0; i < 90; i++) rng.nextFloat();
    assert.equal(changed.rngState, rng.snapshot());
    assert.equal(changed.rngState, baseline.rngState);
    assert.equal(changed.rngDraws, 90);
    assert.equal(changed.events.at(-1).type, 'full-time');
  }
});

test('v5 reader denies shots from removed starters or a bench player before entry', () => {
  const first = substitute('one', 300);
  const run = good(simulateM1V5Phases(initial, policy, [first]));
  const substitutionIndex = run.events.findIndex(x => x.type === 'substitution');
  const template = run.events.find(x => x.type === 'shot' && x.elapsedSeconds > 300);
  assert.ok(template);
  for (const playerId of [first.outPlayerId, homeBench[3]]) {
    const corrupted = run.events.map((x, i) => i === run.events.indexOf(template) ?
      { ...template, teamId: fixture.homeClubId, playerId } : x);
    assert.equal(deriveM1V5Ledger(initial, policy, corrupted).ok, false);
  }
  const tampered = run.events.map((x, i) => i === substitutionIndex ?
    { ...x, command: { ...x.command, inPlayerId: 'unknown-player' } } : x);
  assert.equal(deriveM1V5Ledger(initial, policy, tampered).ok, false);
});

test('malformed replacement and duplicate IDs across all command streams fail atomically', () => {
  const normal = substitute('one', 300);
  const invalid = [
    [{ ...normal, actor: { kind: 'staff', staffId: 'forged' } }],
    [{ ...normal, outPlayerId: 'unknown-player' }],
    [{ ...normal, inPlayerId: homeOutfield[0] }],
    [{ ...normal, stoppage: 'half-time' }],
    [{ ...normal, kind: 'concussion-substitution' }],
    [{ ...normal, elapsedSeconds: 0 }],
    [normal, normal],
    [normal, playerOrder('one', 600, homeOutfield[1])],
    [playerOrder('one', 0, homeOutfield[0]), normal],
    [tacticsOrder('one', 0), normal],
    [substitute('future', 900), normal],
    [{ ...normal, extra: true }],
  ];
  const snapshot = JSON.stringify(initial);
  for (const commands of invalid) {
    assert.equal(simulateM1V5Phases(initial, policy, commands).ok, false);
    assert.equal(JSON.stringify(initial), snapshot);
  }
});

test('normal half-time exemption, strict three windows and five changes survive v5 bridge', () => {
  const commands = [
    substitute('one', 300),
    substitute('two', 600, { outIndex: 1, inIndex: 1 }),
    substitute('three', 900, { outIndex: 2, inIndex: 2 }),
    substitute('four', 2700, { outIndex: 3, inIndex: 3 }),
    substitute('five', 2700, { outIndex: 4, inIndex: 4 }),
  ];
  const accepted = good(simulateM1V5Phases(initial, policy, commands));
  assert.equal(accepted.substitutions.teams.home.normalUsed, 5);
  assert.deepEqual(accepted.substitutions.teams.home.opportunityTimes, [300, 600, 900]);
  assert.equal(accepted.events.filter(e => e.type === 'substitution').length, 5);
  assert.equal(deriveM1V5Ledger(initial, policy, accepted.events).ok, true);
  assert.equal(simulateM1V5Phases(initial, policy,
    [...commands, substitute('six', 3000, { outIndex: 5, inIndex: 5 })]).ok, false);
  const illegalWindow = [
    substitute('one', 300), substitute('two', 600, { outIndex: 1, inIndex: 1 }),
    substitute('three', 900, { outIndex: 2, inIndex: 2 }),
    substitute('four', 1200, { outIndex: 3, inIndex: 3 }),
  ];
  assert.equal(simulateM1V5Phases(initial, policy, illegalWindow).ok, false);
});

test('unrecognized v5 event fields/order/phase/foreign schema fail ledger derivation', () => {
  const run = good(simulateM1V5Phases(initial, policy, [substitute('one', 300)]));
  const sub = run.events.find(e => e.type === 'substitution');
  const shot = run.events.find(e => e.type === 'shot');
  assert.ok(sub && shot);
  const changes = [
    { ...shot, schemaVersion: 4 },
    { ...shot, zone: 'invalid' },
    { ...shot, xgMilli: 1001 },
    { ...shot, fatigueMilli: 600 },
    { ...shot, id: 'incorrect-id' },
    { ...shot, playerId: 'other' },
    { ...shot, extra: true },
  ];
  for (const changed of changes) {
    const tampered = run.events.map(e => e === shot ? changed : e);
    assert.equal(deriveM1V5Ledger(initial, policy, tampered).ok, false);
  }
  assert.equal(deriveM1V5Ledger(initial, policy, []).ok, false);
  assert.equal(deriveM1V5Ledger(initial, policy,
    [...run.events, run.events.at(-1)]).ok, false);
  assert.equal(deriveM1V5Ledger(initial, policy,
    run.events.map(e => e === sub ? { ...sub, command: { ...sub.command, stoppage: 'half-time' } } : e)
  ).ok, false);
});
