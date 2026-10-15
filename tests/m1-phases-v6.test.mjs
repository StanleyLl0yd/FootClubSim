import test from 'node:test';
import assert from 'node:assert/strict';
import { M1_V6_ENGINE_VERSION, M1_V6_EVENT_SCHEMA_VERSION,
  simulateM1V6Phases } from '../dist/core/m1-phases-v6.js';
import { deriveM1V6Ledger } from '../dist/core/m1-v6-ledger.js';
import { simulateM1V5Phases } from '../dist/core/m1-phases-v5.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const fixture=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const home=defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const away=defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const players=new Map(catalog.players.map(p=>[p.id,p]));
const homeOut=home.starters.filter(id=>players.get(id).primaryPosition!=='GK');
const awayOut=away.starters.filter(id=>players.get(id).primaryPosition!=='GK');
const homeBench=home.bench.filter(id=>players.get(id).primaryPosition!=='GK');
const homeKeeper=home.starters.find(id=>players.get(id).primaryPosition==='GK');
const prematch={
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
  away:{assignedActor:{kind:'staff',staffId:'away-coach'},
    availableStaffIds:['away-coach']},
};
function card(id,playerId=homeOut[0],kind='direct-red',time=300){
  return {schemaVersion:1,id,fixtureId:fixture.id,teamId:fixture.homeClubId,
    playerId,elapsedSeconds:time,kind,
    origin:kind==='injury-withdrawal'?'trusted-medical':'trusted-referee'};
}
function sub(id='normal',time=300,outPlayerId=homeOut[1],inPlayerId=homeBench[0]){
  return {schemaVersion:1,commandId:id,fixtureId:fixture.id,
    teamId:fixture.homeClubId,elapsedSeconds:time,actor:{kind:'player'},
    kind:'substitute-normal',outPlayerId,inPlayerId,
    stoppage:time===2700?'half-time':'referee-authorized'};
}
function run(input=prematch,commands=[]){
  const result=simulateM1V6Phases(input,policy,commands);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,120));
  if(!result.ok)throw Error(result.error);
  return result;
}

test('new v6 engine/schema does not alter old v5 seeded matches or historical event IDs',()=>{
  assert.equal(M1_V6_ENGINE_VERSION,'5');
  assert.equal(M1_V6_EVENT_SCHEMA_VERSION,6);
  for(const seed of [1,7,42,99,0x7fffffff,0xffffffff]){
    const input={...prematch,rngSeed:seed};
    const current=run(input);
    const old=simulateM1V5Phases(input,policy);
    assert.equal(old.ok,true);
    if(!old.ok)continue;
    assert.deepEqual(current.report,old.report);
    assert.equal(current.rngState,old.rngState);
    assert.equal(current.rngDraws,90);
    assert.deepEqual(current.events.filter(e=>e.type==='shot').map(e=>({
      ...e,schemaVersion:5,id:e.id.replace('m1-v6-','m1-v5-')})),
      old.events.filter(e=>e.type==='shot'));
    assert.equal(old.events.at(-1).schemaVersion,5);
    assert.equal(current.events.at(-1).schemaVersion,6);
  }
});

test('v6 ledger independently verifies structure, score and exact draw continuation',()=>{
  for(let seed=1;seed<=40;seed++){
    const input={...prematch,rngSeed:seed};
    const game=run(input);
    const replay=deriveM1V6Ledger(input,policy,game.events);
    assert.equal(replay.ok,true);
    if(replay.ok)assert.deepEqual(replay.report,game.report);
    const rng=new SeededRng(seed);
    for(let i=0;i<90;i++)rng.nextFloat();
    assert.equal(game.rngState,rng.snapshot());
    assert.equal(game.events.at(-1).elapsedSeconds,5400);
  }
});

test('straight-red and normal substitutions determine actual later shooters and skill averages',()=>{
  const instructions=[card('red-at-300'),sub('sub-at-600',600,homeOut[1],homeBench[0])];
  const original=run(prematch);
  const changed=run(prematch,instructions);
  assert.deepEqual(changed.events.filter(e=>e.type==='shot'&&e.elapsedSeconds<300)
    .map(({id,sequence,...rest})=>rest),
    original.events.filter(e=>e.type==='shot'&&e.elapsedSeconds<300)
      .map(({id,sequence,...rest})=>rest));
  assert.ok(changed.availability.teams.home.dismissed.includes(homeOut[0]));
  assert.equal(changed.availability.teams.home.active.length,10);
  assert.ok(changed.availability.teams.home.active.includes(homeBench[0]));
  assert.ok(changed.events.filter(e=>e.type==='shot'&&e.elapsedSeconds>=300)
    .every(e=>e.playerId!==homeOut[0]));
  assert.ok(changed.events.filter(e=>e.type==='shot'&&e.elapsedSeconds>=600)
    .every(e=>e.playerId!==homeOut[1]));
  assert.equal(changed.rngState,original.rngState);
  assert.equal(changed.rngDraws,original.rngDraws);
  const independent=deriveM1V6Ledger(prematch,policy,changed.events);
  assert.equal(independent.ok,true);
  if(independent.ok)assert.deepEqual(independent.report,changed.report);
});

test('two yellow cards on substitute produce red; decision entries are typed and ordered',()=>{
  const actions=[
    sub('early'),
    card('yellow-1',homeBench[0],'caution',600),
    card('yellow-2',homeBench[0],'caution',900),
  ];
  const result=run(prematch,actions);
  assert.equal(result.availability.teams.home.active.length,10);
  assert.deepEqual(result.availability.teams.home.dismissed,[homeBench[0]]);
  const e=result.events.filter(x=>x.type==='availability');
  assert.deepEqual(e.map(x=>x.entry.effect),[
    'substitution','yellow','second-yellow-red']);
  assert.ok(result.events.filter(x=>x.type==='shot'&&x.elapsedSeconds>=900)
    .every(x=>x.playerId!==homeBench[0]));
});

test('confirmed medical withdrawal removes player from future phases without automatic diagnosis',()=>{
  const result=run(prematch,[card('medical',homeOut[0],'injury-withdrawal',300)]);
  assert.deepEqual(result.availability.teams.home.medicalWithdrawn,[homeOut[0]]);
  assert.equal(result.availability.teams.home.active.length,10);
  assert.ok(result.events.filter(e=>e.type==='shot'&&e.elapsedSeconds>=300)
    .every(e=>e.playerId!==homeOut[0]));
});

test('GK dismissal and below-seven ruling fail closed without false final score',()=>{
  assert.deepEqual(simulateM1V6Phases(prematch,policy,[
    card('keeper',homeKeeper,'direct-red',300)]),
    {ok:false,error:'REFEREE_RULING_REQUIRED'});
  const decisions=homeOut.slice(0,5).map((id,i)=>card('red-'+i,id,'direct-red',300));
  assert.deepEqual(simulateM1V6Phases(prematch,policy,decisions),
    {ok:false,error:'REFEREE_RULING_REQUIRED'});
});

test('cannot replace dismissed player, replay forged identity or add impossible future events',()=>{
  const unsafe=[
    [card('red'),sub('replace-red',300,homeOut[0],homeBench[0])],
    [card('red'),card('again')],
    [card('red'),{...card('bad-med',homeOut[1],'injury-withdrawal'),
      origin:'trusted-referee'}],
    [sub('name'),card('name',homeBench[0])],
    [card('late',homeOut[0],'direct-red',5400)],
    [card('future',homeOut[0],'direct-red',900),card('past',homeOut[1])],
  ];
  for(const commands of unsafe)assert.equal(simulateM1V6Phases(prematch,policy,commands).ok,false);
  const result=run();
  const shot=result.events.find(e=>e.type==='shot');
  assert.ok(shot);
  const i=result.events.indexOf(shot);
  for(const badShot of [
    {...shot,schemaVersion:5},
    {...shot,id:'wrong'},
    {...shot,playerId:'unknown'},
    {...shot,zone:'invalid'},
    {...shot,xgMilli:-1},
    {...shot,outcome:'own-goal'},
    {...shot,elapsedSeconds:shot.elapsedSeconds+1},
    {...shot,extra:true},
  ]){
    const copy=[...result.events];copy[i]=badShot;
    assert.deepEqual(deriveM1V6Ledger(prematch,policy,copy),
      {ok:false,error:'INVALID_LEDGER'});
  }
});

test('modified availability effect and action cannot forge score chronology',()=>{
  const result=run(prematch,[card('red')]);
  const index=result.events.findIndex(e=>e.type==='availability');
  assert.ok(index>=0);
  for(const broken of [
    {...result.events[index],entry:{...result.events[index].entry,effect:'yellow'}},
    {...result.events[index],entry:{...result.events[index].entry,
      action:{...result.events[index].entry.action,playerId:'not-active'}}},
    {...result.events[index],sequence:999},
  ]){
    const events=[...result.events];events[index]=broken;
    assert.deepEqual(deriveM1V6Ledger(prematch,policy,events),
      {ok:false,error:'INVALID_LEDGER'});
  }
});

test('input catalog/fixture/tactics and referee commands remain unmodified',()=>{
  const old=JSON.stringify(prematch), commands=[card('red'),sub('next',600)];
  const saved=JSON.stringify(commands);
  run(prematch,commands);
  assert.equal(JSON.stringify(commands),saved);
  assert.equal(JSON.stringify(prematch),old);
});
