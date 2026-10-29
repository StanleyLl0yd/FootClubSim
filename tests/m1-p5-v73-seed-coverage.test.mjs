import test from 'node:test';
import assert from 'node:assert/strict';
import {SeededRng} from '../dist/core/rng.js';
import {researchSeedFromIndex,firstPossessionDraw,
  compareM1V73SeedCoverage as measure}
  from '../scripts/m1-p5-v73-seed-coverage.mjs';

test('v73 verifies concentrated initial draws of contiguous low xorshift seeds',()=>{
  const original=Array.from({length:128},(_,i)=>firstPossessionDraw(i+1));
  assert.ok(original.every(x=>x>0&&x<0.01));
  assert.ok(original.every(x=>x<0.27));
  const expanded=Array.from({length:128},(_,i)=>researchSeedFromIndex(i+1));
  assert.equal(new Set(expanded).size,128);
  assert.ok(expanded.every(x=>Number.isInteger(x)&&x>=1&&x<=0xffffffff));
  const mapped=expanded.map(firstPossessionDraw);
  assert.ok(mapped.some(x=>x<0.27));
  assert.ok(mapped.some(x=>x>0.73));
  assert.equal(mapped.filter(x=>x<0.5).length,60);
  assert.equal(firstPossessionDraw(1),new SeededRng(1).nextFloat());
});
test('same synthetic fixture can be inspected under independently mapped seeds',()=>{
  const result=measure({firstfixture:1,fixtures:1,start:1,count:2});
  assert.equal(result.attempted,2);
  assert.equal(result.original.accepted+result.original.rejected,2);
  assert.equal(result.mapped.accepted+result.mapped.rejected,2);
  assert.equal(result.lowFirstDraw.count,2);
  assert.equal(result.mappedFirstDraw.count,2);
  assert.equal(result.lowFirstDraw.belowOneHundredth,2);
  assert.equal(result.rngVersion,'xorshift32-v1');
  assert.equal(result.engineAndMatchRngUnmodified,true);
  assert.equal(result.sameFixtureAndIndexCount,true);
  assert.equal(result.independentFootballReferenceAvailable,false);
  assert.equal(result.holdout2024_25Used,false);
  assert.equal(result.modelNotTuned,true);
  assert.deepEqual(result,measure({firstfixture:1,fixtures:1,start:1,count:2}));
});
test('seed mapping and bounded comparison reject spoofed domains and ranges',()=>{
  for(const n of [0,129,-1,1.5,NaN,'1',null]){
    assert.throws(()=>researchSeedFromIndex(n),/INVALID_RESEARCH_SEED_INDEX/);
  }
  for(const cfg of [{firstfixture:0},{fixtures:9},{firstfixture:240,fixtures:8},
    {start:0},{start:128,count:2},{count:0},{count:33},{fixtures:1.25}]){
    assert.throws(()=>measure(cfg),/BOUNDED_P5_SEED_COVERAGE_REQUIRED/);
  }
});
