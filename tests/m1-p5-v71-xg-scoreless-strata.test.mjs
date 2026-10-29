import test from 'node:test';
import assert from 'node:assert/strict';
import {stratifyM1V71SourceXgObservations as stratify,
  collectM1V71SourceXgStrata as collect}
  from '../scripts/m1-p5-v71-xg-scoreless-strata.mjs';
import {measureM1V29SourceXgCohort as measure}
  from '../scripts/m1-p5-v70-source-xg-corpus.mjs';

const rows=()=>[
  {fixtureId:'fixture-a',seed:1,shots:2,goals:0,xgMilli:200},
  {fixtureId:'fixture-a',seed:2,shots:6,goals:1,xgMilli:900},
  {fixtureId:'fixture-a',seed:3,shots:12,goals:4,xgMilli:1800},
];
test('v71 predeclared xG and shot strata conserve scoreless mass',()=>{
  const r=stratify(rows());
  assert.equal(r.accepted,3);
  assert.equal(r.shots,20);
  assert.equal(r.goals,5);
  assert.equal(r.xgMilli,2900);
  assert.equal(r.scoreless,1);
  assert.deepEqual(r.xgBands.map(x=>x.matches),[1,1,1]);
  assert.deepEqual(r.xgBands.map(x=>x.scoreless),[1,0,0]);
  assert.deepEqual(r.shotBands.map(x=>x.matches),[1,1,1]);
  assert.deepEqual(r.shotBands.map(x=>x.scoreless),[1,0,0]);
  assert.equal(r.xgBands[0].scorelessRate,1);
  assert.equal(r.xgBands[2].meanXgPerMatch,1.8);
  assert.equal(r.internalXgOnly,true);
  assert.equal(r.independentExternalRplXgAvailable,false);
  assert.equal(r.holdout2024_25Used,false);
  assert.deepEqual(stratify(rows()),r);
});
test('v71 rejects forged xG, impossible goals, missing and oversized rows',()=>{
  const mutations=[
    x=>{x[0].shots=19;},
    x=>{x[0].goals=3;},
    x=>{x[0].xgMilli=-1;},
    x=>{x[0].xgMilli=2000;},
    x=>{x[0].seed=0;},
    x=>{x[0].fixtureId='';},
    x=>{x[0].extra=true;},
  ];
  for(const edit of mutations){
    const data=rows();edit(data);
    assert.throws(()=>stratify(data),/SOURCE_XG_STRATA_CONSERVATION_FAILED/);
  }
  assert.throws(()=>stratify([]),/INVALID_SOURCE_XG_STRATA_INPUT/);
  assert.throws(()=>stratify(null),/INVALID_SOURCE_XG_STRATA_INPUT/);
});
test('small exact-source cohort partitions match unchanged v70 metric totals',()=>{
  const cfg={firstfixture:1,fixtures:1,start:1,count:3};
  const out=collect(cfg),original=measure(cfg);
  assert.equal(out.attempted,original.attempted);
  assert.equal(out.accepted,original.accepted);
  assert.equal(out.rejected,original.rejected);
  assert.equal(out.shots,original.sourceShots);
  assert.equal(out.goals,original.sourceOpenPlayGoals);
  assert.equal(out.xgMilli,original.sourceOpenPlayXgMilli);
  assert.equal(out.xgBands.reduce((a,b)=>a+b.matches,0),out.accepted);
  assert.equal(out.shotBands.reduce((a,b)=>a+b.matches,0),out.accepted);
  assert.equal(out.xgBands.reduce((a,b)=>a+b.scoreless,0),out.scoreless);
  assert.equal(out.shotBands.reduce((a,b)=>a+b.scoreless,0),out.scoreless);
  assert.deepEqual(collect(cfg),out);
});
test('invalid source cohort ranges cannot turn rejected games into scoreless data',()=>{
  for(const cfg of [{count:0},{count:129},{fixtures:33},{firstfixture:241},
    {firstfixture:240,fixtures:2},{start:0},{start:0xffffffff,count:2}]){
    assert.throws(()=>collect(cfg),/BOUNDED_SOURCE_XG_STRATA_REQUIRED/);
  }
});
