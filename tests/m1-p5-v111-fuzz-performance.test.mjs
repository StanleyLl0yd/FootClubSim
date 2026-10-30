import test from 'node:test';
import assert from 'node:assert/strict';
import {runM1V111FuzzShard as run}
  from '../scripts/m1-p5-v111-fuzz-performance.mjs';

test('v111 independent fixed-seed fuzz replays model and rejects forged events',()=>{
  const first=run(0,{seeds:2});
  const second=run(0,{seeds:2});
  assert.equal(first.group,0);
  assert.equal(first.distinctSeeds,8);
  assert.equal(first.negativeChecks,4);
  assert.equal(first.resultSha256,second.resultSha256);
  assert.deepEqual(first.totals,second.totals);
  for(const row of Object.values(first.totals)){
    assert.equal(row.matches,8);
    assert.ok(row.goals<=row.onTarget&&row.onTarget<=row.shots);
    assert.ok(row.xgMilli>=0);
  }
  assert.equal(first.holdout2024_25Used,false);
  assert.equal(first.releaseCalibrationAccepted,false);
  assert.equal(first.timing.modelPerformanceAcceptance,false);
});
test('v111 scope and operational budget parameters fail closed',()=>{
  for(const invalid of [-1,4,1.5,NaN,'2']){
    assert.throws(()=>run(invalid,{seeds:1}),/V111_INVALID_ARGUMENTS/);
  }
  for(const seeds of [0,17,1.5]){
    assert.throws(()=>run(0,{seeds}),/V111_INVALID_ARGUMENTS/);
  }
});
