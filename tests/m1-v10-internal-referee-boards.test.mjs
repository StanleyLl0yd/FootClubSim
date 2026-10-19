import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V10WithInternalGoalBoards }
  from '../dist/core/m1-v10-internal-referee-boards.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
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
const players = new Map(catalog.players.map(p => [p.id, p]));
const homeOut = home.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const homeIn = home.bench.filter(id => players.get(id).primaryPosition !== 'GK');
const awayOut = away.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const awayIn = away.bench.filter(id => players.get(id).primaryPosition !== 'GK');
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const input = seed => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const command = (i, side = 'home') => ({
  schemaVersion: 1, kind: 'substitute-normal',
  fixtureId: fixture.id, commandId: 'virtual-change-' + side + i,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  elapsedSeconds: 300, actor: {kind:'player'},
  stoppage: 'referee-authorized',
  outPlayerId: side === 'home' ? homeOut[i] : awayOut[i],
  inPlayerId: side === 'home' ? homeIn[i] : awayIn[i],
});
const run = (commands = [], seed = 645) =>
  simulateM1V10WithInternalGoalBoards(input(seed), policy, commands, [], []);
function accept(result) {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 450));
  return result;
}
function reject(result, expected) {
  assert.equal(result.ok, false);
  assert.equal(result.error, expected, JSON.stringify(result).slice(0, 300));
}
test('in-game virtual referee issues one immediate board after its own generated goal', () => {
  const commands = [command(0)];
  const before = structuredClone(commands);
  const output = accept(run(commands));
  assert.equal(output.status, 'INTERNAL_GOAL_BOARD_INSTANT_DEPARTURE_PROTOTYPE');
  assert.equal(output.source, 'INTERNAL_DETERMINISTIC_V8_EVENTS');
  assert.equal(output.normalSubstitutionCount, 1);
  assert.equal(output.boardGroups.length, 1);
  assert.equal(output.boardGroups[0].checkpointRunningSeconds, 300);
  assert.deepEqual(output.boardGroups[0].boardWallSeconds, [0]);
  assert.equal(output.boardGroups[0].simulatedDepartureWallSeconds, 0);
  assert.equal(output.clientRefereeClaimsAccepted, false);
  assert.equal(output.physicalExitTimeCalibrated, false);
  const baseline = simulateM1V8MedicalPhases(input(645), policy, commands, [], []);
  assert.equal(baseline.ok, true);
  assert.deepEqual(output.result, baseline);
  assert.deepEqual(commands, before);
});
test('same-stop team changes produce one last-board deadline for all players', () => {
  const commands = [command(0), command(1)];
  const output = accept(run(commands));
  assert.equal(output.normalSubstitutionCount, 2);
  assert.equal(output.boardGroups.length, 1);
  assert.equal(output.boardGroups[0].issuedSignalIds.length, 2);
  assert.deepEqual(output.boardGroups[0].boardWallSeconds, [0, 1]);
  assert.equal(output.boardGroups[0].simulatedDepartureWallSeconds, 1);
  assert.equal(output.result.onFieldAtFullTime.home.includes(homeIn[0]), true);
  assert.equal(output.result.onFieldAtFullTime.home.includes(homeIn[1]), true);
});
test('both teams can use the same internally established restart independently', () => {
  const commands = [command(0, 'home'), command(0, 'away')];
  const output = accept(run(commands));
  assert.equal(output.normalSubstitutionCount, 2);
  assert.equal(output.boardGroups.length, 2);
  assert.deepEqual(new Set(output.boardGroups.map(x => x.teamId)),
    new Set([fixture.homeClubId, fixture.awayClubId]));
  assert.equal(output.boardGroups[0].stoppageId,
    output.boardGroups[1].stoppageId);
});
test('no goal means no board, regardless of user-controlled referee-authorized text', () => {
  reject(run([command(0)], 49), 'NO_ENGINE_GOAL_STOPPAGE');
  reject(run([{...command(0), stoppage: 'half-time',
    elapsedSeconds: 2700}]), 'UNSUPPORTED_SUBSTITUTION_CONTEXT');
});
test('without substitutes the model remains bit-identical to original v8', () => {
  const output = accept(run());
  assert.deepEqual(output.boardGroups, []);
  assert.equal(output.normalSubstitutionCount, 0);
  assert.deepEqual(output.result, simulateM1V8MedicalPhases(
    input(645), policy, [], [], []));
});
test('malicious getters, cyclic data, untrusted substitutions reject before any referee action', () => {
  let calls = 0;
  const unsafe = { ...input(645), fixture: { ...fixture } };
  Object.defineProperty(unsafe.fixture, 'id', {
    enumerable: true, get() { calls++; return fixture.id; },
  });
  reject(simulateM1V10WithInternalGoalBoards(
    unsafe, policy, [command(0)], [], []), 'INVALID_SOURCE');
  assert.equal(calls, 0);
  const cycle = [command(0)];
  cycle[0].recursive = cycle;
  reject(run(cycle), 'INVALID_SOURCE');
  reject(run([{ ...command(0), outPlayerId: awayOut[0] }]),
    'MATCH_REJECTED');
  reject(run([{ ...command(0), actor: {kind:'staff', staffId:'forged'} }]),
    'MATCH_REJECTED');
});
