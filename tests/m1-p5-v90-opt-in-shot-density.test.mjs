import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectM1V90ShotDensity as inspect,
  compareM1V90WithOriginalV5 as parity,runM1V90ResearchShard,
  researchSeedV90,V90_DENSITIES}
  from '../scripts/m1-p5-v90-opt-in-shot-density.mjs';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const fixture=generateDoubleRoundRobin(catalog.clubs.map(x=>x.id))[0].fixtures[0];
const clubs=new Map(catalog.clubs.map(x=>[x.id,x]));
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const prematch=seed=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,
  homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});
test('v90 single-checkpoint mode is numerically identical to original v5 simulation',()=>{
  for(const seed of [1,3,17,43]){
    const v=parity(prematch(seed),policy);
    assert.equal(v.ok,true,JSON.stringify(v));
    assert.equal(v.baselineParityVerified,true);
    const a=inspect(prematch(seed),policy,1);
    assert.equal(a.ok,true);
    assert.equal(a.rngDraws,90);
    assert.equal(a.productionEngineAndSavedSchemasUnmodified,true);
    assert.equal(a.canPersistInV76CareerJournal,false);
    assert.equal(a.substitutionsAndMedicalModelled,false);
    assert.deepEqual(a,inspect(prematch(seed),policy,1));
  }
});

test('v90 extra opportunities change observed shots, but are never accepted as saved fixtures',()=>{
  let one=0,four=0;
  for(const seed of [1,3,17,43,88,99]){
    const input=prematch(seed);
    const low=inspect(input,policy,1);
    const high=inspect(input,policy,4);
    assert.equal(low.ok,true);
    assert.equal(high.ok,true);
    assert.equal(high.rngDraws,360);
    assert.ok(high.stats.goals<=high.stats.onTarget);
    assert.ok(high.stats.onTarget<=high.stats.shots);
    assert.equal(high.sourceMatchReplayOrPersistenceClaimed,undefined);
    assert.equal(high.canPersistInV76CareerJournal,false);
    assert.equal(high.refereeOrKdkAuthorityAuthenticated,false);
    one+=low.stats.shots;four+=high.stats.shots;
  }
  assert.ok(four>one,'higher opportunity count should raise cohort shots');
});

test('v90 seeding is bound to fixture plus index, not reused for every referee calendar match',()=>{
  const seeds=['a-0-0','a-0-1','a-1-0']
    .flatMap(f=>Array.from({length:8},(_,i)=>researchSeedV90(f,i+1)));
  assert.equal(new Set(seeds).size,24);
  for(const bad of [0,-1,9,1.2,'2',null,undefined])
    assert.throws(()=>researchSeedV90(fixture.id,bad),
      /V90_BAD_RESEARCH_SEED_PAIR/);
  assert.deepEqual(V90_DENSITIES,[1,2,3,4]);
  for(const invalid of [0,-1,5,1.5,NaN,'4',null,undefined])
    assert.equal(inspect(prematch(1),policy,invalid).ok,false);
  assert.equal(inspect(prematch(0),policy,1).ok,false);
});

test('v90 one hosted research shard conserves every paired density without claiming release calibration',()=>{
  const result=runM1V90ResearchShard(0);
  assert.equal(result.seedPairs,120);
  assert.equal(result.researchSeedsUnique,120);
  assert.equal(result.holdout2024_25Used,false);
  assert.equal(result.sourceMatchReplayOrPersistenceClaimed,false);
  assert.equal(result.noChangesToExistingEngineRngOrSave,true);
  assert.equal(result.formalP5CalibrationAccepted,false);
  for(const density of V90_DENSITIES){
    const m=result.totals[String(density)];
    assert.equal(m.matches+m.sourceRejected,120);
    assert.equal(m.shots,m.homeShots+m.awayShots);
    assert.equal(m.goals,m.homeGoals+m.awayGoals);
    assert.ok(m.goals<=m.onTarget&&m.onTarget<=m.shots);
  }
  assert.match(result.digestSha256,/^[a-f0-9]{64}$/);
  for(const bad of [-1,16,'0',0.5,null,undefined])
    assert.throws(()=>runM1V90ResearchShard(bad),/V90_INVALID_GROUP/);
});
