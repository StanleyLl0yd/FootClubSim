import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createM1V5Checkpoint, resumeM1V5Checkpoint,
} from '../dist/core/m1-v5-checkpoint.js';
import { simulateM1V5Phases } from '../dist/core/m1-phases-v5.js';
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
const home = defaultSyntheticLineup(byClub.get(fixture.homeClubId));
const away = defaultSyntheticLineup(byClub.get(fixture.awayClubId));
const players = new Map(catalog.players.map(p => [p.id, p]));
const firstOutfield = home.starters.find(id => players.get(id).primaryPosition !== 'GK');
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
    availableStaffIds: ['away-coach'] },
};
function sub(id, time, { side = 'home', outIndex = 0, inIndex = 0 } = {}) {
  const source = side === 'home' ? home : away;
  const ids = source.starters.filter(x => players.get(x).primaryPosition !== 'GK');
  const bench = source.bench.filter(x => players.get(x).primaryPosition !== 'GK');
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
    elapsedSeconds: time,
    actor: side === 'home' ? { kind: 'player' } :
      { kind: 'staff', staffId: 'away-coach' },
    kind: 'substitute-normal', outPlayerId: ids[outIndex], inPlayerId: bench[inIndex],
    stoppage: time === 2700 ? 'half-time' : 'referee-authorized',
  };
}
function focus(id, time, value = 'attack') {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, elapsedSeconds: time,
    actor: { kind: 'player' }, kind: 'set-player-focus',
    playerId: firstOutfield, focus: value,
  };
}
function team(id, time, tempo = 90) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, elapsedSeconds: time, actor: { kind: 'player' },
    kind: 'set-tactics', plan: { ...input.homeTactics, tempo },
  };
}
function good(x) {
  assert.equal(x.ok, true, JSON.stringify(x).slice(0, 180));
  if (!x.ok) throw Error(x.error);
  return x.checkpoint;
}
function fail(x, expected) {
  assert.deepEqual(x, { ok: false, error: expected });
}

test('all 19 v5 checkpoint boundaries preserve exact draws and no future shots/subs', () => {
  const full = simulateM1V5Phases(input, policy);
  assert.equal(full.ok, true);
  if (!full.ok) return;
  for (let phase = 0; phase <= 18; phase++) {
    const snapshot = good(createM1V5Checkpoint(input, policy, phase));
    assert.equal(snapshot.schemaVersion, 5);
    assert.equal(snapshot.engineVersion, '4');
    assert.equal(snapshot.completedPhases, phase);
    assert.equal(snapshot.rngDraws, phase * 5);
    assert.equal(snapshot.controlled.controlled.clock.elapsedSeconds, phase * 300);
    assert.equal(snapshot.substitutions.clock.elapsedSeconds, phase * 300);
    assert.equal(snapshot.controlled.controlled.clock.events.length, phase);
    assert.equal(snapshot.substitutions.clock.events.length, phase);
    assert.ok(snapshot.events.every(x => x.elapsedSeconds <= phase * 300));
    const seeded = new SeededRng(42);
    for (let i = 0; i < phase * 5; i++) seeded.nextFloat();
    assert.equal(snapshot.rngState, seeded.snapshot());
    if (phase < 18) assert.equal(snapshot.report, null);
    else {
      assert.deepEqual(snapshot.report, full.report);
      assert.deepEqual(snapshot.events, full.events);
      assert.deepEqual(snapshot.substitutions, full.substitutions);
      assert.deepEqual(snapshot.controlled, full.controlled);
    }
  }
});

test('paused v5 with actual substitutions and mixed tactical commands equals continuous run', () => {
  const zero = good(createM1V5Checkpoint(input, policy, 0));
  const kickoff = focus('focus-start', 0);
  const first = good(resumeM1V5Checkpoint(input, policy, zero, 3, [kickoff]));
  const saved = JSON.parse(JSON.stringify(first));
  const commands = [
    sub('sub-900', 900),
    team('tempo-900', 900, 96),
    sub('away-900', 900, { side: 'away' }),
  ];
  const mid = good(resumeM1V5Checkpoint(input, policy, saved, 9, commands));
  assert.equal(mid.substitutions.teams.home.normalUsed, 1);
  assert.equal(mid.substitutions.teams.away.normalUsed, 1);
  assert.equal(mid.controlled.controlled.tactics.home.tempo, 96);
  assert.deepEqual(mid.events.filter(x => x.elapsedSeconds < 900), first.events);
  const later = sub('half-time', 2700, { outIndex: 1, inIndex: 1 });
  const done = good(resumeM1V5Checkpoint(input, policy, mid, 18, [later]));
  const direct = simulateM1V5Phases(input, policy, [kickoff, ...commands, later]);
  assert.equal(direct.ok, true);
  if (!direct.ok) return;
  assert.deepEqual(done.events, direct.events);
  assert.deepEqual(done.substitutions, direct.substitutions);
  assert.deepEqual(done.controlled, direct.controlled);
  assert.deepEqual(done.report, direct.report);
  assert.equal(done.rngState, direct.rngState);
  assert.equal(done.rngDraws, direct.rngDraws);
});

test('same-seed v5 paused and automatic event streams stay identical', () => {
  for (const seed of [1, 7, 42, 0x12345678, 0xffffffff]) {
    const original = { ...input, rngSeed: seed };
    let checkpoint = good(createM1V5Checkpoint(original, policy, 0));
    const commands = [sub('sub-300', 300), team('tempo-300', 300, 88)];
    checkpoint = good(resumeM1V5Checkpoint(original, policy, checkpoint, 8, commands));
    checkpoint = good(resumeM1V5Checkpoint(original, policy,
      JSON.parse(JSON.stringify(checkpoint)), 18));
    const complete = simulateM1V5Phases(original, policy, commands);
    assert.equal(complete.ok, true);
    if (complete.ok) {
      assert.deepEqual(checkpoint.events, complete.events, 'seed=' + seed);
      assert.deepEqual(checkpoint.report, complete.report, 'seed=' + seed);
      assert.deepEqual(checkpoint.controlled, complete.controlled, 'seed=' + seed);
      assert.deepEqual(checkpoint.substitutions, complete.substitutions, 'seed=' + seed);
      assert.equal(checkpoint.rngState, complete.rngState);
    }
  }
});

test('v5 saved authority, XI, commands, shot zone, RNG and version are tamper checked', () => {
  const initialCheckpoint = good(createM1V5Checkpoint(input, policy, 4,
    [sub('normal-300', 300)]));
  const damaged = [
    null, {}, [], { ...initialCheckpoint, schemaVersion: 4 },
    { ...initialCheckpoint, engineVersion: '3' },
    { ...initialCheckpoint, rngState: 999 },
    { ...initialCheckpoint, rngDraws: 10 },
    { ...initialCheckpoint, completedPhases: 3 },
    { ...initialCheckpoint, events: [] },
    { ...initialCheckpoint, events: [
      { ...initialCheckpoint.events[0], elapsedSeconds: 600 },
      ...initialCheckpoint.events.slice(1),
    ] },
    { ...initialCheckpoint, substitutions: { ...initialCheckpoint.substitutions,
      teams: { ...initialCheckpoint.substitutions.teams,
        home: { ...initialCheckpoint.substitutions.teams.home, normalUsed: 5 } },
    } },
    { ...initialCheckpoint, substitutions: { ...initialCheckpoint.substitutions,
      authority: { ...initialCheckpoint.substitutions.authority, home: {
        assignedActor: { kind: 'staff', staffId: 'forged' }, availableStaffIds: ['forged'],
      } },
    } },
    { ...initialCheckpoint, substitutions: { ...initialCheckpoint.substitutions,
      commands: [{
        ...initialCheckpoint.substitutions.commands[0], inPlayerId: 'ghost-player',
      }],
    } },
    { ...initialCheckpoint, controlled: { ...initialCheckpoint.controlled,
      controlled: { ...initialCheckpoint.controlled.controlled,
        clock: { ...initialCheckpoint.controlled.controlled.clock, elapsedSeconds: 1800 },
      },
    } },
    { ...initialCheckpoint, injected: undefined },
    { ...initialCheckpoint, events: [...initialCheckpoint.events, undefined] },
  ];
  for (const candidate of damaged) {
    fail(resumeM1V5Checkpoint(input, policy, candidate, 6), 'INVALID_CHECKPOINT');
  }
});

test('bad source policy cannot authenticate saved v5 commands', () => {
  const safe = good(createM1V5Checkpoint(input, policy, 6, [
    sub('one', 300),
  ]));
  const changedPolicy = { ...policy, home: {
    assignedActor: { kind: 'staff', staffId: 'impostor' }, availableStaffIds: ['impostor'],
  } };
  fail(resumeM1V5Checkpoint(input, changedPolicy, safe, 8), 'INVALID_CHECKPOINT');
  fail(resumeM1V5Checkpoint({ ...input, rngSeed: 777 }, policy, safe, 8),
    'INVALID_CHECKPOINT');
});

test('backdated substitutions, impossible future times and post-full-time changes fail', () => {
  const first = good(createM1V5Checkpoint(input, policy, 5));
  fail(resumeM1V5Checkpoint(input, policy, first, 6, [sub('past', 300)]),
    'BACKDATED_COMMAND');
  fail(resumeM1V5Checkpoint(input, policy, first, 4), 'INVALID_PHASE');
  fail(resumeM1V5Checkpoint(input, policy, first, 19), 'INVALID_PHASE');
  fail(resumeM1V5Checkpoint(input, policy, first, 6, [sub('future', 1800)]),
    'INVALID_SCHEDULE');
  fail(createM1V5Checkpoint(input, policy, -1), 'INVALID_PHASE');
  fail(createM1V5Checkpoint(input, policy, 19), 'INVALID_PHASE');
  fail(createM1V5Checkpoint(input, policy, 2, [sub('future', 600)]),
    'INVALID_SCHEDULE');
  const done = good(createM1V5Checkpoint(input, policy, 18));
  assert.deepEqual(good(resumeM1V5Checkpoint(input, policy, done, 18)), done);
  fail(resumeM1V5Checkpoint(input, policy, done, 18,
    [sub('after-game', 5400)]), 'INVALID_SCHEDULE');
});
