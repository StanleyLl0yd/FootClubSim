import test from 'node:test';
import assert from 'node:assert/strict';
import { createM1V4Checkpoint, resumeM1V4Checkpoint } from '../dist/core/m1-v4-checkpoint.js';
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
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const home = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const away = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
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
  away: { assignedActor: { kind: 'staff', staffId: 'coach-away' },
    availableStaffIds: ['coach-away'] },
};
const byId = new Map(catalog.players.map(p => [p.id, p]));
const playerId = home.starters.find(id => byId.get(id).primaryPosition !== 'GK');
function individual(id, focus, time) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId, elapsedSeconds: time,
    actor: { kind: 'player' }, kind: 'set-player-focus', focus,
  };
}
function team(id, time, tempo) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, elapsedSeconds: time,
    actor: { kind: 'player' }, kind: 'set-tactics',
    plan: { ...input.homeTactics, tempo },
  };
}
function ok(value) {
  assert.equal(value.ok, true, JSON.stringify(value).slice(0, 140));
  if (!value.ok) throw Error(value.error);
  return value.checkpoint;
}
function fail(value, error) {
  assert.deepEqual(value, { ok: false, error });
}

test('v4 every canonical phase consumes exactly five draws and has no future shots', () => {
  const full = simulateM1V4Phases(input, policy);
  assert.equal(full.ok, true);
  if (!full.ok) return;
  for (let phase = 0; phase <= 18; phase++) {
    const snapshot = ok(createM1V4Checkpoint(input, policy, phase));
    assert.equal(snapshot.engineVersion, '3');
    assert.equal(snapshot.schemaVersion, 4);
    assert.equal(snapshot.completedPhases, phase);
    assert.equal(snapshot.controlled.controlled.clock.elapsedSeconds, phase * 300);
    assert.equal(snapshot.controlled.controlled.clock.events.length, phase);
    assert.equal(snapshot.rngDraws, phase * 5);
    assert.ok(snapshot.events.every(e => e.elapsedSeconds <= phase * 300));
    const rng = new SeededRng(42);
    for (let draw = 0; draw < phase * 5; draw++) rng.nextFloat();
    assert.equal(snapshot.rngState, rng.snapshot());
    if (phase < 18) assert.equal(snapshot.report, null);
    else {
      assert.deepEqual(snapshot.report, full.report);
      assert.deepEqual(snapshot.events, full.events);
      assert.deepEqual(snapshot.controlled, full.controlled);
    }
  }
});

test('restored v4 player/team commands preserve old zone/fatigue shots after pause', () => {
  const empty = ok(createM1V4Checkpoint(input, policy, 0));
  const first = individual('attack-0', 'attack', 0);
  const atThree = ok(resumeM1V4Checkpoint(input, policy, empty, 3, [first]));
  const saved = JSON.parse(JSON.stringify(atThree));
  const later = team('team-900', 900, 100);
  const atNine = ok(resumeM1V4Checkpoint(input, policy, saved, 9, [later]));
  assert.deepEqual(atNine.events.filter(e => e.elapsedSeconds < 900), atThree.events);
  const defensive = individual('defend-2700', 'defend', 2700);
  const final = ok(resumeM1V4Checkpoint(input, policy, atNine, 18, [defensive]));
  const direct = simulateM1V4Phases(input, policy, [first, later, defensive]);
  assert.equal(direct.ok, true);
  if (!direct.ok) return;
  assert.deepEqual(final.events, direct.events);
  assert.deepEqual(final.report, direct.report);
  assert.deepEqual(final.controlled, direct.controlled);
  assert.equal(final.rngState, direct.rngState);
  assert.equal(final.rngDraws, direct.rngDraws);
});

test('v4 paused and uninterrupted matches agree for multiple independent seeds', () => {
  for (const seed of [1, 3, 7, 42, 0x12345678, 0xffffffff]) {
    const prematch = { ...input, rngSeed: seed };
    const first = individual('early-0', 'attack', 0);
    let snapshot = ok(createM1V4Checkpoint(prematch, policy, 0));
    snapshot = ok(resumeM1V4Checkpoint(prematch, policy, snapshot, 8, [first]));
    snapshot = JSON.parse(JSON.stringify(snapshot));
    snapshot = ok(resumeM1V4Checkpoint(prematch, policy, snapshot, 18));
    const full = simulateM1V4Phases(prematch, policy, [first]);
    assert.equal(full.ok, true);
    if (full.ok) {
      assert.deepEqual(snapshot.events, full.events, 'seed=' + seed);
      assert.deepEqual(snapshot.report, full.report, 'seed=' + seed);
      assert.equal(snapshot.rngState, full.rngState, 'seed=' + seed);
    }
  }
});

test('history edits, bad authority, incorrect output and sparse arrays fail closed', () => {
  const first = individual('one', 'attack', 0);
  const valid = ok(createM1V4Checkpoint(input, policy, 4, [first]));
  const changed = [
    null, {}, [], { ...valid, engineVersion: '2' },
    { ...valid, schemaVersion: 3 }, { ...valid, rngSeed: 100 },
    { ...valid, rngState: 100 }, { ...valid, rngDraws: 15 },
    { ...valid, completedPhases: 5 },
    { ...valid, report: { fixtureId: fixture.id } },
    { ...valid, events: [] },
    { ...valid, events: [{ ...valid.events[0], zone: 'goal' }, ...valid.events.slice(1)] },
    { ...valid, controlled: { ...valid.controlled, instructions: [] } },
    { ...valid, controlled: { ...valid.controlled,
      commands: [{ ...valid.controlled.commands[0], focus: 'defend' }] } },
    { ...valid, controlled: { ...valid.controlled,
      controlled: { ...valid.controlled.controlled,
        authority: { ...valid.controlled.controlled.authority,
          home: { assignedActor: { kind: 'staff', staffId: 'fake' },
            availableStaffIds: ['fake'] },
        },
      },
    } },
    { ...valid, events: [...valid.events, undefined] },
    { ...valid, unknown: undefined },
  ];
  for (const item of changed) {
    fail(resumeM1V4Checkpoint(input, policy, item, 5), 'INVALID_CHECKPOINT');
  }
  const changedPolicy = { ...policy,
    home: { assignedActor: { kind: 'staff', staffId: 'fake' },
      availableStaffIds: ['fake'] },
  };
  fail(resumeM1V4Checkpoint(input, changedPolicy, valid, 5), 'INVALID_CHECKPOINT');
});

test('reject forbidden future/backdated/malformed commands without changing inputs', () => {
  const initial = ok(createM1V4Checkpoint(input, policy, 0));
  const prior = ok(resumeM1V4Checkpoint(input, policy, initial, 5));
  fail(resumeM1V4Checkpoint(input, policy, prior, 6,
    [individual('past', 'attack', 300)]), 'BACKDATED_COMMAND');
  fail(resumeM1V4Checkpoint(input, policy, prior, 4), 'INVALID_PHASE');
  fail(resumeM1V4Checkpoint(input, policy, prior, 19), 'INVALID_PHASE');
  fail(createM1V4Checkpoint(input, policy, -1), 'INVALID_PHASE');
  fail(createM1V4Checkpoint(input, policy, 19), 'INVALID_PHASE');
  fail(createM1V4Checkpoint(input, policy, 1, [individual('future', 'attack', 300)]),
    'INVALID_SCHEDULE');
  fail(resumeM1V4Checkpoint(input, policy, prior, 6, [null]), 'INVALID_SCHEDULE');
  fail(resumeM1V4Checkpoint(input, policy, prior, 6,
    [individual('bad', 'fly', 1500)]), 'INVALID_SOURCE');
});

test('v4 finalized snapshot cannot append post-full-time instructions', () => {
  const final = ok(createM1V4Checkpoint(input, policy, 18));
  assert.equal(final.controlled.controlled.clock.status, 'full-time');
  assert.deepEqual(ok(resumeM1V4Checkpoint(input, policy, final, 18)), final);
  fail(resumeM1V4Checkpoint(input, policy, final, 18,
    [individual('too-late', 'attack', 5400)]), 'INVALID_SCHEDULE');
});
