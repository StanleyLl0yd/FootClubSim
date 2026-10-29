import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
const file='scripts/m1-p5-v64-rejection-taxonomy.mjs';
const run=(count,fixtures)=>JSON.parse(execFileSync(process.execPath,[
  file,'--start=1','--count='+count,'--fixtures='+fixtures,
],{encoding:'utf8',timeout:120000}));
test('v64 narrow source root taxonomy is deterministic, additive and honest',()=>{
  const x=run(8,2);
  assert.deepEqual(x,run(8,2));
  assert.equal(x.schemaVersion,1);
  assert.equal(x.attempted,16);
  assert.equal(x.accepted+x.rejected,16);
  assert.equal(x.sourceReplayVerifierUntouched,true);
  assert.equal(x.simulatorBehaviorChanged,false);
  assert.equal(x.real2024_25HoldoutUsed,false);
  assert.equal(x.calibrationAccepted,false);
  assert.equal(Object.values(x.rejectionRootCounts)
    .reduce((sum,n)=>sum+n,0),x.rejected);
  assert.ok(x.lowerLevelRefereeFailuresClassified<=x.rejected);
  assert.equal(Object.values(x.rejectionSubreasonCounts)
    .reduce((sum,n)=>sum+n,0),x.rejected);
  if(x.rejected>0) {
    assert.equal(x.rejectionSubreasonCounts.NO_UNDERLYING_SUBREASON??0,0);
  }
  assert.match(x.deterministicSha256,/^[a-f0-9]{64}$/);
});
test('v64 invalid options fail before publishing a partial report',()=>{
  for(const args of [
    ['--count=0'],['--count=65'],['--fixtures=9'],
    ['--start=4294967296'],['--start=4294967295','--count=2'],
    ['--fixtures=0'],['--other=1'],['--count=3','--count=4'],
    ['--fixtures=NaN'],['--start=0'],['--count'],['8'],
  ]){
    const p=spawnSync(process.execPath,[file,...args],{
      encoding:'utf8',timeout:30000,
    });
    assert.equal(p.status,1,JSON.stringify(args));
    assert.equal(p.stdout,'',JSON.stringify(args));
    assert.match(p.stderr,/M1_V64_DIAG_FAIL:/);
  }
});
