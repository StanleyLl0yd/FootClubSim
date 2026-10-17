import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeRplCsvCandidate } from '../scripts/m1-p5-reference-candidate.mjs';

const header = 'match_id,league_id,season,status,home_id,away_id,home_goals,away_goals,venue';
const rows = [
  '1,235,2024/2025,finished,10,20,2,1,"A, Moscow"',
  '2,235,2024/2025,finished,30,40,0,0,"B"',
  '3,235,2024/2025,finished,50,60,1,3,"C"',
  '4,235,2024/2025,scheduled,10,30,,,"D"',
  '5,235,2024/2025,live,20,40,1,0,"E"',
  '6,235,2024/2025,cancelled,50,20,,,"F"',
  '7,235,2025/2026,finished,10,30,2,2,"G"',
];
const digest = text => createHash('sha256').update(text).digest('hex');
function inspect(lines = rows, season = '2024/2025') {
  const csv = [header, ...lines].join('\r\n') + '\r\n';
  return analyzeRplCsvCandidate(csv, season, digest(csv));
}

test('bounded, anonymized completed season outcomes and uncertainty', () => {
  const r = inspect();
  assert.equal(r.status, 'UNAPPROVED_EXTERNAL_REFERENCE_CANDIDATE_NOT_CALIBRATED');
  assert.equal(r.rightsStatus, 'UPSTREAM_RIGHTS_NOT_VERIFIED');
  assert.equal(r.isCompleteSeason, 'NOT_ESTABLISHED');
  assert.deepEqual(r.scheduleShape, {
    status: 'STRUCTURAL_ONLY_NOT_INDEPENDENTLY_VERIFIED',
    expectedFormat: '16_CLUB_30_ROUND_DOUBLE_ROUND_ROBIN',
    selectedSeasonUnfinished: 3,
    checks: {
      expectedFinishedMatches: false,
      expectedClubs: false,
      fifteenHomeAndAwayPerClub: false,
      uniqueDirectedFixtures: true,
      noUnfinishedSelectedSeasonRows: false,
    },
    consistentWithExpectedPattern: false,
  });
  assert.equal(r.finishedMatches, 3);
  assert.deepEqual(r.exclusions, {
    otherSeason: 1, scheduled: 1, live: 1, cancelled: 1,
  });
  assert.equal(r.outcomes.homeWin.numerator, 1);
  assert.equal(r.outcomes.draw.numerator, 1);
  assert.equal(r.outcomes.awayWin.numerator, 1);
  assert.equal(r.outcomes.scoreless.numerator, 1);
  assert.equal(r.outcomes.bothScored.numerator, 2);
  assert.equal(r.goalsPerMatch.total, 7);
  assert.deepEqual(r.goalTotals, { home: 3, away: 4, total: 7 });
  assert.deepEqual(r.coverage, {
    observedClubCount: 6,
    finishedAppearancesPerClub: { min: 1, max: 1 },
    finishedHomeMatchesPerClub: { min: 0, max: 1 },
    finishedAwayMatchesPerClub: { min: 0, max: 1 },
    repeatedHomeAwayFixtures: 0,
  });
  assert.equal(r.goalsPerMatch.mean, 7 / 3);
  for (const x of Object.values(r.outcomes)) {
    assert.equal(x.denominator, 3);
    assert.ok(x.wilson95.lower >= 0 && x.wilson95.upper <= 1);
    assert.ok(x.wilson95.lower <= x.rate && x.rate <= x.wilson95.upper);
  }
  assert.ok(r.goalsPerMatch.normalMean95.lower < r.goalsPerMatch.mean);
  assert.ok(r.goalsPerMatch.normalMean95.upper > r.goalsPerMatch.mean);
  assert.equal(JSON.stringify(r).includes('Moscow'), false);
});

test('quoted cells and UTF-8 BOM do not alter numeric reports', () => {
  const baseline = inspect();
  const c = '\ufeff' + [header, ...rows].join('\n') + '\n';
  assert.deepEqual(analyzeRplCsvCandidate(c, '2024/2025', digest(c)).outcomes,
    baseline.outcomes);
  const multi = rows.map(x => x.startsWith('1,') ?
    x.replace('"A, Moscow"', '"A ""quoted"",\nMoscow"') : x);
  assert.equal(inspect(multi).finishedMatches, 3);
});

test('coverage reports incomplete and repeated directed fixtures without leaking IDs', () => {
  const original = rows[0];
  const repeat = original.replace('1,235,', '8,235,');
  const reverse = original.replace('1,235,', '9,235,')
    .replace(',10,20,2,1,', ',20,10,1,2,');
  const r = inspect([original, repeat, reverse]);
  assert.equal(r.finishedMatches, 3);
  assert.deepEqual(r.coverage, {
    observedClubCount: 2,
    finishedAppearancesPerClub: { min: 3, max: 3 },
    finishedHomeMatchesPerClub: { min: 1, max: 2 },
    finishedAwayMatchesPerClub: { min: 1, max: 2 },
    repeatedHomeAwayFixtures: 1,
  });
  assert.equal(r.isCompleteSeason, 'NOT_ESTABLISHED');
  assert.equal(JSON.stringify(r).includes('A, Moscow'), false);
});

test('single fixture yields null, never invented uncertainty', () => {
  const r = inspect(rows.slice(0, 1));
  assert.equal(r.finishedMatches, 1);
  assert.equal(r.goalsPerMatch.sampleStdDev, null);
  assert.equal(r.goalsPerMatch.normalMean95, null);
});

test('rejects falsified hash, bad seasons, unknown league, duplicate records and invalid scores', () => {
  const csv = [header, ...rows].join('\n') + '\n';
  assert.throws(() => analyzeRplCsvCandidate(csv, '2024/2025', '0'.repeat(64)), /SHA-256/);
  assert.throws(() => inspect(rows, '2024/2027'), /Season/);
  assert.throws(() => inspect(rows, '2023/2024'), /No completed/);
  assert.throws(() => inspect([...rows, rows[0]]), /duplicate match ID/);
  assert.throws(() => inspect([rows[0].replace(',235,', ',999,')]), /non-RPL/);
  assert.throws(() => inspect([rows[0].replace(',2,1,', ',31,1,')]), /home_goals/);
  assert.throws(() => inspect([rows[0].replace(',2,1,', ',,1,')]), /home_goals/);
  assert.throws(() => inspect([rows[0].replace('finished', 'postponed')]), /Unknown/);
  assert.throws(() => inspect([rows[0].replace(',10,20,', ',10,10,')]), /team identifiers/);
  assert.throws(() => inspect([rows[0].replace(',2,1,', ',-1,1,')]), /home_goals/);
  assert.throws(() => inspect([rows[0].replace('2024/2025', 'unknown')]), /row season/);
  assert.throws(() => inspect([rows[0].replace('2024/2025', '2024/2027')]), /row season/);
});

test('rejects malformed CSV, duplicate/missing headers, and oversized cells', () => {
  for (const line of [
    rows[0].replace('"A, Moscow"', '"unterminated'),
    rows[0].replace('"A, Moscow"', '"A"surprise'),
    rows[0].replace('"A, Moscow"', 'A"unexpected'),
    rows[0] + ',extra',
    rows[0].replace('"A, Moscow"', 'x'.repeat(4097)),
  ]) assert.throws(() => inspect([line]));
  assert.throws(() => {
    const csv = [header.replace('away_goals', 'home_goals'), rows[0]].join('\n');
    analyzeRplCsvCandidate(csv, '2024/2025', digest(csv));
  }, /Duplicate CSV header/);
  assert.throws(() => {
    const csv = [header.replace('away_goals', 'missing_goals'), rows[0]].join('\n');
    analyzeRplCsvCandidate(csv, '2024/2025', digest(csv));
  }, /Missing required/);
  assert.throws(() => inspect([rows[0] + '\n\n']), /Blank CSV row/);
  assert.throws(() => inspect([rows[0].replace('2,1', '2\0,1')]), /NUL/);
  assert.throws(() => inspect([rows[0].replace('2,1', '2\r,1')]), /carriage return/);
});

test('CLI accepts only a pinned local file and rejects unauthorized options', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fcs-ref-'));
  try {
    const file = join(directory, 'private-reference.csv');
    const csv = [header, ...rows].join('\n') + '\n';
    writeFileSync(file, csv);
    const cli = join('scripts', 'm1-p5-reference-candidate.mjs');
    const ok = spawnSync(process.execPath, [cli,
      `--file=${file}`, '--season=2024/2025', `--sha256=${digest(csv)}`],
    { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    const report = JSON.parse(ok.stdout);
    assert.equal(report.source.sha256, digest(csv));
    assert.equal(report.finishedMatches, 3);
    assert.equal(report.status, 'UNAPPROVED_EXTERNAL_REFERENCE_CANDIDATE_NOT_CALIBRATED');
    const bom = '\ufeff' + csv;
    writeFileSync(file, bom);
    const bomOk = spawnSync(process.execPath, [cli,
      `--file=${file}`, '--season=2024/2025', `--sha256=${digest(bom)}`],
    { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(bomOk.status, 0, bomOk.stderr);
    assert.equal(JSON.parse(bomOk.stdout).source.sha256, digest(bom));
    for (const args of [
      [`--file=${file}`, '--season=2024/2025'],
      [`--file=${file}`, '--season=2024/2025', `--sha256=${digest(csv)}`, '--fetch'],
      [`--file=${file}`, '--season=2024/2025', '--sha256=wrong'],
    ]) {
      const bad = spawnSync(process.execPath, [cli, ...args],
        { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(bad.status, 0);
      assert.equal(bad.stdout, '');
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('240 directed pairings satisfy only the double-round-robin structural prerequisite', () => {
  const clubs = Array.from({ length: 16 }, (_, i) => String(100 + i));
  const fixtures = [];
  for (const home of clubs) {
    for (const away of clubs) {
      if (home === away) continue;
      fixtures.push([
        fixtures.length + 1, 235, '2024/2025', 'finished', home, away,
        fixtures.length % 4, fixtures.length % 3, '"private, venue"',
      ].join(','));
    }
  }
  assert.equal(fixtures.length, 240);
  const good = inspect(fixtures);
  assert.equal(good.scheduleShape.consistentWithExpectedPattern, true);
  assert.deepEqual(good.scheduleShape.checks, {
    expectedFinishedMatches: true,
    expectedClubs: true,
    fifteenHomeAndAwayPerClub: true,
    uniqueDirectedFixtures: true,
    noUnfinishedSelectedSeasonRows: true,
  });
  assert.equal(good.coverage.repeatedHomeAwayFixtures, 0);
  assert.deepEqual(good.coverage.finishedAppearancesPerClub, { min: 30, max: 30 });
  assert.deepEqual(good.coverage.finishedHomeMatchesPerClub, { min: 15, max: 15 });
  assert.deepEqual(good.coverage.finishedAwayMatchesPerClub, { min: 15, max: 15 });
  assert.equal(good.isCompleteSeason, 'NOT_ESTABLISHED');
  assert.equal(JSON.stringify(good).includes('private, venue'), false);

  const missing = inspect(fixtures.slice(1));
  assert.equal(missing.scheduleShape.checks.expectedFinishedMatches, false);
  assert.equal(missing.scheduleShape.consistentWithExpectedPattern, false);

  // Same 240 completed rows and 16 clubs, but one directed fixture repeats.
  const duplicatePair = [...fixtures];
  duplicatePair[1] = duplicatePair[0].replace(/^1,/, '2,');
  const repeated = inspect(duplicatePair);
  assert.equal(repeated.finishedMatches, 240);
  assert.equal(repeated.coverage.repeatedHomeAwayFixtures, 1);
  assert.equal(repeated.scheduleShape.checks.uniqueDirectedFixtures, false);
  assert.equal(repeated.scheduleShape.consistentWithExpectedPattern, false);

  // Even a full finished grid cannot silently disregard pending rows.
  const extra = inspect([...fixtures, '241,235,2024/2025,scheduled,100,101,,,X']);
  assert.equal(extra.scheduleShape.selectedSeasonUnfinished, 1);
  assert.equal(extra.scheduleShape.checks.noUnfinishedSelectedSeasonRows, false);
  assert.equal(extra.scheduleShape.consistentWithExpectedPattern, false);
  assert.equal(extra.isCompleteSeason, 'NOT_ESTABLISHED');
});
