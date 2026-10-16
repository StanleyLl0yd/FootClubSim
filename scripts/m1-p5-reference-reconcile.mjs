#!/usr/bin/env node
/** Offline comparison of anonymized observations; never a realism or rights gate. */
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MAX_CANDIDATE_BYTES = 256 * 1024;
const MAX_PUBLISHED_BYTES = 16 * 1024;
const LABEL = 'UNAPPROVED_PUBLISHED_AGGREGATE_CROSSCHECK';
const METRICS = [
  'finishedMatches', 'homeWins', 'draws', 'awayWins', 'scoreless',
  'homeGoals', 'awayGoals', 'totalGoals', 'observedClubCount',
];
const STATUS = 'UNAPPROVED_EXTERNAL_REFERENCE_CANDIDATE_NOT_CALIBRATED';

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
  for (const name of ['homeWin', 'draw', 'awayWin', 'scoreless', 'bothScored']) {
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
