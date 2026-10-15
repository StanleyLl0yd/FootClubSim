import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveM1SyntheticUnrankedTotals, M1_SYNTHETIC_STANDINGS_SCHEMA_VERSION,
} from '../dist/core/m1-standings.js';
import {
  applyM1MatchResultBatch, startM1MatchResultJournal,
} from '../dist/core/m1-result-journal.js';
import { simulateM1V5Phases } from '../dist/core/m1-phases-v5.js';
import { createInitialCareer } from '../dist/core/save.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const initial = createInitialCareer(catalog, catalog.clubs[0].id, 42, 'standings-career');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function requireGood(result) {
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 160));
  if (!result.ok) throw Error(result.error);
  return result;
}
function request(fixture, seed, expectedRevision) {
  const prematch = {
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
  const result = requireGood(simulateM1V5Phases(prematch, policy));
  return {
    schemaVersion: 1, commandId: 'apply-' + fixture.id,
    careerId: initial.careerId, expectedRevision,
    prematch, policy, plannedCommands: [], result,
  };
}
function fresh() {
  return requireGood(startM1MatchResultJournal(initial)).journal;
}
function batch(count) {
  const commands = fixtures.slice(0, count)
    .map((fixture, i) => request(fixture, i + 1, i));
  return requireGood(applyM1MatchResultBatch(initial, fresh(), commands)).journal;
}

test('empty official-unranked table starts with all 16 original clubs and zero statistics', () => {
  assert.equal(M1_SYNTHETIC_STANDINGS_SCHEMA_VERSION, 1);
  const result = requireGood(deriveM1SyntheticUnrankedTotals(initial, fresh()));
  assert.equal(result.totals.status, 'UNRANKED_SYNTHETIC_NOT_OFFICIAL_RPL');
  assert.equal(result.totals.revision, 0);
  assert.equal(result.totals.completedFixtures, 0);
  assert.deepEqual(result.totals.clubs.map(c => c.clubId),
    catalog.clubs.map(c => c.id), 'original source order, NOT league ranking');
  assert.equal(result.totals.clubs.length, 16);
  assert.ok(result.totals.clubs.every(c =>
    c.played === 0 && c.points === 0 && c.goalDifference === 0));
});

test('three validated matches contribute exactly six team appearances and conserved goals', () => {
  const journal = batch(3);
  const result = requireGood(deriveM1SyntheticUnrankedTotals(initial, journal));
  const rows = result.totals.clubs;
  assert.equal(result.totals.revision, 3);
  assert.equal(result.totals.completedFixtures, 3);
  assert.equal(rows.reduce((sum, row) => sum + row.played, 0), 6);
  const scored = rows.reduce((sum, row) => sum + row.goalsFor, 0);
  const conceded = rows.reduce((sum, row) => sum + row.goalsAgainst, 0);
  assert.equal(scored, conceded);
  assert.equal(rows.reduce((sum, row) => sum + row.goalDifference, 0), 0);
  const allWins = rows.reduce((sum, row) => sum + row.won, 0);
  const allLosses = rows.reduce((sum, row) => sum + row.lost, 0);
  const allDraws = rows.reduce((sum, row) => sum + row.drawn, 0);
  assert.equal(allWins, allLosses);
  assert.equal(rows.reduce((sum, row) => sum + row.points, 0),
    allWins * 3 + allDraws);
  assert.ok(rows.every(c => c.played === c.won + c.drawn + c.lost));
  for (const match of journal.results) {
    const home = rows.find(c => c.clubId === match.homeClubId);
    const away = rows.find(c => c.clubId === match.awayClubId);
    assert.ok(home.played >= 1 && away.played >= 1);
  }
});

test('seeded scoreless draw gives both clubs exactly one synthetic point', () => {
  const fixture = fixtures[0];
  let picked = null;
  for (let seed = 1; seed <= 60; seed++) {
    const candidate = request(fixture, seed, 0);
    if (candidate.result.report.home.goals === 0 &&
        candidate.result.report.away.goals === 0) {
      picked = candidate; break;
    }
  }
  assert.ok(picked);
  const after = requireGood(applyM1MatchResultBatch(initial, fresh(), [picked])).journal;
  const table = requireGood(deriveM1SyntheticUnrankedTotals(initial, after)).totals;
  const homeRow = table.clubs.find(x => x.clubId === fixture.homeClubId);
  const awayRow = table.clubs.find(x => x.clubId === fixture.awayClubId);
  assert.equal(homeRow.points, 1);
  assert.equal(awayRow.points, 1);
  assert.equal(homeRow.drawn, 1);
  assert.equal(awayRow.drawn, 1);
  assert.equal(homeRow.won, 0);
  assert.equal(awayRow.won, 0);
});

test('aggregates are byte-identical across serialized journal roundtrips', () => {
  const journal = batch(5);
  const before = JSON.stringify(journal);
  const a = requireGood(deriveM1SyntheticUnrankedTotals(initial, journal)).totals;
  const b = requireGood(deriveM1SyntheticUnrankedTotals(
    structuredClone(initial), JSON.parse(JSON.stringify(journal)))).totals;
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(journal), before);
  assert.equal(a.completedFixtures, 5);
});

test('tampered journal, alien catalog and unsupported revision are rejected', () => {
  const journal = batch(1);
  const invalid = [
    { ...journal, revision: 2 },
    { ...journal, careerId: 'other' },
    { ...journal, results: [{ ...journal.results[0], fixtureId: 'invented' }] },
    { ...journal, results: [{ ...journal.results[0], report: {
      ...journal.results[0].report,
      home: { ...journal.results[0].report.home, shotsOnTarget: 25 },
    } }] },
  ];
  for (const changed of invalid) {
    assert.deepEqual(deriveM1SyntheticUnrankedTotals(initial, changed),
      { ok: false, error: 'INVALID_JOURNAL' });
  }
  assert.deepEqual(deriveM1SyntheticUnrankedTotals(
    { ...initial, revision: 1 }, journal),
    { ok: false, error: 'INVALID_INITIAL_CAREER' });
});
