import test from 'node:test';
import assert from 'node:assert/strict';
import {compare2023RplIndependentScoreReports as compare}
  from '../scripts/m1-p5-two-publisher-2023-24.mjs';
import {OPENFOOTBALL_RPL_2023_24}
  from '../scripts/m1-p5-openfootball-2023-24.mjs';
const values={
  finishedMatches:240,homeWins:113,draws:66,awayWins:61,
  scoreless:20,homeGoals:359,awayGoals:278,
  totalGoals:637,observedClubCount:16,
};
const foot=()=>({
  schemaVersion:1,source:{publisher:'footbolno.ru',leagueId:'235'},
  sample:{finishedMatches:240,requiredMatches:240,
    distinctSeasonClubs:16,matchesWithAnyEvent:238},
  fullSeasonResultCoverage:true,expectedScopeCovered:true,
  reservedHoldoutUsed:false,
  observedResultCounts:{
    matches:240,homeWins:113,draws:66,awayWins:61,
    scoreless:20,homeGoals:359,awayGoals:278,allGoals:637,
  },
});
const open=()=>({
  schemaVersion:1,source:{...OPENFOOTBALL_RPL_2023_24},
  observed:{...values},trainingSeason:'2023/2024',
  reservedUntouchedHoldoutSeason:'2024/2025',
  referenceApproved:false,modelTuned:false,
});
test('matching independent score totals are NOT a simulator calibration pass',()=>{
  const x=compare(foot(),open());
  assert.equal(x.sourceScoreAgreement,true);
  assert.equal(x.deltas.length,8);
  assert.ok(x.deltas.every(d=>d.footbolnoMinusOpenFootball===0));
  assert.equal(x.statisticalCalibrationPassed,false);
  assert.equal(x.syntheticGameEngineCompared,false);
  assert.equal(x.cardsCompared,false);
  assert.equal(x.holdout2024_25Used,false);
  assert.equal(JSON.stringify(x),JSON.stringify(compare(foot(),open())));
});
test('real disagreement is reported, not artificially tuned away',()=>{
  const f=foot();
  f.observedResultCounts.homeGoals++;
  f.observedResultCounts.allGoals++;
  const x=compare(f,open());
  assert.equal(x.sourceScoreAgreement,false);
  assert.match(x.status,/DISAGREE/);
  assert.deepEqual(x.deltas.filter(d=>d.footbolnoMinusOpenFootball!==0)
    .map(d=>d.metric),['homeGoals','totalGoals']);
  assert.equal(x.modelAdjusted,false);
  assert.equal(x.statisticalCalibrationPassed,false);
});
test('malformed source, wrong season, invented count and holdout access fail closed',()=>{
  const checks=[
    [f=>{f.sample.finishedMatches=239;},'INCOMPLETE'],
    [f=>{f.sample.distinctSeasonClubs=15;},'INCOMPLETE'],
    [f=>{f.reservedHoldoutUsed=true;},'SOURCE_IDENTITY'],
    [f=>{f.source.leagueId='240';},'SOURCE_IDENTITY'],
    [f=>{f.observedResultCounts.allGoals=1;},'INCONSISTENT'],
    [f=>{f.observedResultCounts.draws=-1;},'INVALID_COUNT'],
  ];
  for(const [edit,error] of checks){
    const f=foot();edit(f);
    assert.throws(()=>compare(f,open()),new RegExp(error));
  }
  const bad=open();bad.source.sha256='0'.repeat(64);
  assert.throws(()=>compare(foot(),bad),/SOURCE_IDENTITY/);
  const o=open();o.observed.awayWins++;
  assert.throws(()=>compare(foot(),o),/INCONSISTENT/);
  assert.throws(()=>compare(null,open()),/INVALID_REPORT/);
});
