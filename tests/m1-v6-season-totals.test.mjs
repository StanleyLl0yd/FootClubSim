import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1V6UnrankedSeasonTotals, M1_V6_TOTALS_SCHEMA_VERSION }
  from '../dist/core/m1-v6-season-totals.js';
import { startM1V6MatchJournal, applyM1V6MatchResult }
  from '../dist/core/m1-v6-result-journal.js';
import { startM1MatchResultJournal } from '../dist/core/m1-result-journal.js';
import { simulateM1V6Phases } from '../dist/core/m1-phases-v6.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { createInitialCareer } from '../dist/core/save.js';

const catalog = createSyntheticRplScaleCatalog(77);
const career = createInitialCareer(catalog, catalog.clubs[0].id, 88, 'v6-totals-career');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function prematch(fixture, seed) {
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
function create(journal, fixture, seed, commands = []) {
  const source = prematch(fixture, seed);
  const match = simulateM1V6Phases(source, policy, commands);
  assert.equal(match.ok, true, JSON.stringify(match).slice(0, 220));
  const command = {
    schemaVersion: 2, commandId: 'commit-' + journal.revision,
    careerId: career.careerId, expectedRevision: journal.revision,
    prematch: source, policy, plannedCommands: commands, result: match,
  };
  const result = applyM1V6MatchResult(career, journal, command);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 220));
  return result.journal;
}
function totals(journal) {
  const result = deriveM1V6UnrankedSeasonTotals(career, journal);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 220));
  return result.totals;
}
test('empty v6 season keeps original pack order and no imaginary league ranking', () => {
  const original = startM1V6MatchJournal(career);
  assert.equal(original.ok, true);
  const value = totals(original.journal);
  assert.equal(M1_V6_TOTALS_SCHEMA_VERSION, 1);
  assert.equal(value.status, 'UNRANKED_SYNTHETIC_V6_NO_CAREER_SANCTIONS');
  assert.equal(value.revision, 0);
  assert.equal(value.completedFixtures, 0);
  assert.deepEqual(value.clubs.map(c => c.clubId), catalog.clubs.map(c => c.id));
  assert.ok(value.clubs.every(c => c.played === 0 && c.points === 0 &&
    c.yellowCards === 0 && c.playedSeconds === 0));
});
test('v6 full-time games conserve shots, goals, discipline, minutes and points', () => {
  const started = startM1V6MatchJournal(career);
  assert.equal(started.ok, true);
  const source = prematch(fixtures[0], 42);
  const p = source.homeLineup.starters.find(id =>
    catalog.players.find(player => player.id === id).primaryPosition !== 'GK');
  const card = {
    schemaVersion: 1, id: 'warning', fixtureId: source.fixture.id,
    teamId: source.fixture.homeClubId, playerId: p,
    elapsedSeconds: 300, kind: 'caution', origin: 'trusted-referee',
  };
  const red = { ...card, id: 'dismissal', elapsedSeconds: 600, kind: 'direct-red' };
  const first = create(started.journal, fixtures[0], 42, [card, red]);
  const second = create(first, fixtures[1], 43);
  const report = totals(second);
  assert.equal(report.completedFixtures, 2);
  assert.equal(report.revision, 2);
  const sum = key => report.clubs.reduce((n, c) => n + c[key], 0);
  assert.equal(sum('played'), 4);
  assert.equal(sum('goalsFor'), sum('goalsAgainst'));
  assert.equal(sum('goalsFor'), second.results.reduce((n, r) =>
    n + r.goals.length, 0));
  assert.equal(sum('shots'), second.results.reduce((n, r) =>
    n + r.report.home.shots + r.report.away.shots, 0));
  assert.equal(sum('yellowCards'), 1);
  assert.equal(sum('dismissals'), 1);
  assert.equal(sum('playedSeconds'), 4 * 11 * 5400 - (5400 - 600));
  assert.ok(sum('points') >= 4 && sum('points') <= 6);
  assert.equal(second.results.length, 2);
  assert.equal(started.journal.revision, 0);
  assert.ok(!('suspensionMatches' in report.clubs[0]));
});
test('tampered journal, incompatible v5 journal or modified initial source fail closed', () => {
  const started = startM1V6MatchJournal(career);
  const previous = startM1MatchResultJournal(career);
  assert.equal(started.ok, true);
  assert.equal(previous.ok, true);
  assert.deepEqual(deriveM1V6UnrankedSeasonTotals(career, previous.journal),
    { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(deriveM1V6UnrankedSeasonTotals({ ...career, revision: 1 },
    started.journal), { ok: false, error: 'INVALID_INITIAL_CAREER' });
  const committed = create(started.journal, fixtures[0], 22);
  assert.deepEqual(deriveM1V6UnrankedSeasonTotals(career,
    { ...committed, results: [{ ...committed.results[0], rngSeed: -1 }] }),
  { ok: false, error: 'INVALID_JOURNAL' });
});
