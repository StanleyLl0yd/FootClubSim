import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const cli = 'scripts/m1-v29-causal-corpus.mjs';
const run = (start = 1, count = 12, fixtures = 1) =>
  JSON.parse(execFileSync(process.execPath, [
    cli, '--start=' + start, '--count=' + count,
    '--fixtures=' + fixtures,
  ], {encoding:'utf8',timeout:60000}));

test('v29 seeded causal corpus replays all accepted medical transitions',()=>{
  const a=run();
  assert.deepEqual(a,run());
  assert.equal(a.schemaVersion,1);
  assert.equal(a.sourceEngine,'m1-v29-synthetic-medical-source');
  assert.equal(a.totalCases,12);
  assert.equal(a.fixtureSummaries.length,1);
  assert.equal(a.accepted+a.rejected,a.totalCases);
  assert.ok(a.accepted>0);
  assert.equal(a.medicalExitEvents,a.medicalReturnEvents);
  assert.equal(a.medicalExitEvents,a.offFieldAssessments);
  assert.equal(a.injuryOccurrenceCalibrated,false);
  assert.equal(a.physicianOrRefereeAuthorityAuthenticated,false);
  assert.equal(a.realFootballReferenceSample,false);
  assert.match(a.deterministicSha256,/^[0-9a-f]{64}$/);
  assert.equal(Object.values(a.rejectionReasons).reduce((n,x)=>n+x,0),
    a.rejected);
});

test('different seeds and fixture sets change digest without changing boundaries',()=>{
  const a=run(1,6,3);
  const b=run(1,6,3);
  const changed=run(21,6,3);
  assert.deepEqual(a,b);
  assert.equal(a.totalCases,18);
  assert.equal(a.fixtureSummaries.length,3);
  assert.equal(new Set(a.fixtureSummaries.map(x=>x.fixtureId)).size,3);
  for(const group of a.fixtureSummaries){
    assert.equal(group.accepted+group.rejected,6);
    assert.ok(group.accepted>0);
  }
  assert.notEqual(a.deterministicSha256,changed.deterministicSha256);
  assert.notEqual(a.deterministicSha256,run(1,6,1).deterministicSha256);
});

test('invalid CLI arguments fail closed and emit no partial JSON',()=>{
  for(const args of [
    ['--count=0'],['--count=129'],['--start=0'],
    ['--start=4294967296'],['--start=4294967295','--count=2'],
    ['--fixtures=0'],['--fixtures=33'],['--fixtures=NaN'],
    ['--start=NaN'],['--count=-1'],['--count=1.5'],
    ['--count=1','--count=2'],['--fixtures=1','--fixtures=2'],
    ['--foo=1'],['12'],['--count'],['--fixtures'],
  ]){
    const result=spawnSync(process.execPath,[cli,...args],
      {encoding:'utf8',timeout:30000});
    assert.equal(result.status,1,JSON.stringify(args));
    assert.equal(result.stdout,'',JSON.stringify(args));
    assert.match(result.stderr,/M1_V29_CORPUS_ERROR:/);
  }
});

test('P5 source-derived mixed metric observation keeps confidence and missing coverage honest',()=>{
  const corpus=run(1,8,3);
  const metrics=corpus.p5Observation;
  assert.equal(metrics.schemaVersion,1);
  assert.equal(metrics.status,
    'SYNTHETIC_V29_CONDITIONAL_OBSERVATION_NOT_CALIBRATION');
  assert.equal(metrics.accepted,corpus.accepted);
  assert.equal(metrics.rejected,corpus.rejected);
  assert.equal(metrics.attempted,24);
  assert.equal(metrics.denominatorPolicy,'SUCCESSFUL_FULL_SOURCE_REPLAYS_ONLY');
  const outcome=metrics.outcomeRates;
  assert.equal(outcome.homeWin.count+outcome.draw.count+
    outcome.awayWin.count,corpus.accepted);
  for(const value of Object.values(outcome)){
    assert.equal(value.denominator,corpus.accepted);
    assert.ok(value.rate>=0&&value.rate<=1);
    assert.ok(value.wilson95.lower>=0&&value.wilson95.upper<=1);
    assert.ok(value.wilson95.lower<=value.rate);
    assert.ok(value.rate<=value.wilson95.upper);
  }
  assert.equal(metrics.perAcceptedMatch.goals.total,corpus.totalGoals);
  assert.equal(metrics.perAcceptedMatch.modelledAssessments.total,
    corpus.quickAssessments+corpus.offFieldAssessments);
  for(const value of Object.values(metrics.perAcceptedMatch)){
    assert.equal(value.count,corpus.accepted);
    assert.equal(value.mean,value.total/corpus.accepted);
    assert.ok(value.total>=0);
    if(value.normalMean95!==null){
      assert.ok(value.normalMean95.lower<=value.mean);
      assert.ok(value.mean<=value.normalMean95.upper);
    }
  }
  assert.equal(metrics.xg.total,null);
  assert.match(metrics.xg.status,/^UNAVAILABLE_/);
  assert.equal(metrics.realInjuries.total,null);
  assert.match(metrics.realInjuries.status,/^UNAVAILABLE_/);
  assert.equal(metrics.externalReference.pass,null);
  assert.match(metrics.externalReference.status,/^UNAVAILABLE_/);
  assert.equal(metrics.sourceEventCoverage.cards,
    'SEEDED_INTERNAL_REFEREE_NOT_EXTERNAL_AUTHORITY');
  assert.deepEqual(corpus,run(1,8,3));
});

test('explicit 1-based fixture windows have unique disjoint deterministic source IDs',()=>{
  const cliWithOffset=(first)=>JSON.parse(execFileSync(process.execPath,[
    cli,'--start=1','--count=3','--fixtures=4',
    '--firstfixture='+first,
  ],{encoding:'utf8',timeout:60000}));
  const a=cliWithOffset(1),b=cliWithOffset(5);
  assert.equal(a.firstFixture,1);
  assert.equal(b.firstFixture,5);
  assert.equal(a.totalCases,12);
  assert.equal(b.totalCases,12);
  assert.equal(a.accepted+a.rejected,12);
  assert.equal(b.accepted+b.rejected,12);
  const ids=new Set(a.fixtureSummaries.map(x=>x.fixtureId));
  assert.ok(b.fixtureSummaries.every(x=>!ids.has(x.fixtureId)));
  assert.deepEqual(a,cliWithOffset(1));
  assert.notEqual(a.deterministicSha256,b.deterministicSha256);
  for(const args of [
    ['--firstfixture=0'],['--firstfixture=241'],
    ['--firstfixture=240','--fixtures=2'],
    ['--firstfixture=1','--firstfixture=2'],
  ]){
    const x=spawnSync(process.execPath,[cli,...args],
      {encoding:'utf8',timeout:30000});
    assert.equal(x.status,1);
    assert.equal(x.stdout,'');
    assert.match(x.stderr,/M1_V29_CORPUS_ERROR:/);
  }
});
