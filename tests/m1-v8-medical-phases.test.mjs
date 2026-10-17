import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V8MedicalPhases, verifyM1V8MedicalResult }
  from '../dist/core/m1-v8-medical-phases.js';
import { simulateM1V7Phases } from '../dist/core/m1-v7-adjudications.js';
import { replayM1V7TemporaryMedicalPresence }
  from '../dist/core/m1-v7-temporary-medical.js';
import { deriveM1VerifiedV8PhasePresence }
  from '../dist/core/m1-v8-phase-presence.js';
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
const position = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const homeOut = home.starters.find(id => position.get(id) !== 'GK');
const awayOut = away.starters.find(id => position.get(id) !== 'GK');
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
const run = (medical = [], decisions = [], commands = [], input = prematch) =>
  simulateM1V8MedicalPhases(input, policy, commands, decisions, medical);
function departure(playerId = homeOut, id = 'exit-1') {
  return { schemaVersion: 1, id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId, elapsedSeconds: 0,
    kind: 'treatment-exit', reason: 'medical-staff-entered',
    restartAtRunningSeconds: 15 };
}
function returning(playerId = homeOut) {
  return { schemaVersion: 1, id: 'return-1', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId, elapsedSeconds: 300,
    kind: 'treatment-return', returnContext: 'running-clock', ballInPlay: true,
    entryBoundary: 'touchline', refereeSignalId: 'genuine-integration-required' };
}
function penalty(playerId = homeOut) {
  return { schemaVersion: 1, decisionId: 'decision-1', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId, elapsedSeconds: 0,
    kind: 'penalty-kick', outcome: 'scored' };
}
test('no medical treatment preserves v7 open play, decisions and RNG', () => {
  for (const seed of [1, 42, 777, 0xffffffff]) {
    const input = { ...prematch, rngSeed: seed };
    const prior = simulateM1V7Phases(input, policy, [], [penalty()]);
    const next = run([], [penalty()], [], input);
    assert.equal(prior.ok, true);
    assert.equal(next.ok, true, JSON.stringify(next));
    assert.deepEqual(next.report, prior.report);
    assert.equal(next.rngState, prior.base.rngState);
    assert.equal(next.rngDraws, prior.base.rngDraws);
    const oldShots = prior.events.filter(e => e.type === 'v6-event' &&
      e.source.type === 'shot').map(e => e.source);
    const newShots = next.events.filter(e => e.type === 'shot');
    assert.deepEqual(newShots.map(({ id, schemaVersion, sequence, ...shot }) => shot),
      oldShots.map(({ id, schemaVersion, sequence, ...shot }) => shot));
  }
});
test('temporary absence changes actual phase selection, not existing v7 history', () => {
  const original = simulateM1V7Phases(prematch, policy, [], []);
  assert.equal(original.ok, true);
  const shooter = original.events.find(e => e.type === 'v6-event' &&
    e.source.type === 'shot' && e.elapsedSeconds === 299)?.source.playerId;
  const playerId = shooter && home.starters.includes(shooter) ? shooter : homeOut;
  const medical = [departure(playerId), returning(playerId)];
  const next = run(medical);
  assert.equal(next.ok, true, JSON.stringify(next));
  assert.equal(next.events.filter(e => e.type === 'medical').length, 2);
  assert.equal(next.events.filter(e => e.type === 'shot' &&
    e.elapsedSeconds === 299 && e.playerId === playerId).length, 0);
  assert.equal(next.onFieldAtFullTime.home.length, 11);
  assert.deepEqual(next.offFieldAtFullTime, []);
  assert.equal(next.rngDraws, 90);
  assert.ok(verifyM1V8MedicalResult(prematch, policy, [], [], medical, next));
  assert.deepEqual(simulateM1V7Phases(prematch, policy, [], []), original);
});
test('pending exits persist and are omitted from final physical XI', () => {
  const player = home.starters.find(id => position.get(id) !== 'GK');
  const first = run([departure(player)]);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.deepEqual(first.offFieldAtFullTime, [player]);
  assert.equal(first.onFieldAtFullTime.home.length, 10);
});
test('penalty taker and own-goal defender cannot be off the pitch', () => {
  assert.deepEqual(run([departure()], [penalty()]), {
    ok: false, error: 'NOT_ON_FIELD',
  });
  const ownGoal = { schemaVersion: 1, decisionId: 'own-goal', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: awayOut, elapsedSeconds: 0, kind: 'own-goal' };
  const absence = { ...departure(awayOut, 'other-exit'), teamId: fixture.awayClubId };
  assert.deepEqual(run([absence], [ownGoal]), {
    ok: false, error: 'NOT_ON_FIELD',
  });
});
test('disallowed return, unsupported keeper and malformed schedules fail', () => {
  assert.deepEqual(run([returning()]), { ok: false, error: 'NOT_ABSENT' });
  assert.deepEqual(run([departure(), { ...returning(), entryBoundary: 'goal-line' }]), {
    ok: false, error: 'MEDICAL_RETURN_REJECTED', medicalError: 'WRONG_ENTRY_BOUNDARY',
  });
  const keeper = home.starters.find(id => position.get(id) === 'GK');
  assert.deepEqual(run([departure(keeper)]), {
    ok: false, error: 'EXCEPTION_RULING_REQUIRED',
  });
  assert.deepEqual(run([departure(), { ...returning(), id: 'exit-1' }]), {
    ok: false, error: 'DUPLICATE_ID',
  });
  assert.deepEqual(run([departure(), { ...returning(), elapsedSeconds: 0 }]), {
    ok: false, error: 'INVALID_MEDICAL_SCHEDULE',
  });
  assert.deepEqual(run([{ ...departure(), extra: 1 }]), {
    ok: false, error: 'INVALID_MEDICAL_SCHEDULE',
  });
});
test('v8 cannot accept forged deterministic reports or source actions', () => {
  const medical = [departure(), returning()];
  const result = run(medical);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(verifyM1V8MedicalResult(prematch, policy, [], [], medical,
    { ...result, rngState: result.rngState ^ 1 }), false);
  assert.equal(verifyM1V8MedicalResult(prematch, policy, [], [], medical,
    { ...result, events: [...result.events].reverse() }), false);
  assert.equal(verifyM1V8MedicalResult(prematch, policy, [], [], [], result), false);
});

test('v8 accepts two independent departures and returns at the same checkpoints', () => {
  const homeExit = departure(homeOut, 'home-simultaneous-exit');
  const awayExit = {
    ...departure(awayOut, 'away-simultaneous-exit'),
    teamId: fixture.awayClubId,
  };
  const homeReturn = { ...returning(homeOut), id: 'home-simultaneous-return' };
  const awayReturn = {
    ...returning(awayOut), id: 'away-simultaneous-return',
    teamId: fixture.awayClubId,
  };
  const actions = [homeExit, awayExit, homeReturn, awayReturn];
  const pending = run([homeExit, awayExit]);
  assert.equal(pending.ok, true, JSON.stringify(pending));
  assert.deepEqual(pending.offFieldAtFullTime, [homeOut, awayOut].sort());
  assert.equal(pending.onFieldAtFullTime.home.length, 10);
  assert.equal(pending.onFieldAtFullTime.away.length, 10);
  const restored = run(actions);
  assert.equal(restored.ok, true, JSON.stringify(restored));
  assert.deepEqual(restored.offFieldAtFullTime, []);
  assert.equal(restored.onFieldAtFullTime.home.length, 11);
  assert.equal(restored.onFieldAtFullTime.away.length, 11);
  assert.deepEqual(restored.events.filter(e => e.type === 'medical')
    .map(e => e.action.id), actions.map(a => a.id));
  assert.equal(restored.rngDraws, 90);
  assert.equal(verifyM1V8MedicalResult(prematch, policy, [], [], actions,
    restored), true);

  const presence = deriveM1VerifiedV8PhasePresence(
    prematch, policy, [], [], actions, restored);
  assert.equal(presence.ok, true, JSON.stringify(presence));
  for (const playerId of [homeOut, awayOut]) {
    const row = presence.report.players.find(p => p.playerId === playerId);
    assert.equal(row.registeredPhaseSeconds, 5400);
    assert.equal(row.physicalPhaseSeconds, 5100);
    assert.equal(row.temporarilyAbsentPhaseSeconds, 300);
  }

  const reordered = run([awayExit, homeExit, awayReturn, homeReturn]);
  assert.equal(reordered.ok, true, JSON.stringify(reordered));
  assert.deepEqual(reordered.report, restored.report);
  assert.equal(reordered.rngState, restored.rngState);
  assert.equal(reordered.rngDraws, restored.rngDraws);
  // v7 previously rejected equal elapsed seconds and retains that contract.
  assert.deepEqual(replayM1V7TemporaryMedicalPresence(
    prematch, policy, [], [], actions), {
    ok: false, error: 'INVALID_ACTIONS',
  });
});

test('v8 simultaneous medical actions still reject conflicts and ordering defects', () => {
  const exit = departure(homeOut, 'simultaneous-exit');
  const repeated = { ...exit, id: 'second-exit' };
  assert.deepEqual(run([exit, repeated]), {
    ok: false, error: 'ALREADY_ABSENT',
  });
  assert.deepEqual(run([exit, { ...exit }]), {
    ok: false, error: 'DUPLICATE_ID',
  });
  assert.equal(run([exit, { ...returning(homeOut),
    elapsedSeconds: 0 }]).error, 'MEDICAL_RETURN_REJECTED');
  assert.deepEqual(run([returning(homeOut), exit]), {
    ok: false, error: 'INVALID_MEDICAL_SCHEDULE',
  });
  assert.deepEqual(run([exit, { ...departure(awayOut, 'wrong-club'),
    teamId: fixture.homeClubId }]), {
    ok: false, error: 'NOT_ON_FIELD',
  });
});
