import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveM1V4Ledger, M1_V4_DRAWS_PER_PHASE, M1_V4_ENGINE_VERSION,
  M1_V4_EVENT_SCHEMA_VERSION, simulateM1V4Phases,
} from '../dist/core/m1-phases-v4.js';
import { simulateM1SyntheticPhases } from '../dist/core/m1-phases.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { SeededRng, RNG_VERSION } from '../dist/core/rng.js';
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
  away: { assignedActor: { kind: 'staff', staffId: 'coach-away' },
    availableStaffIds: ['coach-away'] },
};
const players = new Map(catalog.players.map(p => [p.id, p]));
const homeOutfield = homeLineup.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const starter = homeOutfield[0];
function playerCommand(id, playerId, focus = 'attack', time = 0) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId, elapsedSeconds: time,
    actor: { kind: 'player' }, kind: 'set-player-focus', focus,
  };
}
function teamCommand(id, tempo, time = 0) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id, teamId: fixture.homeClubId,
    elapsedSeconds: time, actor: { kind: 'player' }, kind: 'set-tactics',
    plan: { ...input.homeTactics, tempo },
  };
}
function successful(candidate) {
  assert.equal(candidate.ok, true, JSON.stringify(candidate).slice(0, 180));
  if (!candidate.ok) throw Error(candidate.error);
  return candidate;
}

test('v4 and engine 3 preserve independent M1 v3 event and M0 history', () => {
  assert.equal(M1_V4_ENGINE_VERSION, '3');
  assert.equal(M1_V4_EVENT_SCHEMA_VERSION, 4);
  assert.equal(M1_V4_DRAWS_PER_PHASE, 5);
  const latest = successful(simulateM1V4Phases(input, policy));
  assert.equal(latest.engineVersion, '3');
  assert.equal(latest.events.at(-1).schemaVersion, 4);
  assert.equal(latest.controlled.controlled.clock.engineVersion, '1');
  const legacy = successful(simulateM1SyntheticPhases(input, policy));
  assert.equal(legacy.engineVersion, '2');
  assert.equal(legacy.events.at(-1).schemaVersion, 3);
  assert.equal(legacy.rngDraws, latest.rngDraws);
});

test('seeded v4 replay is byte-identical with exact xorshift32 continuation', () => {
  for (const seed of [1, 7, 42, 0x12345678, 0xffffffff]) {
    const prematch = { ...input, rngSeed: seed };
    const first = successful(simulateM1V4Phases(prematch, policy));
    const repeated = successful(simulateM1V4Phases(structuredClone(prematch), structuredClone(policy)));
    assert.deepEqual(first, repeated);
    assert.equal(first.rngDraws, 90);
    const rng = new SeededRng(seed);
    for (let i = 0; i < 90; i++) rng.nextFloat();
    assert.equal(first.rngState, rng.snapshot());
    const independent = deriveM1V4Ledger(prematch, first.events);
    assert.equal(independent.ok, true);
    if (independent.ok) assert.deepEqual(independent.report, first.report);
  }
});

test('bounded shot participants/zones/fatigue and all match stats derive from ledger', () => {
  for (let seed = 1; seed <= 90; seed++) {
    const run = successful(simulateM1V4Phases({ ...input, rngSeed: seed }, policy));
    const shots = run.events.filter(event => event.type === 'shot');
    assert.ok(shots.length <= 18);
    assert.equal(run.report.home.shots + run.report.away.shots, shots.length);
    assert.equal(run.report.home.goals + run.report.away.goals,
      shots.filter(shot => shot.outcome === 'goal').length);
    assert.equal(run.report.home.xgMilli + run.report.away.xgMilli,
      shots.reduce((sum, shot) => sum + shot.xgMilli, 0));
    assert.equal(new Set(shots.map(shot => Math.floor(shot.elapsedSeconds / 300))).size,
      shots.length);
    for (const shot of shots) {
      assert.ok(['left', 'center', 'right'].includes(shot.zone));
      assert.ok(['balanced', 'attack', 'defend'].includes(shot.focus));
      assert.ok(shot.fatigueMilli >= 700 && shot.fatigueMilli <= 1000);
      if (shot.elapsedSeconds === 299) assert.equal(shot.fatigueMilli, 1000);
      assert.ok(shot.xgMilli >= 20 && shot.xgMilli <= 600);
      assert.notEqual(players.get(shot.playerId).primaryPosition, 'GK');
    }
    assert.equal(run.events.at(-1).type, 'full-time');
  }
});

test('direct individual focus and mixed team commands affect only future phases', () => {
  const baseline = successful(simulateM1V4Phases(input, policy));
  const commands = [
    playerCommand('role-1', starter, 'attack', 300),
    teamCommand('team-1', 100, 300),
  ];
  const changed = successful(simulateM1V4Phases(input, policy, commands));
  assert.deepEqual(
    changed.events.filter(e => e.elapsedSeconds < 300),
    baseline.events.filter(e => e.elapsedSeconds < 300),
  );
  assert.equal(changed.controlled.instructions[0].focus, 'attack');
  assert.equal(changed.controlled.controlled.tactics.home.tempo, 100);
  assert.equal(changed.controlled.commands.length, 1);
  assert.equal(changed.controlled.controlled.commands.length, 1);
  assert.equal(changed.rngState, baseline.rngState);
  assert.equal(changed.rngDraws, baseline.rngDraws);
});

test('paired seeds exhibit directional increased shooting from full-team attacking focus', () => {
  const attack = homeOutfield.map((id, i) => playerCommand('attack-' + i, id, 'attack'));
  const defend = homeOutfield.map((id, i) => playerCommand('defend-' + i, id, 'defend'));
  let totalAttack = 0, totalDefend = 0, changedShooterFocus = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const prematch = { ...input, rngSeed: seed };
    const a = successful(simulateM1V4Phases(prematch, policy, attack));
    const d = successful(simulateM1V4Phases(prematch, policy, defend));
    totalAttack += a.report.home.shots;
    totalDefend += d.report.home.shots;
    changedShooterFocus += a.events.filter(e => e.type === 'shot' && e.focus === 'attack').length;
  }
  assert.ok(totalAttack > totalDefend);
  assert.ok(changedShooterFocus > 0);
});

test('v4 strict event reader rejects foreign-version, invalid zone/fatigue/participant/order', () => {
  const latest = successful(simulateM1V4Phases(input, policy));
  const shot = latest.events.find(e => e.type === 'shot');
  assert.ok(shot);
  const terminal = latest.events.at(-1);
  for (const corrupted of [
    { ...shot, schemaVersion: 3 },
    { ...shot, id: 'wrong-id' },
    { ...shot, sequence: 100 },
    { ...shot, elapsedSeconds: shot.elapsedSeconds + 1 },
    { ...shot, teamId: 'unknown-team' },
    { ...shot, playerId: 'unknown-player' },
    { ...shot, zone: 'goal' },
    { ...shot, focus: 'fly' },
    { ...shot, fatigueMilli: 699 },
    { ...shot, fatigueMilli: 1001 },
    { ...shot, xgMilli: 1001 },
    { ...shot, outcome: 'penalty' },
    { ...shot, secret: true },
  ]) {
    assert.equal(deriveM1V4Ledger(input, [corrupted, { ...terminal, sequence: 2 }]).ok,
      false, JSON.stringify(corrupted));
  }
  for (const events of [
    [], null, [shot], [{ ...terminal, sequence: 9 }],
    [{ ...terminal, elapsedSeconds: 5200 }], [{ ...terminal, extra: 1 }],
    [shot, shot, { ...terminal, sequence: 3 }],
    Array(20).fill(shot),
  ]) assert.equal(deriveM1V4Ledger(input, events).ok, false);
});

test('unknown or unauthorized commands cannot produce fictitious events', () => {
  const good = playerCommand('first', starter);
  for (const planned of [
    [null], [good, good],
    [{ ...good, actor: { kind: 'staff', staffId: 'coach-home' } }],
    [{ ...good, playerId: homeLineup.bench[0] }],
    [{ ...good, kind: 'substitute' }],
    [{ ...good, elapsedSeconds: 5400 }],
    [playerCommand('future', starter, 'defend', 900), good],
    [good, teamCommand('first', 80)],
    Array(129).fill(good),
  ]) assert.equal(simulateM1V4Phases(input, policy, planned).ok, false);
  assert.equal(simulateM1V4Phases({ ...input, rngSeed: 0 }, policy).ok, false);
  assert.equal(simulateM1V4Phases(input, {}).ok, false);
});

test('no mutation of original prematch, roster or scheduled commands', () => {
  const before = JSON.stringify(input);
  const cmds = [playerCommand('one', starter), teamCommand('two', 75)];
  const beforeCommands = JSON.stringify(cmds);
  successful(simulateM1V4Phases(input, policy, cmds));
  assert.equal(JSON.stringify(input), before);
  assert.equal(JSON.stringify(cmds), beforeCommands);
});
