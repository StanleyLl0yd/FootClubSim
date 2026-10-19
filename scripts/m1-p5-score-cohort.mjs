#!/usr/bin/env node
/**
 * Fixed-seed 240-fixture v8 scoring diagnostics compared with the ONE
 * corrected 2023/24 development reference. This cannot establish realism:
 * simulated refereed penalties/own goals/cards/injuries are not generated.
 * The reserved 2024/25 holdout is deliberately not imported or read.
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
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

export const M1_P5_SCORE_DEVELOPMENT_REFERENCE = Object.freeze({
  season: '2023/2024',
  sourceRepo: 'openfootball/europe',
  sourceCommit: '63df627f3c87ce71708f016522ea236cf74332c3',
  sourceOriginalSha256:
    '18512df8829a945f2b543a8ed5e8c3259e216263bc3e2a35c5545421d27b59cc',
  evidenceBoundRepairs: 1,
  upstreamRightsVerified: false,
  matches: 240,
  homeWins: 113, draws: 66, awayWins: 61, scoreless: 20,
  homeGoals: 359, awayGoals: 278, totalGoals: 637,
});
const FIELDS = [
  'matches', 'homeWins', 'draws', 'awayWins', 'scoreless',
  'homeGoals', 'awayGoals', 'totalGoals',
];

/** The summary is an observation, never an acceptance test of realism. */
export function compareM1P5ScoreResearchCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).length !== FIELDS.length ||
      FIELDS.some(key => !Object.hasOwn(raw, key) ||
        !Number.isSafeInteger(raw[key]) || raw[key] < 0) ||
      raw.matches < 240 || raw.matches > 1920 ||
      raw.matches % 240 !== 0 ||
      raw.homeWins + raw.draws + raw.awayWins !== raw.matches ||
      raw.homeGoals + raw.awayGoals !== raw.totalGoals ||
      raw.scoreless > raw.draws || raw.totalGoals > raw.matches * 22) {
    throw Error('Invalid complete-season simulation score counts');
  }
  const perMatch = count => count / raw.matches;
  const metrics = ['homeWins', 'draws', 'awayWins', 'scoreless',
    'homeGoals', 'awayGoals', 'totalGoals'];
  const observed = Object.fromEntries(metrics.map(name => [
    name, {syntheticPerMatch: perMatch(raw[name]),
      historical2023PerMatch: M1_P5_SCORE_DEVELOPMENT_REFERENCE[name] / 240,
      exploratoryDeltaPerMatch: perMatch(raw[name]) -
        M1_P5_SCORE_DEVELOPMENT_REFERENCE[name] / 240},
  ]));
  return {
    schemaVersion: 1,
    status: 'NONCOMPARABLE_EVENT_COVERAGE_NOT_CALIBRATED',
    simulationScope: 'SYNTHETIC_PARODY_CATALOG_NOT_REAL_RPL_ROSTERS',
    referenceScope: 'CORRECTED_2023_24_DEVELOPMENT_ONLY',
    reservedUntouchedHoldout: '2024/2025',
    sourceRightsVerified: false,
    generatedPenalties: false,
    generatedOwnGoals: false,
    generatedCards: false,
    generatedInjuries: false,
    empiricalAcceptance: false,
    reason: 'REFERENCE_ALL_GOALS_VS_SYNTHETIC_OPEN_PLAY_ONLY',
    reference: M1_P5_SCORE_DEVELOPMENT_REFERENCE,
    observed,
  };
}

export function runM1P5FullSyntheticScoreCohort(
  { firstSeed = 1, seasonCount = 1 } = {},
) {
  if (!Number.isSafeInteger(firstSeed) || firstSeed < 1 ||
      !Number.isSafeInteger(seasonCount) || seasonCount < 1 ||
      seasonCount > 8 ||
      firstSeed + seasonCount * 240 - 1 > 0xffffffff) {
    throw Error('Invalid cohort plan: 1..8 full seasons, safe seed interval');
  }
  const catalog = createSyntheticRplScaleCatalog(77);
  const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
    .flatMap(round => round.fixtures);
  if (fixtures.length !== 240 ||
      new Set(fixtures.map(f => f.id)).size !== 240) {
    throw Error('Incomplete synthetic 16-team fixture schedule');
  }
  const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
  const policy = {
    home: {assignedActor: {kind: 'player'}, availableStaffIds: []},
    away: {assignedActor: {kind: 'player'}, availableStaffIds: []},
  };
  const totals = { matches: 0, homeWins: 0, draws: 0, awayWins: 0,
    scoreless: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 };
  const fingerprint = createHash('sha256');
  for (let season = 0; season < seasonCount; season++) {
    for (let index = 0; index < fixtures.length; index++) {
      const fixture = fixtures[index], seed = firstSeed +
        season * fixtures.length + index;
      const source = {
        schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
        rulesPackId: M0_RULES_PACK_ID,
        rulesPackVersion: M0_RULES_PACK_VERSION,
        fixture, catalog,
        homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
        awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
        homeTactics: defaultTacticalPlan(fixture.homeClubId),
        awayTactics: defaultTacticalPlan(fixture.awayClubId),
        rosterRules: {starterCount: 11, maxBench: 12, maxForeignersOnField: 7},
        rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
      };
      const simulated = simulateM1V8MedicalPhases(source, policy, [], [], []);
      if (!simulated.ok || simulated.rngDraws !== 90 ||
          simulated.report.home.xgCoverage !== 'open-play-only' ||
          simulated.report.away.xgCoverage !== 'open-play-only') {
        throw Error('Synthetic v8 calculation failed or emitted unsupported events');
      }
      const h = simulated.report.home, a = simulated.report.away;
      if (h.penaltyGoals !== 0 || a.penaltyGoals !== 0 ||
          h.ownGoalsFor !== 0 || a.ownGoalsFor !== 0 ||
          h.goals !== h.openPlayGoals || a.goals !== a.openPlayGoals) {
        throw Error('Unsupported special goals appeared in baseline cohort');
      }
      totals.matches++;
      totals.homeWins += Number(h.goals > a.goals);
      totals.draws += Number(h.goals === a.goals);
      totals.awayWins += Number(h.goals < a.goals);
      totals.scoreless += Number(h.goals === 0 && a.goals === 0);
      totals.homeGoals += h.goals;
      totals.awayGoals += a.goals;
      totals.totalGoals += h.goals + a.goals;
      fingerprint.update([season, fixture.id, seed, h.goals,
        a.goals, simulated.rngState].join('|') + '\n');
    }
  }
  return {
    schemaVersion: 1,
    engineVersion: 'm1-v8-research',
    firstSeed, lastSeed: firstSeed + totals.matches - 1,
    seasonCount, fixtureCountPerSeason: 240,
    counts: totals,
    reproducibilitySha256: fingerprint.digest('hex'),
    comparison: compareM1P5ScoreResearchCounts(totals),
  };
}
function main(args) {
  if (args.length > 2 || args.some(arg =>
      !/^--(?:first-seed|seasons)=[0-9]{1,10}$/.test(arg)) ||
      new Set(args.map(a => a.split('=')[0])).size !== args.length) {
    throw Error('Usage: node scripts/m1-p5-score-cohort.mjs [--seasons=1] [--first-seed=1]');
  }
  const get = (name, fallback) => {
    const argument = args.find(a => a.startsWith('--' + name + '='));
    return argument === undefined ? fallback : Number(argument.split('=')[1]);
  };
  process.stdout.write(JSON.stringify(runM1P5FullSyntheticScoreCohort({
    firstSeed: get('first-seed', 1), seasonCount: get('seasons', 1),
  }), null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); } catch (error) {
    process.stderr.write(String(error?.message ?? error) + '\n');
    process.exitCode = 1;
  }
}
