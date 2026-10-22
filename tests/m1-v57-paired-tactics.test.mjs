import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';

const script='scripts/m1-v57-paired-tactics.mjs';
const run=(tempo=100,count=4,fixtures=2,start=1)=>JSON.parse(
  execFileSync(process.execPath,[script,'--tempo='+tempo,
    '--count='+count,'--fixtures='+fixtures,'--start='+start],
  {encoding:'utf8',timeout:90000}));

test('v57 same-seed identical tactical plans have exactly zero causal deltas',()=>{
  const a=run(50,4,1),b=run(50,4,1);
  assert.deepEqual(a,b);
  assert.equal(a.schemaVersion,1);
  assert.equal(a.status,'SYNTHETIC_V29_PAIRED_TACTICAL_NOT_CALIBRATED');
  assert.equal(a.pairPolicy,
    'SAME_SYNTHETIC_FIXTURE_SEED_CATALOG_ROSTER_AND_REFEREE_RNG');
  assert.equal(a.baselineHomeTempo,50);
  assert.equal(a.variantHomeTempo,50);
  assert.equal(a.attemptedPairs,4);
  assert.equal(a.comparedPairs+a.rejectedPairs,a.attemptedPairs);
  assert.ok(a.comparedPairs>0);
  for(const metric of Object.values(a.pairedMeanDeltas)){
    assert.equal(metric.total,0);
    assert.equal(metric.mean,0);
    assert.equal(metric.sampleStdDev,0);
    assert.deepEqual(metric.normalMean95,{lower:0,upper:0});
    assert.equal(metric.count,a.comparedPairs);
  }
  assert.equal(a.homeShotDirection.tied.count,a.comparedPairs);
  assert.equal(a.homeShotDirection.increased.count,0);
  assert.equal(a.homeShotDirection.decreased.count,0);
  assert.equal(a.acceptedRealismCalibration,false);
  assert.equal(a.externalRefereeAuthorityVerified,false);
  assert.equal(a.holdoutUsed,false);
});

test('v57 real tactical counterfactual conserves paired denominators and uncertainty',()=>{
  const a=run(100,6,2),b=run(100,6,2);
  assert.deepEqual(a,b);
  assert.equal(a.attemptedPairs,12);
  assert.equal(a.comparedPairs+a.rejectedPairs,12);
  assert.equal(a.fixtureSummaries.length,2);
  assert.equal(a.fixtureSummaries.reduce((n,x)=>n+x.compared,0),
    a.comparedPairs);
  assert.equal(a.fixtureSummaries.reduce((n,x)=>n+x.rejected,0),
    a.rejectedPairs);
  assert.equal(Object.values(a.rejectedReasons).reduce((n,x)=>n+x,0),
    a.rejectedPairs);
  assert.match(a.deterministicSha256,/^[a-f0-9]{64}$/);
  assert.equal(a.homeShotDirection.increased.count+
    a.homeShotDirection.tied.count+
    a.homeShotDirection.decreased.count,a.comparedPairs);
  for(const metric of Object.values(a.pairedMeanDeltas)){
    assert.equal(metric.count,a.comparedPairs);
    assert.ok(Number.isFinite(metric.mean));
    assert.ok(metric.normalMean95.lower<=metric.mean);
    assert.ok(metric.mean<=metric.normalMean95.upper);
  }
  for(const metric of Object.values(a.homeShotDirection)){
    assert.equal(metric.denominator,a.comparedPairs);
    // At a zero observed rate, floating-point Wilson arithmetic can
    // leave an insignificant positive lower bound (~1e-17).
    const tolerance=1e-12;
    assert.ok(metric.wilson95.lower<=metric.rate+tolerance);
    assert.ok(metric.rate<=metric.wilson95.upper+tolerance);
  }
  assert.equal(a.referenceSourceStatus,
    'NO_LAWFUL_COMPARABLE_RPL_TACTICAL_EFFECT_REFERENCE');
  assert.equal(a.medicalRateCalibrated,false);
});

test('same setting, different seed or fixture count changes source fingerprint',()=>{
  const a=run(100,4,2,1),b=run(100,4,2,20);
  const c=run(100,4,1,1);
  assert.notEqual(a.deterministicSha256,b.deterministicSha256);
  assert.notEqual(a.deterministicSha256,c.deterministicSha256);
});

test('v57 malformed and excessive workloads fail without partial JSON',()=>{
  for(const args of [
    ['--tempo=101'],['--tempo=-1'],['--tempo=1.5'],
    ['--count=0'],['--count=65'],['--fixtures=0'],
    ['--fixtures=9'],['--start=0'],['--start=4294967296'],
    ['--start=4294967295','--count=2'],
    ['--count=2','--count=3'],['--garbage=2'],
    ['--count'],['12'],['--tempo=1e3'],
  ]){
    const x=spawnSync(process.execPath,[script,...args],
      {encoding:'utf8',timeout:30000});
    assert.equal(x.status,1,JSON.stringify(args));
    assert.equal(x.stdout,'',JSON.stringify(args));
    assert.match(x.stderr,/M1_V57_PAIRED_ERROR:/);
  }
});
