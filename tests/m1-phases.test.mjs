import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveM1SyntheticLedger, M1_ACTION_DRAW_COUNT_PER_PHASE,
  M1_ACTION_ENGINE_VERSION, M1_ACTION_EVENT_SCHEMA_VERSION, simulateM1SyntheticPhases,
} from '../dist/core/m1-phases.js';
import { M1_CLOCK_MAX_EVENTS, M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION } from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
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
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'staff', staffId: 'coach-away' },
    availableStaffIds: ['coach-away'] },
};
function result(input = prematch, commands = []) {
  return simulateM1SyntheticPhases(input, policy, commands);
}
function good(x) {
  assert.equal(x.ok, true);
  if (!x.ok) throw Error(x.error);
  return x;
}
function controlCommand(input, changes, at = 0, side = 'home') {
  const teamId = side === 'home' ? fixture.homeClubId : fixture.awayClubId;
  const plan = side === 'home' ? input.homeTactics : input.awayTactics;
  return {
    schemaVersion: 1, commandId: 'cmd-' + side + '-' + at,
    fixtureId: fixture.id, teamId, elapsedSeconds: at,
    actor: side === 'home' ? { kind: 'player' } : { kind: 'staff', staffId: 'coach-away' },
    kind: 'set-tactics', plan: { ...plan, ...changes },
  };
}

test('M1 action engine v2 and event schema v3 cannot silently reinterpret M0 or clock events', () => {
  assert.equal(M1_ACTION_ENGINE_VERSION, '2');
  assert.equal(M1_ACTION_EVENT_SCHEMA_VERSION, 3);
  assert.equal(M1_ACTION_DRAW_COUNT_PER_PHASE, 5);
  const run = good(result());
  assert.equal(run.schemaVersion, 3);
  assert.equal(run.engineVersion, '2');
  assert.equal(run.controlled.clock.engineVersion, '1');
  assert.equal(run.controlled.clock.status, 'full-time');
  assert.equal(run.events.at(-1).type, 'full-time');
  assert.equal(run.events.at(-1).schemaVersion, 3);
  assert.equal(run.events.at(-1).elapsedSeconds, 5400);
});

test('seed 42 yields byte-for-byte deterministic action events and exact 90 RNG draws', () => {
  const a = good(result());
  const b = good(result(structuredClone(prematch)));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.rngAlgorithmVersion, RNG_VERSION);
  assert.equal(a.rngSeed, 42);
  assert.equal(a.rngDraws, 90);
  const rng = new SeededRng(42);
  for (let i = 0; i < M1_CLOCK_MAX_EVENTS * M1_ACTION_DRAW_COUNT_PER_PHASE; i++) {
    rng.nextFloat();
  }
  assert.equal(a.rngState, rng.snapshot());
  assert.equal(a.controlled.clock.rngState, 42,
    'phase action draw state is separate from historical clock-only continuation');
});

test('all shots are ordered, active, bounded and exactly derive aggregate scores/xG', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const input = { ...prematch, rngSeed: seed };
    const run = good(result(input));
    const shots = run.events.filter(e => e.type === 'shot');
    assert.ok(shots.length <= 18);
    const onTarget = run.report.home.shotsOnTarget + run.report.away.shotsOnTarget;
    const goals = run.report.home.goals + run.report.away.goals;
    assert.ok(goals <= onTarget && onTarget <= shots.length);
    assert.equal(run.report.home.shots + run.report.away.shots, shots.length);
    assert.equal(run.report.home.xgMilli + run.report.away.xgMilli,
      shots.reduce((sum, shot) => sum + shot.xgMilli, 0));
    assert.equal(new Set(shots.map(shot => Math.floor(shot.elapsedSeconds / 300))).size,
      shots.length);
    assert.ok(shots.every(shot => shot.xgMilli >= 20 && shot.xgMilli <= 600));
    const independent = deriveM1SyntheticLedger(input, run.events);
    assert.equal(independent.ok, true);
    if (independent.ok) assert.deepEqual(independent.report, run.report);
  }
});

test('strict ledger validation rejects altered IDs, timing, players, xG and schema version', () => {
  const run = good(result());
  const shot = run.events.find(e => e.type === 'shot');
  assert.ok(shot, 'chosen seed must produce a shot');
  const final = run.events.at(-1);
  for (const changed of [
    { ...shot, schemaVersion: 1 },
    { ...shot, id: 'wrong-id' },
    { ...shot, sequence: 999 },
    { ...shot, elapsedSeconds: shot.elapsedSeconds + 1 },
    { ...shot, teamId: 'unregistered-team' },
    { ...shot, playerId: 'unregistered-player' },
    { ...shot, xgMilli: 1001 },
    { ...shot, xgMilli: -1 },
    { ...shot, outcome: 'penalty' },
    { ...shot, extra: true },
  ]) {
    assert.equal(deriveM1SyntheticLedger(prematch, [changed, { ...final, sequence: 2 }]).ok,
      false, JSON.stringify(changed));
  }
  for (const bad of [
    [], null, {}, [{ ...final, sequence: 99 }],
    [{ ...final, elapsedSeconds: 5300 }],
    [{ ...final, type: 'shot' }],
    [shot], [shot, shot, { ...final, sequence: 3 }],
    [{ ...shot, type: 'substitution' }, { ...final, sequence: 2 }],
    Array(20).fill(shot),
  ]) assert.equal(deriveM1SyntheticLedger(prematch, bad).ok, false);
});

test('changing tempo affects paired-seed chance counts without hard-coding final scores', () => {
  let baselineShots = 0;
  let highTempoShots = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const original = { ...prematch, rngSeed: seed };
    const fast = {
      ...original,
      homeTactics: { ...original.homeTactics, tempo: 100 },
    };
    baselineShots += good(result(original)).report.home.shots;
    highTempoShots += good(result(fast)).report.home.shots;
  }
  assert.ok(highTempoShots > baselineShots,
    'home high tempo must create more chances over deterministic paired seeds');
});

test('finishing skills affect paired-seed aggregate xG without copying external ratings', () => {
  let baselineXg = 0, improvedXg = 0;
  const upgraded = structuredClone(catalog);
  const home = new Set(prematch.homeLineup.starters);
  for (const player of upgraded.players) {
    if (home.has(player.id) && player.primaryPosition !== 'GK') {
      player.attributes.finishing = Math.min(100, player.attributes.finishing + 20);
    }
  }
  for (let seed = 1; seed <= 150; seed++) {
    baselineXg += good(result({ ...prematch, rngSeed: seed })).report.home.xgMilli;
    improvedXg += good(result({ ...prematch, catalog: upgraded, rngSeed: seed })).report.home.xgMilli;
  }
  assert.ok(improvedXg > baselineXg,
    'higher finishing must increase aggregate synthetic xG for home chances');
});

test('tactical commands at virtual checkpoints influence only later phase shots', () => {
  const baseline = good(result());
  const attack = controlCommand(prematch, { tempo: 100, mentality: 2 }, 300);
  const after = good(result(prematch, [attack]));
  assert.deepEqual(after.events.filter(e => e.elapsedSeconds < 300),
    baseline.events.filter(e => e.elapsedSeconds < 300));
  assert.deepEqual(after.controlled.commands.map(c => [c.commandId, c.elapsedSeconds]),
    [[attack.commandId, 300]]);
  assert.equal(after.controlled.tactics.home.tempo, 100);
  assert.equal(after.rngState, baseline.rngState,
    'a tactical command does not alter fixed per-phase draw count');
  assert.equal(after.rngDraws, baseline.rngDraws);
});

test('unapproved staff, invalid command order and post-full-time plan cannot run', () => {
  const command = controlCommand(prematch, { tempo: 100 });
  const future = controlCommand(prematch, { tempo: 20 }, 900);
  for (const commands of [
    [null], [{}], [command, command],
    [{ ...command, actor: { kind: 'staff', staffId: 'unauthorized' } }],
    [{ ...command, schemaVersion: 2 }],
    [future, command],
    [{ ...command, elapsedSeconds: 5400 }],
    Array(65).fill(command),
  ]) {
    const failed = result(prematch, commands);
    assert.equal(failed.ok, false, JSON.stringify(commands).slice(0, 90));
  }
  assert.equal(result({ ...prematch, rngSeed: 0 }).ok, false);
  assert.equal(result({ ...prematch, catalog: { ...catalog, players: [null] } }).ok, false);
});

test('no mutation of original fixtures, lineups, roster/skills or command payloads', () => {
  const original = JSON.stringify(prematch);
  const cmd = controlCommand(prematch, { tempo: 100 }, 0);
  const commandsBefore = JSON.stringify([cmd]);
  good(result(prematch, [cmd]));
  assert.equal(JSON.stringify(prematch), original);
  assert.equal(JSON.stringify([cmd]), commandsBefore);
});
