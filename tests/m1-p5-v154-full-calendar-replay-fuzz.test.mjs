import test from 'node:test';
import assert from 'node:assert/strict';
import {runM1P5V154FullCalendarShard as run}
  from '../scripts/m1-p5-v154-full-calendar-replay-fuzz.mjs';

test('v154 full-calendar shard: deterministic source replay and separate case accounting',()=>{
  const first=run(0,{seeds:1});
  const second=run(0,{seeds:1});
  assert.equal(first.schemaVersion,154);
  assert.equal(first.source.fixtureCount,240);
  assert.equal(first.source.fixturesPerShard,15);
  assert.equal(first.uniqueFixtureSeedPairs,15);
  assert.equal(first.modelAttempts,45);
  assert.equal(first.resultSha256,second.resultSha256);
  assert.deepEqual(first.rows,second.rows);
  for(const row of Object.values(first.rows)){
    assert.equal(row.attempted,15);
    assert.equal(row.accepted+row.rejected,15);
    assert.ok(row.goals<=row.onTarget&&row.onTarget<=row.shots);
  }
  assert.ok(first.negativeChecks<=15);
  assert.equal(first.sourceReplayVerified,true);
  assert.equal(first.holdout2024_25Used,false);
  assert.equal(first.releaseP5Accepted,false);
  assert.equal(first.timing.releasePerformanceAccepted,false);
  assert.equal(first.referenceMetricTaxonomyAligned,false);
});

test('v154 rejects noninteger shard, invalid seeds and resource limits',()=>{
  for(const group of [-1,16,0.5,NaN,'0']){
    assert.throws(()=>run(group,{seeds:1}),/V154_INVALID_ARGUMENTS/);
  }
  for(const seeds of [-1,0,49,1.5,NaN]){
    assert.throws(()=>run(0,{seeds}),/V154_INVALID_ARGUMENTS/);
  }
  for(const options of [
    {maxElapsedMs:0},{maxRssMiB:0},
    {maxElapsedMs:NaN},{maxRssMiB:Infinity},
  ]){
    assert.throws(()=>run(0,{seeds:1,...options}),
      /V154_INVALID_ARGUMENTS/);
  }
});
