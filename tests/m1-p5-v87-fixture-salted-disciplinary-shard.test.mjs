import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureSeedV87,runM1V87DisciplineSourceShard as run,
  v87Plans} from '../scripts/m1-p5-v87-fixture-salted-disciplinary-shard.mjs';

test('v87 per-fixture mapping is deterministic and avoids repeated referee seed streams',()=>{
  const inputs=['a-0-0','a-0-1','a-1-0','b-0-0'];
  const seeds=inputs.flatMap(id=>Array.from({length:8},(_,i)=>fixtureSeedV87(id,i+1)));
  assert.equal(seeds.length,32);
  assert.equal(new Set(seeds).size,32);
  assert.ok(seeds.every(x=>Number.isSafeInteger(x)&&x>0&&x<=0xffffffff));
  assert.equal(fixtureSeedV87('a-0-0',1),fixtureSeedV87('a-0-0',1));
  assert.notEqual(fixtureSeedV87('a-0-0',1),fixtureSeedV87('a-0-1',1));
  for(const bad of [0,-1,9,1.5,NaN,Infinity,null,'1'])
    assert.throws(()=>fixtureSeedV87('a-0-0',bad),/V87_INVALID_SEED_PAIR/);
  for(const bad of ['',null,{},'x'.repeat(129)])
    assert.throws(()=>fixtureSeedV87(bad,1),/V87_INVALID_SEED_PAIR/);
});

test('v87 planned double round-robin keeps exact 240 fixture scope',()=>{
  const plans=v87Plans();
  assert.equal(plans.length,16);
  assert.equal(plans.reduce((a,x)=>a+x.fixtureCount,0),240);
  assert.deepEqual(plans.map(x=>x.group),Array.from({length:16},(_,i)=>i));
  assert.ok(plans.every(x=>x.seedsPerFixture===8));
});

test('v87 source-admitted distinct fixture seeds preserve reference and source card conservation',()=>{
  const x=run(0);
  assert.equal(x.fixtureCount,15);
  assert.equal(x.synthetic.attempted,120);
  assert.equal(x.synthetic.accepted+x.synthetic.rejected,120);
  assert.equal(x.distinctSourceSeeds,120);
  assert.equal(x.reference.realRedCards,26);
  assert.equal(x.reference.realFouls,6815);
  assert.equal(x.modelScoreIncludesOnlyGeneratedOpenPlayGoals,true);
  assert.equal(x.externalRefereeAndMedicalAuthenticated,false);
  assert.equal(x.holdout2024_25Used,false);
  assert.equal(x.productionProbabilityOrRngModified,false);
  assert.equal(x.releaseCalibrationAccepted,false);
  assert.equal(x.actualSourceShotsOnTarget,null);
  assert.match(x.digestSha256,/^[0-9a-f]{64}$/);
  assert.ok(x.perFixture.every(y=>y.attempted===8&&
    y.accepted+y.rejected===8));
  // Check research-seed decorrelation against v86, where every
  // fixture reused the exact same eight referee RNG seed values.
  const signatures=x.perFixture.map(y=>[
    y.sourceFirstYellows,y.sourceSecondYellowReds,y.sourceDirectReds,
    y.sourceGeneratedFoulStoppages,y.sourceModelledWithdrawals].join('/'));
  assert.ok(new Set(signatures).size>1,
    'fixture-specific research seeds must diversify referee outcomes');
});

test('v87 strictly bounds external shard and seed selection',()=>{
  for(const bad of [-1,16,0.1,'0',null,undefined])
    assert.throws(()=>run(bad),/V87_INVALID_GROUP/);
});
