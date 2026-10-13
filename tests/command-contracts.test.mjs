import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCareerCommand, CAREER_COMMAND_VERSION } from '../dist/core/command-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(19);
const club = catalog.clubs[0];
const context = {
  careerId: 'career-one',
  revision: 5,
  controlledClubId: club.id,
  assignedActors: {},
  availableStaffIds: new Set(['assistant']),
  appliedCommandIds: new Set(['already-applied']),
};
const lineup = defaultSyntheticLineup(club);
const tactics = defaultTacticalPlan(club.id);
const command = {
  schemaVersion: CAREER_COMMAND_VERSION,
  commandId: 'cmd-1',
  careerId: context.careerId,
  expectedRevision: 5,
  actor: { kind: 'player' },
  kind: 'set-lineup',
  payload: lineup,
};
const invalidCode = (candidate, state = context) => {
  const result = validateCareerCommand(candidate, state);
  assert.equal(result.ok, false);
  return result.error;
};

test('manual control is the default and successful validation makes an isolated copy', () => {
  const snapshot = structuredClone({ ...context, appliedCommandIds: [], availableStaffIds: [] });
  const result = validateCareerCommand(command, context);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.command, command);
    assert.notStrictEqual(result.command.payload.starters, command.payload.starters);
    assert.notStrictEqual(result.command.payload.bench, command.payload.bench);
  }
  assert.deepEqual(structuredClone({ ...context, appliedCommandIds: [], availableStaffIds: [] }), snapshot);
  assert.equal(context.appliedCommandIds.has(command.commandId), false);
  const tacticsResult = validateCareerCommand({
    ...command, commandId: 'cmd-tactics', kind: 'set-tactics', payload: tactics,
  }, context);
  assert.equal(tacticsResult.ok, true);
  if (tacticsResult.ok) assert.notStrictEqual(tacticsResult.command.payload, tactics);
});

test('version, shape and IDs are checked before any state operation', () => {
  assert.equal(invalidCode(null), 'INVALID_COMMAND');
  assert.equal(invalidCode({ ...command, schemaVersion: 2 }), 'INVALID_COMMAND');
  assert.equal(invalidCode({ ...command, kind: 'execute-match' }), 'INVALID_COMMAND');
  assert.equal(invalidCode({ ...command, extra: 1 }), 'INVALID_COMMAND');
  assert.equal(invalidCode({ ...command, commandId: ' ' }), 'INVALID_ID');
  assert.equal(invalidCode({ ...command, careerId: 'bad\u202e' }), 'INVALID_ID');
  assert.equal(invalidCode({ ...command, actor: { kind: 'staff' } }), 'INVALID_ACTOR');
  assert.equal(invalidCode({ ...command, actor: { kind: 'player', staffId: 'assistant' } }), 'INVALID_ACTOR');
  for (const revision of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(invalidCode({ ...command, expectedRevision: revision }), 'INVALID_REVISION');
  }
});

test('commands are bound to their career, current revision and never replayed', () => {
  assert.equal(invalidCode({ ...command, careerId: 'someone-else' }), 'WRONG_CAREER');
  assert.equal(invalidCode({ ...command, expectedRevision: 4 }), 'STALE_REVISION');
  assert.equal(invalidCode({ ...command, commandId: 'already-applied' }), 'DUPLICATE_COMMAND');
});

test('only the explicitly delegated employee may act, per separate responsibility', () => {
  const delegated = {
    ...context,
    assignedActors: { lineup: { kind: 'staff', staffId: 'assistant' } },
  };
  assert.equal(invalidCode(command, delegated), 'UNAUTHORIZED');
  assert.equal(invalidCode({ ...command, actor: { kind: 'staff', staffId: 'other' } }, delegated), 'UNAUTHORIZED');
  const employee = { ...command, actor: { kind: 'staff', staffId: 'assistant' } };
  assert.equal(validateCareerCommand(employee, delegated).ok, true);
  assert.equal(invalidCode(employee, {
    ...delegated, availableStaffIds: new Set(),
  }), 'UNAVAILABLE_STAFF');
  assert.equal(invalidCode(employee, context), 'UNAUTHORIZED');
  assert.equal(validateCareerCommand({
    ...command, commandId: 'tactics-manual', kind: 'set-tactics', payload: tactics,
  }, delegated).ok, true);
});

test('lineup payload rejects sparse, duplicated, oversized and rival players', () => {
  const invalid = [
    null,
    { ...lineup, starters: Array(11) },
    { ...lineup, starters: [...lineup.starters.slice(0, 10), lineup.starters[0]] },
    { ...lineup, bench: Array(13).fill(lineup.starters[0]) },
    { ...lineup, bench: Array(1) },
    { ...lineup, clubId: 'another-club' },
    { ...lineup, starters: [...lineup.starters.slice(0, 10), 42] },
    { ...lineup, unexpected: true },
  ];
  for (const payload of invalid) {
    assert.equal(invalidCode({ ...command, payload }), 'INVALID_PAYLOAD');
  }
});

test('tactics require exact versioned fields, club and bounded numeric sliders', () => {
  const base = { ...command, kind: 'set-tactics', payload: tactics };
  for (const payload of [
    null,
    { ...tactics, schemaVersion: 2 },
    { ...tactics, clubId: 'another-club' },
    { ...tactics, formation: '9-9' },
    { ...tactics, pressing: 101 },
    { ...tactics, pressing: NaN },
    { ...tactics, extra: 'unrecognized' },
  ]) {
    assert.equal(invalidCode({ ...base, payload }), 'INVALID_PAYLOAD');
  }
});
