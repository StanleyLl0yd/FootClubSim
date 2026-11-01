import test from 'node:test';
import assert from 'node:assert/strict';
import {runM1P5V141CareerClusters}
  from '../scripts/m1-p5-v141-career-clusters.mjs';
import {runM1V131FictionalIncidentCohort}
  from '../scripts/m1-p5-v131-incident-cohort.mjs';

test('v141 retains correlated matches within genuinely distinct seed careers',()=>{
  const options={firstSeed:1,seedCount:2,fixturesPerCareer:2};
  const observed=runM1P5V141CareerClusters(options);
  const batch=runM1V131FictionalIncidentCohort(options);
  assert.equal(observed.schemaVersion,141);
  assert.equal(observed.independentUnit,'SEED_CAREER_NOT_FIXTURE');
  assert.deepEqual(observed.careers.map(r=>r.seed),[1,2]);
  assert.equal(observed.careers.length,2);
  assert.equal(observed.attempted,batch.attempted);
  assert.equal(observed.accepted,batch.accepted);
  assert.equal(observed.rejected,batch.rejected);
  assert.deepEqual(observed.totals,batch.totals);
  assert.equal(observed.holdout2024_25Used,false);
  assert.equal(observed.factualProviderMetricDefinitionsAligned,false);
  assert.equal(observed.releaseP5Accepted,false);
  assert.deepEqual(runM1P5V141CareerClusters(options),observed);
});
test('v141 rejects unsafe ranges before any source work',()=>{
  for(const options of [
    {firstSeed:0},{seedCount:0},{seedCount:9},
    {firstSeed:0xffffffff,seedCount:2},
    {fixturesPerCareer:0},{fixturesPerCareer:7},
    {seedCount:1.1},
  ]){
    assert.throws(()=>runM1P5V141CareerClusters(options),
      /V141_INVALID_OPTIONS/);
  }
});
