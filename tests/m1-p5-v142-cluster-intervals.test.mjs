import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeM1P5V142ClusterIntervals}
  from '../scripts/m1-p5-v142-cluster-intervals.mjs';

function source(firstSeed,n,goalsFor=()=>2){
  const careers=Array.from({length:n},(_,i)=>{
    const seed=firstSeed+i;
    const goals=goalsFor(i,seed);
    return {seed,attempted:4,accepted:4,rejected:0,
      replayedJournals:1,verifiedVirtualSources:4,
      totals:{goals,shots:80,onTarget:30,openPlayXgMilli:8000,
        homeWins:2,draws:1,awayWins:1,cautions:8,straightReds:0,
        fictionalInjuryWithdrawals:1,secondYellowDismissals:0,
        fixturesWithEvents:4}};
  });
  const totals=Object.fromEntries(Object.keys(careers[0].totals)
    .map(k=>[k,careers.reduce((s,r)=>s+r.totals[k],0)]));
  return {schemaVersion:141,
    status:'PER_CAREER_FICTIONAL_SOURCE_CLUSTERS_NOT_CALIBRATION',
    source:'v131-v19-v124-v130-v120-replayed-per-seed',
    independentUnit:'SEED_CAREER_NOT_FIXTURE',
    firstSeed,seedCount:n,fixturesPerCareer:4,
    careers,totals,attempted:n*4,accepted:n*4,rejected:0,
    factualProviderMetricDefinitionsAligned:false,
    holdout2024_25Used:false,releaseP5Accepted:false};
}
test('v142 only enables exploratory intervals for enough career clusters',()=>{
  const small=analyzeM1P5V142ClusterIntervals([source(1,8)]);
  assert.equal(small.clusters,8);
  assert.equal(small.intervalEligible,false);
  assert.equal(small.metrics.goals.exploratory95ClusterInterval,null);
  const large=analyzeM1P5V142ClusterIntervals([
    source(17,8,(_,seed)=>seed%2?2:6),
    source(1,8,(_,seed)=>seed%2?2:6),
    source(25,8,(_,seed)=>seed%2?2:6),
    source(9,8,(_,seed)=>seed%2?2:6),
  ]);
  assert.equal(large.clusters,32);
  assert.equal(large.accepted,128);
  assert.equal(large.metrics.goals.perAcceptedFixture,1);
  const ci=large.metrics.goals.exploratory95ClusterInterval;
  assert.ok(ci&&ci.lower<1&&ci.upper>1&&ci.margin>0);
  assert.deepEqual(large,analyzeM1P5V142ClusterIntervals([
    source(1,8,(_,seed)=>seed%2?2:6),
    source(9,8,(_,seed)=>seed%2?2:6),
    source(17,8,(_,seed)=>seed%2?2:6),
    source(25,8,(_,seed)=>seed%2?2:6),
  ]));
  assert.equal(large.metrics.openPlayXgMilli.perAcceptedFixture,2);
  assert.equal(large.recordConsistencyChecked,true);
  assert.equal(large.holdout2024_25Used,false);
  assert.equal(large.releaseP5Accepted,false);
});
test('v142 deterministic zero-variance and bounded outcome intervals',()=>{
  const report=analyzeM1P5V142ClusterIntervals([
    source(1,8),source(9,8),source(17,8),source(25,8)]);
  assert.deepEqual(report.metrics.goals.exploratory95ClusterInterval,
    {lower:0.5,upper:0.5,margin:0});
  assert.deepEqual(report.metrics.homeWins.exploratory95ClusterInterval,
    {lower:0.5,upper:0.5,margin:0});
});
test('v142 fails closed on overlap, unverified rows and drift',()=>{
  const a=source(1,8);
  assert.throws(()=>analyzeM1P5V142ClusterIntervals([a,a]),
    /V142_UNVERIFIED_CAREER/);
  const changed=structuredClone(a);
  changed.careers[0].totals.goals=999;
  assert.throws(()=>analyzeM1P5V142ClusterIntervals([changed]),
    /V142_SHARD_AGGREGATE_DRIFT/);
  const forged=structuredClone(a);
  forged.careers[0].replayedJournals=0;
  assert.throws(()=>analyzeM1P5V142ClusterIntervals([forged]),
    /V142_UNVERIFIED_CAREER/);
  const wrongSource=structuredClone(a);
  wrongSource.source='untrusted-v131-mimic';
  assert.throws(()=>analyzeM1P5V142ClusterIntervals([wrongSource]),
    /V142_UNVERIFIED_SHARD/);
  const implausible=structuredClone(a);
  implausible.careers[0].totals.fixturesWithEvents=5;
  assert.throws(()=>analyzeM1P5V142ClusterIntervals([implausible]),
    /V142_UNVERIFIED_CAREER/);
  const noRights=structuredClone(a);
  noRights.holdout2024_25Used=true;
  assert.throws(()=>analyzeM1P5V142ClusterIntervals([noRights]),
    /V142_UNVERIFIED_SHARD/);
});
