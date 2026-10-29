import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectM1V88SourceShotOnTarget as inspect,
  inspectM1V29SourceOpenPlayXg as existing}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {deriveM1V31CausalPhysicalExposure as replay}
  from '../dist/core/m1-v24-physical-exposure.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
function sourceInput(fixture,seed){
  return{
    schemaVersion:MATCH_LEDGER_VERSION,
    engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,
    rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,
    homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
  };
}

test('v88 exact source-shot targets agree with existing xG and full v31 replay',()=>{
  let accepted=0;
  for(const fixture of fixtures.slice(0,3)){
    for(const seed of [1,3,17,43]){
      const prematch=sourceInput(fixture,seed);
      const v88=inspect(prematch,policy);
      const v29=existing(prematch,policy);
      const v31=replay(prematch,policy);
      assert.deepEqual(v88,inspect(prematch,policy));
      assert.equal(v88.ok,v29.ok);
      assert.equal(v88.ok,v31.ok);
      if(!v88.ok)continue;
      accepted++;
      assert.equal(v88.fixtureId,fixture.id);
      assert.equal(v88.sourceShots,v29.sourceShots);
      assert.equal(v88.sourceOpenPlayGoals,v29.sourceOpenPlayGoals);
      assert.equal(v88.sourceOpenPlayXgMilli,v29.sourceOpenPlayXgMilli);
      assert.equal(v88.sourceShots,
        v31.source.source.match.events.filter(e=>e.kind==='shot').length);
      assert.ok(v88.sourceShotsOnTarget<=v88.sourceShots);
      assert.ok(v88.sourceOpenPlayGoals<=v88.sourceShotsOnTarget);
      assert.equal(v88.fullyReplayedV8PhysicalXi,true);
      assert.equal(v88.historicalSaveAndRngUnchanged,true);
      assert.equal(v88.realWorldShotDefinitionVerified,false);
    }
  }
  assert.ok(accepted>=8,'a sufficient deterministic sample should replay');
});

test('v88 rejects untrusted source before reporting any shot metrics',()=>{
  const fixture=fixtures[0];
  for(const input of [
    null,{...sourceInput(fixture,1),rngSeed:0},
    {...sourceInput(fixture,1),
      fixture:{...fixture,homeClubId:'missing-registered-club'}},
  ]) {
    const result=inspect(input,policy);
    assert.equal(result.ok,false);
  }
  assert.equal(inspect(sourceInput(fixture,1),null).ok,false);
});
