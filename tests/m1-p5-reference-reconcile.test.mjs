import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { analyzeRplCsvCandidate } from '../scripts/m1-p5-reference-candidate.mjs';
import { reconcileRplPublishedAggregates } from '../scripts/m1-p5-reference-reconcile.mjs';

const csv = [
  'match_id,league_id,season,status,home_id,away_id,home_goals,away_goals',
  '1,235,2024/2025,finished,10,20,2,1',
  '2,235,2024/2025,finished,30,40,0,0',
  '3,235,2024/2025,finished,50,60,1,3',
].join('\n') + '\n';
const hash = createHash('sha256').update(csv).digest('hex');
const candidate = () => analyzeRplCsvCandidate(csv, '2024/2025', hash);
function published() {
  return {
    schemaVersion: 1,
    kind: 'UNAPPROVED_PUBLISHED_AGGREGATE_CROSSCHECK',
    leagueId: 235, season: '2024/2025', retrievedOn: '2026-10-17',
    rightsStatus: 'NOT_REVIEWED', sourceIndependence: 'NOT_ESTABLISHED',
    sources: [
      { publisher: 'First source', url: 'https://example.org/statistics' },
      { publisher: 'Second source', url: 'https://example.net/observations' },
    ],
    observed: {
      finishedMatches: 3, homeWins: 1, draws: 1, awayWins: 1,
      scoreless: 1, homeGoals: 3, awayGoals: 4, totalGoals: 7,
      observedClubCount: 6,
    },
  };
}

test('matching descriptive counts remain explicitly unapproved', () => {
  const report = reconcileRplPublishedAggregates(candidate(), published());
  assert.equal(report.status, 'MATCHING_AGGREGATES_NOT_CALIBRATED');
  assert.equal(report.benchmarkApproved, false);
  assert.equal(report.sourceRightsReviewed, false);
  assert.equal(report.seasonCompletenessEstablished, false);
  assert.equal(report.candidateSha256, hash);
  assert.equal(report.comparedMetrics, 9);
  assert.deepEqual(report.differences, []);
});

test('differences are exact and never silently marked calibrated', () => {
  const p = published();
  p.observed.homeGoals = 4;
  p.observed.awayGoals = 3;
  p.observed.observedClubCount = 5;
  const report = reconcileRplPublishedAggregates(candidate(), p);
  assert.equal(report.status, 'DIFFERENT_AGGREGATES_NOT_CALIBRATED');
  assert.deepEqual(report.differences, [
    { metric: 'homeGoals', candidate: 3, published: 4, delta: -1 },
    { metric: 'awayGoals', candidate: 4, published: 3, delta: 1 },
    { metric: 'observedClubCount', candidate: 6, published: 5, delta: 1 },
  ]);
});

test('rejects forged candidate metadata and impossible report arithmetic', () => {
  for (const mutate of [
    c => { c.source.sha256 = '0'.repeat(63); },
    c => { c.rightsStatus = 'APPROVED'; },
    c => { c.isCompleteSeason = true; },
    c => { c.schemaVersion = 2; },
    c => { c.goalTotals.home = 999; },
    c => { c.outcomes.draw.numerator = 100; },
    c => { c.coverage.observedClubCount = 100; },
    c => { c.outcomes.homeWin.denominator = 999; },
    c => { c.outcomes.homeWin.rate = 0.999; },
    c => { c.outcomes.bothScored.numerator = 999; },
    c => { c.goalsPerMatch.total = 99; },
    c => { c.goalsPerMatch.mean = 99; },
  ]) {
    const c = candidate();
    mutate(c);
    assert.throws(() => reconcileRplPublishedAggregates(c, published()));
  }
});

test('mutated candidate diagnostics cannot claim a matched published source', () => {
  const changes = [
    c => { c.source.bytes = 0; },
    c => { c.source.bytes = 20000000; },
    c => { c.source.attributionUrl = 'https://example.com'; },
    c => { c.season = '2024/2027'; },
    c => { c.csvRows += 1; },
    c => { c.exclusions.otherSeason += 1; },
    c => { c.exclusions.extra = 0; },
    c => { c.coverage.repeatedHomeAwayFixtures = 3; },
    c => { c.coverage.finishedHomeMatchesPerClub.min = 4; },
    c => { c.coverage.finishedHomeMatchesPerClub.max = 0; },
    c => { c.coverage.finishedAppearancesPerClub.max = 2; },
    c => { c.scheduleShape.checks.expectedFinishedMatches = true; },
    c => { c.scheduleShape.checks.uniqueDirectedFixtures = false; },
    c => { c.scheduleShape.consistentWithExpectedPattern = true; },
    c => { c.scheduleShape.selectedSeasonUnfinished = 1; },
    c => { c.scheduleShape.status = 'VERIFIED'; },
    c => { c.outcomes.homeWin.wilson95.lower = 0; },
    c => { c.outcomes.draw.wilson95.upper = 1; },
    c => { c.outcomes.scoreless.wilson95.lower = -1; },
    c => { c.goalsPerMatch.sampleStdDev = 200; },
    c => { c.goalsPerMatch.normalMean95.upper += 1; },
    c => { c.outcomes.bothScored.numerator = 3;
      c.outcomes.bothScored.rate = 1;
      c.outcomes.bothScored.wilson95 = {
        lower: 0.4385029682449545, upper: 1,
      }; },
    c => { c.outcomes.homeWin.extra = 'unverified'; },
  ];
  for (const mutate of changes) {
    const c = candidate();
    mutate(c);
    assert.throws(() => reconcileRplPublishedAggregates(c, published()));
  }
});

test('single-match candidate retains null standard deviation and CI', () => {
  const single = [
    'match_id,league_id,season,status,home_id,away_id,home_goals,away_goals',
    '1,235,2024/2025,finished,10,20,2,1',
  ].join('\\n') + '\\n';
  const c = analyzeRplCsvCandidate(single, '2024/2025',
    createHash('sha256').update(single).digest('hex'));
  const ref = published();
  ref.observed = {
    finishedMatches: 1, homeWins: 1, draws: 0, awayWins: 0,
    scoreless: 0, homeGoals: 2, awayGoals: 1, totalGoals: 3,
    observedClubCount: 2,
  };
  assert.equal(reconcileRplPublishedAggregates(c, ref).status,
    'MATCHING_AGGREGATES_NOT_CALIBRATED');
});

test('rejects forged published provenance, unsafe URLs and impossible totals', () => {
  for (const mutate of [
    p => { p.rightsStatus = 'APPROVED'; },
    p => { p.sourceIndependence = 'VERIFIED'; },
    p => { p.season = '2025/2026'; },
    p => { p.season = '2024/2027'; },
    p => { p.retrievedOn = 'today'; },
    p => { p.sources = []; },
    p => { p.sources[1].url = p.sources[0].url; },
    p => { p.sources[0].url = 'http://example.org/a'; },
    p => { p.sources[0].url = 'https://bob:secret@example.org/a'; },
    p => { p.observed.awayWins = -1; },
    p => { p.observed.homeWins = 3; },
    p => { delete p.observed.totalGoals; },
    p => { p.observed.homeGoals += 1; },
    p => { p.observed.extra = 5; },
  ]) {
    const p = published();
    mutate(p);
    assert.throws(() => reconcileRplPublishedAggregates(candidate(), p));
  }
});

test('published 2024/25 observed summary is attributed and arithmetically coherent', () => {
  const ref = JSON.parse(readFileSync('data/rpl-2024-25-published-aggregate-research.json'));
  assert.equal(ref.kind, 'UNAPPROVED_PUBLISHED_AGGREGATE_CROSSCHECK');
  assert.equal(ref.rightsStatus, 'NOT_REVIEWED');
  assert.equal(ref.sourceIndependence, 'NOT_ESTABLISHED');
  assert.equal(ref.observed.finishedMatches, 240);
  assert.equal(ref.observed.homeWins + ref.observed.draws +
    ref.observed.awayWins, ref.observed.finishedMatches);
  assert.equal(ref.observed.homeGoals + ref.observed.awayGoals,
    ref.observed.totalGoals);
  assert.equal(ref.observed.scoreless, 20);
  assert.equal(ref.sources.length, 2);
});

test('offline CLI accepts local JSON files; rejects unsupported flags and bad inputs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fcs-p5-reconcile-'));
  try {
    const report = join(dir, 'candidate.json'), reference = join(dir, 'published.json');
    writeFileSync(report, JSON.stringify(candidate()));
    writeFileSync(reference, JSON.stringify(published()));
    const cli = 'scripts/m1-p5-reference-reconcile.mjs';
    const run = (...args) => spawnSync(process.execPath, [cli, ...args],
      { cwd: process.cwd(), encoding: 'utf8' });
    const ok = run('--candidate=' + report, '--published=' + reference);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).status,
      'MATCHING_AGGREGATES_NOT_CALIBRATED');
    const bad = [
      run('--candidate=' + report),
      run('--published=' + reference, '--candidate=' + report),
      run('--candidate=' + report, '--published=' + reference, '--fetch'),
    ];
    for (const result of bad) {
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, '');
    }
    writeFileSync(reference, '{"__proto__":1}');
    const malformed = run('--candidate=' + report, '--published=' + reference);
    assert.notEqual(malformed.status, 0);
    assert.equal(malformed.stdout, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
