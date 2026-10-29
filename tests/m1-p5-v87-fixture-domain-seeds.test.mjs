import test from 'node:test';
import assert from 'node:assert/strict';
import {researchFixtureSeedV87,V87_FIXTURE_SEEDS,
  runM1V86DisciplineSourceShard}
  from '../scripts/m1-p5-v86-source-disciplinary-shard.mjs';
import {runM1V87IndependentRefereeShard}
  from '../scripts/m1-p5-v87-fixture-domain-seed-shard.mjs';

test('v87 explicit domain separation preserves 16 unique valid seeds per fixture',()=>{
  assert.equal(V87_FIXTURE_SEEDS,16);
  const seen=new Set();
  for(const id of ['a-0-0','a-0-1','b-1-0']){
    for(let i=1;i<=16;i++){
      const seed=researchFixtureSeedV87(id,i);
      assert.ok(Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff);
      assert.ok(!seen.has(seed),id+':'+i);
      seen.add(seed);
      assert.equal(researchFixtureSeedV87(id,i),seed);
    }
  }
  for(const [id,i] of [['fake',1],['a-0-0',0],['b-1-0',17],
    [null,1],['a-0-0','1']]){
    assert.throws(()=>researchFixtureSeedV87(id,i),/INVALID_V87_FIXTURE_SEED/);
  }
});

test('v87 independent seeded research retains v86 source invariants',()=>{
  const x=runM1V87IndependentRefereeShard(0);
  assert.equal(x.synthetic.attempted,240);
  assert.equal(x.synthetic.accepted+x.synthetic.rejected,240);
  assert.equal(x.verifiedUniqueInputSeeds,240);
  assert.equal(x.perFixture.length,15);
  assert.equal(x.researchSeedStrategy,'fixture-domain-v87');
  assert.equal(x.reusedV86SourceEngine,true);
  assert.equal(x.officialRefereeOrKdkAuthorityAuthenticated,false);
  assert.equal(x.releaseCalibrationAccepted,false);
  assert.equal(x.productionProbabilityOrRngModified,false);
  assert.equal(x.holdout2024_25Used,false);
  assert.match(x.digestSha256,/^[a-f0-9]{64}$/);
  // The old intentionally shared fixture-independent research seed behavior
  // is preserved for comparison, never silently migrated.
  const base=runM1V86DisciplineSourceShard(0);
  assert.equal(base.synthetic.attempted,120);
  assert.equal(base.researchSeedStrategy,'shared');
  assert.notEqual(base.digestSha256,x.digestSha256);
});

test('v87 rejects unknown mode and invalid shard',()=>{
  assert.throws(()=>runM1V86DisciplineSourceShard(0,'hidden'),
    /V87_INVALID_RESEARCH_MODE/);
  for(const group of [-1,16,0.4,null,'0'])
    assert.throws(()=>runM1V87IndependentRefereeShard(group),
      /V86_INVALID_GROUP/);
});
