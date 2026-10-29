import test from 'node:test';
import assert from 'node:assert/strict';
import {v74ShardPlan,v74CoveragePlans,v74InitialThreshold}
  from '../scripts/m1-p5-v74-seed-shard.mjs';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {researchSeedFromIndex,firstPossessionDraw}
  from '../scripts/m1-p5-v73-seed-coverage.mjs';

test('v74 preregistered 16 shards cover exactly 32 x 128 unseen fixture/index pairs',()=>{
  const plans=v74CoveragePlans();
  assert.equal(plans.length,16);
  const pairs=new Set(),fixtures=new Set(),indices=new Set();
  for(const p of plans){
    for(let f=p.firstfixture;f<p.firstfixture+8;f++)
      for(let i=p.start;i<p.start+32;i++){
        assert.ok(!pairs.has(f+':'+i));
        pairs.add(f+':'+i);fixtures.add(f);indices.add(i);
      }
  }
  assert.equal(pairs.size,4096);
  assert.deepEqual([...fixtures].sort((a,b)=>a-b),
    Array.from({length:32},(_,i)=>i+9));
  assert.deepEqual([...indices].sort((a,b)=>a-b),
    Array.from({length:128},(_,i)=>i+1));
  for(const args of [[-1,0],[0,4],[4,0],[0,-1],[0.1,0],
      ['0',0],[0,null],[NaN,0],[0,Infinity]])
    assert.throws(()=>v74ShardPlan(...args),/INVALID_P5_V74_SHARD/);
});

test('initial possession threshold is fixture-specific and bounded',()=>{
  const c=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(c.clubs.map(x=>[x.id,x]));
  const fixtures=generateDoubleRoundRobin(c.clubs.map(x=>x.id))
    .flatMap(r=>r.fixtures).slice(8,40);
  assert.equal(fixtures.length,32);
  const thresholds=fixtures.map(f=>v74InitialThreshold(f,c,clubs));
  assert.ok(thresholds.every(x=>Number.isFinite(x)&&x>=0.27&&x<=0.73));
  const low=Array.from({length:128},(_,i)=>firstPossessionDraw(i+1));
  assert.ok(thresholds.every(t=>low.every(x=>x<t)));
  const mapped=Array.from({length:128},(_,i)=>
    firstPossessionDraw(researchSeedFromIndex(i+1)));
  assert.ok(thresholds.some(t=>mapped.some(x=>x>=t)));
});
