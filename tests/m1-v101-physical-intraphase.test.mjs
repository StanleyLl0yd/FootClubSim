import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V101PhysicalIntraphase as simulate,
  verifyM1V101PhysicalIntraphase as verify}
  from '../dist/core/m1-v101-physical-intraphase.js';
import {simulateM1V99IntraphaseShots}
  from '../dist/core/m1-v99-intraphase-shots.js';
import {simulateM1V8MedicalPhases}
  from '../dist/core/m1-v8-medical-phases.js';
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
const players=new Map(catalog.players.map(p=>[p.id,p]));
const patient=home.starters.find(id=>players.get(id).primaryPosition!=='GK');
const other=home.starters.find(id=>id!==patient&&
  players.get(id).primaryPosition!=='GK');
const substitute=home.bench.find(id=>
  players.get(id).primaryPosition!=='GK');
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
const departure={schemaVersion:1,id:'exit-1',fixtureId:fixture.id,
  teamId:fixture.homeClubId,playerId:patient,elapsedSeconds:0,
  kind:'treatment-exit',reason:'medical-staff-entered',
  restartAtRunningSeconds:15};
const returning={schemaVersion:1,id:'return-1',fixtureId:fixture.id,
  teamId:fixture.homeClubId,playerId:patient,elapsedSeconds:300,
  kind:'treatment-return',returnContext:'running-clock',ballInPlay:true,
  entryBoundary:'touchline',refereeSignalId:'not-authenticated'};
const normalSub={schemaVersion:1,kind:'substitute-normal',
  fixtureId:fixture.id,commandId:'normal-sub-1',
  teamId:fixture.homeClubId,elapsedSeconds:2700,
  actor:{kind:'player'},stoppage:'half-time',
  outPlayerId:other,inPlayerId:substitute};

test('v101 zero-transition shots preserve the full exact v99 report and RNG',()=>{
  const prior=simulateM1V99IntraphaseShots(input,policy);
  const current=simulate(input,policy);
  assert.equal(prior.ok,true);
  assert.equal(current.ok,true,JSON.stringify(current).slice(0,500));
  assert.deepEqual(current.report,prior.report);
  assert.equal(current.rngState,prior.rngState);
  assert.equal(current.rngDraws,270);
  assert.equal(current.sourceTransitionCount,0);
  assert.deepEqual(
    current.events.filter(e=>e.type==='shot').map(
      ({schemaVersion,id,...e})=>e),
    prior.events.filter(e=>e.type==='shot').map(
      ({schemaVersion,id,...e})=>e),
  );
  assert.equal(verify(input,policy,[],[],current),true);
  assert.equal(current.careerCASAdmissionSupported,false);
  assert.equal(current.refereeAndClinicalAuthorityAuthenticated,false);
});

test('v101 physically excludes medical patient in all three first subphase slots',()=>{
  const schedule=[departure,returning];
  const original=structuredClone(input),originalMedical=structuredClone(schedule);
  const current=simulate(input,policy,[],schedule);
  assert.equal(current.ok,true,JSON.stringify(current).slice(0,600));
  const refs=current.events.filter(e=>e.type==='physical-transition');
  assert.equal(refs.length,2);
  assert.deepEqual(refs.map(e=>e.elapsedSeconds),[0,300]);
  assert.equal(current.sourceTransitionCount,2);
  for(const e of current.events.filter(e=>e.type==='shot'&&
      e.elapsedSeconds<300)){
    assert.notEqual(e.playerId,patient);
  }
  assert.equal(current.rngDraws,270);
  assert.equal(current.events.at(-1).elapsedSeconds,5400);
  assert.equal(verify(input,policy,[],schedule,current),true);
  assert.deepEqual(input,original);
  assert.deepEqual(schedule,originalMedical);
});

test('v101 source-verified halftime substitution changes subsequent 100s shooters',()=>{
  const original=simulateM1V8MedicalPhases(input,policy,[normalSub],[],[]);
  assert.equal(original.ok,true,JSON.stringify(original).slice(0,500));
  const current=simulate(input,policy,[normalSub]);
  assert.equal(current.ok,true,JSON.stringify(current).slice(0,500));
  const replacementEvent=current.events.find(e=>e.type==='physical-transition'&&
    e.source.type==='availability'&&
    e.source.source.entry.action.kind==='substitute-normal');
  assert.equal(replacementEvent.elapsedSeconds,2700);
  assert.ok(current.events.filter(e=>e.type==='shot'&&
    e.elapsedSeconds>=2700).every(e=>e.playerId!==other));
  assert.ok(current.events.every((e,i)=>e.sequence===i+1));
  assert.equal(current.rngDraws,270);
  assert.equal(verify(input,policy,[normalSub],[],current),true);
});

test('v101 reflects source-verified direct dismissal at all later shot slots',()=>{
  const red={schemaVersion:1,id:'direct-red-1',fixtureId:fixture.id,
    teamId:fixture.homeClubId,playerId:patient,elapsedSeconds:300,
    kind:'direct-red',origin:'trusted-referee'};
  const match=simulate(input,policy,[red]);
  assert.equal(match.ok,true,JSON.stringify(match).slice(0,500));
  const transition=match.events.find(e=>e.type==='physical-transition');
  assert.equal(transition.elapsedSeconds,300);
  assert.equal(transition.source.type,'availability');
  assert.ok(match.events.filter(e=>e.type==='shot'&&e.elapsedSeconds>=300)
    .every(e=>e.playerId!==patient));
  assert.equal(verify(input,policy,[red],[],match),true);
  const keeper=home.starters.find(id=>
    players.get(id).primaryPosition==='GK');
  assert.equal(simulate(input,policy,[{...red,playerId:keeper}]).ok,false);
});

test('v101 rejects unverified clocks, forged event histories and illegal medical transitions',()=>{
  const current=simulate(input,policy,[],[departure,returning]);
  assert.equal(current.ok,true);
  const mutators=[
    x=>{x.events[0].elapsedSeconds=99;},
    x=>{x.events[0].source.action.playerId='invented';},
    x=>{x.events[1].playerId=patient;},
    x=>{x.report.home.goals++;},
    x=>{x.rngDraws=90;},
    x=>{x.refereeAndClinicalAuthorityAuthenticated=true;},
  ];
  for(const mutate of mutators){
    const forged=structuredClone(current);
    mutate(forged);
    assert.equal(verify(input,policy,[],[departure,returning],forged),false);
  }
  assert.equal(verify(input,policy,[],[],current),false);
  assert.equal(simulate(input,policy,[],[returning]).ok,false);
  assert.equal(simulate(input,policy,[],[
    departure,{...returning,entryBoundary:'goal-line'}]).ok,false);
  assert.equal(simulate(input,policy,[{kind:'set-tactics'}]).ok,false);
  assert.equal(simulate(input,policy,[],[{...departure,extra:1}]).ok,false);
  assert.equal(simulate(null,policy).ok,false);
});
