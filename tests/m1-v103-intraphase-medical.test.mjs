import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V103IntraphaseMedical as simulate,
  verifyM1V103IntraphaseMedical as verify}
  from '../dist/core/m1-v103-intraphase-medical.js';
import {simulateM1V101PhysicalIntraphase}
  from '../dist/core/m1-v101-physical-intraphase.js';
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
const fixture=generateDoubleRoundRobin(catalog.clubs.map(x=>x.id))[0].fixtures[0];
const clubs=new Map(catalog.clubs.map(x=>[x.id,x]));
const home=defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const away=defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const players=new Map(catalog.players.map(x=>[x.id,x]));
const patient=home.starters.find(id=>players.get(id).primaryPosition!=='GK');
const patientTwo=home.starters.find(id=>id!==patient&&
  players.get(id).primaryPosition!=='GK');
const keeper=home.starters.find(id=>players.get(id).primaryPosition==='GK');
const input={
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:home,awayLineup:away,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:42,
};
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
const exit={schemaVersion:1,id:'v103-exit-100',
  fixtureId:fixture.id,teamId:fixture.homeClubId,playerId:patient,
  elapsedSeconds:100,kind:'treatment-exit',
  reason:'medical-staff-entered',restartAtRunningSeconds:115};
const returning={schemaVersion:1,id:'v103-return-200',
  fixtureId:fixture.id,teamId:fixture.homeClubId,playerId:patient,
  elapsedSeconds:200,kind:'treatment-return',
  returnContext:'running-clock',ballInPlay:true,
  entryBoundary:'touchline',refereeSignalId:'untrusted-signal'};
const checkpointExit={...exit,id:'checkpoint-exit-0',
  elapsedSeconds:0,restartAtRunningSeconds:15};
const checkpointReturn={...returning,id:'checkpoint-return-300',
  elapsedSeconds:300};
const checkpointRed={schemaVersion:1,id:'checkpoint-red-300',
  fixtureId:fixture.id,teamId:fixture.homeClubId,
  playerId:patientTwo,elapsedSeconds:300,
  kind:'direct-red',origin:'trusted-referee'};

test('v103 no intraphase actions exactly preserves v101 shots, RNG and report',()=>{
  const prior=simulateM1V101PhysicalIntraphase(input,policy);
  const current=simulate(input,policy);
  assert.equal(prior.ok,true);
  assert.equal(current.ok,true,JSON.stringify(current).slice(0,400));
  assert.equal(current.schemaVersion,103);
  assert.equal(current.intraphaseMedicalCount,0);
  assert.deepEqual(current.report,prior.report);
  assert.equal(current.rngState,prior.rngState);
  assert.equal(current.rngDraws,prior.rngDraws);
  assert.equal(current.rngDraws,270);
  assert.deepEqual(current.events.filter(e=>e.type==='shot').map(
    ({schemaVersion,id,...e})=>e),
  prior.events.filter(e=>e.type==='shot').map(
    ({schemaVersion,id,...e})=>e));
  assert.equal(verify(input,policy,[],[],[],current),true);
  assert.equal(current.clinicalAndRefereeSourceAuthenticated,false);
  assert.equal(current.careerCASAdmissionSupported,false);
});

test('v103 treatment exit at 100 affects only later shot slots and return at 200 restores',()=>{
  const originals=[structuredClone(input),structuredClone(exit),
    structuredClone(returning)];
  const current=simulate(input,policy,[],[],[exit,returning]);
  assert.equal(current.ok,true,JSON.stringify(current).slice(0,450));
  assert.equal(current.intraphaseMedicalCount,2);
  assert.equal(current.rngDraws,270);
  const medical=current.events.filter(e=>e.type==='intraphase-medical');
  assert.deepEqual(medical.map(e=>e.elapsedSeconds),[100,200]);
  assert.ok(current.events.every((e,i)=>e.sequence===i+1));
  for(const shot of current.events.filter(e=>e.type==='shot'&&
      e.elapsedSeconds>=100&&e.elapsedSeconds<200)){
    assert.notEqual(shot.playerId,patient);
  }
  assert.ok(medical[0].sequence>1||current.events[0].elapsedSeconds===100);
  assert.ok(current.events.filter(e=>e.type==='shot'&&
    e.elapsedSeconds<100).every(e=>e.elapsedSeconds===99));
  assert.equal(verify(input,policy,[],[],[exit,returning],current),true);
  assert.deepEqual(input,originals[0]);
  assert.deepEqual(exit,originals[1]);
  assert.deepEqual(returning,originals[2]);
});

test('v103 arbitrary-second exit at 150 and return at 250 update different shot slots',()=>{
  const departure={...exit,id:'v103-arbitrary-exit-150',
    elapsedSeconds:150,restartAtRunningSeconds:165};
  const arrival={...returning,id:'v103-arbitrary-return-250',
    elapsedSeconds:250};
  const match=simulate(input,policy,[],[],[departure,arrival]);
  assert.equal(match.ok,true,JSON.stringify(match).slice(0,500));
  const events=match.events.filter(e=>e.type==='intraphase-medical');
  assert.deepEqual(events.map(e=>e.elapsedSeconds),[150,250]);
  assert.ok(match.events.filter(e=>e.type==='shot'&&
    e.elapsedSeconds>=150&&e.elapsedSeconds<250)
    .every(e=>e.playerId!==patient));
  assert.ok(match.events.every((e,i)=>e.sequence===i+1));
  assert.equal(match.rngDraws,270);
  assert.equal(verify(input,policy,[],[],[departure,arrival],match),true);
  assert.equal(simulate(input,policy,[],[],[
    departure,{...arrival,elapsedSeconds:220}]).ok,false);
});

test('v103 combines verified 300s source transitions with new 100s actions',()=>{
  const source=simulateM1V101PhysicalIntraphase(
    input,policy,[checkpointRed],[checkpointExit,checkpointReturn]);
  assert.equal(source.ok,true,JSON.stringify(source).slice(0,450));
  const change={...exit,id:'v103-patient-two-exit',
    playerId:patientTwo,elapsedSeconds:400,restartAtRunningSeconds:415};
  const wrong=simulate(input,policy,[checkpointRed],
    [checkpointExit,checkpointReturn],[change]);
  assert.equal(wrong.ok,false); // dismissed player cannot leave for treatment
  const current=simulate(input,policy,[checkpointRed],
    [checkpointExit,checkpointReturn]);
  assert.equal(current.ok,true,JSON.stringify(current).slice(0,450));
  assert.equal(current.sourceTransitionCount,3);
  assert.equal(current.intraphaseMedicalCount,0);
  assert.deepEqual(current.report,source.report);
  assert.equal(current.rngState,source.rngState);
  assert.equal(verify(input,policy,[checkpointRed],
    [checkpointExit,checkpointReturn],[],current),true);
});

test('v103 rejects malformed, early or unauthorized medical transitions',()=>{
  assert.equal(simulate(input,policy,[],[],[returning]).ok,false);
  assert.equal(simulate(input,policy,[],[],[exit,exit]).ok,false);
  assert.equal(simulate(input,policy,[],[],[returning,exit]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    {...exit,elapsedSeconds:99}]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    {...exit,elapsedSeconds:199}]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    {...exit,elapsedSeconds:299}]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    {...exit,elapsedSeconds:300}]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    {...exit,playerId:keeper}]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    {...exit,fixtureId:'other-fixture'}]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    {...exit,extra:'forbidden'}]).ok,false);
  assert.equal(simulate(input,policy,[],[checkpointExit],[
    {...exit,id:checkpointExit.id,playerId:patientTwo}]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    {...exit,restartAtRunningSeconds:195},returning]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    exit,{...returning,entryBoundary:'goal-line'}]).ok,false);
  assert.equal(simulate(input,policy,[],[],[
    exit,{...returning,refereeSignalId:''}]).ok,false);
  assert.equal(simulate(null,policy).ok,false);
});

test('v103 rejects tampered medical identities, times and source results',()=>{
  const valid=simulate(input,policy,[],[],[exit,returning]);
  assert.equal(valid.ok,true);
  const mutate=[
    x=>{x.events.find(e=>e.type==='intraphase-medical').elapsedSeconds=99;},
    x=>{x.events.find(e=>e.type==='intraphase-medical').action.playerId=keeper;},
    x=>{x.report.home.goals++;},
    x=>{x.rngDraws=90;},
    x=>{x.clinicalAndRefereeSourceAuthenticated=true;},
    x=>{x.events[x.events.length-1].elapsedSeconds=5399;},
  ];
  for(const change of mutate){
    const copy=structuredClone(valid);
    change(copy);
    assert.equal(verify(input,policy,[],[],[exit,returning],copy),false);
  }
  assert.equal(verify(input,policy,[],[],[],valid),false);
});
