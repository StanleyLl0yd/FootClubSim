import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeM1V106Evidence,replayM1V106Shard}
  from '../scripts/m1-p5-v106-frozen-joint-evidence.mjs';
import evidence from '../data/m1-p5-v106-v104-shard-evidence.json' with {type:'json'};

test('v106 frozen exact source shards conserve each candidate and v102 baseline',()=>{
  const result=summarizeM1V106Evidence();
  assert.equal(result.schemaVersion,106);
  assert.equal(result.shardCount,16);
  assert.equal(result.uniqueSourceJobIds,16);
  assert.equal(result.gamesPerCandidate,1920);
  assert.equal(result.observedTotals.baseline.shots,41238);
  assert.equal(result.observedTotals.baseline.onTarget,21023);
  assert.equal(result.observedTotals.baseline.goals,7535);
  assert.equal(result.observedTotals.candidateA.shots,44584);
  assert.equal(result.observedTotals.candidateA.onTarget,16483);
  assert.equal(result.observedTotals.candidateA.goals,5002);
  assert.equal(result.observedTotals.candidateB.shots,44584);
  assert.equal(result.observedTotals.candidateB.onTarget,15751);
  assert.equal(result.observedTotals.candidateB.goals,4848);
  assert.equal(result.releaseCalibrationAccepted,false);
  assert.equal(result.strictGoalMetricEquivalence,false);
  assert.equal(result.strictShotClassificationEquivalence,false);
  assert.equal(result.independentHoldoutUsed,false);
  assert.ok(Math.abs(result.metrics.candidateB.shotsPerMatch-
    44584/1920)<1e-12);
  assert.ok(result.metrics.candidateB.descriptiveDeltaTargetPerMatch>0);
});

test('v106 detects forged counts, group identity, job identity and source flags',()=>{
  const changes=[
    x=>{x.shards[0].totals.candidateB.goals++;},
    x=>{x.shards[1].totals.candidateA.shots++;},
    x=>{x.shards[2].digests.baseline='123';},
    x=>{x.shards[1].group=0;},
    x=>{x.shards[1].sourceJobId=x.shards[0].sourceJobId;},
    x=>{x.shards[2].totals.baseline.onTarget++;},
    x=>{x.observedTotals.candidateB.goals++;},
    x=>{x.reference.onTarget++;},
    x=>{x.parameters.candidateB.xgMultiplier=0.8;},
    x=>{x.source.workflowRunId=1;},
    x=>{x.interpretation.holdout2024_25Used=true;},
    x=>{x.interpretation.releaseCalibrationAccepted=true;},
  ];
  for(const tamper of changes){
    const forged=structuredClone(evidence);
    tamper(forged);
    assert.throws(()=>summarizeM1V106Evidence(forged),/V106_/);
  }
  assert.deepEqual(summarizeM1V106Evidence(),
    summarizeM1V106Evidence(structuredClone(evidence)));
});

test('v106 exact source shard 0 regenerates pinned totals and digests',()=>{
  assert.deepEqual(replayM1V106Shard(0),{
    group:0,sourceReplayVerified:true});
  assert.throws(()=>replayM1V106Shard(-1),/V106_INVALID_GROUP/);
  assert.throws(()=>replayM1V106Shard(16),/V106_INVALID_GROUP/);
});
