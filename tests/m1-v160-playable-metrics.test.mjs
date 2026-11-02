import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V122DenseOrdinaryMatch}
  from '../dist/core/m1-v122-dense-ordinary-season.js';
import {simulateM1V105SpecialGoalChronology}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {deriveM1V160PlayableMetrics}
  from '../dist/core/m1-v160-playable-metrics.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const initial=createInitialCareer(catalog,
  catalog.clubs[0].id,47,'v160-source-playable');
function source(){
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  let journal=started.journal;
  for(let i=0;i<2;i++){
    const candidate=prepareM1V122DenseOrdinaryMatch(initial,journal);
    assert.equal(candidate?.ok,true,JSON.stringify(candidate).slice(0,300));
    const appended=applyM1V120Source(initial,journal,candidate.request);
    assert.equal(appended.ok,true,JSON.stringify(appended).slice(0,350));
    journal=appended.journal;
  }
  return journal;
}
test('v160 initially empty metrics are typed, not invented rates',()=>{
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const out=deriveM1V160PlayableMetrics(initial,started.journal);
  assert.equal(out.ok,true);
  assert.equal(out.report.matches,0);
  assert.equal(out.report.twoTeamTotal.goalsAllTypes,0);
  assert.equal(out.report.providerShotTaxonomyVerified,false);
  assert.equal(out.report.releaseCalibrationAccepted,false);
});
test('v160 source-replays two actual dense fixtures with all goal types split',()=>{
  const journal=source();
  const before=JSON.stringify(journal);
  const result=deriveM1V160PlayableMetrics(initial,journal);
  assert.equal(result.ok,true);
  const r=result.report;
  assert.equal(r.schemaVersion,160);
  assert.equal(r.matches,2);
  assert.equal(r.journalRevision,2);
  assert.equal(r.outcomeHomeWins+r.outcomeDraws+r.outcomeAwayWins,2);
  assert.equal(r.providerShotTaxonomyVerified,false);
  assert.equal(r.providerGoalsAllTypesComparable,false);
  assert.equal(r.fullLeagueFixtureCoverage,false);
  assert.equal(r.holdout2024_25Used,false);
  for(const side of ['home','away']){
    const sum=journal.entries.reduce((a,e)=>a+e.result.report[side].goals,0);
    assert.equal(r[side].goalsAllTypes,sum);
    assert.equal(r[side].goalsAllTypes,
      r[side].openPlayGoals+r[side].penaltyGoals+r[side].ownGoalsFor);
    assert.equal(r[side].openPlayXgMilli,
      journal.entries.reduce((a,e)=>a+e.result.report[side].xgMilli,0));
  }
  assert.equal(r.twoTeamTotal.goalsAllTypes,
    r.home.goalsAllTypes+r.away.goalsAllTypes);
  assert.equal(r.twoTeamTotal.shots,
    r.home.shots+r.away.shots);
  assert.equal(JSON.stringify(journal),before);
  assert.deepEqual(deriveM1V160PlayableMetrics(initial,journal),result);
});
test('v160 refuses forged outcome/source and earlier save revisions',()=>{
  const journal=source(),modified=structuredClone(journal);
  modified.entries[0].result.report.home.goals++;
  assert.deepEqual(deriveM1V160PlayableMetrics(initial,modified),
    {ok:false,error:'INVALID_JOURNAL'});
  const bad=structuredClone(journal);
  bad.revision++;
  assert.deepEqual(deriveM1V160PlayableMetrics(initial,bad),
    {ok:false,error:'INVALID_JOURNAL'});
});

test('v160 separates replayed synthetic penalty and own goal from open play',()=>{
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const prepared=prepareM1V122DenseOrdinaryMatch(initial,started.journal);
  assert.equal(prepared?.ok,true);
  const req=prepared.request,fixture=prepared.fixture;
  const pos=new Map(initial.catalog.players.map(x=>[x.id,x.primaryPosition]));
  const homeOut=req.prematch.homeLineup.starters.find(id=>
    pos.get(id)!=='GK');
  const awayOut=req.prematch.awayLineup.starters.find(id=>
    pos.get(id)!=='GK');
  assert.ok(homeOut&&awayOut);
  const decisions=[
    {schemaVersion:1,decisionId:'v160-synthetic-penalty',
      fixtureId:fixture.id,teamId:fixture.homeClubId,
      playerId:homeOut,elapsedSeconds:0,kind:'penalty-kick',
      outcome:'scored'},
    {schemaVersion:1,decisionId:'v160-synthetic-own-goal',
      fixtureId:fixture.id,teamId:fixture.homeClubId,
      playerId:awayOut,elapsedSeconds:300,kind:'own-goal'},
  ];
  const simulated=simulateM1V105SpecialGoalChronology(
    req.prematch,req.policy,[],[],[],decisions);
  assert.equal(simulated.ok,true,JSON.stringify(simulated).slice(0,350));
  const appended=applyM1V120Source(initial,started.journal,{
    ...req,commandId:'v160-synthetic-adjudications',
    trustedDecisions:decisions,result:simulated,
  });
  assert.equal(appended.ok,true,JSON.stringify(appended).slice(0,350));
  const cohort=deriveM1V160PlayableMetrics(initial,appended.journal);
  assert.equal(cohort.ok,true);
  assert.equal(cohort.report.matches,1);
  const home=cohort.report.home;
  assert.equal(home.penaltiesTaken,1);
  assert.equal(home.penaltyGoals,1);
  assert.equal(home.ownGoalsFor,1);
  assert.equal(home.goalsAllTypes,home.openPlayGoals+2);
  assert.equal(cohort.report.providerGoalsAllTypesComparable,false);
  assert.equal(simulated.refereeAndPhysicianAuthorityAuthenticated,false);
});
