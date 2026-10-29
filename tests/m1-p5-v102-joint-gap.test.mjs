import test from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/m1-p5-v102-v100-shard-evidence.json' with {type:'json'};
import reference from '../data/rpl-2025-26-p5-shot-discipline-reference.json' with {type:'json'};

test('v102 records all sixteen exact-source v100 shards without omissions',()=>{
  assert.equal(evidence.schemaVersion,1);
  assert.equal(evidence.evidence.githubRunId,40945616709);
  assert.equal(evidence.evidence.sourceHeadSha,'b592971ef103cf23e0db1459ad2fb604125ef2ee');
  assert.equal(evidence.evidence.sourceSchema,99);
  assert.equal(evidence.evidence.fullTimeSeconds,5400);
  assert.equal(evidence.evidence.drawsPerMatch,270);
  assert.equal(evidence.evidence.fixturePositions,240);
  assert.equal(evidence.evidence.seedsPerFixture,8);
  assert.equal(evidence.evidence.shardCount,16);
  assert.equal(evidence.shards.length,16);
  const unique=new Set();
  for(const [index,shard] of evidence.shards.entries()){
    assert.equal(shard.group,index);
    assert.equal(unique.has(shard.group),false);
    unique.add(shard.group);
    assert.match(shard.digestSha256,/^[0-9a-f]{64}$/);
    assert.equal(shard.matchesAttempted,120);
    assert.equal(shard.matchesAccepted,120);
    assert.equal(shard.matchesRejected,0);
    assert.ok(shard.shots>=shard.onTarget);
    assert.ok(shard.onTarget>=shard.openPlayGoals);
  }
  assert.equal(unique.size,16);
});

test('v102 aggregates match-level source events rather than invented ratios',()=>{
  const total=evidence.observedModelTotals;
  for(const [field,key] of [
    ['shots','shots'],['onTarget','onTarget'],
    ['openPlayGoals','openPlayGoals'],['matchesAccepted','matchesAccepted'],
    ['matchesAttempted','matchesAttempted'],['matchesRejected','matchesRejected'],
  ]){
    assert.equal(evidence.shards.reduce((n,s)=>n+s[field],0),total[key]);
  }
  assert.equal(total.matchesAttempted,1920);
  assert.equal(total.matchesAccepted,1920);
  assert.equal(total.matchesRejected,0);
  assert.equal(total.shots,41238);
  assert.equal(total.onTarget,21023);
  assert.equal(total.openPlayGoals,7535);
  assert.equal(total.openPlayGoals+total.saved,total.onTarget);
  assert.equal(total.onTarget+total.blocked+total.offTarget,total.shots);
  assert.ok(total.maxShots<=54);
  assert.ok(total.over18ShotMatches<=total.matchesAccepted);
  assert.ok(total.xgMilli>=0);
});

test('v102 retains independent real-world metric definitions and untested holdout',()=>{
  const real=reference.regularSeason;
  const recorded=evidence.reference;
  assert.equal(real.matches,240);
  assert.equal(real.shotsAll,5548);
  assert.equal(real.shotsOnTarget,1879);
  assert.equal(real.goalsAllTypes,609);
  assert.equal(recorded.matchCount,real.matches);
  assert.equal(recorded.shots,real.shotsAll);
  assert.equal(recorded.onTarget,real.shotsOnTarget);
  assert.equal(recorded.goalsAllTypes,real.goalsAllTypes);
  const model=evidence.observedModelTotals;
  const shotRatio=(model.shots/model.matchesAccepted)/(real.shotsAll/real.matches);
  const targetRatio=(model.onTarget/model.matchesAccepted)/(real.shotsOnTarget/real.matches);
  const goalRatio=(model.openPlayGoals/model.matchesAccepted)/(real.goalsAllTypes/real.matches);
  assert.ok(shotRatio>0.9&&shotRatio<1);
  assert.ok(targetRatio>1.3&&targetRatio<1.5);
  assert.ok(goalRatio>1.5&&goalRatio<1.6);
  assert.deepEqual(evidence.interpretation,{
    modelGoalsOpenPlayOnly:true,realGoalsAllTypes:true,
    shotTaxonomyHarmonized:false,holdout2024_25Used:false,
    refereeMedicalAndCASAdmitted:false,releaseCalibrationAccepted:false,
  });
  assert.equal(reference.metricLimits.realXg,null);
  assert.equal(reference.metricLimits.realShotEventTaxonomyMapped,false);
});
