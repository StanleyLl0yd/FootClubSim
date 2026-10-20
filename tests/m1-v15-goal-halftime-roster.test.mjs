import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V15GoalAndHalfTime,verifyM1V15GoalAndHalfTime}
  from '../dist/core/m1-v15-goal-halftime-roster.js';
import {simulateM1V8MedicalPhases}
  from '../dist/core/m1-v8-medical-phases.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const fixture=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
const home=defaultSyntheticLineup(catalog.clubs.find(c=>c.id===fixture.homeClubId));
const away=defaultSyntheticLineup(catalog.clubs.find(c=>c.id===fixture.awayClubId));
const role=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
const nongk=ids=>ids.filter(id=>role.get(id)!=='GK');
const out={home:nongk(home.starters),away:nongk(away.starters)};
const next={home:nongk(home.bench),away:nongk(away.bench)};
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
const prematch=(seed=645)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:home,awayLineup:away,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});
const command=(i,side='home',time=300)=>({
  schemaVersion:1,kind:'substitute-normal',
  fixtureId:fixture.id,commandId:'v15-'+side+'-'+i+'-'+time,
  teamId:side==='home'?fixture.homeClubId:fixture.awayClubId,
  elapsedSeconds:time,actor:{kind:'player'},
  stoppage:time===2700?'half-time':'referee-authorized',
  outPlayerId:out[side][i],inPlayerId:next[side][i],
});
const run=(commands=[],pause=1,interval=900,seed=645)=>
  simulateM1V15GoalAndHalfTime(prematch(seed),policy,commands,pause,interval);
const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r).slice(0,400));return r;};
const bad=(r,error)=>assert.equal(r.error,error,JSON.stringify(r).slice(0,300));

test('one timeline applies goal changes AND half-time changes to the actual XI',()=>{
  const commands=[
    command(0,'home',300),command(1,'home',300),
    command(2,'home',2700),command(0,'away',2700),
  ];
  const original=structuredClone(commands);
  const match=ok(run(commands,1,600));
  assert.equal(match.inPlayOpportunitiesUsed.home,1);
  assert.equal(match.inPlayOpportunitiesUsed.away,0);
  assert.deepEqual(match.halfTimeSubstitutions,{home:1,away:1});
  const kinds=match.events.map(e=>e.kind);
  assert.ok(kinds.includes('goal-whistle'));
  assert.ok(kinds.includes('restart-kickoff'));
  assert.ok(kinds.includes('half-time-whistle'));
  assert.ok(kinds.includes('second-half-kickoff'));
  assert.equal(kinds.filter(k=>k==='board-signal').length,2);
  assert.equal(kinds.filter(k=>k==='substitution-applied').length,2);
  assert.equal(kinds.filter(k=>k==='half-time-substitution').length,2);
  const firstGoal=match.events.find(e=>e.kind==='goal-whistle');
  assert.equal(firstGoal.runningSeconds,299);
  assert.equal(match.events.find(e=>e.kind==='restart-kickoff').runningSeconds,300);
  const half=match.events.find(e=>e.kind==='half-time-whistle');
  assert.equal(half.runningSeconds,2700);
  assert.ok(!half.onField.home.includes(next.home[2]));
  assert.ok(half.onField.home.includes(next.home[0]));
  assert.ok(match.finalOnField.home.includes(next.home[2]));
  assert.ok(match.finalOnField.away.includes(next.away[0]));
  assert.deepEqual(commands,original);
  assert.equal(match.physicalDepartureTimingAuthenticated,false);
  assert.equal(match.lateEntryAndMedicalSupported,false);
  assert.equal(match.otherRefereeStoppagesSupported,false);
});
test('v8 outcome and RNG are identical with both classes of replacements',()=>{
  const commands=[command(0,'home'),command(1,'home',2700),
    command(0,'away',2700)];
  const combined=ok(run(commands,0,900));
  const v8=simulateM1V8MedicalPhases(prematch(),policy,commands,[],[]);
  assert.equal(v8.ok,true);
  assert.deepEqual(combined.finalOnField,v8.onFieldAtFullTime);
  assert.deepEqual(combined.finalScore,{
    home:v8.report.home.goals,away:v8.report.away.goals,
  });
  assert.equal(combined.rngState,v8.rngState);
  assert.equal(combined.rngDraws,v8.rngDraws);
  for(let i=1;i<combined.events.length;i++){
    assert.ok(combined.events[i].runningSeconds>=
      combined.events[i-1].runningSeconds);
    assert.ok(combined.events[i].wallSeconds>=combined.events[i-1].wallSeconds);
  }
  for(const event of combined.events.filter(e=>e.kind==='shot')){
    const side=event.teamId===fixture.homeClubId?'home':'away';
    assert.ok(event.onField[side].includes(event.playerId));
  }
  assert.equal(verifyM1V15GoalAndHalfTime(
    prematch(),policy,commands,0,900,combined),true);
});
test('both teams receive ordered goal boards without wall-clock reversal',()=>{
  const commands=[command(0,'home'),command(1,'home'),command(0,'away')];
  const match=ok(run(commands,1,900));
  assert.deepEqual(match.inPlayOpportunitiesUsed,{home:1,away:1});
  const boards=match.events.filter(e=>e.kind==='board-signal');
  assert.equal(boards.length,3);
  assert.deepEqual(boards.map(e=>e.wallSeconds),[299,299,300]);
  assert.ok(match.finalOnField.home.includes(next.home[0]));
  assert.ok(match.finalOnField.away.includes(next.away[0]));
  for(let i=1;i<match.events.length;i++){
    assert.ok(match.events[i].wallSeconds>=match.events[i-1].wallSeconds);
  }
});
test('no-goal checkpoint rejected, but half-time is always generated',()=>{
  bad(run([command(0)],1,900,49),'MISSING_INTERNAL_STOPPAGE');
  const intervalOnly=ok(run([command(0,'home',2700)],0,900,49));
  assert.equal(intervalOnly.inPlayOpportunitiesUsed.home,0);
  assert.equal(intervalOnly.halfTimeSubstitutions.home,1);
  assert.equal(intervalOnly.events.filter(e=>e.kind==='half-time-whistle').length,1);
  const empty=ok(run([],0,0,49));
  assert.equal(empty.events.at(-1).runningSeconds,5400);
  assert.equal(empty.events.at(-1).wallSeconds,5400);
});
test('half-time must not consume an in-play window or accept a fake goal stoppage',()=>{
  bad(run([{...command(0,'home',2700),stoppage:'referee-authorized'}]),
    'UNSUPPORTED_COMMAND');
  bad(run([{...command(0),stoppage:'half-time'}]),'UNSUPPORTED_COMMAND');
  bad(run([command(0,'home',2400)]),'MISSING_INTERNAL_STOPPAGE');
  bad(run([command(0,'home',2700)],1,0),'INVALID_INTERVAL');
  bad(run([command(0),command(1)],0,900),'STOPPAGE_TOO_SHORT');
  for(const duration of [-1,121,1.3,NaN,Infinity,'3',null]){
    bad(run([],duration),'INVALID_INTERVAL');
  }
  for(const duration of [-1,901,5.3,'900']){
    bad(run([],0,duration),'INVALID_INTERVAL');
  }
});
test('invalid actor, bench, duplicate action and wrong player are rejected',()=>{
  bad(run([{...command(0),actor:{kind:'staff',staffId:'fake'}}]),
    'SOURCE_MATCH_REJECTED');
  bad(run([{...command(0),inPlayerId:out.away[0]}]),
    'SOURCE_MATCH_REJECTED');
  bad(run([command(0),command(0)]),'SOURCE_MATCH_REJECTED');
});
test('forged replay, prototype getter and cyclic command are rejected',()=>{
  const actions=[command(0),command(0,'away',2700)];
  const valid=ok(run(actions,0,900));
  for(const edit of [
    x=>{x.finalScore.home++;},
    x=>{x.rngDraws--;},
    x=>{x.events.at(-1).wallSeconds++;},
    x=>{x.events[2].onField.home.push('phantom');},
    x=>{x.inPlayOpportunitiesUsed.home=3;},
  ]){
    const forged=structuredClone(valid);
    edit(forged);
    assert.equal(verifyM1V15GoalAndHalfTime(
      prematch(),policy,actions,0,900,forged),false);
  }
  let calls=0;
  const getter=structuredClone(actions);
  Object.defineProperty(getter[0],'teamId',{
    enumerable:true,get(){calls++;return fixture.homeClubId;},
  });
  bad(run(getter),'INVALID_SOURCE');
  assert.equal(calls,0);
  const cyclic=[command(0)];
  cyclic[0].extra=cyclic;
  bad(run(cyclic),'INVALID_SOURCE');
});
