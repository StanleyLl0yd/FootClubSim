import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V8MedicalPhases } from '../dist/core/m1-v8-medical-phases.js';
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
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const outfield = home.starters.filter(id => positions.get(id) !== 'GK');
const bench = home.bench.find(id => positions.get(id) !== 'GK');
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
  schemaVersion: 1, id: 'exit', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: outfield[0], elapsedSeconds: 0,
  kind: 'treatment-exit', reason: 'medical-staff-entered',
  restartAtRunningSeconds: 15,
};
const back = {
  schemaVersion: 1, id: 'return', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: outfield[0], elapsedSeconds: 300,
  kind: 'treatment-return', returnContext: 'running-clock', ballInPlay: true,
  entryBoundary: 'touchline', refereeSignalId: 'not-authenticated-by-test',
};
function examine(input = prematch, commands = [], medical = []) {
  const match = simulateM1V8MedicalPhases(input, policy, commands, [], medical);
  assert.equal(match.ok, true, JSON.stringify(match).slice(0, 200));
  const projected = deriveM1VerifiedV8PhasePresence(
    input, policy, commands, [], medical, match);
  assert.equal(projected.ok, true, JSON.stringify(projected).slice(0, 200));
  return { match, report: projected.report };
}
const rowFor = (report, playerId) => report.players.find(p => p.playerId === playerId);

test('all starters physically present in four unmodified seeded matches', () => {
  for (const seed of [1, 42, 777, 0xffffffff]) {
    const { report } = examine({ ...prematch, rngSeed: seed });
    assert.equal(report.status, 'SYNTHETIC_PHASE_SECONDS_NOT_REAL_RUNNING_CLOCK');
    assert.equal(report.players.length, 22);
    assert.equal(report.players.filter(p => p.started).length, 22);
    assert.equal(report.completedPhases, 18);
    for (const p of report.players) {
      assert.equal(p.registeredPhaseSeconds, 5400);
      assert.equal(p.physicalPhaseSeconds, 5400);
      assert.equal(p.temporarilyAbsentPhaseSeconds, 0);
    }
    for (const side of ['home', 'away']) {
      assert.equal(report.teams[side].registeredPhasePersonSeconds, 11 * 5400);
      assert.equal(report.teams[side].physicalPhasePersonSeconds, 11 * 5400);
      assert.equal(report.teams[side].temporarilyAbsentPhasePersonSeconds, 0);
      assert.equal(report.teams[side].minPhysicallyPresent, 11);
      assert.equal(report.teams[side].maxPhysicallyPresent, 11);
    }
  }
});

test('temporary medical absence removes exactly one phase from physical presence', () => {
  const { report } = examine(prematch, [], [exit, back]);
  const patient = rowFor(report, outfield[0]);
  assert.equal(patient.registeredPhaseSeconds, 5400);
  assert.equal(patient.physicalPhaseSeconds, 5100);
  assert.equal(patient.temporarilyAbsentPhaseSeconds, 300);
  assert.equal(report.teams.home.registeredPhasePersonSeconds, 11 * 5400);
  assert.equal(report.teams.home.physicalPhasePersonSeconds, 11 * 5400 - 300);
  assert.equal(report.teams.home.temporarilyAbsentPhasePersonSeconds, 300);
  assert.equal(report.teams.home.minPhysicallyPresent, 10);
  assert.equal(report.teams.home.maxPhysicallyPresent, 11);
  assert.deepEqual(report.offFieldAtFullTime, []);
});

test('permanent unresolved treatment is counted as absence, not dismissal', () => {
  const { report } = examine(prematch, [], [exit]);
  const patient = rowFor(report, outfield[0]);
  assert.equal(patient.registeredPhaseSeconds, 5400);
  assert.equal(patient.physicalPhaseSeconds, 0);
  assert.equal(patient.temporarilyAbsentPhaseSeconds, 5400);
  assert.equal(report.teams.home.minPhysicallyPresent, 10);
  assert.equal(report.teams.home.maxPhysicallyPresent, 10);
  assert.deepEqual(report.offFieldAtFullTime, [outfield[0]]);
});

test('substitution and red card retire physical seconds at exact checkpoints', () => {
  const commands = [
    { schemaVersion: 1, commandId: 'normal', fixtureId: fixture.id,
      teamId: fixture.homeClubId, elapsedSeconds: 300, actor: { kind: 'player' },
      kind: 'substitute-normal', outPlayerId: outfield[1], inPlayerId: bench,
      stoppage: 'referee-authorized' },
    { schemaVersion: 1, id: 'red', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId: bench, elapsedSeconds: 600,
      kind: 'direct-red', origin: 'trusted-referee' },
  ];
  const { report } = examine(prematch, commands);
  assert.equal(rowFor(report, outfield[1]).registeredPhaseSeconds, 300);
  assert.equal(rowFor(report, outfield[1]).physicalPhaseSeconds, 300);
  assert.equal(rowFor(report, bench).started, false);
  assert.equal(rowFor(report, bench).physicalPhaseSeconds, 300);
  assert.equal(rowFor(report, bench).registeredPhaseSeconds, 300);
  assert.equal(report.players.length, 23);
  assert.equal(report.teams.home.minPhysicallyPresent, 10);
  assert.equal(report.teams.home.maxPhysicallyPresent, 11);
  assert.equal(report.teams.home.physicalPhasePersonSeconds,
    11 * 5400 - (5400 - 600));
});

test('fabricated result and wrong asserted medical history fail closed', () => {
  const { match } = examine(prematch, [], [exit, back]);
  const project = (medical, candidate) =>
    deriveM1VerifiedV8PhasePresence(prematch, policy, [], [], medical, candidate);
  assert.deepEqual(project([], match), { ok: false, error: 'INVALID_MATCH_SOURCE' });
  assert.deepEqual(project([exit, back], { ...match, rngState: 1 }),
    { ok: false, error: 'INVALID_MATCH_SOURCE' });
  assert.deepEqual(project([exit, back], { ...match, events: [...match.events].reverse() }),
    { ok: false, error: 'INVALID_MATCH_SOURCE' });
});

test('projection preserves prematch and medical facts without mutation', () => {
  const original = structuredClone(prematch);
  const medical = structuredClone([exit, back]);
  const medicalOriginal = structuredClone(medical);
  examine(prematch, [], medical);
  assert.deepEqual(prematch, original);
  assert.deepEqual(medical, medicalOriginal);
});
