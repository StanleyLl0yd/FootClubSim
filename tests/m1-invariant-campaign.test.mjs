import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V5Phases, deriveM1V5Ledger } from '../dist/core/m1-phases-v5.js';
import { deriveM1VerifiedScorerReport } from '../dist/core/m1-scorer-report.js';
import { startM1RefereeState, submitM1RefereeDecision,
  advanceM1RefereeState } from '../dist/core/m1-referee-decisions.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c=>[c.id,c]));
const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const roster = new Map(catalog.players.map(p=>[p.id,p]));
const homeOut = homeLineup.starters.filter(id=>roster.get(id).primaryPosition!=='GK');
const awayOut = awayLineup.starters.filter(id=>roster.get(id).primaryPosition!=='GK');
const homeBench = homeLineup.bench.filter(id=>roster.get(id).primaryPosition!=='GK');
const awayBench = awayLineup.bench.filter(id=>roster.get(id).primaryPosition!=='GK');
const prematch = {
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup,awayLineup,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:1,
};
const policy = {
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'staff',staffId:'away-coach'},availableStaffIds:['away-coach']},
};
const seeds=[1,2,3,7,19,42,77,1023,65535,0x7fffffff,0xffffffff];
const rejection=(x)=>assert.deepEqual(x,{ok:false,error:'INVALID_EVENT'});
function good(seed, commands=[]) {
  const input={...prematch,rngSeed:seed};
  const result=simulateM1V5Phases(input,policy,commands);
  assert.equal(result.ok,true);
  if(!result.ok)throw Error(result.error);
  return {input,result};
}
function substitute(side,time) {
  return {
    schemaVersion:1,commandId:'sub-'+side+'-'+time,
    fixtureId:fixture.id,
    teamId:side==='home'?fixture.homeClubId:fixture.awayClubId,
    elapsedSeconds:time,
    actor:side==='home'?{kind:'player'}:{kind:'staff',staffId:'away-coach'},
    kind:'substitute-normal',
    outPlayerId:side==='home'?homeOut[0]:awayOut[0],
    inPlayerId:side==='home'?homeBench[0]:awayBench[0],
    stoppage:time===2700?'half-time':'referee-authorized',
  };
}

test('v5 independent seeded corpus conserves 90 PRNG draws and report sums',()=>{
  let observedShots=0, observedGoals=0;
  for(const seed of [...seeds,...Array.from({length:80},(_,i)=>i+100)]) {
    const {input,result}=good(seed);
    const independent=deriveM1V5Ledger(input,policy,result.events);
    assert.equal(independent.ok,true,'seed '+seed);
    if(independent.ok)assert.deepEqual(independent.report,result.report);
    assert.equal(result.rngDraws,90);
    const rng=new SeededRng(seed);
    for(let i=0;i<90;i++)rng.nextFloat();
    assert.equal(result.rngState,rng.snapshot(),'seed '+seed);
    const shots=result.events.filter(x=>x.type==='shot');
    observedShots+=shots.length;
    observedGoals+=shots.filter(x=>x.outcome==='goal').length;
    assert.ok(shots.length<=18);
    assert.equal(result.report.home.shots+result.report.away.shots,shots.length);
    assert.ok(result.report.home.goals+result.report.away.goals<=shots.length);
    const chron=shots.map(s=>Math.floor(s.elapsedSeconds/300));
    assert.equal(new Set(chron).size,shots.length);
    assert.ok(result.events.every((e,i)=>e.sequence===i+1));
  }
  assert.ok(observedShots>0);
  assert.ok(observedGoals>0);
});

test('mixed normal substitutions remain legally admitted across boundary seeds',()=>{
  const commands=[substitute('home',300),substitute('away',2700)];
  for(const seed of [...seeds,101,102,103,104,105]) {
    const {input,result}=good(seed,commands);
    assert.deepEqual(result.substitutions.teams.home.opportunityTimes,[300]);
    assert.deepEqual(result.substitutions.teams.away.opportunityTimes,[]);
    assert.equal(result.substitutions.teams.home.normalUsed,1);
    assert.equal(result.substitutions.teams.away.normalUsed,1);
    assert.ok(result.events.filter(e=>e.type==='shot'&&e.elapsedSeconds>=300)
      .every(e=>e.playerId!==homeOut[0]));
    assert.ok(result.events.filter(e=>e.type==='shot'&&e.elapsedSeconds>=2700)
      .every(e=>e.playerId!==awayOut[0]));
    const match=deriveM1VerifiedScorerReport(input,policy,commands,result);
    assert.equal(match.ok,true,'seed '+seed);
    if(match.ok) {
      assert.equal(match.report.players.find(x=>x.playerId===homeBench[0]).playedSeconds,5100);
      assert.equal(match.report.players.find(x=>x.playerId===awayBench[0]).playedSeconds,2700);
    }
  }
});

test('event ledger targeted invalid mutations fail closed for every sampled shot',()=>{
  let count=0;
  for(const seed of [...seeds,...Array.from({length:60},(_,i)=>i+20)]) {
    const {input,result}=good(seed);
    const index=result.events.findIndex(e=>e.type==='shot');
    if(index<0)continue;
    const shot=result.events[index];
    const mutations=[
      {...shot,schemaVersion:4},
      {...shot,sequence:index+2},
      {...shot,id:'bad-event-id'},
      {...shot,playerId:'forged-person'},
      {...shot,teamId:'forged-club'},
      {...shot,elapsedSeconds:shot.elapsedSeconds+1},
      {...shot,elapsedSeconds:shot.elapsedSeconds+300},
      {...shot,fatigueMilli:1001},
      {...shot,xgMilli:-1},
      {...shot,xgMilli:Infinity},
      {...shot,zone:'outside'},
      {...shot,outcome:'own-goal'},
      {...shot,secret:undefined},
    ];
    for(const mutated of mutations) {
      const events=[...result.events];events[index]=mutated;
      rejection(deriveM1V5Ledger(input,policy,events));
    }
    count+=mutations.length;
  }
  assert.ok(count>=100,'enough deterministic negative cases');
});

test('referee decision snapshots reject deterministic mutation corpus and preserve source',()=>{
  for(const seed of seeds) {
    const input={...prematch,rngSeed:seed};
    const start=startM1RefereeState(input);
    assert.equal(start.ok,true);
    if(!start.ok)continue;
    const next=advanceM1RefereeState(input,start.state);
    assert.equal(next.ok,true);
    if(!next.ok)continue;
    const card={schemaVersion:1,id:'fuzz-'+seed,fixtureId:fixture.id,
      teamId:fixture.homeClubId,playerId:homeOut[0],elapsedSeconds:300,
      kind:'caution',origin:'trusted-referee'};
    const admitted=submitM1RefereeDecision(input,next.state,card);
    assert.equal(admitted.ok,true);
    if(!admitted.ok)continue;
    const snapshot=JSON.parse(JSON.stringify(admitted.state));
    assert.equal(advanceM1RefereeState(input,snapshot).ok,true);
    for(const forged of [
      {...snapshot,clock:{...snapshot.clock,rngState:0}},
      {...snapshot,teams:{...snapshot.teams,home:{...snapshot.teams.home,
        dismissed:[homeOut[0]]}}},
      {...snapshot,decisions:[{...snapshot.decisions[0],kind:'direct-red'}]},
      {...snapshot,decisions:[{...snapshot.decisions[0],effect:'straight-red'}]},
      {...snapshot,decisions:[{...snapshot.decisions[0],origin:'trusted-medical'}]},
      {...snapshot,commands:undefined},
    ]) {
      assert.deepEqual(advanceM1RefereeState(input,forged),
        {ok:false,error:'INVALID_STATE'});
    }
  }
});

test('deterministic fuzz corpus never mutates protected initial synthetic catalog',()=>{
  const before=JSON.stringify(catalog);
  const input=JSON.stringify(prematch);
  for(const seed of seeds) {
    good(seed);
  }
  assert.equal(JSON.stringify(catalog),before);
  assert.equal(JSON.stringify(prematch),input);
});
