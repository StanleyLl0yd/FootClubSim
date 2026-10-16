import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlainJsonTree } from '../dist/core/plain-json-tree.js';
import { createM1V8PhaseCheckpoint, resumeM1V8PhaseCheckpoint }
  from '../dist/core/m1-v8-phase-checkpoint.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.awayClubId));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const caution = {
  schemaVersion: 1, id: 'yellow', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: home.starters[1],
  elapsedSeconds: 600, kind: 'caution', origin: 'trusted-referee',
};
function create(phase, commands = [], decisions = [], medical = []) {
  return createM1V8PhaseCheckpoint(
    prematch, policy, phase, commands, decisions, medical);
}

test('ordinary versioned checkpoint remains JSON-safe and exactly resumable', () => {
  const start = create(2);
  assert.equal(start.ok, true, JSON.stringify(start).slice(0, 200));
  assert.equal(isPlainJsonTree(start.checkpoint), true);
  const next = resumeM1V8PhaseCheckpoint(
    prematch, policy, start.checkpoint, 4, [caution]);
  assert.equal(next.ok, true, JSON.stringify(next).slice(0, 200));
  assert.equal(isPlainJsonTree(next.checkpoint), true);
  assert.equal(next.checkpoint.plannedCommands.length, 1);
  assert.equal(next.checkpoint.events.some(e => e.type === 'availability'), true);
  const saved = JSON.parse(JSON.stringify(next.checkpoint));
  assert.deepEqual(resumeM1V8PhaseCheckpoint(prematch, policy, saved, 18).ok, true);
});

test('malformed action sources fail before any getter or toJSON is invoked', () => {
  let executed = 0;
  const getter = { ...caution };
  Object.defineProperty(getter, 'elapsedSeconds', {
    enumerable: true, get() { executed++; throw Error('must never run'); },
  });
  const custom = Object.assign(Object.create({ inherited: true }), caution);
  const toJson = { ...caution, toJSON() {
    executed++;
    throw Error('must never serialize a method');
  } };
  const symbol = { ...caution };
  symbol[Symbol('hidden')] = 'bad';
  const nonfinite = { ...caution, elapsedSeconds: Infinity };
  const undefinedField = { ...caution, extra: undefined };
  const cyclic = { ...caution };
  cyclic.loop = cyclic;
  const hole = [];
  hole.length = 1;
  const alias = { ...caution };
  const rejected = [[getter], [custom], [toJson], [symbol],
    [nonfinite], [undefinedField], [cyclic], hole, [alias, alias]];
  for (const source of rejected) {
    assert.deepEqual(create(3, source),
      { ok: false, error: 'INVALID_SCHEDULE' });
  }
  assert.equal(executed, 0);
});

test('referee and medical source arrays receive the same strict preflight', () => {
  const abnormal = { ...caution, bad: BigInt(1) };
  assert.deepEqual(create(3, [], [abnormal]),
    { ok: false, error: 'INVALID_SCHEDULE' });
  assert.deepEqual(create(3, [], [], [abnormal]),
    { ok: false, error: 'INVALID_SCHEDULE' });
  const noPrototype = Object.create(null);
  noPrototype.elapsedSeconds = 0;
  noPrototype.kind = 'not-a-valid-medical-action';
  assert.equal(isPlainJsonTree(noPrototype), true);
  // A plain JSON object can still be rejected by the domain's action rules.
  assert.deepEqual(create(3, [], [], [noPrototype]),
    { ok: false, error: 'INVALID_SOURCE' });
});

test('forged checkpoint and newly submitted commands are rejected without reads', () => {
  const initial = create(2);
  assert.equal(initial.ok, true);
  let executed = 0;
  const forged = { ...initial.checkpoint };
  Object.defineProperty(forged, 'completedPhases', {
    enumerable: true, get() { executed++; throw Error('checkpoint getter'); },
  });
  assert.deepEqual(resumeM1V8PhaseCheckpoint(prematch, policy, forged, 3),
    { ok: false, error: 'INVALID_CHECKPOINT' });
  const invalidNew = { ...caution };
  Object.defineProperty(invalidNew, 'elapsedSeconds', {
    enumerable: true, get() { executed++; throw Error('new command getter'); },
  });
  assert.deepEqual(resumeM1V8PhaseCheckpoint(
    prematch, policy, initial.checkpoint, 3, [invalidNew]),
  { ok: false, error: 'INVALID_SCHEDULE' });
  assert.equal(executed, 0);
});

test('direct source JSON checks still reject aliases and nonenumerable fields', () => {
  const repeated = { field: 'x' };
  assert.equal(isPlainJsonTree([repeated, repeated]), false);
  const invisible = { field: 'x' };
  Object.defineProperty(invisible, 'hidden', { value: 'x' });
  assert.equal(isPlainJsonTree(invisible), false);
  assert.equal(isPlainJsonTree([1, true, null, { nested: 'ok' }]), true);
});
