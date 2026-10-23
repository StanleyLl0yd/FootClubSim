import test from 'node:test';
import assert from 'node:assert/strict';
import {observeM1V29VsIndependent2023Rpl as compare}
  from '../scripts/m1-p5-v61-observational-gap.mjs';
import {OPENFOOTBALL_RPL_2023_24} from '../scripts/m1-p5-openfootball-2023-24.mjs';
function sources(){
  return [
    {schemaVersion:1,source:{publisher:'footbolno.ru',leagueId:'235'},
      sample:{requiredMatches:240,finishedMatches:240,distinctSeasonClubs:16},
      fullSeasonResultCoverage:true,expectedScopeCovered:true,
      reservedHoldoutUsed:false,observedResultCounts:{
        matches:240,homeWins:113,draws:66,awayWins:61,scoreless:20,
        homeGoals:359,awayGoals:278,allGoals:637}},
    {schemaVersion:1,source:OPENFOOTBALL_RPL_2023_24,
      trainingSeason:'2023/2024',
      reservedUntouchedHoldoutSeason:'2024/2025',
      referenceApproved:false,modelTuned:false,
      observed:{finishedMatches:240,homeWins:113,draws:66,
        awayWins:61,scoreless:20,homeGoals:359,awayGoals:278,
        totalGoals:637,observedClubCount:16}},
  ];
}
function cohort(){
  const accepted=12;
  const rr=(count)=>({count,denominator:accepted,rate:count/accepted});
  return {schemaVersion:1,status:'SEEDED_CAUSAL_MEDICAL_REGRESSION_NOT_CALIBRATION',
    sourceEngine:'m1-v29-synthetic-medical-source',
    start:1,count:12,fixtureCount:1,totalCases:12,accepted,rejected:0,
    deterministicSha256:'a'.repeat(64),totalGoals:15,
    realFootballReferenceSample:false,injuryOccurrenceCalibrated:false,
    p5Observation:{
      status:'SYNTHETIC_V29_CONDITIONAL_OBSERVATION_NOT_CALIBRATION',
      accepted,rejected:0,denominatorPolicy:'SUCCESSFUL_FULL_SOURCE_REPLAYS_ONLY',
      outcomeRates:{homeWin:rr(5),draw:rr(4),awayWin:rr(3),
        scorelessDraw:rr(2)},
      perAcceptedMatch:{goals:{count:accepted,total:15,mean:1.25,
        normalMean95:{lower:0.7,upper:1.8}}},
    },
  };
}
test('real 240-game source versus synthetic conditional rates describes, never accepts',()=>{
  const f=sources(),c=cohort(),x=compare(...f,c);
  assert.equal(x.sourceAgreement,true);
  assert.equal(x.modelAttempted,12);
  assert.equal(x.modelAccepted,12);
  assert.equal(x.calibrationPassed,false);
  assert.equal(x.calibrationPass,null);
  assert.equal(x.holdout2024_25Used,false);
  assert.equal(x.outcomeRates.length,4);
  assert.equal(x.outcomeRates[0].reference.rate,113/240);
  assert.equal(x.outcomeRates[1].synthetic.rate,4/12);
  assert.equal(x.goalTotals.comparable,false);
  assert.equal(x.goalTotals.observedAllGoalKinds.mean,637/240);
  assert.equal(x.goalTotals.syntheticOpenPlayOnly.mean,1.25);
  assert.deepEqual(x,compare(...sources(),cohort()));
  assert.equal(JSON.stringify(x).includes('2024/2025'),false);
});
test('bad accepted denominators, forged scores and missing input fail closed',()=>{
  const edit=[
    [x=>{x.accepted=11;},/CORPUS_PROVENANCE/],
    [x=>{x.p5Observation.accepted=11;},/CORPUS_PROVENANCE/],
    [x=>{x.p5Observation.outcomeRates.draw.rate=0.1;},/OUTCOME/],
    [x=>{x.p5Observation.outcomeRates.draw.count=12;},/OUTCOME_CONSERVATION/],
    [x=>{x.totalGoals=20;},/GOALS_CONSERVATION/],
    [x=>{x.injuryOccurrenceCalibrated=true;},/CORPUS_PROVENANCE/],
  ];
  for(const [mutate,pattern] of edit){
    const c=cohort();mutate(c);
    assert.throws(()=>compare(...sources(),c),pattern);
  }
  const [f,o]=sources();f.observedResultCounts.homeWins++;
  assert.throws(()=>compare(f,o,cohort()),/INCONSISTENT_TOTALS/);
  assert.throws(()=>compare(...sources(),null),/CORPUS_PROVENANCE/);
});
test('valid but source-divergent outcomes are not treated as calibration',()=>{
  const [f,o]=sources();
  f.observedResultCounts.homeGoals++;
  f.observedResultCounts.allGoals++;
  assert.throws(()=>compare(f,o,cohort()),/SOURCE_DISAGREEMENT/);
});
