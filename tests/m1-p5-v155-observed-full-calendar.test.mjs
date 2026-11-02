import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const input=JSON.parse(readFileSync(new URL(
  '../data/m1-p5-v155-observed-full-calendar.json',import.meta.url),
'utf8'));
const names=['baseline','candidateA','candidateB'];
const counts=['attempted','accepted','rejected','goals',
  'shots','onTarget','xgMilli'];
const isInt=n=>Number.isSafeInteger(n)&&n>=0;

test('v155 original 16-job manifest is fixed, complete and noncalibrated',()=>{
  assert.equal(input.schemaVersion,155);
  assert.equal(input.status,'OBSERVED_FULL_SYNTHETIC_CALENDAR_NOT_CALIBRATED');
  assert.equal(input.sourceCommit,'034c74712cf9b23f5eec1a2829bdad9d1eabb166');
  assert.equal(input.sourceWorkflowRun,41413788321);
  assert.equal(input.sourceJobOriginIndependentlyAuthenticated,false);
  assert.equal(input.sourceWorkflowJobCount,16);
  assert.equal(input.independentInputUnit,'FIXTURE_SEED_PAIR_NOT_REAL_MATCH');
  assert.equal(input.syntheticFixtures,240);
  assert.equal(input.seedsPerFixture,48);
  assert.equal(input.uniqueFixtureSeedPairs,11520);
  assert.equal(input.modelRunAttempts,34560);
  assert.equal(input.forgedEventNegativeChecks,240);
  assert.equal(input.sourceReplayVerified,true);
  assert.equal(input.referenceCategoryAligned,false);
  assert.equal(input.releaseP5Accepted,false);
  assert.equal(input.holdout2024_25Used,false);
  assert.equal(input.shards.length,16);
  assert.deepEqual(Object.keys(input.totals).sort(),names.slice().sort());
  const jobIds=new Set(),digests=new Set();
  const aggregates=Object.fromEntries(names.map(k=>[k,
    Object.fromEntries(counts.map(key=>[key,0]))]));
  for(let g=0;g<16;g++){
    const s=input.shards[g];
    assert.equal(s.group,g);
    assert.ok(Number.isSafeInteger(s.jobId)&&s.jobId>0);
    assert.ok(!jobIds.has(s.jobId));
    jobIds.add(s.jobId);
    assert.match(s.resultSha256,/^[0-9a-f]{64}$/);
    assert.ok(!digests.has(s.resultSha256));
    digests.add(s.resultSha256);
    assert.equal(s.negativeChecks,15);
    assert.ok(Number.isFinite(s.observedWallMs)&&s.observedWallMs>0);
    assert.ok(Number.isFinite(s.observedPeakRssMiB)&&
      s.observedPeakRssMiB>0&&s.observedPeakRssMiB<=1024);
    assert.deepEqual(Object.keys(s.rows).sort(),names.slice().sort());
    for(const model of names){
      const row=s.rows[model];
      for(const key of counts){
        assert.ok(isInt(row[key]),model+' '+key+' shard '+g);
        aggregates[model][key]+=row[key];
      }
      assert.equal(row.attempted,720);
      assert.equal(row.accepted,720);
      assert.equal(row.rejected,0);
      assert.deepEqual(row.rejectionCodes,{});
      assert.ok(row.goals<=row.onTarget&&row.onTarget<=row.shots);
    }
  }
  assert.deepEqual(input.totals,{
    "baseline": {
      "attempted": 11520,
      "accepted": 11520,
      "rejected": 0,
      "goals": 45105,
      "shots": 246948,
      "onTarget": 125905,
      "xgMilli": 45198683
    },
    "candidateA": {
      "attempted": 11520,
      "accepted": 11520,
      "rejected": 0,
      "goals": 30154,
      "shots": 266744,
      "onTarget": 98572,
      "xgMilli": 30265308
    },
    "candidateB": {
      "attempted": 11520,
      "accepted": 11520,
      "rejected": 0,
      "goals": 29133,
      "shots": 266744,
      "onTarget": 94070,
      "xgMilli": 29289707
    }
  });
  assert.deepEqual(aggregates,input.totals);
  for(const model of names){
    assert.equal(aggregates[model].attempted,11520);
    assert.equal(aggregates[model].accepted,11520);
    assert.equal(aggregates[model].rejected,0);
  }
});
test('v155 per-fixture comparisons remain research observations',()=>{
  assert.notEqual(input.totals.baseline.goals,input.totals.candidateA.goals);
  assert.equal(input.totals.candidateA.shots,input.totals.candidateB.shots);
  assert.equal(input.referenceCategoryAligned,false);
  assert.equal(input.releaseP5Accepted,false);
});
