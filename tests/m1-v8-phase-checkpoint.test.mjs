import test from 'node:test';
import assert from 'node:assert/strict';
import { createM1V8PhaseCheckpoint, resumeM1V8PhaseCheckpoint }
  from '../dist/core/m1-v8-phase-checkpoint.js';
import { simulateM1V8MedicalPhases } from '../dist/core/m1-v8-medical-phases.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.awayClubId));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const homeOut = home.starters.filter(id => positions.get(id) !== 'GK');
const awayOut = away.starters.find(id => positions.get(id) !== 'GK');
const prematch = {
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
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const exit = {
  schemaVersion: 1, id: 'exit-1', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: homeOut[0], elapsedSeconds: 0,
  kind: 'treatment-exit', reason: 'medical-staff-entered',
  restartAtRunningSeconds: 15,
};
const back = {
  schemaVersion: 1, id: 'return-1', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: homeOut[0], elapsedSeconds: 300,
  kind: 'treatment-return', returnContext: 'running-clock',
  ballInPlay: true, entryBoundary: 'touchline',
  refereeSignalId: 'external-source-must-authenticate',
};
const caution = {
  schemaVersion: 1, id: 'caution', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: homeOut[1], elapsedSeconds: 600,
  kind: 'caution', origin: 'trusted-referee',
};
const own = {
  schemaVersion: 1, decisionId: 'own-1', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: awayOut, elapsedSeconds: 900,
  kind: 'own-goal',
};
const initial = (phase = 0, commands = [], decisions = [], medical = [],
  input = prematch) => createM1V8PhaseCheckpoint(
  input, policy, phase, commands, decisions, medical);
const advance = (checkpoint, phase, commands = [], decisions = [], medical = [],
  input = prematch) => resumeM1V8PhaseCheckpoint(
  input, policy, checkpoint, phase, commands, decisions, medical);
function good(result) {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 160));
  return result.checkpoint;
}
function shotFacts(events) {
  return events.filter(e => e.type === 'shot').map(({ sequence, ...shot }) => shot);
}

test('initial, partial and terminal v8 previews have exact seeded RNG and no leaked events', () => {
  for (const seed of [1, 42, 777]) {
    const input = { ...prematch, rngSeed: seed };
    const zero = good(initial(0, [], [], [], input));
    assert.equal(zero.status, 'preview-paused');
    assert.equal(zero.completedPhases, 0);
    assert.equal(zero.rngDraws, 0);
    assert.equal(zero.events.length, 0);
    assert.equal(zero.report, null);
    const rng = new SeededRng(seed);
    assert.equal(zero.rngState, rng.snapshot());
    const half = good(initial(9, [], [], [], input));
    assert.equal(half.rngDraws, 45);
    assert.equal(half.events.every(e => e.elapsedSeconds < 2700), true);
    assert.equal(half.report, null);
    const final = good(initial(18, [], [], [], input));
    const direct = simulateM1V8MedicalPhases(input, policy, [], [], []);
    assert.equal(direct.ok, true);
    assert.equal(final.status, 'full-time-preview');
    assert.equal(final.rngDraws, 90);
    assert.equal(final.rngState, direct.rngState);
    assert.deepEqual(final.events, direct.events);
    assert.deepEqual(final.report, direct.report);
    assert.deepEqual(final.provisionalScore,
      { home: direct.report.home.goals, away: direct.report.away.goals });
    assert.equal(Object.hasOwn(final, 'appliedFixture'), false);
  }
});

test('paused medical exit/return preserves past and matches uninterrupted full match', () => {
  const first = good(initial(1, [], [], [exit]));
  assert.deepEqual(first.offFieldAtCheckpoint, [homeOut[0]]);
  assert.equal(first.onFieldAtCheckpoint.home.length, 10);
  const next = good(advance(first, 3, [], [], [back]));
  assert.deepEqual(next.offFieldAtCheckpoint, []);
  assert.deepEqual(next.events.filter(e => e.type === 'medical').map(e => e.action.id),
    ['exit-1', 'return-1']);
  assert.deepEqual(next.events.filter(e => e.elapsedSeconds < 300),
    first.events);
  const terminal = good(advance(next, 18));
  const direct = simulateM1V8MedicalPhases(
    prematch, policy, [], [], [exit, back]);
  assert.equal(direct.ok, true);
  assert.deepEqual(terminal.events, direct.events);
  assert.deepEqual(terminal.report, direct.report);
  assert.equal(terminal.rngState, direct.rngState);
  assert.deepEqual(shotFacts(terminal.events), shotFacts(direct.events));
});

test('new referee/card actions at or after pause do not rewrite earlier phases', () => {
  const first = good(initial(2));
  const second = good(advance(first, 4, [caution], [own]));
  assert.equal(second.plannedCommands.length, 1);
  assert.equal(second.trustedDecisions.length, 1);
  assert.equal(second.events.some(e => e.type === 'adjudication'), true);
  assert.deepEqual(second.events.filter(e => e.elapsedSeconds < 600), first.events);
  const final = good(advance(second, 18));
  const direct = simulateM1V8MedicalPhases(
    prematch, policy, [caution], [own], []);
  assert.equal(direct.ok, true);
  assert.deepEqual(final.events, direct.events);
  assert.deepEqual(final.report, direct.report);
});

test('any history alteration or changed prematch/authority fails closed', () => {
  const candidate = good(initial(3, [], [], [exit, back]));
  for (const changed of [
    { ...candidate, rngState: candidate.rngState ^ 1 },
    { ...candidate, rngDraws: 99 },
    { ...candidate, events: [...candidate.events].reverse() },
    { ...candidate, provisionalScore: { home: 99, away: 0 } },
    { ...candidate, offFieldAtCheckpoint: [homeOut[0]] },
    { ...candidate, medicalActions: [] },
    { ...candidate, plannedCommands: [caution] },
    { ...candidate, status: 'full-time-preview' },
    { ...candidate, additional: true },
  ]) assert.deepEqual(advance(changed, 5),
    { ok: false, error: 'INVALID_CHECKPOINT' });
  assert.deepEqual(advance(candidate, 5, [], [], [], { ...prematch, rngSeed: 99 }),
    { ok: false, error: 'INVALID_CHECKPOINT' });
  assert.deepEqual(resumeM1V8PhaseCheckpoint(
    prematch, {}, candidate, 5),
  { ok: false, error: 'INVALID_CHECKPOINT' });
});

test('backdated/future orders, unsupported medical facts and phase skips are typed', () => {
  const first = good(initial(1));
  assert.deepEqual(advance(first, 3, [{ ...caution, elapsedSeconds: 0 }]),
    { ok: false, error: 'BACKDATED_ACTION' });
  assert.deepEqual(advance(first, 3, [], [{ ...own, elapsedSeconds: 0 }]),
    { ok: false, error: 'BACKDATED_ACTION' });
  assert.deepEqual(advance(first, 3, [], [], [{ ...exit, elapsedSeconds: 0 }]),
    { ok: false, error: 'BACKDATED_ACTION' });
  assert.deepEqual(advance(first, 2, [caution]),
    { ok: false, error: 'INVALID_SCHEDULE' });
  assert.deepEqual(advance(first, 2, [], [], [back]),
    { ok: false, error: 'INVALID_SOURCE' });
  assert.deepEqual(advance(first, 0), { ok: false, error: 'INVALID_PHASE' });
  assert.deepEqual(initial(1, [], [], [back]),
    { ok: false, error: 'INVALID_SCHEDULE' });
  assert.deepEqual(initial(1, [], [], [{ ...exit, restartAtRunningSeconds: 1500 }]),
    { ok: false, error: 'INVALID_SCHEDULE' });
  assert.deepEqual(initial(19), { ok: false, error: 'INVALID_PHASE' });
  assert.deepEqual(initial(-1), { ok: false, error: 'INVALID_PHASE' });
  const final = good(initial(18));
  assert.deepEqual(advance(final, 18, [caution]),
    { ok: false, error: 'MATCH_FINISHED' });
  assert.deepEqual(advance(final, 18), { ok: true, checkpoint: final });
});

test('treatment input and checkpoints never alias or mutate their caller sources', () => {
  const medical = structuredClone([exit, back]);
  const original = structuredClone(medical);
  const input = structuredClone(prematch);
  const first = good(initial(3, [], [], medical));
  medical[0].id = 'modified-after-save';
  assert.equal(first.medicalActions[0].id, 'exit-1');
  assert.deepEqual(advance(first, 18).ok, true);
  assert.deepEqual(prematch, input);
  assert.equal(original[0].id, 'exit-1');
});
