import test from 'node:test';
import assert from 'node:assert/strict';
import { runM1V119PlayableDistribution }
  from '../scripts/m1-p5-v119-playable-source.mjs';

test('v119 directly replays the browser-playable v8 match source and preserves all denominators', () => {
  const a = runM1V119PlayableDistribution({
    firstSeed: 1, seedCount: 1, fixturesPerCareer: 2, scenario: 'ordinary',
  });
  const b = runM1V119PlayableDistribution({
    firstSeed: 1, seedCount: 1, fixturesPerCareer: 2, scenario: 'ordinary',
  });
  assert.deepEqual(a, b);
  assert.equal(a.accepted, 2);
  assert.equal(a.attempted, 2);
  assert.equal(a.rejected, 0);
  assert.equal(a.verifiedCareerJournals, 1);
  assert.equal(a.gamesBySeed[0].finalJournalRevision, 2);
  assert.equal(a.totals.homeWins + a.totals.draws + a.totals.awayWins, 2);
  assert.equal(a.structural.v8MaxOpenPlayShotsPerMatch, 18);
  assert.equal(a.structural.referenceAverageShotsExceedsV8PhysicalMaximum, true);
  assert.equal(a.limitations.releaseP5Accepted, false);
  assert.equal(a.limitations.holdout2024_25Used, false);
  assert.equal(a.perMatch.cautions, 0);
  assert.equal(a.perMatch.dismissals, 0);
  assert.equal(a.perMatch.modelledWithdrawals, 0);
});

test('v119 rejects malformed and out-of-range requests before generating any match', () => {
  const invalid = [
    { seedCount: 0 }, { seedCount: 65 },
    { firstSeed: 0 }, { firstSeed: 0xffffffff, seedCount: 2 },
    { fixturesPerCareer: 0 }, { fixturesPerCareer: 31 },
    { scenario: 'external-referee' }, { seedCount: 1.5 },
  ];
  for (const options of invalid) {
    assert.throws(() => runM1V119PlayableDistribution(options),
      /V119_INVALID_OPTIONS/);
  }
});
