import test from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/m1-p5-v106-v104-shard-evidence.json' with {type:'json'};
import {deriveM1V108TaxonomyEnvelope as derive}
  from '../scripts/m1-p5-v108-taxonomy-envelope.mjs';

test('v108 bounds derive only from the pinned 16-shard v106 evidence',()=>{
  const original=structuredClone(evidence);
  const result=derive(evidence);
  assert.equal(result.sourceMatchesPerCandidate,1920);
  assert.deepEqual(Object.keys(result.candidates),
    ['baseline','candidateA','candidateB']);
  const b=result.candidates.candidateB;
  assert.equal(b.shots,44584);
  assert.equal(b.modelOpenPlayGoals,4848);
  assert.equal(b.modelSaved,10903);
  assert.equal(b.modelGenericBlocks,12870);
  assert.equal(b.modelOffTarget,15963);
  assert.equal(b.modelReportedOnTarget,15751);
  assert.equal(b.hypotheticalOnTargetIfAllGenericBlocksWereLastLine,28621);
  assert.equal(b.unresolvedLastLineBlockSplit,12870);
  assert.equal(b.reportedOnTargetPerMatch,15751/1920);
  assert.equal(b.hypotheticalUpperOnTargetPerMatch,28621/1920);
  assert.equal(result.providerShotDefinitionVerified,false);
  assert.equal(result.providerLastLineBlocksIdentified,false);
  assert.equal(result.realAndModelGoalDefinitionsHarmonized,false);
  assert.equal(result.holdout2024_25Used,false);
  assert.equal(result.releaseCalibrationAccepted,false);
  assert.deepEqual(evidence,original);
});
test('v108 categories conserve each candidate and do not masquerade as real totals',()=>{
  const result=derive();
  for(const row of Object.values(result.candidates)){
    assert.equal(row.shots,row.modelOpenPlayGoals+row.modelSaved+
      row.modelGenericBlocks+row.modelOffTarget);
    assert.equal(row.modelReportedOnTarget,row.modelOpenPlayGoals+row.modelSaved);
    assert.ok(row.modelReportedOnTarget<=
      row.hypotheticalOnTargetIfAllGenericBlocksWereLastLine);
    assert.ok(row.hypotheticalOnTargetIfAllGenericBlocksWereLastLine<=row.shots);
    assert.equal(row.targetDefinitionComparableToPublisher,false);
    assert.equal(row.allGoalTypesComparableToPublisher,false);
  }
  assert.equal(result.referenceMatches,240);
  assert.equal(result.referenceShotsPerMatch,5548/240);
  assert.equal(result.referenceOnTargetPerMatch,1879/240);
  assert.equal(result.referenceGoalsAllTypesPerMatch,609/240);
});
test('v108 rejects tampered frozen evidence rather than recomputing a new baseline',()=>{
  const changed=structuredClone(evidence);
  changed.shards[0].totals.candidateB.blocked++;
  assert.throws(()=>derive(changed),/V106_/);
  const wrongSource=structuredClone(evidence);
  wrongSource.source.headSha='0'.repeat(40);
  assert.throws(()=>derive(wrongSource),/V106_/);
});
