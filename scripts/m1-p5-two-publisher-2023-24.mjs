/**
 * Two-publisher RPL 2023/24 final-score triangulation.
 * Does not test simulator realism, cards, injury rates or reserved holdout.
 */
import {FOOTBOLNO_RPL_SOURCE}
  from './m1-p5-footbolno-rpl-events.mjs';
import {OPENFOOTBALL_RPL_2023_24}
  from './m1-p5-openfootball-2023-24.mjs';
export const P5_TWO_PUBLISHER_SCORE_SCHEMA=1;
const FIELDS=Object.freeze([
  ['finishedMatches','matches'],
  ['homeWins','homeWins'],['draws','draws'],['awayWins','awayWins'],
  ['scoreless','scoreless'],['homeGoals','homeGoals'],
  ['awayGoals','awayGoals'],['totalGoals','allGoals'],
]);
const natural=n=>Number.isSafeInteger(n)&&n>=0;
const fail=reason=>{throw Error('UNVERIFIED_RPL_AGGREGATE:'+reason);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function compare2023RplIndependentScoreReports(footbolno,openfootball){
  if(!obj(footbolno)||!obj(openfootball)||
      !obj(footbolno.source)||!obj(footbolno.sample)||
      !obj(footbolno.observedResultCounts)||
      !obj(openfootball.source)||!obj(openfootball.observed)){
    fail('INVALID_REPORT');
  }
  if(footbolno.source.publisher!==FOOTBOLNO_RPL_SOURCE.publisher||
      footbolno.source.leagueId!=='235'||
      openfootball.source.sha256!==OPENFOOTBALL_RPL_2023_24.sha256||
      openfootball.source.commit!==OPENFOOTBALL_RPL_2023_24.commit||
      footbolno.schemaVersion!==1||openfootball.schemaVersion!==1||
      footbolno.reservedHoldoutUsed!==false||
      openfootball.trainingSeason!=='2023/2024'||
      openfootball.reservedUntouchedHoldoutSeason!=='2024/2025') {
    fail('SOURCE_IDENTITY_OR_HOLDOUT');
  }
  if(footbolno.sample.finishedMatches!==240||
      footbolno.sample.requiredMatches!==240||
      footbolno.sample.distinctSeasonClubs!==16||
      footbolno.fullSeasonResultCoverage!==true||
      footbolno.expectedScopeCovered!==true||
      openfootball.observed.finishedMatches!==240||
      openfootball.observed.observedClubCount!==16||
      openfootball.referenceApproved!==false||
      openfootball.modelTuned!==false) {
    fail('INCOMPLETE_SEASON_OR_REFERENCE');
  }
  const left=footbolno.observedResultCounts;
  const right=openfootball.observed;
  for(const [a,b] of FIELDS){
    if(!natural(right[a])||!natural(left[b]))fail('INVALID_COUNT:'+a);
  }
  if(left.homeWins+left.draws+left.awayWins!==240||
      right.homeWins+right.draws+right.awayWins!==240||
      left.homeGoals+left.awayGoals!==left.allGoals||
      right.homeGoals+right.awayGoals!==right.totalGoals||
      left.scoreless>240||right.scoreless>240){
    fail('INCONSISTENT_TOTALS');
  }
  const deltas=FIELDS.map(([a,b])=>({
    metric:a,footbolno:left[b],openfootball:right[a],
    footbolnoMinusOpenFootball:left[b]-right[a],
  }));
  const agreement=deltas.every(x=>x.footbolnoMinusOpenFootball===0);
  return {
    schemaVersion:P5_TWO_PUBLISHER_SCORE_SCHEMA,
    status:agreement?
      'TWO_PUBLISHER_SCORE_AGGREGATES_CONCORDANT_NOT_CALIBRATED':
      'TWO_PUBLISHER_SCORE_AGGREGATES_DISAGREE_NOT_CALIBRATED',
    competition:'Russian Premier League',developmentSeason:'2023/2024',
    analyzedFinishedMatches:240,sourceScoreAgreement:agreement,deltas,
    footbolnoSource:FOOTBOLNO_RPL_SOURCE.matches,
    openfootballSource:{
      repo:OPENFOOTBALL_RPL_2023_24.repo,
      commit:OPENFOOTBALL_RPL_2023_24.commit,
      sha256:OPENFOOTBALL_RPL_2023_24.sha256,
      correctedOneDocumentedFixture:true,
    },
    inputAggregateReportProvenance:'CALLER_SUPPLIED_INSPECTOR_REPORTS',
    rawRowsIncluded:false,sourceRightsIndependentlyCleared:false,
    cardsCompared:false,injuriesCompared:false,xgCompared:false,
    syntheticGameEngineCompared:false,modelAdjusted:false,
    statisticalCalibrationPassed:false,holdout2024_25Used:false,
  };
}
