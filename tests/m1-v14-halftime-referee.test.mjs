import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V14HalfTimeSubstitutions,verifyM1V14HalfTimeSubstitutions}
  from '../dist/core/m1-v14-halftime-referee.js';
import {simulateM1V8MedicalPhases}
  from '../dist/core/m1-v8-medical-phases.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
const catalog=createSyntheticRplScaleCatalog(77);
const fixture=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
const home=defaultSyntheticLineup(catalog.clubs.find(c=>c.id===fixture.homeClubId));
const away=defaultSyntheticLineup(catalog.clubs.find(c=>c.id===fixture.awayClubId));
const position=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
const normal=ids=>ids.filter(id=>position.get(id)!=='GK');
const outs={home:normal(home.starters),away:normal(away.starters)};
const ins={home:normal(home.bench),away:normal(away.bench)};
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
const source=(rngSeed=645)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:home,awayLineup:away,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed,
});
const command=(i,side='home')=>({
  schemaVersion:1,kind:'substitute-normal',
  fixtureId:fixture.id,commandId:'v14-interval-'+side+'-'+i,
  teamId:side==='home'?fixture.homeClubId:fixture.awayClubId,
  elapsedSeconds:2700,actor:{kind:'player'},stoppage:'half-time',
  outPlayerId:outs[side][i],inPlayerId:ins[side][i],
});
const run=(cmd=[],time=900,seed=645)=>
  simulateM1V14HalfTimeSubstitutions(source(seed),policy,cmd,time);
const ok=x=>{assert.equal(x.ok,true,JSON.stringify(x).slice(0,400));return x;};
const fail=(x,error)=>assert.equal(x.error,error,JSON.stringify(x).slice(0,250));

test('internal half-time referee requires no client-made goal/whistle and changes current XI',()=>{
  const commands=[command(0),command(1),command(0,'away')];
  const before=structuredClone(commands);
  const game=ok(run(commands,900));
  assert.equal(game.inPlayOpportunitiesUsed,0);
  assert.equal(game.homeNormalSubstitutions,2);
  assert.equal(game.awayNormalSubstitutions,1);
  const interval=game.events.filter(x=>
    x.kind==='half-time-whistle'||x.kind==='half-time-substitution'||
    x.kind==='second-half-kickoff');
  assert.deepEqual(interval.map(e=>e.kind),[
    'half-time-whistle','half-time-substitution',
    'half-time-substitution','half-time-substitution','second-half-kickoff',
  ]);
  assert.deepEqual(interval.map(e=>e.runningSeconds),[2700,2700,2700,2700,2700]);
  assert.deepEqual(interval.map(e=>e.wallSeconds),[2700,2700,2700,2700,3600]);
  assert.ok(!interval[0].onField.home.includes(ins.home[0]));
  assert.ok(interval[1].onField.home.includes(ins.home[0]));
  assert.ok(interval[2].onField.home.includes(ins.home[1]));
  assert.ok(interval[3].onField.away.includes(ins.away[0]));
  assert.equal(game.finalOnField.home.length,11);
  assert.equal(game.finalOnField.away.length,11);
  assert.deepEqual(commands,before);
  assert.equal(game.refereePhysicalProcedureAuthenticated,false);
  assert.equal(game.nonHalfTimeWhistlesAuthenticated,false);
});

test('second-half source shots are selected using the actual new XI and v8 RNG',()=>{
  const commands=[command(0),command(0,'away')];
  const game=ok(run(commands,600));
  const v8=simulateM1V8MedicalPhases(source(),policy,commands,[],[]);
  assert.equal(v8.ok,true);
  assert.deepEqual(game.finalOnField,v8.onFieldAtFullTime);
  assert.equal(game.rngState,v8.rngState);
  assert.equal(game.rngDraws,v8.rngDraws);
  assert.deepEqual(game.finalScore,{
    home:v8.report.home.goals,away:v8.report.away.goals,
  });
  assert.ok(game.events.every((e,i)=>i===0||
    e.runningSeconds>=game.events[i-1].runningSeconds));
  assert.ok(game.events.every((e,i)=>i===0||
    e.wallSeconds>=game.events[i-1].wallSeconds));
  for(const event of game.events.filter(e=>e.kind==='shot')){
    const side=event.teamId===fixture.homeClubId?'home':'away';
    assert.ok(event.onField[side].includes(event.playerId));
  }
  assert.equal(verifyM1V14HalfTimeSubstitutions(
    source(),policy,commands,600,game),true);
});

test('halftime window requires internal 2700 second and excludes off-time commands',()=>{
  fail(run([{...command(0),elapsedSeconds:2400,stoppage:'referee-authorized'}]),
    'UNSUPPORTED_COMMAND');
  fail(run([{...command(0),elapsedSeconds:3000}]),'UNSUPPORTED_COMMAND');
  fail(run([{...command(0),stoppage:'referee-authorized'}]),
    'UNSUPPORTED_COMMAND');
  fail(run([{...command(0),kind:'penalty-kick'}]),'UNSUPPORTED_COMMAND');
  fail(run([command(0)],0),'INVALID_INTERVAL');
  for(const duration of [-1,901,NaN,3.3,'900',null]){
    fail(run([],duration),'INVALID_INTERVAL');
  }
  const zero=ok(run([],0,49));
  assert.equal(zero.events.filter(e=>e.kind==='half-time-whistle').length,1);
  assert.equal(zero.events.at(-1).wallSeconds,5400);
});

test('fake substitute, duplicated changes and wrong actor fail core admission',()=>{
  fail(run([{...command(0),inPlayerId:outs.away[0]}]),'INVALID_MATCH');
  fail(run([command(0),command(0)]),'INVALID_MATCH');
  fail(run([{...command(0),actor:{kind:'staff',staffId:'fake'}}]),
    'INVALID_MATCH');
});

test('tampered event/clock/XI/source outcome cannot validate by replay',()=>{
  const commands=[command(0)];
  const g=ok(run(commands,900));
  for(const edit of [
    x=>{x.halftimeIntervalWallSeconds=899;},
    x=>{x.finalScore.away++;},
    x=>{x.events.at(-1).wallSeconds++;},
    x=>{x.events[1].onField.home.push('phantom');},
    x=>{x.inPlayOpportunitiesUsed=1;},
  ]){
    const fake=structuredClone(g);edit(fake);
    assert.equal(verifyM1V14HalfTimeSubstitutions(
      source(),policy,commands,900,fake),false);
  }
  const malicious=structuredClone(g);let calls=0;
  Object.defineProperty(malicious.events[0],'kind',{
    enumerable:true,get(){calls++;return 'kickoff';},
  });
  assert.equal(verifyM1V14HalfTimeSubstitutions(
    source(),policy,commands,900,malicious),false);
  assert.equal(calls,0);
});
