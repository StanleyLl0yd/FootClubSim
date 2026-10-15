import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V6Phases } from '../dist/core/m1-phases-v6.js';
import { deriveM1V6Ledger } from '../dist/core/m1-v6-ledger.js';
import { deriveM1VerifiedV6AppearanceReport }
  from '../dist/core/m1-v6-appearance-report.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const teams = new Map(catalog.clubs.map(c => [c.id, c]));
const homeLineup = defaultSyntheticLineup(teams.get(fixture.homeClubId));
const awayLineup = defaultSyntheticLineup(teams.get(fixture.awayClubId));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const homeOut = homeLineup.starters.filter(id => positions.get(id) !== 'GK');
const awayOut = awayLineup.starters.filter(id => positions.get(id) !== 'GK');
const homeBench = homeLineup.bench.filter(id => positions.get(id) !== 'GK');
const awayBench = awayLineup.bench.filter(id => positions.get(id) !== 'GK');
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup, awayLineup,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 1,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: {
    assignedActor: { kind: 'staff', staffId: 'away-coach' },
    availableStaffIds: ['away-coach'],
  },
};
const seeds = [...Array.from({ length: 28 }, (_, i) => i + 1),
  77, 99, 255, 1023, 0x7fffffff, 0xffffffff];
function incident(id, at, playerId, kind) {
  return {
    schemaVersion: 1, id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId, elapsedSeconds: at, kind,
    origin: kind === 'injury-withdrawal' ? 'trusted-medical' : 'trusted-referee',
  };
}
function substitute(id, at, teamId, actor, outPlayerId, inPlayerId) {
  return {
    schemaVersion: 1, commandId: id, fixtureId: fixture.id, teamId,
    elapsedSeconds: at, kind: 'substitute-normal', actor,
    outPlayerId, inPlayerId,
    stoppage: at === 2700 ? 'half-time' : 'referee-authorized',
  };
}
const mixed = [
  substitute('home-sub', 300, fixture.homeClubId, { kind: 'player' },
    homeOut[0], homeBench[0]),
  incident('new-caution', 300, homeBench[0], 'caution'),
  incident('new-dismissal', 600, homeBench[0], 'direct-red'),
  incident('medical-out', 900, homeOut[1], 'injury-withdrawal'),
  substitute('away-break', 2700, fixture.awayClubId,
    { kind: 'staff', staffId: 'away-coach' }, awayOut[0], awayBench[0]),
];
function run(seed, commands) {
  const source = { ...prematch, rngSeed: seed };
  const result = simulateM1V6Phases(source, policy, commands);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 190));
  const score = deriveM1V6Ledger(source, policy, result.events);
  assert.equal(score.ok, true);
  if (score.ok) assert.deepEqual(score.report, result.report);
  const appearance = deriveM1VerifiedV6AppearanceReport(source, policy, commands, result);
  assert.equal(appearance.ok, true, JSON.stringify(appearance).slice(0, 200));
  assert.equal(result.rngDraws, 90);
  const rng = new SeededRng(seed);
  for (let i = 0; i < 90; i++) rng.nextFloat();
  assert.equal(result.rngState, rng.snapshot());
  assert.ok(result.events.every((event, i) => event.sequence === i + 1));
  assert.equal(result.events.at(-1).type, 'full-time');
  return { source, result, appearance: appearance.report };
}

test('independent v6 seed cohort conserves RNG, score, named goals and time', () => {
  let shots = 0, goals = 0;
  const previous = JSON.stringify(prematch);
  const originalCatalog = JSON.stringify(catalog);
  for (const seed of seeds) {
    const { source, result, appearance } = run(seed, []);
    assert.deepEqual(simulateM1V6Phases(source, policy), result);
    assert.equal(result.events.filter(e => e.type === 'availability').length, 0);
    assert.equal(appearance.appearances.length, 22);
    assert.equal(appearance.teams.home.playedSeconds, 59400);
    assert.equal(appearance.teams.away.playedSeconds, 59400);
    assert.equal(appearance.teams.home.dismissals, 0);
    assert.equal(appearance.teams.away.dismissals, 0);
    const attempts = result.events.filter(e => e.type === 'shot');
    const scores = attempts.filter(e => e.outcome === 'goal');
    shots += attempts.length;
    goals += scores.length;
    assert.equal(appearance.goals.length, scores.length);
    assert.equal(appearance.appearances.reduce((n, p) => n + p.shots, 0),
      attempts.length);
    assert.equal(appearance.appearances.reduce((n, p) => n + p.xgMilli, 0),
      attempts.reduce((n, e) => n + e.xgMilli, 0));
  }
  assert.ok(shots > 0 && goals > 0);
  assert.equal(JSON.stringify(prematch), previous);
  assert.equal(JSON.stringify(catalog), originalCatalog);
});
test('mixed same-tick substitution/card and later referee decisions preserve eligibility', () => {
  const originalCommands = JSON.stringify(mixed);
  for (const seed of seeds) {
    const { source, result, appearance } = run(seed, mixed);
    assert.deepEqual(simulateM1V6Phases(source, policy, mixed), result);
    const byId = new Map(appearance.appearances.map(p => [p.playerId, p]));
    assert.equal(byId.get(homeOut[0]).playedSeconds, 300);
    assert.equal(byId.get(homeBench[0]).playedSeconds, 300);
    assert.equal(byId.get(homeBench[0]).yellowCards, 1);
    assert.equal(byId.get(homeBench[0]).dismissal, 'straight-red');
    assert.equal(byId.get(homeOut[1]).playedSeconds, 900);
    assert.equal(byId.get(homeOut[1]).medicalWithdrawn, true);
    assert.equal(byId.get(awayOut[0]).playedSeconds, 2700);
    assert.equal(byId.get(awayBench[0]).playedSeconds, 2700);
    assert.equal(appearance.teams.home.normalSubstitutions, 1);
    assert.equal(appearance.teams.home.dismissals, 1);
    assert.equal(appearance.teams.home.medicalWithdrawals, 1);
    assert.equal(appearance.teams.home.playedSeconds,
      59400 - (5400 - 600) - (5400 - 900));
    assert.ok(result.events.filter(e => e.type === 'shot' && e.elapsedSeconds >= 300)
      .every(e => e.playerId !== homeOut[0]));
    assert.ok(result.events.filter(e => e.type === 'shot' && e.elapsedSeconds >= 600)
      .every(e => e.playerId !== homeBench[0]));
    assert.ok(result.events.filter(e => e.type === 'shot' && e.elapsedSeconds >= 900)
      .every(e => e.playerId !== homeOut[1]));
    assert.ok(result.events.filter(e => e.type === 'shot' && e.elapsedSeconds >= 2700)
      .every(e => e.playerId !== awayOut[0]));
  }
  assert.equal(JSON.stringify(mixed), originalCommands);
});
test('v6 tamper corpus rejects false availability, score, seed and event history', () => {
  for (const seed of [1, 3, 7, 13, 42, 1023, 0xffffffff]) {
    const { source, result } = run(seed, mixed);
    for (const candidate of [
      { ...result, rngState: 0 },
      { ...result, rngDraws: 85 },
      { ...result, events: result.events.slice(1) },
      { ...result, events: [...result.events, { type: 'penalty-goal' }] },
      { ...result, report: { ...result.report,
        away: { ...result.report.away, goals: 100 } } },
      { ...result, availability: { ...result.availability, status: 'below-seven' } },
      { ...result, source: undefined },
    ]) {
      assert.deepEqual(deriveM1VerifiedV6AppearanceReport(
        source, policy, mixed, candidate), { ok: false, error: 'INVALID_MATCH_SOURCE' });
    }
    assert.deepEqual(deriveM1VerifiedV6AppearanceReport(
      source, policy, [...mixed].reverse(), result),
    { ok: false, error: 'INVALID_MATCH_SOURCE' });
  }
});
