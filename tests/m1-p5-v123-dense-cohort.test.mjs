import test from 'node:test';
import assert from 'node:assert/strict';
import {runM1V123DensePlayableCohort}
  from '../scripts/m1-p5-v123-dense-cohort.mjs';

test('v123 samples exact v120 dense playable history, replay and conservation',()=>{
  const a=runM1V123DensePlayableCohort({
    firstSeed:1,seedCount:1,fixturesPerCareer:3,
  });
  const b=runM1V123DensePlayableCohort({
    firstSeed:1,seedCount:1,fixturesPerCareer:3,
  });
  assert.deepEqual(a,b);
  assert.equal(a.accepted,3);
  assert.equal(a.rejected,0);
  assert.equal(a.replayedJournals,1);
  assert.equal(a.totals.homeWins+a.totals.draws+a.totals.awayWins,3);
  assert.equal(a.structural.openPlayShotSlotsPerMatch,54);
  assert.equal(a.holdout2024_25Used,false);
  assert.equal(a.releaseP5Accepted,false);
  assert.equal(a.missingCoverage.refereeCards,null);
  assert.equal(a.missingCoverage.clinicalInjuries,null);
});
test('v123 fails closed for malformed options',()=>{
  for(const bad of [{firstSeed:0},{seedCount:0},{seedCount:33},
    {firstSeed:0xffffffff,seedCount:2},{fixturesPerCareer:31},
    {fixturesPerCareer:0},{seedCount:1.25}]){
    assert.throws(()=>runM1V123DensePlayableCohort(bad),
      /V123_INVALID_OPTIONS/);
  }
});
