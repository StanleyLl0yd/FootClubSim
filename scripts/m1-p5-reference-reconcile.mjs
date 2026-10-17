#!/usr/bin/env node
/** Offline comparison of anonymized observations; never a realism or rights gate. */
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { wilson } from './m1-p5-reference-candidate.mjs';

const MAX_CANDIDATE_BYTES = 256 * 1024;
const MAX_PUBLISHED_BYTES = 16 * 1024;
const LABEL = 'UNAPPROVED_PUBLISHED_AGGREGATE_CROSSCHECK';
const METRICS = [
  'finishedMatches', 'homeWins', 'draws', 'awayWins', 'scoreless',
  'homeGoals', 'awayGoals', 'totalGoals', 'observedClubCount',
];
const STATUS = 'UNAPPROVED_EXTERNAL_REFERENCE_CANDIDATE_NOT_CALIBRATED';
const EXCLUSIONS = ['otherSeason', 'scheduled', 'live', 'cancelled'];
const OUTCOMES = ['homeWin', 'draw', 'awayWin', 'scoreless', 'bothScored'];
const SHAPE_CHECKS = ['expectedFinishedMatches', 'expectedClubs',
  'fifteenHomeAndAwayPerClub', 'uniqueDirectedFixtures',
  'noUnfinishedSelectedSeasonRows'];
const Z95 = 1.959963984540054;

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    throw Error('Invalid ' + label);
  }
  return value;
}

function boundedCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000000) {
    throw Error('Invalid ' + label);
  }
  return value;
}

function exactKeys(value, names, label) {
  const item = object(value, label);
  if (Object.keys(item).length !== names.length ||
      names.some(name => !Object.hasOwn(item, name))) {
    throw Error('Unexpected ' + label + ' fields');
  }
  return item;
}

function verifyCandidateDiagnostics(candidate, result) {
  const source = exactKeys(candidate.source,
    ['url', 'attributionUrl', 'sha256', 'bytes'], 'candidate source');
  if (source.attributionUrl !== 'https://footbolno.ru/otkrytye-dannye' ||
      !Number.isSafeInteger(source.bytes) || source.bytes < 1 ||
      source.bytes > 16 * 1024 * 1024 ||
      !/^\d{4}\/\d{4}$/.test(candidate.season) ||
      Number(candidate.season.slice(5)) !== Number(candidate.season.slice(0, 4)) + 1 ||
      !Number.isSafeInteger(candidate.csvRows) ||
      candidate.csvRows < result.finishedMatches || candidate.csvRows > 100000 ||
      result.finishedMatches > 100000) {
    throw Error('Invalid candidate source or row metadata');
  }
  const exclusions = exactKeys(candidate.exclusions, EXCLUSIONS, 'exclusions');
  let excluded = 0;
  for (const name of EXCLUSIONS) {
    excluded += boundedCount(exclusions[name], 'exclusion ' + name);
  }
  if (result.finishedMatches + excluded !== candidate.csvRows) {
    throw Error('Inconsistent candidate row exclusions');
  }
  const coverage = exactKeys(candidate.coverage, [
    'observedClubCount', 'finishedAppearancesPerClub',
    'finishedHomeMatchesPerClub', 'finishedAwayMatchesPerClub',
    'repeatedHomeAwayFixtures',
  ], 'candidate coverage');
  const n = result.finishedMatches, clubs = result.observedClubCount;
  if (clubs < 2 || boundedCount(coverage.repeatedHomeAwayFixtures,
    'repeated fixtures') >= n) throw Error('Invalid fixture coverage');
  function readRange(value, label, expectedSum, minimum) {
    const range = exactKeys(value, ['min', 'max'], label);
    const low = boundedCount(range.min, label + ' min');
    const high = boundedCount(range.max, label + ' max');
    if (low < minimum || high < low || high > n ||
        low * clubs > expectedSum || high * clubs < expectedSum) {
      throw Error('Inconsistent ' + label);
    }
    return range;
  }
  const total = readRange(coverage.finishedAppearancesPerClub,
    'total appearances', 2 * n, 1);
  const home = readRange(coverage.finishedHomeMatchesPerClub,
    'home appearances', n, 0);
  const away = readRange(coverage.finishedAwayMatchesPerClub,
    'away appearances', n, 0);
  if (total.min < home.min + away.min ||
      total.max > home.max + away.max) {
    throw Error('Inconsistent combined appearance ranges');
  }
  const shape = exactKeys(candidate.scheduleShape, [
    'status', 'expectedFormat', 'selectedSeasonUnfinished', 'checks',
    'consistentWithExpectedPattern',
  ], 'candidate schedule shape');
  const pending = exclusions.scheduled + exclusions.live + exclusions.cancelled;
  const expected = [
    n === 240,
    clubs === 16,
    home.min === 15 && home.max === 15 &&
      away.min === 15 && away.max === 15,
    coverage.repeatedHomeAwayFixtures === 0,
    pending === 0,
  ];
  const checks = exactKeys(shape.checks, SHAPE_CHECKS, 'schedule shape checks');
  if (shape.status !== 'STRUCTURAL_ONLY_NOT_INDEPENDENTLY_VERIFIED' ||
      shape.expectedFormat !== '16_CLUB_30_ROUND_DOUBLE_ROUND_ROBIN' ||
      shape.selectedSeasonUnfinished !== pending ||
      SHAPE_CHECKS.some((name, index) => checks[name] !== expected[index]) ||
      shape.consistentWithExpectedPattern !== expected.every(Boolean)) {
    throw Error('Inconsistent unapproved schedule shape');
  }
  const goals = exactKeys(candidate.goalsPerMatch,
    ['total', 'mean', 'sampleStdDev', 'normalMean95'], 'goal mean');
  if (result.homeGoals > 30 * n || result.awayGoals > 30 * n ||
      result.totalGoals > 60 * n ||
      (n === 1 && (goals.sampleStdDev !== null || goals.normalMean95 !== null))) {
    throw Error('Invalid goal distribution');
  }
  if (n > 1) {
    const sd = goals.sampleStdDev;
    const ci = exactKeys(goals.normalMean95,
      ['lower', 'upper'], 'goal mean interval');
    const margin = Z95 * sd / Math.sqrt(n);
    if (typeof sd !== 'number' || !Number.isFinite(sd) ||
        sd < 0 || sd > 60 || !Number.isFinite(ci.lower) ||
        !Number.isFinite(ci.upper) ||
        Math.abs(ci.lower - (goals.mean - margin)) > 1e-9 ||
        Math.abs(ci.upper - (goals.mean + margin)) > 1e-9) {
      throw Error('Inconsistent goal mean interval');
    }
  }
  const outcomes = exactKeys(candidate.outcomes, OUTCOMES, 'candidate outcomes');
  for (const name of OUTCOMES) {
    const metric = exactKeys(outcomes[name],
      ['numerator', 'denominator', 'rate', 'wilson95'], 'outcome ' + name);
    const expectedInterval = wilson(metric.numerator, n).wilson95;
    const interval = exactKeys(metric.wilson95,
      ['lower', 'upper'], 'Wilson interval');
    if (interval.lower !== expectedInterval.lower ||
        interval.upper !== expectedInterval.upper) {
      throw Error('Inconsistent candidate Wilson interval');
    }
  }
  const bothScored = outcomes.bothScored.numerator;
  if (bothScored + result.scoreless > n ||
      bothScored > result.homeGoals || bothScored > result.awayGoals) {
    throw Error('Impossible both-scored outcome count');
  }
}

function observedCandidateCounts(candidate) {
  const outcomes = object(candidate.outcomes, 'candidate outcomes');
  const goalTotals = object(candidate.goalTotals, 'candidate goal totals');
  const coverage = object(candidate.coverage, 'candidate coverage');
  const result = {
    finishedMatches: candidate.finishedMatches,
    homeWins: object(outcomes.homeWin, 'home wins').numerator,
    draws: object(outcomes.draw, 'draws').numerator,
    awayWins: object(outcomes.awayWin, 'away wins').numerator,
    scoreless: object(outcomes.scoreless, 'scoreless').numerator,
    homeGoals: goalTotals.home,
    awayGoals: goalTotals.away,
    totalGoals: goalTotals.total,
    observedClubCount: coverage.observedClubCount,
  };
  for (const name of METRICS) boundedCount(result[name], 'candidate ' + name);
  for (const name of OUTCOMES) {
    const metric = object(outcomes[name], 'candidate ' + name);
    const numerator = boundedCount(metric.numerator, name + ' numerator');
    if (metric.denominator !== result.finishedMatches ||
        numerator > result.finishedMatches ||
        metric.rate !== numerator / result.finishedMatches) {
      throw Error('Inconsistent candidate outcome denominator or rate');
    }
  }
  const goalMean = object(candidate.goalsPerMatch, 'candidate goals per match');
  if (goalMean.total !== result.totalGoals ||
      goalMean.mean !== result.totalGoals / result.finishedMatches) {
    throw Error('Inconsistent candidate goal mean or total');
  }
  if (result.homeWins + result.draws + result.awayWins !== result.finishedMatches ||
      result.homeGoals + result.awayGoals !== result.totalGoals ||
      result.scoreless > result.draws ||
      result.observedClubCount > result.finishedMatches * 2) {
    throw Error('Inconsistent candidate counts');
  }
  verifyCandidateDiagnostics(candidate, result);
  return result;
}

export function reconcileRplPublishedAggregates(candidate, published) {
  object(candidate, 'candidate');
  object(published, 'published aggregates');
  if (candidate.schemaVersion !== 1 || candidate.leagueId !== 235 ||
      candidate.status !== STATUS ||
      candidate.rightsStatus !== 'UPSTREAM_RIGHTS_NOT_VERIFIED' ||
      candidate.isCompleteSeason !== 'NOT_ESTABLISHED' ||
      !/^[a-f0-9]{64}$/.test(object(candidate.source, 'candidate source').sha256) ||
      candidate.source.url !== 'https://footbolno.ru/data/league/235-matches.csv') {
    throw Error('Unverified or incompatible candidate report');
  }
  if (published.schemaVersion !== 1 || published.kind !== LABEL ||
      published.leagueId !== 235 || published.season !== candidate.season ||
      !/^\d{4}\/\d{4}$/.test(published.season) ||
      Number(published.season.slice(5)) !== Number(published.season.slice(0, 4)) + 1 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(published.retrievedOn) ||
      published.rightsStatus !== 'NOT_REVIEWED' ||
      published.sourceIndependence !== 'NOT_ESTABLISHED') {
    throw Error('Invalid published aggregate provenance');
  }
  if (!Array.isArray(published.sources) || published.sources.length < 2 ||
      published.sources.length > 5) {
    throw Error('Published aggregates need at least two attributed sources');
  }
  const urls = new Set();
  for (const statement of published.sources) {
    object(statement, 'publisher statement');
    if (typeof statement.publisher !== 'string' || !statement.publisher ||
        statement.publisher.length > 100 ||
        typeof statement.url !== 'string' || statement.url.length > 2048) {
      throw Error('Invalid publisher statement');
    }
    let url;
    try { url = new URL(statement.url); } catch { throw Error('Invalid publisher URL'); }
    if (url.protocol !== 'https:' || !url.hostname ||
        url.username || url.password || urls.has(url.href)) {
      throw Error('Publisher URLs must be distinct HTTPS pages');
    }
    urls.add(url.href);
  }
  const expected = object(published.observed, 'published observed counts');
  if (Object.keys(expected).length !== METRICS.length ||
      METRICS.some(name => !Object.hasOwn(expected, name))) {
    throw Error('Incomplete published aggregate fields');
  }
  for (const name of METRICS) boundedCount(expected[name], 'published ' + name);
  if (expected.homeWins + expected.draws + expected.awayWins !== expected.finishedMatches ||
      expected.homeGoals + expected.awayGoals !== expected.totalGoals ||
      expected.scoreless > expected.draws ||
      expected.observedClubCount > expected.finishedMatches * 2) {
    throw Error('Inconsistent published aggregate arithmetic');
  }
  const actual = observedCandidateCounts(candidate);
  const differences = METRICS.flatMap(metric => actual[metric] === expected[metric]
    ? [] : [{ metric, candidate: actual[metric], published: expected[metric],
      delta: actual[metric] - expected[metric] }]);
  return {
    schemaVersion: 1,
    status: differences.length ? 'DIFFERENT_AGGREGATES_NOT_CALIBRATED' :
      'MATCHING_AGGREGATES_NOT_CALIBRATED',
    benchmarkApproved: false,
    sourceRightsReviewed: false,
    seasonCompletenessEstablished: false,
    candidateSha256: candidate.source.sha256,
    season: candidate.season,
    publishedSourceDate: published.retrievedOn,
    comparedMetrics: METRICS.length,
    differences,
  };
}

async function readBoundedJson(path, maxBytes) {
  if (!path) throw Error('Missing local JSON path');
  const handle = await open(path, 'r');
  let bytes;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 2 || stat.size > maxBytes) {
      throw Error('Invalid local JSON file size');
    }
    bytes = await handle.readFile();
  } finally { await handle.close(); }
  if (bytes.length > maxBytes) throw Error('Oversized local JSON');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

async function main(args) {
  if (args.length !== 2 || !args[0].startsWith('--candidate=') ||
      !args[1].startsWith('--published=')) {
    throw Error('Usage: node scripts/m1-p5-reference-reconcile.mjs --candidate=REPORT.json --published=OBSERVED.json');
  }
  const candidate = await readBoundedJson(args[0].slice(12), MAX_CANDIDATE_BYTES);
  const published = await readBoundedJson(args[1].slice(12), MAX_PUBLISHED_BYTES);
  process.stdout.write(JSON.stringify(reconcileRplPublishedAggregates(
    candidate, published), null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(String(error.message ?? error) + '\n');
    process.exitCode = 1;
  });
}
