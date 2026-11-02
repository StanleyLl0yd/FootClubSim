import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectM1P5V159Compatibility}
  from '../scripts/m1-p5-v159-compatibility-gate.mjs';
import real from '../data/rpl-2025-26-p5-shot-discipline-reference.json'
  with {type:'json'};
import cohort from '../data/m1-p5-v155-observed-full-calendar.json'
  with {type:'json'};

test('v159 keeps all incompatible P5 metrics blocked, regardless of apparent fit',()=>{
  const result=inspectM1P5V159Compatibility();
  assert.equal(result.status,'BLOCKED_UNHARMONIZED_METRIC_TAXONOMY');
  assert.equal(result.observedModelRuns,34560);
  assert.equal(result.externalMetricComparisonAuthorized,false);
  assert.equal(result.modelTuningAuthorized,false);
  assert.equal(result.holdout2024_25Used,false);
  assert.equal(result.releaseCalibrationAccepted,false);
  assert.deepEqual(Object.keys(result.observedModelCases),
    ['baseline','candidateA','candidateB']);
  assert.equal(Object.keys(result.metrics).length,9);
  for(const [name,metric] of Object.entries(result.metrics)){
    assert.equal(metric.comparable,false,name);
    assert.ok(typeof metric.reason==='string'&&metric.reason.length>8);
  }
  assert.equal(result.observedModelCases.candidateB.goals,29133);
  assert.equal(result.observedModelCases.candidateB.accepted,11520);
});

test('v159 refuses fake source versions, preapproved claims and denominators',()=>{
  const clone=value=>structuredClone(value);
  const changed=(target,alter)=>{const v=clone(target);alter(v);return v;};
  for(const candidate of [
    changed(real,x=>{x.schemaVersion=2;}),
    changed(real,x=>{x.season='2024/25';}),
    changed(real,x=>{x.referenceOnly=false;}),
    changed(real,x=>{x.holdout2024_25Used=true;}),
    changed(real,x=>{x.regularSeason.matches=239;}),
  ]){
    assert.throws(()=>inspectM1P5V159Compatibility(candidate,cohort),
      /M1_P5_V159_SOURCE_CONTRACT/);
  }
  for(const candidate of [
    changed(cohort,x=>{x.schemaVersion=154;}),
    changed(cohort,x=>{x.referenceCategoryAligned=true;}),
    changed(cohort,x=>{x.releaseP5Accepted=true;}),
    changed(cohort,x=>{x.holdout2024_25Used=true;}),
    changed(cohort,x=>{x.syntheticFixtures=239;}),
    changed(cohort,x=>{x.totals.baseline.attempted=11519;}),
    changed(cohort,x=>{x.totals.candidateA.rejected=1;}),
    changed(cohort,x=>{x.totals.candidateB.goals=100000;}),
  ]){
    assert.throws(()=>inspectM1P5V159Compatibility(real,candidate),
      /M1_P5_V159_(SOURCE_CONTRACT|MODEL_DENOMINATOR)/);
  }
});
