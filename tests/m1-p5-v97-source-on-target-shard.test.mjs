import test from 'node:test';
import assert from 'node:assert/strict';
import {researchSeedM1V97,runM1V97TargetSourceShard}
  from '../scripts/m1-p5-v97-source-on-target-shard.mjs';

test('v97 fixture-index source observation seeds do not reuse previous fixture RNG streams',()=>{
  const ids=['a-0-0','a-0-1','a-1-0','b-0-0'];
  const mapped=ids.flatMap(id=>Array.from({length:8},
    (_,i)=>researchSeedM1V97(id,i+1)));
  assert.equal(mapped.length,32);
  assert.equal(new Set(mapped).size,32);
  assert.ok(mapped.every(x=>Number.isSafeInteger(x)&&x>0&&x<=0xffffffff));
  assert.equal(researchSeedM1V97('a-0-0',1),researchSeedM1V97('a-0-0',1));
  for(const bad of [0,9,-1,0.5,'1',null,undefined,Infinity])
    assert.throws(()=>researchSeedM1V97('a-0-0',bad),
      /V97_INVALID_SEED_PAIR/);
});

test('v97 original fully replayed v88 on-target census conserves all games and distinct metrics',()=>{
  const x=runM1V97TargetSourceShard(0);
  assert.equal(x.schemaVersion,1);
  assert.equal(x.fixtureCount,15);
  assert.equal(x.researchSeedsUnique,120);
  assert.equal(x.synthetic.attempted,120);
  assert.equal(x.synthetic.accepted+x.synthetic.rejected,120);
  assert.equal(x.perFixture.length,15);
  assert.equal(x.synthetic.shots,x.perFixture.reduce((n,r)=>n+r.shots,0));
  assert.equal(x.synthetic.shotsOnTarget,
    x.perFixture.reduce((n,r)=>n+r.shotsOnTarget,0));
  assert.ok(x.synthetic.openPlayGoals<=x.synthetic.shotsOnTarget);
  assert.ok(x.synthetic.shotsOnTarget<=x.synthetic.shots);
  assert.equal(x.realReference.shotsOnTarget,1879);
  assert.equal(x.realReference.totalGoals,609);
  assert.equal(x.realReference.realXg,null);
  assert.equal(x.modelOpenPlayGoalsNotComparableToAllRealGoals,true);
  assert.equal(x.independentRealXgUnavailable,true);
  assert.equal(x.shotDefinitionVerifiedAgainstPublisher,false);
  assert.equal(x.holdout2024_25Used,false);
  assert.equal(x.productionRngOrSavedSchemaChanged,false);
  assert.equal(x.releaseCalibrationAccepted,false);
  assert.match(x.digestSha256,/^[0-9a-f]{64}$/);
});

test('v97 rejects invalid shard without falsely producing measurements',()=>{
  for(const bad of [-1,16,99,0.1,'0',null,undefined])
    assert.throws(()=>runM1V97TargetSourceShard(bad),
      /V97_INVALID_FIXTURE_SHARD/);
});
