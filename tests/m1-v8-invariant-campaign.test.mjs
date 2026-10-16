import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V8MedicalPhases, verifyM1V8MedicalResult }
  from '../dist/core/m1-v8-medical-phases.js';
import { simulateM1V7Phases }
  from '../dist/core/m1-v7-adjudications.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const SEEDS = Array.from({ length: 32 }, (_, i) => i + 1);
const catalog = createSyntheticRplScaleCatalog(77);
const fixtureCorpus = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures).filter((_, i) => i % 8 === 0).slice(0, 8);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function source(fixture, seed) {
  return {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog,
    homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
  };
}
function special(input) {
  const home = input.homeLineup.starters.find(id => positions.get(id) !== 'GK');
  const away = input.awayLineup.starters.find(id => positions.get(id) !== 'GK');
  return [
    { schemaVersion: 1, decisionId: 'v8-corpus-penalty', fixtureId: input.fixture.id,
      teamId: input.fixture.homeClubId, playerId: home,
      elapsedSeconds: 600, kind: 'penalty-kick', outcome: 'scored' },
    { schemaVersion: 1, decisionId: 'v8-corpus-own', fixtureId: input.fixture.id,
      teamId: input.fixture.homeClubId, playerId: away,
      elapsedSeconds: 900, kind: 'own-goal' },
  ];
}
function treatment(input) {
  const playerId = input.homeLineup.starters.find(id => positions.get(id) !== 'GK');
  return [
    { schemaVersion: 1, id: 'v8-corpus-exit', fixtureId: input.fixture.id,
      teamId: input.fixture.homeClubId, playerId, elapsedSeconds: 0,
      kind: 'treatment-exit', reason: 'medical-staff-entered',
      restartAtRunningSeconds: 15 },
    { schemaVersion: 1, id: 'v8-corpus-return', fixtureId: input.fixture.id,
      teamId: input.fixture.homeClubId, playerId, elapsedSeconds: 300,
      kind: 'treatment-return', returnContext: 'running-clock', ballInPlay: true,
      entryBoundary: 'touchline', refereeSignalId: 'external-proof-required' },
  ];
}
function assertTotals(result, input) {
  for (const side of ['home', 'away']) {
    const teamId = side === 'home' ? input.fixture.homeClubId : input.fixture.awayClubId;
    const shots = result.events.filter(e => e.type === 'shot' && e.teamId === teamId);
    const decisions = result.events.filter(e => e.type === 'adjudication' &&
      e.decision.teamId === teamId).map(e => e.decision);
    const penalties = decisions.filter(d => d.kind === 'penalty-kick');
    const own = decisions.filter(d => d.kind === 'own-goal');
    const openGoals = shots.filter(e => e.outcome === 'goal').length;
    const penaltyGoals = penalties.filter(e => e.outcome === 'scored').length;
    const recorded = result.report[side];
    assert.equal(recorded.xgMilli, shots.reduce((a, e) => a + e.xgMilli, 0));
    assert.equal(recorded.openPlayGoals, openGoals);
    assert.equal(recorded.penaltyGoals, penaltyGoals);
    assert.equal(recorded.ownGoalsFor, own.length);
    assert.equal(recorded.goals, openGoals + penaltyGoals + own.length);
    assert.equal(recorded.shots, shots.length + penalties.length);
    assert.equal(recorded.penaltiesTaken, penalties.length);
    assert.equal(recorded.xgCoverage, 'open-play-only');
  }
}

test('32 seeds across 8 fixtures: v7 parity and v8 medical presence invariants', () => {
  for (const seed of SEEDS) {
    const input = source(fixtureCorpus[(seed - 1) % fixtureCorpus.length], seed);
    const decisions = special(input), medical = treatment(input);
    const old = simulateM1V7Phases(input, policy, [], decisions);
    assert.equal(old.ok, true, 'v7 source seed ' + seed);
    const untouched = simulateM1V8MedicalPhases(input, policy, [], decisions, []);
    assert.equal(untouched.ok, true, 'v8 no-med seed ' + seed);
    assert.deepEqual(untouched.report, old.report, 'no-med score parity ' + seed);
    assert.equal(untouched.rngState, old.base.rngState);
    assert.equal(untouched.rngDraws, 90);
    const next = simulateM1V8MedicalPhases(input, policy, [], decisions, medical);
    assert.equal(next.ok, true, 'v8 medical seed ' + seed + ': ' + JSON.stringify(next));
    assert.equal(next.rngDraws, 90);
    assert.deepEqual(next.offFieldAtFullTime, []);
    assert.equal(next.onFieldAtFullTime.home.length, 11);
    assert.equal(next.onFieldAtFullTime.away.length, 11);
    const absentId = medical[0].playerId;
    assert.equal(next.events.some(e => e.type === 'shot' &&
      e.elapsedSeconds === 299 && e.playerId === absentId), false);
    assert.equal(next.events.filter(e => e.type === 'medical').length, 2);
    assert.equal(next.events.filter(e => e.type === 'adjudication').length, 2);
    assertTotals(next, input);
    assert.equal(verifyM1V8MedicalResult(input, policy, [], decisions, medical, next), true);
    assert.equal(verifyM1V8MedicalResult(input, policy, [], decisions, [],
      next), false);
    assert.equal(verifyM1V8MedicalResult(input, policy, [], decisions, medical,
      { ...next, report: { ...next.report,
        home: { ...next.report.home, goals: next.report.home.goals + 1 } } }), false);
  }
});
