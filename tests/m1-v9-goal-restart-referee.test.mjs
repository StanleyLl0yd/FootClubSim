import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V9GoalRestartSubstitutions }
  from '../dist/core/m1-v9-goal-restart-referee.js';
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
const player = new Map(catalog.players.map(p => [p.id, p]));
const outgoing = home.starters.filter(id => player.get(id).primaryPosition !== 'GK');
const incoming = home.bench.filter(id => player.get(id).primaryPosition !== 'GK');
const input = (seed = 645) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const command = i => ({
  schemaVersion: 1, commandId: 'change-' + i,
  fixtureId: fixture.id, teamId: fixture.homeClubId,
  kind: 'substitute-normal', elapsedSeconds: 300,
  actor: { kind: 'player' }, stoppage: 'referee-authorized',
  outPlayerId: outgoing[i], inPlayerId: incoming[i],
});
const single = () => ({
  schemaVersion: 1, fixtureId: fixture.id,
  teamId: fixture.homeClubId, outPlayerId: outgoing[0],
  inPlayerId: incoming[0], refereeSignalId: 'reported-board-1',
  groupSize: 1, signalWallSeconds: 100, exitWallSeconds: 110,
  restartRunningSeconds: 300,
});
const grouped = () => ({
  schemaVersion: 2, kind: 'group-normal-departures',
  fixtureId: fixture.id, teamId: fixture.homeClubId,
  stoppageId: 'reported-stoppage', finalSignalWallSeconds: 103,
  restartRunningSeconds: 300,
  departures: [0, 1].map((i) => ({
    outPlayerId: outgoing[i], inPlayerId: incoming[i],
    refereeSignalId: 'board-' + i,
    signalWallSeconds: 100 + i * 3,
    exitWallSeconds: 110 + i * 3,
  })),
});
const run = (commands, claims, seed = 645) =>
  simulateM1V9GoalRestartSubstitutions(
    input(seed), policy, commands, [], [], claims);
const dossier = claim => [{ checkpointSeconds: 300, evidence: claim }];
const reject = (value, error) =>
  assert.equal(value.error, error, JSON.stringify(value).slice(0, 240));

test('seeded v8 goal at phase 1 end provides an internal Law 8 restart candidate', () => {
  const game = simulateM1V8MedicalPhases(input(), policy, [], [], []);
  assert.equal(game.ok, true, JSON.stringify(game));
  const opening = game.events.find(e => e.type === 'shot' && e.elapsedSeconds === 299);
  assert.equal(opening?.outcome, 'goal');
  const admissible = run([command(0)], dossier(single()));
  assert.equal(admissible.ok, true, JSON.stringify(admissible));
  assert.equal(admissible.refereeOrigin, 'INTERNAL_V8_REPLAY');
  assert.equal(admissible.normalSubstitutionCount, 1);
  assert.equal(admissible.acceptedStoppageGroups, 1);
  assert.equal(admissible.restartEvidence[0].goalRunningSeconds, 299);
  assert.equal(admissible.restartEvidence[0].candidateRestartRunningSeconds, 300);
  assert.equal(admissible.restartEvidence[0].shotEventId, opening.id);
  assert.equal(admissible.wallClockTimingAuthenticated, false);
  assert.equal(admissible.fullLaw8RestartProcedureVerified, false);
  assert.equal(admissible.result.events.some(e =>
    e.type === 'shot' && e.elapsedSeconds === 299 && e.outcome === 'goal'), true);
});

test('no goal at preceding phase cannot create a legal stoppage from manager text', () => {
  const seed = 49; // phase-0 draw for attempt is >0.75 (max chance).
  const game = simulateM1V8MedicalPhases(input(seed), policy, [], [], []);
  assert.equal(game.ok, true);
  assert.equal(game.events.some(e =>
    e.type === 'shot' && e.elapsedSeconds === 299), false);
  reject(run([command(0)], dossier(single()), seed),
    'MISSING_ENGINE_GOAL_RESTART');
});

test('two same-team replacements need one legal goal and one grouped board dossier', () => {
  const commands = [command(0), command(1)];
  const prior = structuredClone(commands);
  const result = run(commands, dossier(grouped()));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.normalSubstitutionCount, 2);
  assert.equal(result.acceptedStoppageGroups, 1);
  assert.deepEqual(commands, prior);
  reject(run(commands, dossier(single())), 'TIMING_ADMISSION_REJECTED');
});

test('reported late exit fails despite legitimate internal goal', () => {
  const late = single();
  late.exitWallSeconds = 111;
  const result = run([command(0)], dossier(late));
  reject(result, 'TIMING_ADMISSION_REJECTED');
  assert.equal(result.timingError, 'LATE_REQUIRES_REFEREE_RULING');
});

test('unsupported half-time, bogus source and untrusted JSON refuse', () => {
  reject(run([{ ...command(0), elapsedSeconds: 2700,
    stoppage: 'half-time' }], []), 'UNSUPPORTED_HALF_TIME');
  reject(run([command(0)], []), 'TIMING_ADMISSION_REJECTED');
  reject(run([{ ...command(0), elapsedSeconds: 301 }],
    dossier(single())), 'INVALID_COMMANDS');
  let getterCalls = 0;
  const attacker = command(0);
  Object.defineProperty(attacker, 'kind', {
    enumerable: true, get() { getterCalls++; return 'substitute-normal'; },
  });
  reject(run([attacker], dossier(single())), 'INVALID_COMMANDS');
  assert.equal(getterCalls, 0);
  const cycle = [command(0)];
  cycle[0].loop = cycle;
  reject(run(cycle, dossier(single())), 'INVALID_COMMANDS');
});

test('no substitutions still reuses original v8 RNG and all goal timestamps', () => {
  const initial = input();
  const game = simulateM1V8MedicalPhases(initial, policy, [], [], []);
  assert.equal(game.ok, true);
  const selected = run([], []);
  assert.equal(selected.ok, true, JSON.stringify(selected));
  assert.deepEqual(selected.result, game);
  assert.equal(selected.acceptedStoppageGroups, 0);
  const goals = game.events.filter(e => e.type === 'shot' &&
    e.outcome === 'goal' && e.elapsedSeconds < 5399);
  assert.equal(selected.restartEvidence.length, goals.length);
});
