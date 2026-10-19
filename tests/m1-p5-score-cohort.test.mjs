import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareM1P5ScoreResearchCounts, runM1P5FullSyntheticScoreCohort,
  M1_P5_SCORE_DEVELOPMENT_REFERENCE,
} from '../scripts/m1-p5-score-cohort.mjs';

const reference = () => ({
  matches: 240, homeWins: 113, draws: 66, awayWins: 61,
  scoreless: 20, homeGoals: 359, awayGoals: 278, totalGoals: 637,
});

test('corrected 2023/24 source baseline is immutable and not an approval threshold', () => {
  const src = M1_P5_SCORE_DEVELOPMENT_REFERENCE;
  assert.equal(src.season, '2023/2024');
  assert.equal(src.sourceOriginalSha256.length, 64);
  assert.equal(src.evidenceBoundRepairs, 1);
  assert.equal(src.upstreamRightsVerified, false);
  const same = compareM1P5ScoreResearchCounts(reference());
  assert.equal(same.empiricalAcceptance, false);
  assert.equal(same.status, 'NONCOMPARABLE_EVENT_COVERAGE_NOT_CALIBRATED');
  assert.equal(same.reservedUntouchedHoldout, '2024/2025');
  assert.equal(same.reason, 'REFERENCE_ALL_GOALS_VS_SYNTHETIC_OPEN_PLAY_ONLY');
  assert.equal(same.observed.totalGoals.exploratoryDeltaPerMatch, 0);
});

test('source-based comparisons reject partial seasons, impossible statistics and fabricated fields', () => {
  const counts = reference();
  for (const input of [
    {...counts, matches: 239},
    {...counts, homeWins: 114},
    {...counts, totalGoals: 638},
    {...counts, scoreless: 70},
    {...counts, awayGoals: -1},
    {...counts, extra: 'fake-acceptance'},
    {...counts, homeWins: Number.POSITIVE_INFINITY},
    {...counts, matches: 2160},
  ]) assert.throws(() => compareM1P5ScoreResearchCounts(input),
    /Invalid complete-season/);
});

test('full 240-fixture synthetic v8 season produces source-labelled noncalibration diagnostic', () => {
  const report = runM1P5FullSyntheticScoreCohort({
    firstSeed: 1, seasonCount: 1,
  });
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.fixtureCountPerSeason, 240);
  assert.equal(report.seasonCount, 1);
  assert.equal(report.firstSeed, 1);
  assert.equal(report.lastSeed, 240);
  assert.equal(report.counts.matches, 240);
  assert.equal(report.counts.homeWins + report.counts.draws +
    report.counts.awayWins, 240);
  assert.equal(report.counts.homeGoals + report.counts.awayGoals,
    report.counts.totalGoals);
  assert.equal(report.comparison.empiricalAcceptance, false);
  assert.equal(report.comparison.generatedPenalties, false);
  assert.equal(report.comparison.generatedCards, false);
  assert.equal(report.comparison.generatedInjuries, false);
  assert.equal(report.comparison.reservedUntouchedHoldout, '2024/2025');
  assert.match(report.reproducibilitySha256, /^[a-f0-9]{64}$/);
});

test('invalid RNG seed plans fail before evaluating the season', () => {
  for (const options of [
    { firstSeed: 0 }, { firstSeed: -1 }, { seasonCount: 0 },
    { seasonCount: 9 }, { seasonCount: 2.5 },
    { firstSeed: 0xffffffff, seasonCount: 1 },
  ]) assert.throws(() => runM1P5FullSyntheticScoreCohort(options),
    /Invalid cohort plan/);
});
