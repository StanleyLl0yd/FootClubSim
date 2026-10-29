import test from 'node:test';
import assert from 'node:assert/strict';
import {seedM1V100,runM1V100Shard} from '../scripts/m1-p5-v100-intraphase-shard.mjs';

test('v100 fixture-domain research seeds are stable and separated',()=>{
  const samples=['0-0','0-1','2-0','3-7'].flatMap(f=>
    Array.from({length:8},(_,i)=>seedM1V100(f,i+1)));
  assert.equal(new Set(samples).size,samples.length);
  assert.ok(samples.every(v=>Number.isSafeInteger(v)&&v>0&&v<=0xffffffff));
  assert.equal(seedM1V100('0-0',3),seedM1V100('0-0',3));
  for(const invalid of [-1,0,9,1.1,NaN,null,'1',undefined])
    assert.throws(()=>seedM1V100('0-0',invalid),/V100_INVALID_SEED_PAIR/);
});
test('v100 invalid research shards are rejected before any simulation',()=>{
  for(const invalid of [-1,16,99,1.5,null,'0',undefined])
    assert.throws(()=>runM1V100Shard(invalid),/V100_INVALID_SHARD/);
});
