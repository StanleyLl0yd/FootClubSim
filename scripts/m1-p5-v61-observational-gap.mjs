/**
 * Descriptive RPL 2023/24 result gaps against synthetic v29.
 * Only independently cross-checked completed-score aggregates are compared.
 * No holdout, no invented metric compatibility, no pass/fail tolerance.
 */
import {compare2023RplIndependentScoreReports}
  from './m1-p5-two-publisher-2023-24.mjs';

export const M1_P5_V61_SCHEMA=1;
const fail=why=>{throw Error('M1_P5_V61_INVALID_INPUT:'+why);};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function wilson95(k,n){
  const z=1.959963984540054,z2=z*z,p=k/n,d=1+z2/n;
  const center=(p+z2/(2*n))/d;
  const half=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/d;
  return {lower:Math.max(0,center-half),upper:Math.min(1,center+half)};
}
export function observeM1V29VsIndependent2023Rpl(
  footbolno,openfootball,cohort,
){
  const sources=compare2023RplIndependentScoreReports(
    footbolno,openfootball);
  if(!sources.sourceScoreAgreement)fail('SOURCE_DISAGREEMENT');
  if(!record(cohort)||cohort.schemaVersion!==1||
      cohort.sourceEngine!=='m1-v29-synthetic-medical-source'||
      cohort.status!=='SEEDED_CAUSAL_MEDICAL_REGRESSION_NOT_CALIBRATION'||
      !record(cohort.p5Observation)||
      cohort.p5Observation.status!==
        'SYNTHETIC_V29_CONDITIONAL_OBSERVATION_NOT_CALIBRATION'||
      !record(cohort.p5Observation.outcomeRates)||
      !record(cohort.p5Observation.perAcceptedMatch)||
      !integer(cohort.start)||cohort.start<1||
      !integer(cohort.count)||cohort.count<1||cohort.count>128||
      !integer(cohort.fixtureCount)||cohort.fixtureCount<1||
      cohort.fixtureCount>32||
      !integer(cohort.totalCases)||cohort.totalCases!==
        cohort.count*cohort.fixtureCount||
      !integer(cohort.accepted)||cohort.accepted<1||
      !integer(cohort.rejected)||cohort.rejected<0||
      cohort.accepted+cohort.rejected!==cohort.totalCases||
      cohort.p5Observation.accepted!==cohort.accepted||
      cohort.p5Observation.rejected!==cohort.rejected||
      cohort.p5Observation.denominatorPolicy!==
        'SUCCESSFUL_FULL_SOURCE_REPLAYS_ONLY'||
      !/^[0-9a-f]{64}$/.test(cohort.deterministicSha256)||
      cohort.realFootballReferenceSample!==false||
      cohort.injuryOccurrenceCalibrated!==false)fail('CORPUS_PROVENANCE');
  const outcome=cohort.p5Observation.outcomeRates;
  const pairs=[
    ['homeWin','homeWins'],['draw','draws'],['awayWin','awayWins'],
    ['scorelessDraw','scoreless'],
  ];
  const source=footbolno.observedResultCounts;
  const sample=cohort.accepted;
  for(const [name] of pairs){
    const x=outcome[name];
    if(!record(x)||!integer(x.count)||x.count>sample||
        x.denominator!==sample||!finite(x.rate)||
        Math.abs(x.rate-x.count/sample)>1e-12)fail('OUTCOME:'+name);
  }
  if(outcome.homeWin.count+outcome.draw.count+
      outcome.awayWin.count!==sample)fail('OUTCOME_CONSERVATION');
  const resultRates=pairs.map(([name,key])=>{
    const s=source[key],k=outcome[name].count,n=240;
    if(!integer(s)||s>n)fail('REFERENCE_COUNT:'+key);
    return {metric:name,
      reference:{count:s,matches:n,rate:s/n,wilson95:wilson95(s,n)},
      synthetic:{count:k,acceptedMatches:sample,rate:k/sample,
        naiveWilson95AssumesIndependentGames:wilson95(k,sample)},
      differenceSyntheticMinusObserved:k/sample-s/n,
      statisticalComparability:
        'EXPLORATORY_CLUSTERED_SEEDED_CONDITIONAL_PARTIAL_ENGINE',
    };
  });
  const goals=cohort.p5Observation.perAcceptedMatch.goals;
  if(!record(goals)||goals.count!==sample||
      !integer(goals.total)||!finite(goals.mean)||
      Math.abs(goals.mean-goals.total/sample)>1e-12||
      goals.total!==cohort.totalGoals)fail('GOALS_CONSERVATION');
  const observed=source.allGoals/240,model=goals.mean;
  return {
    schemaVersion:M1_P5_V61_SCHEMA,
    status:'DESCRIPTIVE_V29_VS_2023_RPL_GAPS_NOT_CALIBRATED',
    developmentSeason:'2023/2024',
    originalReferenceMatches:240,
    sourceAgreement:true,
    modelEngine:cohort.sourceEngine,
    modelSeedStart:cohort.start,modelSeedCount:cohort.count,
    modelFixtureCount:cohort.fixtureCount,
    modelAttempted:cohort.totalCases,
    modelAccepted:sample,modelRejected:cohort.rejected,
    sourceReplayDigestSha256:cohort.deterministicSha256,
    outcomeRates:resultRates,
    goalTotals:{
      observedAllGoalKinds:{goals:source.allGoals,matches:240,
        mean:observed},
      syntheticOpenPlayOnly:{goals:goals.total,acceptedMatches:sample,
        mean:model,naiveMean95:goals.normalMean95},
      differenceSyntheticMinusObserved:model-observed,
      comparable:false,
      reason:'MODEL_OMITS_GENERATED_PENALTIES_AND_OWN_GOALS',
    },
    qualityWarnings:[
      'SYNTHETIC_FIXTURES_AND_REUSED_SEEDS_ARE_CLUSTERED',
      'CONDITIONING_ON_SUCCESSFUL_SOURCE_REPLAY_MAY_BIAS_SAMPLE',
      'SOURCE_AGREEMENT_DOES_NOT_PROVE_INDEPENDENT_UPSTREAM_RIGHTS',
      'NO_PREREGISTERED_TOLERANCE_OR_HOLDOUT_ACCEPTANCE',
    ],
    excludedMetrics:['shots','xg','cards','clinicalInjuries'],
    realWorldMedicalOrRefereeAuthority:false,
    referencesUpstreamRightsAudited:false,
    tuningPerformed:false,calibrationPassed:false,
    calibrationPass:null,holdout2024_25Used:false,
  };
}
