import test from 'node:test';
import assert from 'node:assert/strict';
import {observeM1V29ShotGoalBudget as inspect}
  from '../scripts/m1-p5-v68-shot-goal-budget.mjs';
const make=()=>{
  const accepted=8,shots=50,goals=7;
  return {schemaVersion:1,
    status:'SEEDED_CAUSAL_MEDICAL_REGRESSION_NOT_CALIBRATION',
    sourceEngine:'m1-v29-synthetic-medical-source',
    totalCases:10,accepted,rejected:2,totalGoals:goals,
    deterministicSha256:'a'.repeat(64),
    realFootballReferenceSample:false,injuryOccurrenceCalibrated:false,
    p5Observation:{accepted,rejected:2,
      perAcceptedMatch:{
        shots:{count:accepted,total:shots,mean:shots/accepted},
        goals:{count:accepted,total:goals,mean:goals/accepted},
      },
      shotStructure:{
        schemaVersion:1,virtualPhasesPerMatch:18,
        theoreticalShotEventsCapPerMatch:18,
        oneShotEventPerPhaseVerified:true,
        observedMinimumShotsPerAcceptedMatch:3,
        observedMaximumShotsPerAcceptedMatch:9,
        observedShotlessAcceptedMatches:0,
        realRplShotReferenceAvailable:false,
        modelShotsPerAcceptedMatch:shots/accepted,
      },
    },
  };
};
test('bounded source shot and goal decomposition is arithmetic, NOT calibration',()=>{
  const result=inspect(make());
  assert.equal(result.accepted,8);
  assert.equal(result.rejected,2);
  assert.equal(result.structure.maximumSourceShotsPerMatch,18);
  assert.equal(result.shotOpportunities.used,50);
  assert.equal(result.shotOpportunities.theoreticalMax,144);
  assert.equal(result.shotOpportunities.occupancy,50/144);
  assert.equal(result.realizedOpenPlayGoals.goalsPerSourceShot,7/50);
  assert.equal(result.realizedOpenPlayGoals.exactArithmeticIdentity,true);
  assert.equal(result.xgValidatedAgainstExternalSource,false);
  assert.equal(result.metricComparableWithAllRealGoals,false);
  assert.equal(result.calibrationPassed,false);
  assert.equal(result.holdout2024_25Used,false);
  assert.deepEqual(inspect(make()),result);
});
test('source tampering, impossible shot totals and forged acceptance fail closed',()=>{
  const cases=[
    [x=>{x.accepted=9;},/PROVENANCE_OR_DENOMINATOR/],
    [x=>{x.rejected=1;},/PROVENANCE_OR_DENOMINATOR/],
    [x=>{x.p5Observation.shotStructure.theoreticalShotEventsCapPerMatch=36;},/SHOT_OR_GOAL/],
    [x=>{x.p5Observation.perAcceptedMatch.goals.total=51;},/SHOT_OR_GOAL/],
    [x=>{x.p5Observation.perAcceptedMatch.shots.mean=3;},/SHOT_OR_GOAL/],
    [x=>{x.p5Observation.shotStructure.observedMaximumShotsPerAcceptedMatch=19;},/SHOT_OR_GOAL/],
    [x=>{x.p5Observation.shotStructure.realRplShotReferenceAvailable=true;},/SHOT_OR_GOAL/],
    [x=>{x.realFootballReferenceSample=true;},/PROVENANCE_OR_DENOMINATOR/],
  ];
  for(const [mutate,expected] of cases){
    const c=make();mutate(c);
    assert.throws(()=>inspect(c),expected);
  }
  assert.throws(()=>inspect(null),/PROVENANCE_OR_DENOMINATOR/);
});
test('valid zero-source-shots cohort yields no fabricated conversion rate',()=>{
  const c=make();
  c.p5Observation.perAcceptedMatch.shots={count:8,total:0,mean:0};
  c.p5Observation.perAcceptedMatch.goals={count:8,total:0,mean:0};
  c.p5Observation.shotStructure.modelShotsPerAcceptedMatch=0;
  c.p5Observation.shotStructure.observedMinimumShotsPerAcceptedMatch=0;
  c.p5Observation.shotStructure.observedMaximumShotsPerAcceptedMatch=0;
  c.p5Observation.shotStructure.observedShotlessAcceptedMatches=8;
  c.totalGoals=0;
  const x=inspect(c);
  assert.equal(x.realizedOpenPlayGoals.goalsPerSourceShot,null);
  assert.equal(x.realizedOpenPlayGoals.naiveWilson95ConditionalOnObservedShots,null);
  assert.equal(x.realizedOpenPlayGoals.exactArithmeticIdentity,true);
});
