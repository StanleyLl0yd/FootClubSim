import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V7Phases } from '../dist/core/m1-v7-adjudications.js';
import { deriveM1VerifiedV7AppearanceReport }
  from '../dist/core/m1-v7-appearance-report.js';
import { deriveM1VerifiedV6AppearanceReport }
  from '../dist/core/m1-v6-appearance-report.js';
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
const homeOut = home.starters.filter(id => positions.get(id) !== 'GK');
const homeBench = home.bench.find(id => positions.get(id) !== 'GK');
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
  away: { assignedActor: { kind: 'staff', staffId: 'away-coach' },
    availableStaffIds: ['away-coach'] },
};
const pen = (id, at, outcome, playerId = homeOut[0]) => ({
  schemaVersion: 1, decisionId: id, fixtureId: fixture.id, elapsedSeconds: at,
  teamId: fixture.homeClubId, playerId, kind: 'penalty-kick', outcome,
});
const own = (id, at) => ({
  schemaVersion: 1, decisionId: id, fixtureId: fixture.id, elapsedSeconds: at,
  teamId: fixture.homeClubId, playerId: awayOut, kind: 'own-goal',
});
function examine(commands = [], decisions = [], input = prematch) {
  const match = simulateM1V7Phases(input, policy, commands, decisions);
  assert.equal(match.ok, true, JSON.stringify(match).slice(0, 200));
  const attributed = deriveM1VerifiedV7AppearanceReport(input, policy,
    commands, decisions, match);
  assert.equal(attributed.ok, true, JSON.stringify(attributed).slice(0, 200));
  return { match, report: attributed.report };
}

test('empty v7 adjudications preserve v6 players, scorers and discipline', () => {
  for (const seed of [1, 42, 777]) {
    const input = { ...prematch, rngSeed: seed };
    const { match, report } = examine([], [], input);
    const old = deriveM1VerifiedV6AppearanceReport(input, policy, [], match.base);
    assert.equal(old.ok, true);
    assert.deepEqual(report.teams, old.report.teams);
    assert.deepEqual(report.match.home, {
      ...match.base.report.home, openPlayGoals: match.base.report.home.goals,
      penaltiesTaken: 0, penaltyGoals: 0, ownGoalsFor: 0,
      xgCoverage: 'open-play-only',
    });
    for (const row of report.appearances) {
      const earlier = old.report.appearances.find(p => p.playerId === row.playerId);
      assert.deepEqual(row, {
        ...earlier, penaltiesTaken: 0, penaltyGoals: 0, ownGoals: 0,
      });
    }
    assert.equal(report.goals.length, old.report.goals.length);
    assert.ok(report.goals.every(g => g.kind === 'open-play'));
  }
});

test('mixed scored, saved, missed penalties and own goal attribute to correct people', () => {
  const decisions = [
    pen('p-score', 300, 'scored'), pen('p-save', 600, 'saved'),
    pen('p-miss', 900, 'missed'), own('own', 1200),
  ];
  const { match, report } = examine([], decisions);
  const kicker = report.appearances.find(p => p.playerId === homeOut[0]);
  const defender = report.appearances.find(p => p.playerId === awayOut);
  const baseKicker = deriveM1VerifiedV6AppearanceReport(
    prematch, policy, [], match.base).report.appearances
    .find(p => p.playerId === homeOut[0]);
  assert.equal(kicker.penaltiesTaken, 3);
  assert.equal(kicker.penaltyGoals, 1);
  assert.equal(kicker.goals, baseKicker.goals + 1);
  assert.equal(kicker.shots, baseKicker.shots + 3);
  assert.equal(kicker.shotsOnTarget, baseKicker.shotsOnTarget + 2);
  assert.equal(kicker.xgMilli, baseKicker.xgMilli);
  assert.equal(defender.ownGoals, 1);
  assert.equal(report.match.home.goals, match.base.report.home.goals + 2);
  assert.equal(report.goals.length, match.base.report.home.goals +
    match.base.report.away.goals + 2);
  assert.deepEqual(report.goals.filter(g => g.kind !== 'open-play'), [
    { kind: 'penalty', eventId: 'm1-v7-decision-p-score',
      teamId: fixture.homeClubId, scorerId: homeOut[0], elapsedSeconds: 300 },
    { kind: 'own-goal', eventId: 'm1-v7-decision-own',
      teamId: fixture.homeClubId, defenderId: awayOut, elapsedSeconds: 1200 },
  ]);
});

test('substitute can become verified penalty taker in match', () => {
  const sub = { schemaVersion: 1, commandId: 'sub', fixtureId: fixture.id,
    teamId: fixture.homeClubId, elapsedSeconds: 300, kind: 'substitute-normal',
    actor: { kind: 'player' }, outPlayerId: homeOut[1], inPlayerId: homeBench,
    stoppage: 'referee-authorized' };
  const { report } = examine([sub], [pen('p-new', 300, 'scored', homeBench)]);
  const row = report.appearances.find(p => p.playerId === homeBench);
  assert.equal(row.started, false);
  assert.equal(row.enteredAtSeconds, 300);
  assert.equal(row.penaltyGoals, 1);
  assert.equal(row.goals >= 1, true);
});

test('forged candidate, altered trusted chronology and unsupported rulings fail closed', () => {
  const decisions = [own('goal', 300)];
  const { match } = examine([], decisions);
  const altered = { ...match, report: { ...match.report,
    home: { ...match.report.home, goals: match.report.home.goals + 1 } } };
  assert.deepEqual(deriveM1VerifiedV7AppearanceReport(prematch, policy,
    [], decisions, altered), { ok: false, error: 'INVALID_MATCH_SOURCE' });
  assert.deepEqual(deriveM1VerifiedV7AppearanceReport(prematch, policy,
    [], [], match), { ok: false, error: 'INVALID_MATCH_SOURCE' });
  assert.deepEqual(deriveM1VerifiedV7AppearanceReport(prematch, policy,
    [], [{ ...pen('bad', 300, 'retake') }], match),
  { ok: false, error: 'INVALID_MATCH_SOURCE' });
});
