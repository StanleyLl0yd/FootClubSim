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
