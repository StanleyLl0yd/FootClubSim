import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createM1PhaseCheckpoint, resumeM1PhaseCheckpoint,
} from '../dist/core/m1-phase-checkpoint.js';
import { simulateM1SyntheticPhases } from '../dist/core/m1-phases.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
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
  away: { assignedActor: { kind: 'staff', staffId: 'coach-away' }, availableStaffIds: ['coach-away'] },
};
function command(changes, time, side = 'home') {
  const teamId = side === 'home' ? fixture.homeClubId : fixture.awayClubId;
  return {
    schemaVersion: 1, commandId: 'cmd-' + side + '-' + time,
    fixtureId: fixture.id, teamId, elapsedSeconds: time,
    actor: side === 'home' ? { kind: 'player' } : { kind: 'staff', staffId: 'coach-away' },
    kind: 'set-tactics',
    plan: { ...defaultTacticalPlan(teamId), ...changes },
  };
}
function good(value) {
  assert.equal(value.ok, true, JSON.stringify(value).slice(0, 250));
  if (!value.ok) throw Error(value.error);
  return value.checkpoint;
}
function bad(value, code) {
  assert.equal(value.ok, false);
  if (!value.ok) assert.equal(value.error, code);
}

test('all 19 inclusive checkpoints are reproducible and properly bounded', () => {
  const full = simulateM1SyntheticPhases(prematch, policy);
  assert.equal(full.ok, true);
  if (!full.ok) return;
  for (let phase = 0; phase <= 18; phase++) {
    const a = good(createM1PhaseCheckpoint(prematch, policy, phase));
    const b = good(createM1PhaseCheckpoint(structuredClone(prematch), structuredClone(policy), phase));
    assert.deepEqual(a, b);
    assert.equal(a.completedPhases, phase);
    assert.equal(a.controlled.clock.events.length, phase);
    assert.equal(a.controlled.clock.elapsedSeconds, phase * 300);
    assert.equal(a.rngDraws, phase * 5);
    assert.ok(a.events.every(e => e.elapsedSeconds <= phase * 300));
    const rng = new SeededRng(42);
    for (let j = 0; j < phase * 5; j++) rng.nextFloat();
    assert.equal(a.rngState, rng.snapshot());
    assert.equal(a.report, null === null ? (phase === 18 ? a.report : null) : null);
  }
  const final = good(createM1PhaseCheckpoint(prematch, policy, 18));
  assert.deepEqual(final.events, full.events);
  assert.deepEqual(final.report, full.report);
  assert.deepEqual(final.controlled, full.controlled);
  assert.equal(final.rngState, full.rngState);
});

test('replay verification supports incremental late tactical orders without rewriting earlier shots', () => {
  const opening = good(createM1PhaseCheckpoint(prematch, policy, 0));
  const kickoff = command({ tempo: 80, mentality: 1 }, 0);
  const atFour = good(resumeM1PhaseCheckpoint(prematch, policy, opening, 4, [kickoff]));
  assert.equal(atFour.controlled.commands.length, 1);
  assert.equal(atFour.controlled.tactics.home.tempo, 80);
  const saved = JSON.parse(JSON.stringify(atFour));
  const late = command({ passingRisk: 100 }, 1200, 'away');
  const afterSeven = good(resumeM1PhaseCheckpoint(prematch, policy, saved, 7, [late]));
  assert.equal(afterSeven.controlled.commands.length, 2);
  assert.equal(afterSeven.controlled.commands[1].elapsedSeconds, 1200);
  assert.deepEqual(afterSeven.events.filter(e => e.elapsedSeconds < 1200), atFour.events);
  const final = good(resumeM1PhaseCheckpoint(prematch, policy, afterSeven, 18));
  const full = simulateM1SyntheticPhases(prematch, policy, [kickoff, late]);
  assert.equal(full.ok, true);
  if (!full.ok) return;
  assert.deepEqual(final.events, full.events);
  assert.deepEqual(final.report, full.report);
  assert.deepEqual(final.controlled.commands, full.controlled.commands);
  assert.equal(final.rngState, full.rngState);
});

test('single-phase resumes match direct checkpoint generation from fixed seed', () => {
  let snapshot = good(createM1PhaseCheckpoint(prematch, policy, 0));
  for (let phase = 1; phase <= 18; phase++) {
    snapshot = good(resumeM1PhaseCheckpoint(prematch, policy, snapshot, phase));
    const direct = good(createM1PhaseCheckpoint(prematch, policy, phase));
    assert.deepEqual(snapshot, direct);
  }
  const repeated = good(resumeM1PhaseCheckpoint(prematch, policy, snapshot, 18));
  assert.deepEqual(repeated, snapshot);
});

test('corrupted checkpoint content, metadata, event history and policy fail closed', () => {
  const valid = good(createM1PhaseCheckpoint(prematch, policy, 4, [
    command({ tempo: 88 }, 0),
  ]));
  const altered = [
    null, [], {}, { ...valid, schemaVersion: 1 }, { ...valid, engineVersion: '0' },
    { ...valid, completedPhases: 3 }, { ...valid, rngState: 0 },
    { ...valid, rngDraws: 19 }, { ...valid, rngSeed: 43 },
    { ...valid, events: [] },
    { ...valid, events: [{ ...valid.events[0], elapsedSeconds: 42 }, ...valid.events.slice(1)] },
    { ...valid, controlled: { ...valid.controlled, clock: { ...valid.controlled.clock, elapsedSeconds: 1500 } } },
    { ...valid, controlled: { ...valid.controlled, tactics: {
      ...valid.controlled.tactics, home: { ...valid.controlled.tactics.home, tempo: 22 },
    } } },
    { ...valid, controlled: { ...valid.controlled, commands: [{ ...valid.controlled.commands[0], sequence: 9 }] } },
    { ...valid, controlled: { ...valid.controlled, commands: [{ ...valid.controlled.commands[0], plan: {
      ...valid.controlled.commands[0].plan, tempo: 99,
    } }] } },
    { ...valid, controlled: { ...valid.controlled, authority: {
      ...valid.controlled.authority, home: {
        assignedActor: { kind: 'staff', staffId: 'fake' }, availableStaffIds: ['fake'],
      },
    } } },
    { ...valid, arbitrary: undefined },
    { ...valid, events: [...valid.events, undefined] },
  ];
  for (const candidate of altered) {
    bad(resumeM1PhaseCheckpoint(prematch, policy, candidate, 5), 'INVALID_CHECKPOINT');
  }
});

test('backdating new commands and skipping past available phases is refused', () => {
  const prior = good(createM1PhaseCheckpoint(prematch, policy, 5));
  bad(resumeM1PhaseCheckpoint(prematch, policy, prior, 6,
    [command({ tempo: 99 }, 300)]), 'BACKDATED_COMMAND');
  bad(resumeM1PhaseCheckpoint(prematch, policy, prior, 4), 'INVALID_PHASE');
  bad(resumeM1PhaseCheckpoint(prematch, policy, prior, 19), 'INVALID_PHASE');
  bad(createM1PhaseCheckpoint(prematch, policy, -1), 'INVALID_PHASE');
  bad(createM1PhaseCheckpoint(prematch, policy, 18.5), 'INVALID_PHASE');
  bad(createM1PhaseCheckpoint(prematch, policy, 19), 'INVALID_PHASE');
  bad(createM1PhaseCheckpoint(prematch, policy, 2, [command({ tempo: 99 }, 600)]),
    'INVALID_SCHEDULE');
});

test('even canonical checkpoints cannot bypass actual player/staff authorization', () => {
  const prior = good(createM1PhaseCheckpoint(prematch, policy, 0));
  const injected = { ...command({ pressing: 100 }, 0), actor: { kind: 'staff', staffId: 'fake' } };
  const failed = resumeM1PhaseCheckpoint(prematch, policy, prior, 1, [injected]);
  bad(failed, 'INVALID_SOURCE');
  const changedPolicy = { ...policy, home: {
    assignedActor: { kind: 'staff', staffId: 'fake' }, availableStaffIds: ['fake'],
  } };
  bad(resumeM1PhaseCheckpoint(prematch, changedPolicy, prior, 1), 'INVALID_CHECKPOINT');
});

test('checkpoint source inputs and command order are preserved without mutation', () => {
  const beforeInput = JSON.stringify(prematch);
  const beforePolicy = JSON.stringify(policy);
  const commands = [command({ tempo: 90 }, 0), command({ pressing: 80 }, 300, 'away')];
  const beforeCommands = JSON.stringify(commands);
  const out = good(createM1PhaseCheckpoint(prematch, policy, 9, commands));
  assert.equal(out.controlled.commands.length, 2);
  assert.equal(JSON.stringify(prematch), beforeInput);
  assert.equal(JSON.stringify(policy), beforePolicy);
  assert.equal(JSON.stringify(commands), beforeCommands);
});
