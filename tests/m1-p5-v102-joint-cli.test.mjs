import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeM1V102JointGap}
  from '../scripts/m1-p5-v102-joint-gap.mjs';

test('v102 source-based density gap is derived, not an acceptance flag',()=>{
  const observed=summarizeM1V102JointGap();
  assert.equal(observed.accepted,1920);
  assert.equal(observed.sourceSchema,99);
  assert.equal(observed.status,'P5_V102_OBSERVED_NOT_CALIBRATED');
  assert.ok(Math.abs(observed.model.shotsPerMatch-21.478125)<1e-10);
  assert.ok(Math.abs(observed.model.onTargetPerMatch-10.9494791667)<1e-8);
  assert.ok(Math.abs(observed.model.openPlayGoalsPerMatch-3.9244791667)<1e-8);
  assert.ok(Math.abs(observed.observed.shotsPerMatch-23.1166666667)<1e-8);
  assert.ok(Math.abs(observed.observed.onTargetPerMatch-7.8291666667)<1e-8);
  assert.ok(Math.abs(observed.observed.allTypesGoalsPerMatch-2.5375)<1e-10);
  assert.ok(observed.perMatchRatios.shots<1);
  assert.ok(observed.perMatchRatios.onTarget>1.3);
  assert.ok(observed.perMatchRatios.modelOpenPlayVsAllRealGoals>1.5);
  assert.equal(observed.strictGoalComparisonValid,false);
  assert.equal(observed.strictShotTaxonomyComparisonValid,false);
  assert.equal(observed.xgReferenceAvailable,false);
  assert.equal(observed.holdout2024_25Used,false);
  assert.equal(observed.releaseCalibrationAccepted,false);
});
