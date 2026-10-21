import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
const cli='scripts/m1-v32-history-workload.mjs';
function run(count=1,seed=1){
  return JSON.parse(execFileSync(process.execPath,
    [cli,'--fixtures='+count,'--firstseed='+seed],
    {encoding:'utf8',timeout:120000}));
}
test('schema-6 bounded pure-history workload is reproducible, not an SLA',()=>{
  const a=run(1),b=run(1);
  assert.equal(a.schemaVersion,1);
  assert.equal(a.schema,6);
  assert.equal(a.fixtureCount,1);
  assert.equal(a.sourceAttempts>=1,true);
  assert.equal(a.status,
    'SYNTHETIC_SCHEMA6_REPLAY_COST_NOT_A_RELEASE_PERFORMANCE_GATE');
  assert.deepEqual(a.measurements.checkpoints.map(x=>x.revision),[1]);
  assert.match(a.deterministicSha256,/^[0-9a-f]{64}$/);
  assert.equal(a.deterministicSha256,b.deterministicSha256);
  assert.equal(a.measurements.checkpoints[0].journalBytes,
    a.measurements.journalBytes);
  assert.ok(a.measurements.totalMs>=0);
  assert.ok(a.measurements.finalFullHistoryValidationMs>=0);
  assert.ok(a.measurements.rssBytes>0);
  assert.ok(a.limitations.some(x=>x.includes('not native IndexedDB')));
});
test('posted fixtures increase source-validated journal size and fingerprint',()=>{
  const a=run(1,5),b=run(2,5);
  assert.equal(b.fixtureCount,2);
  assert.equal(b.measurements.checkpoints.at(-1).revision,2);
  assert.ok(b.measurements.journalBytes>a.measurements.journalBytes);
  assert.notEqual(a.deterministicSha256,b.deterministicSha256);
});
test('invalid or duplicate workload options reject without partial JSON',()=>{
  for(const args of [
    ['--fixtures=0'],['--fixtures=33'],['--firstseed=0'],
    ['--firstseed=4294967295'],['--fixtures=-1'],
    ['--fixtures=NaN'],['--fixtures=1','--fixtures=2'],
    ['--firstseed=1','--firstseed=2'],['--bogus=1'],
    ['--fixtures'],['123'],['--firstseed=1.5'],
  ]) {
    const result=spawnSync(process.execPath,[cli,...args],{
      encoding:'utf8',timeout:30000,
    });
    assert.equal(result.status,1,JSON.stringify(args));
    assert.equal(result.stdout,'',JSON.stringify(args));
    assert.match(result.stderr,/M1_V32_WORKLOAD_ERROR:/);
  }
});
