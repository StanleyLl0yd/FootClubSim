import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V190ExperimentalSpecialGoals as run,
  verifyM1V190ExperimentalSpecialGoals as verify}
  from '../dist/core/m1-v190-experimental-special-goals.js';
import {simulateM1V105SpecialGoalChronology as old}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {projectM1V179MatchClock}
  from '../dist/core/m1-v179-source-clock.js';
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
const fixture=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
assert.equal(fixture.id,'a-0-0');
const teams=new Map(catalog.clubs.map(c=>[c.id,c]));
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const prematch=(seed)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,
  homeLineup:defaultSyntheticLineup(teams.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(teams.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});
const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
test('independent seeds exercise none/penalty/own-goal/both without v188 changes',()=>{
  for(const [seed,names] of [
    [1,['penalty-kick']],[2,[]],[17,['own-goal']],
    [79,['penalty-kick','own-goal']],
  ]){
    const input=prematch(seed);
    const before=JSON.stringify(input);
    const base=old(input,policy);
    assert.equal(base.ok,true);
    const result=run(input,policy);
    assert.equal(result.ok,true,JSON.stringify(result).slice(0,350));
    assert.equal(result.schemaVersion,190);
    assert.deepEqual(result.decisions.map(d=>d.kind).sort(),names.sort());
    assert.deepEqual(result,run(input,policy));
    assert.equal(verify(input,policy,[],[],result),true);
    assert.equal(result.result.rngState,base.rngState);
    assert.equal(result.result.rngDraws,base.rngDraws);
    assert.equal(result.originalV105RngUnchanged,true);
    assert.equal(result.historicalV188SaveAdmissionAllowed,false);
    assert.equal(result.releaseCalibrationAccepted,false);
    assert.equal(JSON.stringify(input),before);
    const delta=['home','away'].reduce((sum,side)=>
      sum+result.result.report[side].goals-base.report[side].goals,0);
    const added=['home','away'].reduce((sum,side)=>
      sum+result.result.report[side].penaltyGoals+
        result.result.report[side].ownGoalsFor,0);
    assert.equal(delta,added,'special goals conserve all scores');
    assert.equal(result.specialDecisionCount,result.decisions.length);
    assert.equal(result.result.specialDecisionCount,result.decisions.length);
  }
});
test('generated events involve physically present outfield actors',()=>{
  const input=prematch(79);
  const baseline=old(input,policy);
  assert.equal(baseline.ok,true);
  const physical=projectM1V179MatchClock(input,baseline);
  assert.equal(physical.ok,true);
  const r=run(input,policy);
  assert.equal(r.ok,true);
  assert.equal(r.decisions.length,2);
  assert.notEqual(r.decisions[0].elapsedSeconds,r.decisions[1].elapsedSeconds);
  for(const d of r.decisions){
    assert.equal(d.elapsedSeconds%300,0);
    assert.ok(d.elapsedSeconds>=300&&d.elapsedSeconds<=5100);
    const snapshot=physical.snapshots.filter(s=>
      s.runningSeconds<=d.elapsedSeconds).at(-1);
    const actorTeam=d.kind==='own-goal'?
      (d.teamId===fixture.homeClubId?'away':'home'):
      (d.teamId===fixture.homeClubId?'home':'away');
    assert.ok(snapshot[actorTeam+'Present'].includes(d.playerId),
      'Cannot select an absent participant');
    assert.notEqual(positions.get(d.playerId),'GK');
  }
});
test('legal source remains valid when speculative incident is rejected',()=>{
  // The source generator may propose an event at a checkpoint where the
  // replay validator says it is not physically legal. A single speculative
  // failure must not make an otherwise valid season impossible to progress.
  const cases=[79,11,17,71,101,123,254,512,1901];
  for(const seed of cases){
    const input=prematch(seed);
    const reference=old(input,policy);
    const result=run(input,policy);
    assert.equal(reference.ok,true);
    assert.equal(result.ok,true,JSON.stringify(result).slice(0,180));
    if(!result.ok||!reference.ok)continue;
    assert.equal(result.specialDecisionCount,result.decisions.length);
    assert.equal(result.result.ok,true);
    assert.equal(result.result.rngState,reference.rngState);
    assert.equal(verify(input,policy,[],[],result),true);
  }
});
test('forged event, score and authority fields fail replay verification',()=>{
  const input=prematch(79),original=run(input,policy);
  assert.equal(original.ok,true);
  for(const attack of [
    r=>r.decisions[0].playerId='player-unknown',
    r=>r.decisions.reverse(),
    r=>r.result.report.home.goals++,
    r=>r.result.rngState=0,
    r=>r.historicalV188SaveAdmissionAllowed=true,
    r=>r.releaseCalibrationAccepted=true,
  ]){
    const forged=structuredClone(original);
    attack(forged);
    assert.equal(verify(input,policy,[],[],forged),false);
  }
  assert.deepEqual(run(null,policy),{ok:false,error:'INVALID_SOURCE'});
  assert.equal(verify(input,policy,[],[],{bad:true}),false);
});
