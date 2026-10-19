import test from 'node:test';
import assert from 'node:assert/strict';
import { startM1V13LateEntry, advanceM1V13LateEntry }
  from '../dist/core/m1-v13-late-entry-physical-xi.js';
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
const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
const out=home.starters.find(id=>positions.get(id)!=='GK');
const incoming=home.bench.find(id=>positions.get(id)!=='GK');
const awayOut=away.starters.find(id=>positions.get(id)!=='GK');
const awayIncoming=away.bench.find(id=>positions.get(id)!=='GK');
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
const prematch=(rngSeed=645)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:home,awayLineup:away,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed,
});
const procedure=(side='home')=>({
  schemaVersion:1,kind:'substitute-normal',fixtureId:fixture.id,
  teamId:side==='home'?fixture.homeClubId:fixture.awayClubId,
  outPlayerId:side==='home'?out:awayOut,
  inPlayerId:side==='home'?incoming:awayIncoming,
  restartRunningSeconds:300,boardSignalWallSeconds:100,
  departureWallSeconds:111,
});
const step=(kind,time,refereeSignalId=null)=>({
  kind,runningSeconds:time,refereeSignalId,
});
const ok=x=>{
  assert.equal(x.ok,true,JSON.stringify(x).slice(0,450));
  return x.state;
};
const fail=(x,err)=>assert.equal(x.error,err,JSON.stringify(x));
const apply=(state,action,seed=645,original=procedure())=>
  advanceM1V13LateEntry(prematch(seed),policy,original,state,action);

test('late outgoing player REALLY leaves: on-field XI remains at ten during full 60 running seconds',()=>{
  const initial=ok(startM1V13LateEntry(prematch(),policy,procedure()));
  assert.equal(initial.schemaVersion,1);
  assert.equal(initial.status,'PLAYING_SHORT');
  assert.equal(initial.entryEligibleAtRunningSeconds,360);
  assert.equal(initial.onField.home.length,10);
  assert.equal(initial.onField.away.length,11);
  assert.equal(initial.onField.home.includes(out),false);
  assert.equal(initial.onField.home.includes(incoming),false);
  assert.equal(initial.originalSubstituteLocked,true);
  assert.equal(initial.downstreamShotsRecomputedForShortHandedXI,false);
  const before=JSON.parse(JSON.stringify(initial));
  const minute=ok(apply(before,step('playing',359)));
  assert.equal(minute.onField.home.length,10);
  const early=ok(apply(minute,step('stoppage',359)));
  assert.equal(early.events.at(-1).kind,'early-stoppage');
  assert.equal(early.onField.home.length,10);
  const later=ok(apply(early,step('playing',360)));
  const admitted=ok(apply(later,step('stoppage',360,'virtual-ref-signal-360')));
  assert.equal(admitted.status,'ENTRY_REPORTED_NOT_AUTHENTICATED');
  assert.equal(admitted.events.at(-1).kind,'entry-permitted');
  assert.equal(admitted.onField.home.length,11);
  assert.equal(admitted.onField.home.includes(out),false);
  assert.equal(admitted.onField.home.includes(incoming),true);
  assert.equal(admitted.subsequentWhistleAuthorityAuthenticated,false);
  assert.equal(admitted.refereeSignalAuthorityAuthenticated,false);
  assert.equal(admitted.downstreamShotsRecomputedForShortHandedXI,false);
  fail(apply(admitted,step('playing',361)),'ALREADY_COMPLETED');
  assert.deepEqual(initial,JSON.parse(JSON.stringify(initial)));
});

test('the one-minute delay counts running time only, not stopped procedure time',()=>{
  let s=ok(startM1V13LateEntry(prematch(),policy,procedure()));
  fail(apply(s,step('stoppage',300,'too-early')),'NOT_YET_ELIGIBLE');
  s=ok(apply(s,step('stoppage',300)));
  s=ok(apply(s,step('playing',330)));
  s=ok(apply(s,step('stoppage',330)));
  fail(apply(s,step('stoppage',330,'also-early')),'NOT_YET_ELIGIBLE');
  s=ok(apply(s,step('playing',360)));
  fail(apply(s,step('stoppage',360)),'REFEREE_SIGNAL_REQUIRED');
  s=ok(apply(s,step('stoppage',360,'signal')));
  assert.equal(s.onField.home.length,11);
});

test('away team can remain short-handed and then admit the originally named substitute',()=>{
  const original=procedure('away');
  let s=ok(startM1V13LateEntry(prematch(),policy,original));
  assert.equal(s.onField.home.length,11);
  assert.equal(s.onField.away.length,10);
  s=ok(apply(s,step('playing',365),645,original));
  s=ok(apply(s,step('stoppage',365,'away-entry'),645,original));
  assert.equal(s.onField.away.length,11);
  assert.ok(s.onField.away.includes(awayIncoming));
  assert.ok(!s.onField.away.includes(awayOut));
});

test('wrong bench/fixture/goal anchor and nonlate procedures fail closed',()=>{
  fail(startM1V13LateEntry(prematch(49),policy,procedure()),
    'NO_ENGINE_GOAL_RESTART');
  fail(startM1V13LateEntry(prematch(),policy,{
    ...procedure(),fixtureId:'wrong'}),'INVALID_PROCEDURE');
  fail(startM1V13LateEntry(prematch(),policy,{
    ...procedure(),inPlayerId:out}),'INVALID_PROCEDURE');
  fail(startM1V13LateEntry(prematch(),policy,{
    ...procedure(),inPlayerId:awayIncoming}),'INVALID_BENCH_OR_XI');
  fail(startM1V13LateEntry(prematch(),policy,{
    ...procedure(),departureWallSeconds:110}),'INVALID_PROCEDURE');
  fail(startM1V13LateEntry(prematch(),policy,{
    ...procedure(),restartRunningSeconds:301}),'INVALID_PROCEDURE');
  const keeper=home.starters.find(id=>positions.get(id)==='GK');
  fail(startM1V13LateEntry(prematch(),policy,{
    ...procedure(),outPlayerId:keeper}),'UNSUPPORTED_EXCEPTION');
  fail(startM1V13LateEntry(prematch(),policy,{
    ...procedure(),kind:'concussion-substitution'}),'INVALID_PROCEDURE');
});

test('source replay forbids replacing the locked substitute and forged snapshots',()=>{
  const initial=ok(startM1V13LateEntry(prematch(),policy,procedure()));
  const valid=ok(apply(initial,step('playing',359)));
  for (const mutate of [
    x=>{x.inPlayerId=awayIncoming;},
    x=>{x.status='ENTRY_REPORTED_NOT_AUTHENTICATED';},
    x=>{x.onField.home.push(incoming);},
    x=>{x.entryEligibleAtRunningSeconds=359;},
    x=>{x.events[0].kind='entry-permitted';},
    x=>{x.appliedActionHistory[0].runningSeconds=360;},
    x=>{x.downstreamShotsRecomputedForShortHandedXI=true;},
  ]) {
    const forged=structuredClone(valid);mutate(forged);
    fail(apply(forged,step('playing',360)),'INVALID_STATE');
  }
  const other=procedure();other.inPlayerId=home.bench.find(id=>id!==incoming && positions.get(id)!=='GK');
  fail(apply(valid,step('playing',360),645,other),'INVALID_STATE');
  fail(apply(valid,{kind:'cancel',runningSeconds:360,refereeSignalId:null}),
    'INVALID_ACTION');
  fail(apply(valid,step('playing',359)),'RUNNING_CLOCK_REQUIRED');
});

test('malicious accessor and cycle never execute hidden source code',()=>{
  const original=procedure();
  let called=0;
  Object.defineProperty(original,'inPlayerId',{
    enumerable:true,get(){called++;return incoming;},
  });
  fail(startM1V13LateEntry(prematch(),policy,original),'INVALID_SOURCE');
  assert.equal(called,0);
  const s=ok(startM1V13LateEntry(prematch(),policy,procedure()));
  const tampered=structuredClone(s);
  tampered.appliedActionHistory.push(tampered);
  fail(apply(tampered,step('playing',301)),'INVALID_STATE');
  const action=step('playing',301);
  Object.defineProperty(action,'runningSeconds',{
    enumerable:true,get(){called++;return 301;},
  });
  fail(apply(s,action),'INVALID_ACTION');
  assert.equal(called,0);
});
