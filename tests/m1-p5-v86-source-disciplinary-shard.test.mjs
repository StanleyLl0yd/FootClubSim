import test from 'node:test';
import assert from 'node:assert/strict';
import {v86Plans,runM1V86DisciplineSourceShard as measure}
  from '../scripts/m1-p5-v86-source-disciplinary-shard.mjs';

test('v86 preregistered shards cover full two-leg synthetic fixture calendar',()=>{
  const plans=v86Plans(),indices=new Set();
  assert.equal(plans.length,16);
  for(const p of plans){
    assert.equal(p.fixtureCount,15);
    assert.equal(p.seedsPerFixture,8);
    for(let i=p.firstFixture;i<p.firstFixture+p.fixtureCount;i++){
      assert.ok(!indices.has(i),'fixture index already covered');
      indices.add(i);
    }
  }
  assert.equal(indices.size,240);
  assert.ok(indices.has(1)&&indices.has(240));
  assert.ok(!indices.has(241));
});

test('v86 first full-source shard conserves referee event and physical player evidence',()=>{
  const x=measure(0);
  assert.equal(x.schemaVersion,1);
  assert.equal(x.synthetic.attempted,120);
  assert.equal(x.synthetic.accepted+x.synthetic.rejected,120);
  assert.equal(x.perFixture.length,15);
  assert.equal(x.modelScoreIncludesOnlyGeneratedOpenPlayGoals,true);
  assert.equal(x.independentlyGeneratedPenaltiesInThisDefaultPath,false);
  assert.equal(x.actualSourceShotsOnTarget,null);
  assert.equal(x.externalRefereeAndMedicalAuthenticated,false);
  assert.equal(x.sourceFoulStoppagesAreNotAllRealWorldFouls,true);
  assert.equal(x.sourceCautionsMayNotMatchRealProviderCardTaxonomy,true);
  assert.equal(x.releaseCalibrationAccepted,false);
  assert.equal(x.holdout2024_25Used,false);
  assert.equal(x.productionProbabilityOrRngModified,false);
  assert.match(x.digestSha256,/^[a-f0-9]{64}$/);
  assert.ok(x.perFixture.every(row=>row.attempted===8&&
    row.accepted+row.rejected===8));
});

test('v86 shard inputs are bounded and cannot silently coerce invalid groups',()=>{
  for(const invalid of [-1,16,17,0.5,NaN,Infinity,'0',null,undefined])
    assert.throws(()=>measure(invalid),/V86_INVALID_GROUP/);
});
