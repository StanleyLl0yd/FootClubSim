import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V104JointCandidate as simulate,
  verifyM1V104JointCandidate as verify}
  from '../dist/core/m1-v104-joint-candidate.js';
import {simulateM1V99IntraphaseShots}
  from '../dist/core/m1-v99-intraphase-shots.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import {P5_V104_CANDIDATES}
  from '../scripts/m1-p5-v104-joint-candidate-shard.mjs';

const catalog=createSyntheticRplScaleCatalog(77);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const prematch=(fixture,seed)=>({
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
const details=r=>r.events.filter(e=>e.type==='shot')
  .map(({id,schemaVersion,...v})=>v);

test('v104 baseline reproduces every v99 shot, RNG and aggregate unchanged',()=>{
  for(const fixture of fixtures.slice(0,3)){
    for(const seed of [1,42,1977]){
      const input=prematch(fixture,seed);
      const original=structuredClone(input);
      const previous=simulateM1V99IntraphaseShots(input,policy);
      const baseline=simulate(input,policy,P5_V104_CANDIDATES.baseline);
      assert.equal(previous.ok,true);
      assert.equal(baseline.ok,true,JSON.stringify(baseline).slice(0,300));
      assert.deepEqual(baseline.report,previous.report);
      assert.deepEqual(details(baseline),details(previous));
      assert.equal(baseline.rngState,previous.rngState);
      assert.equal(baseline.rngDraws,270);
      assert.equal(verify(input,policy,P5_V104_CANDIDATES.baseline,baseline),true);
      assert.deepEqual(input,original);
    }
  }
});

test('v104 joint candidate is replayed with five draws per slot and bounded outcomes',()=>{
  const input=prematch(fixtures[0],123456);
  const original=structuredClone(input);
  for(const [name,parameters] of Object.entries(P5_V104_CANDIDATES)){
    const candidate=simulate(input,policy,parameters);
    assert.equal(candidate.ok,true,name);
    assert.deepEqual(candidate,simulate(input,policy,parameters));
    assert.equal(candidate.rngDraws,270);
    assert.equal(candidate.releaseCalibrationAccepted,false);
    assert.equal(candidate.holdout2024_25Used,false);
    assert.equal(candidate.careerCasAdmissionSupported,false);
    assert.equal(candidate.blockedShotTaxonomyHarmonized,false);
    assert.equal(candidate.realGoalDefinitionHarmonized,false);
    assert.ok(candidate.events.every((e,i)=>e.sequence===i+1));
    const shots=candidate.events.filter(e=>e.type==='shot');
    const scores=candidate.report.home.goals+candidate.report.away.goals;
    const onTarget=candidate.report.home.shotsOnTarget+
      candidate.report.away.shotsOnTarget;
    assert.equal(shots.length,candidate.report.home.shots+
      candidate.report.away.shots);
    assert.equal(scores,shots.filter(e=>e.outcome==='goal').length);
    assert.equal(onTarget,shots.filter(e=>
      e.outcome==='goal'||e.outcome==='saved').length);
    assert.ok(scores<=onTarget&&onTarget<=shots.length&&shots.length<=54);
    assert.ok(shots.every(e=>e.elapsedSeconds%100===99));
    assert.equal(verify(input,policy,parameters,candidate),true);
  }
  assert.deepEqual(input,original);
});

test('v104 rejects forged outcomes and malformed or extreme research parameters',()=>{
  const input=prematch(fixtures[0],42);
  const valid=simulate(input,policy,P5_V104_CANDIDATES.candidateA);
  assert.equal(valid.ok,true);
  for(const change of [
    x=>{x.report.home.goals++;},
    x=>{x.events[0].elapsedSeconds=0;},
    x=>{x.events[0].outcome='goal';},
    x=>{x.rngDraws=1;},
    x=>{x.parameters.saveMultiplier=2;},
    x=>{x.releaseCalibrationAccepted=true;},
  ]){
    const copy=structuredClone(valid);
    change(copy);
    assert.equal(verify(input,policy,P5_V104_CANDIDATES.candidateA,copy),false);
  }
  for(const parameters of [
    null,{},[1,1,1],{...P5_V104_CANDIDATES.baseline,extra:1},
    {...P5_V104_CANDIDATES.baseline,shotOpportunityMultiplier:0},
    {...P5_V104_CANDIDATES.baseline,xgMultiplier:NaN},
    {...P5_V104_CANDIDATES.baseline,saveMultiplier:Infinity},
    {...P5_V104_CANDIDATES.baseline,saveMultiplier:2},
  ])assert.equal(simulate(input,policy,parameters).ok,false);
  assert.equal(simulate(null,policy,P5_V104_CANDIDATES.baseline).ok,false);
});
