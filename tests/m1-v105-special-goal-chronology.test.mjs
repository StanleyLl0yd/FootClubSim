import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V105SpecialGoalChronology as simulate,
  verifyM1V105SpecialGoalChronology as verify}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {simulateM1V103IntraphaseMedical}
  from '../dist/core/m1-v103-intraphase-medical.js';
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
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const home=defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const away=defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const positions=new Map(catalog.players.map(x=>[x.id,x.primaryPosition]));
const homeOut=home.starters.find(id=>positions.get(id)!=='GK');
const awayOut=away.starters.find(id=>positions.get(id)!=='GK');
const prematch={
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:home,awayLineup:away,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:42,
};
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const decision=(id,time,kind,outcome)=>({
  schemaVersion:1,decisionId:id,fixtureId:fixture.id,
  teamId:fixture.homeClubId,playerId:kind==='own-goal'?awayOut:homeOut,
  elapsedSeconds:time,kind,...(outcome?{outcome}:{})
});
const exit={schemaVersion:1,id:'ex-150',fixtureId:fixture.id,
  teamId:fixture.homeClubId,playerId:homeOut,elapsedSeconds:150,
  kind:'treatment-exit',reason:'medical-staff-entered',
  restartAtRunningSeconds:165};
const returning={schemaVersion:1,id:'re-250',fixtureId:fixture.id,
  teamId:fixture.homeClubId,playerId:homeOut,elapsedSeconds:250,
  kind:'treatment-return',returnContext:'running-clock',ballInPlay:true,
  entryBoundary:'touchline',refereeSignalId:'untrusted-signal'};

test('v105 empty special decisions exactly preserve v103 open play shots and RNG',()=>{
  const input=structuredClone(prematch);
  const prior=simulateM1V103IntraphaseMedical(input,policy,[],[],[exit,returning]);
  const actual=simulate(input,policy,[],[],[exit,returning]);
  assert.equal(prior.ok,true);
  assert.equal(actual.ok,true,JSON.stringify(actual).slice(0,300));
  assert.equal(actual.rngDraws,270);
  assert.equal(actual.rngState,prior.rngState);
  assert.deepEqual(actual.events.filter(e=>e.type==='source').map(e=>e.source),
    prior.events);
  assert.equal(actual.report.home.openPlayGoals,prior.report.home.goals);
  assert.equal(actual.report.away.openPlayGoals,prior.report.away.goals);
  assert.equal(actual.report.home.penaltiesTaken,0);
  assert.equal(actual.report.home.ownGoalsFor,0);
  assert.equal(verify(input,policy,[],[],[exit,returning],[],actual),true);
  assert.deepEqual(input,prematch);
});

test('v105 combines replay-verified penalty and own goal only once',()=>{
  const decisions=[
    decision('pen-scored',0,'penalty-kick','scored'),
    decision('own-defender',300,'own-goal'),
    decision('pen-save',600,'penalty-kick','saved'),
    decision('pen-miss',900,'penalty-kick','missed'),
  ];
  const result=simulate(prematch,policy,[],[],[],decisions);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,300));
  assert.equal(result.specialDecisionCount,4);
  assert.equal(result.rngDraws,270);
  const homeResult=result.report.home;
  assert.equal(homeResult.penaltiesTaken,3);
  assert.equal(homeResult.penaltyGoals,1);
  assert.equal(homeResult.ownGoalsFor,1);
  assert.equal(homeResult.goals,homeResult.openPlayGoals+2);
  assert.equal(homeResult.shotsOnTarget,
    result.events.filter(e=>e.type==='source'&&e.source.type==='shot'&&
      e.source.teamId===fixture.homeClubId&&
      ['saved','goal'].includes(e.source.outcome)).length+2);
  assert.ok(result.events.every((e,i)=>e.sequence===i+1));
  assert.ok(result.events.every((e,i)=>i===0||
    e.elapsedSeconds>=result.events[i-1].elapsedSeconds));
  assert.deepEqual(result.events.filter(e=>e.type==='adjudication')
    .map(e=>e.decision.decisionId),decisions.map(d=>d.decisionId));
  assert.equal(verify(prematch,policy,[],[],[],decisions,result),true);
  assert.equal(result.refereeAndPhysicianAuthorityAuthenticated,false);
  assert.equal(result.careerCASAdmissionSupported,false);
});

test('v105 rejects penalty from player absent at 300s despite v8 decision-only source',()=>{
  const absent=simulate(prematch,policy,[],[],[exit],
    [decision('pen-300',300,'penalty-kick','scored')]);
  assert.deepEqual(absent,{
    ok:false,error:'SPECIAL_GOAL_PARTICIPANT_ABSENT'});
  const restored=simulate(prematch,policy,[],[],[exit,returning],
    [decision('pen-300',300,'penalty-kick','scored')]);
  assert.equal(restored.ok,true,JSON.stringify(restored).slice(0,300));
});

test('v105 rejects source ID collisions, forged scores and claimed authority',()=>{
  const decisions=[decision('own-300',300,'own-goal')];
  const result=simulate(prematch,policy,[],[],[exit,returning],decisions);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,300));
  for(const tamper of [
    x=>{x.report.home.goals++;},
    x=>{x.events.reverse();},
    x=>{x.rngDraws=90;},
    x=>{x.specialDecisionCount=77;},
    x=>{x.refereeAndPhysicianAuthorityAuthenticated=true;},
  ]){
    const forged=structuredClone(result);
    tamper(forged);
    assert.equal(verify(prematch,policy,[],[],[exit,returning],
      decisions,forged),false);
  }
  const collide=decision(exit.id,300,'penalty-kick','scored');
  assert.deepEqual(simulate(prematch,policy,[],[],[exit,returning],
    [collide]),{ok:false,error:'DUPLICATE_SOURCE_IDENTIFIER'});
  assert.equal(verify(prematch,policy,[],[],[],decisions,result),false);
  assert.equal(simulate(null,policy).ok,false);
});
