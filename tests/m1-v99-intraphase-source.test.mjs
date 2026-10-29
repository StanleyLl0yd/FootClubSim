import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V99IntraphaseShots as simulate,
  verifyM1V99IntraphaseShots as verify}
  from '../dist/core/m1-v99-intraphase-shots.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION}
  from '../dist/core/m1-clock.js';
import {RNG_VERSION}
  from '../dist/core/rng.js';
import {defaultTacticalPlan}
  from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const map=new Map(catalog.clubs.map(c=>[c.id,c]));
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const match=(fixture,seed)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,
  homeLineup:defaultSyntheticLineup(map.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(map.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});

test('v99 reproducibly records bounded unique intraphase shots with source on-field actors',()=>{
  const source=match(fixtures[0],123456789);
  const before=structuredClone(source),controlBefore=structuredClone(policy);
  const a=simulate(source,policy);
  assert.equal(a.ok,true,JSON.stringify(a));
  assert.deepEqual(a,simulate(source,policy));
  assert.equal(a.rngDraws,270);
  assert.equal(a.subphaseSlots,3);
  assert.equal(a.secondsPerSlot,100);
  assert.equal(a.schemaVersion,99);
  const events=a.events;
  assert.equal(events.at(-1).elapsedSeconds,5400);
  assert.equal(events.at(-1).id,'m1-v99-full-time');
  assert.ok(events.every((e,i)=>e.sequence===i+1));
  const shots=events.filter(e=>e.type==='shot');
  assert.ok(shots.length>0&&shots.length<=54);
  assert.equal(a.report.home.shots+a.report.away.shots,shots.length);
  assert.equal(a.report.home.goals+a.report.away.goals,
    shots.filter(e=>e.outcome==='goal').length);
  assert.equal(a.report.home.shotsOnTarget+a.report.away.shotsOnTarget,
    shots.filter(e=>['saved','goal'].includes(e.outcome)).length);
  const side={home:new Set(source.homeLineup.starters),
    away:new Set(source.awayLineup.starters)};
  let last=-1;
  for(const shot of shots){
    assert.ok(shot.elapsedSeconds>last);
    assert.ok(shot.elapsedSeconds<5400);
    assert.equal(shot.elapsedSeconds%100,99);
    assert.ok(shot.id.startsWith('m1-v99-shot-'));
    const named=shot.teamId===source.fixture.homeClubId?side.home:side.away;
    assert.ok(named.has(shot.playerId));
    last=shot.elapsedSeconds;
  }
  assert.equal(verify(source,policy,a),true);
  assert.equal(a.canPersistInV76CareerJournal,false);
  assert.equal(a.medicalAndSubstitutionTransitionsSupported,false);
  assert.equal(a.refereeAndSpecialGoalsSupported,false);
  assert.equal(a.releaseCalibrationAccepted,false);
  assert.deepEqual(source,before);
  assert.deepEqual(policy,controlBefore);
});

test('v99 alternative fixtures and seeds exceed 18-shot legacy clock ceiling in some games',()=>{
  let maxShots=0;
  for(const fixture of fixtures.slice(0,4)){
    for(const seed of [1,3,11,43,799]){
      const x=simulate(match(fixture,seed),policy);
      assert.equal(x.ok,true);
      maxShots=Math.max(maxShots,
        x.report.home.shots+x.report.away.shots);
      assert.equal(verify(match(fixture,seed),policy,x),true);
    }
  }
  assert.ok(maxShots>18);
});

test('v99 cannot replay a forged participant, phase time, score, RNG or event version',()=>{
  const source=match(fixtures[0],31),result=simulate(source,policy);
  assert.equal(result.ok,true);
  for(const tamper of [
    c=>{c.report.home.goals++;},
    c=>{c.rngDraws--;},
    c=>{c.events[0].elapsedSeconds=299;},
    c=>{c.events[0].sequence=99;},
    c=>{c.events[0].id='duplicate';},
    c=>{c.events[0].schemaVersion=8;},
    c=>{c.events[0].playerId=source.homeLineup.bench[0];},
  ]){
    const forged=structuredClone(result);
    tamper(forged);
    assert.equal(verify(source,policy,forged),false);
  }
  assert.equal(verify(source,policy,null),false);
  assert.equal(verify(source,policy,{...result,releaseCalibrationAccepted:true}),
    false);
});

test('v99 untrusted prematch and synthetic treatment claims never obtain a valid source',()=>{
  const source=match(fixtures[0],1);
  for(const input of [
    null,{...source,rngSeed:0},
    {...source,homeLineup:{...source.homeLineup,starters:[]}},
    {...source,foreignMedicalClaim:true},
  ]){
    assert.equal(simulate(input,policy).ok,false);
  }
  assert.equal(simulate(source,null).ok,false);
  assert.equal(simulate(source,{...policy,home:{assignedActor:{kind:'staff',
    staffId:'invented'}}}).ok,false);
});
