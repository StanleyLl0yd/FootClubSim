import test from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/m1-p5-v111-fuzz-observed.json' with {type:'json'};
import {verifyM1V111Observed as verify}
  from '../scripts/m1-p5-v111-verify-observed.mjs';

test('v111 pins observed independent four-shard exact-source results',()=>{
  const result=verify();
  assert.equal(result.shardCount,4);
  assert.equal(result.jobCount,4);
  assert.equal(result.negativeChecks,16);
  assert.equal(result.modelSimulations,768);
  assert.equal(result.totals.baseline.shots,5399);
  assert.equal(result.totals.candidateA.shots,5887);
  assert.equal(result.totals.candidateB.onTarget,2076);
  assert.equal(result.releaseCalibrationAccepted,false);
});
test('v111 rejects edited counts, duplicate job IDs and lifted claims',()=>{
  const mutated=structuredClone(evidence);
  mutated.shards[0].totals.candidateB.shots++;
  assert.throws(()=>verify(mutated),/V111_PIN_/);
  const duplicate=structuredClone(evidence);
  duplicate.shards[1].jobId=duplicate.shards[0].jobId;
  assert.throws(()=>verify(duplicate),/V111_PIN_SHARD_IDENTITY/);
  const overclaim=structuredClone(evidence);
  overclaim.interpretation.productionPerformanceAccepted=true;
  assert.throws(()=>verify(overclaim),/V111_PIN_LIMITATIONS/);
});
