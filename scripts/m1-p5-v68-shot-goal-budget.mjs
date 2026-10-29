/**
 * P5 v68 purely observational shot budget from source-replayed v29 matches.
 * Does not touch RNG, tactics, game reports or saved careers.
 */
export const M1_P5_V68_GOAL_BUDGET_SCHEMA=1;
const fail=x=>{throw Error('P5_V68_INVALID_SOURCE:'+x)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
function wilson95(k,n) {
  const z=1.959963984540054,z2=z*z,p=k/n,d=1+z2/n;
  const mid=(p+z2/(2*n))/d;
  const spread=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/d;
  return {lower:Math.max(0,mid-spread),upper:Math.min(1,mid+spread)};
}
export function observeM1V29ShotGoalBudget(corpus){
  if(!obj(corpus)||corpus.schemaVersion!==1||
      corpus.sourceEngine!=='m1-v29-synthetic-medical-source'||
      corpus.status!=='SEEDED_CAUSAL_MEDICAL_REGRESSION_NOT_CALIBRATION'||
      !obj(corpus.p5Observation)||
      !obj(corpus.p5Observation.perAcceptedMatch)||
      !obj(corpus.p5Observation.shotStructure)||
      !int(corpus.accepted)||corpus.accepted===0||
      !int(corpus.rejected)||!int(corpus.totalCases)||
      corpus.accepted+corpus.rejected!==corpus.totalCases||
      corpus.p5Observation.accepted!==corpus.accepted||
      corpus.p5Observation.rejected!==corpus.rejected||
      corpus.realFootballReferenceSample!==false||
      corpus.injuryOccurrenceCalibrated!==false||
      !/^[a-f0-9]{64}$/.test(corpus.deterministicSha256)){
    fail('PROVENANCE_OR_DENOMINATOR');
  }
  const p=corpus.p5Observation, shots=p.perAcceptedMatch.shots,
        goals=p.perAcceptedMatch.goals,structure=p.shotStructure;
  if(!obj(shots)||!obj(goals)||
      shots.count!==corpus.accepted||goals.count!==corpus.accepted||
      !int(shots.total)||!int(goals.total)||goals.total>shots.total||
      !Number.isFinite(shots.mean)||!Number.isFinite(goals.mean)||
      shots.mean!==shots.total/corpus.accepted||
      goals.mean!==goals.total/corpus.accepted||
      corpus.totalGoals!==goals.total||
      structure.schemaVersion!==1||
      structure.virtualPhasesPerMatch!==18||
      structure.theoreticalShotEventsCapPerMatch!==18||
      structure.oneShotEventPerPhaseVerified!==true||
      structure.realRplShotReferenceAvailable!==false||
      structure.observedMinimumShotsPerAcceptedMatch<0||
      structure.observedMaximumShotsPerAcceptedMatch>18||
      !int(structure.observedShotlessAcceptedMatches)||
      structure.observedShotlessAcceptedMatches>corpus.accepted||
      structure.modelShotsPerAcceptedMatch!==shots.mean||
      shots.total>18*corpus.accepted){
    fail('SHOT_OR_GOAL_CONSERVATION');
  }
  if(shots.total===0&&goals.total>0)fail('SHOTS_ZERO_WITH_GOALS');
  const conversion=shots.total===0?null:goals.total/shots.total;
  return {
    schemaVersion:M1_P5_V68_GOAL_BUDGET_SCHEMA,
    status:'SOURCE_REPLAYED_OPEN_PLAY_BUDGET_NOT_CALIBRATED',
    attempted:corpus.totalCases,accepted:corpus.accepted,
    rejected:corpus.rejected,
    sourceReplayDigestSha256:corpus.deterministicSha256,
    structure:{
      phaseCount:18,maximumSourceShotsPerMatch:18,
      observedMin:structure.observedMinimumShotsPerAcceptedMatch,
      observedMax:structure.observedMaximumShotsPerAcceptedMatch,
      shotlessAccepted:structure.observedShotlessAcceptedMatches,
    },
    shotOpportunities:{
      used:shots.total,
      theoreticalMax:18*corpus.accepted,
      occupancy:shots.total/(18*corpus.accepted),
      shotsPerAcceptedMatch:shots.mean,
    },
    realizedOpenPlayGoals:{
      count:goals.total,perAcceptedMatch:goals.mean,
      goalsPerSourceShot:conversion,
      naiveWilson95ConditionalOnObservedShots:conversion===null?null:
        wilson95(goals.total,shots.total),
      exactArithmeticIdentity:
        conversion===null?goals.total===0:
        Math.abs(shots.mean*conversion-goals.mean)<1e-12,
    },
    caveats:[
      'REALIZED_CONVERSION_NOT_SHOT_XG',
      'SEEDS_AND_FIXTURES_CLUSTERED_NONINDEPENDENT',
      'SIMULATOR_OPEN_PLAY_ONLY_SPECIAL_GOALS_MISSING',
      'NO_INDEPENDENT_RPL_SHOT_OR_XG_REFERENCE',
    ],
    xgValidatedAgainstExternalSource:false,
    metricComparableWithAllRealGoals:false,
    tuningPerformed:false,preregisteredAcceptance:false,
    calibrationPassed:false,holdout2024_25Used:false,
  };
}
