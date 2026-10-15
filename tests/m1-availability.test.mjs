import test from 'node:test';
import assert from 'node:assert/strict';
import {
  M1_AVAILABILITY_RULES_ID, M1_AVAILABILITY_SCHEMA_VERSION,
  startM1Availability, submitM1AvailabilityAction, advanceM1Availability,
} from '../dist/core/m1-availability.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c=>[c.id,c]));
const home = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const away = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const players = new Map(catalog.players.map(p=>[p.id,p]));
const homeOut = home.starters.filter(id=>players.get(id).primaryPosition!=='GK');
const awayOut = away.starters.filter(id=>players.get(id).primaryPosition!=='GK');
const homeBench = home.bench.filter(id=>players.get(id).primaryPosition!=='GK');
const awayBench = away.bench.filter(id=>players.get(id).primaryPosition!=='GK');
const homeKeeper = home.starters.find(id=>players.get(id).primaryPosition==='GK');
const input = {
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:home,awayLineup:away,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:42,
};
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:['home-coach']},
  away:{assignedActor:{kind:'staff',staffId:'away-coach'},availableStaffIds:['away-coach']},
};
function valid(x){assert.equal(x.ok,true,JSON.stringify(x).slice(0,260));if(!x.ok)throw Error(x.error);return x.state;}
function invalid(x,error){assert.deepEqual(x,{ok:false,error});}
function begin(){return valid(startM1Availability(input,policy));}
function advanceUntil(s,t){while(s.substitutions.clock.elapsedSeconds<t)s=valid(advanceM1Availability(input,policy,s));return s;}
function red(s,id,playerId=homeOut[0],kind='direct-red',side='home'){
  return {
    schemaVersion:1,id,fixtureId:fixture.id,
    teamId:side==='home'?fixture.homeClubId:fixture.awayClubId,
    playerId,elapsedSeconds:s.substitutions.clock.elapsedSeconds,
    kind,origin:kind==='injury-withdrawal'?'trusted-medical':'trusted-referee',
  };
}
function substitution(s,{id='sub-1',side='home',outId,inId}={}){
  const time=s.substitutions.clock.elapsedSeconds;
  return {
    schemaVersion:1,commandId:id,fixtureId:fixture.id,
    teamId:side==='home'?fixture.homeClubId:fixture.awayClubId,
    elapsedSeconds:time,
    actor:side==='home'?{kind:'player'}:{kind:'staff',staffId:'away-coach'},
    kind:'substitute-normal',
    outPlayerId:outId??(side==='home'?homeOut[0]:awayOut[0]),
    inPlayerId:inId??(side==='home'?homeBench[0]:awayBench[0]),
    stoppage:time===2700?'half-time':'referee-authorized',
  };
}
const use=(s,action)=>valid(submitM1AvailabilityAction(input,policy,s,action));

test('new schema preserves original independent referee, v5 and normal-sub contracts',()=>{
  assert.equal(M1_AVAILABILITY_SCHEMA_VERSION,1);
  assert.equal(M1_AVAILABILITY_RULES_ID,'m1-2026-27-unified-limited-v1');
  const x=begin();
  assert.deepEqual(x.teams.home.active,home.starters);
  assert.deepEqual(x.teams.away.active,away.starters);
  assert.deepEqual(x.timeline,[]);
  assert.equal(x.status,'playing');
  assert.equal(x.substitutions.clock.rngState,42);
});

test('normal substitute enters XI and may receive two yellows; existing teammate stays eligible',()=>{
  let s=advanceUntil(begin(),300);
  s=use(s,substitution(s));
  assert.ok(s.teams.home.active.includes(homeBench[0]));
  assert.ok(!s.teams.home.active.includes(homeOut[0]));
  s=use(s,red(s,'yellow-1',homeBench[0],'caution'));
  assert.equal(s.teams.home.cautions[0].count,1);
  s=use(s,red(s,'yellow-2',homeBench[0],'caution'));
  assert.equal(s.teams.home.cautions[0].count,2);
  assert.deepEqual(s.teams.home.dismissed,[homeBench[0]]);
  assert.ok(!s.teams.home.active.includes(homeBench[0]));
  assert.equal(s.teams.home.active.length,10);
  assert.equal(s.timeline.at(-1).effect,'second-yellow-red');
  s=advanceUntil(s,600);
  invalid(submitM1AvailabilityAction(input,policy,s,red(s,'extra',homeBench[0])),
    'NOT_ON_FIELD');
  s=use(s,substitution(s,{id:'sub-2',outId:homeOut[1],inId:homeBench[1]}));
  assert.equal(s.teams.home.active.length,10);
  assert.deepEqual(s.substitutions.teams.home.opportunityTimes,[300,600]);
  assert.equal(s.substitutions.teams.home.normalUsed,2);
});

test('red card cannot be laundered into normal substitution or restored on-field',()=>{
  let s=advanceUntil(begin(),300);
  s=use(s,red(s,'sent-off'));
  assert.equal(s.teams.home.active.length,10);
  invalid(submitM1AvailabilityAction(input,policy,s,substitution(s)),
    'NOT_ON_FIELD');
  s=use(s,substitution(s,{id:'legal',outId:homeOut[1],inId:homeBench[0]}));
  assert.equal(s.teams.home.active.length,10);
  assert.ok(!s.teams.home.active.includes(homeOut[0]));
  assert.ok(s.teams.home.active.includes(homeBench[0]));
  assert.equal(s.timeline.length,2);
  assert.equal(s.teams.home.dismissed[0],homeOut[0]);
});

test('medically withdrawn player cannot return through ordinary substitution',()=>{
  let s=advanceUntil(begin(),300);
  s=use(s,red(s,'medical-1',homeOut[0],'injury-withdrawal'));
  assert.deepEqual(s.teams.home.medicalWithdrawn,[homeOut[0]]);
  assert.equal(s.teams.home.active.length,10);
  invalid(submitM1AvailabilityAction(input,policy,s,substitution(s)),
    'NOT_ON_FIELD');
  invalid(submitM1AvailabilityAction(input,policy,s,red(s,'medical-2',homeOut[0])),
    'NOT_ON_FIELD');
  s=use(s,substitution(s,{id:'other',outId:homeOut[1],inId:homeBench[0]}));
  assert.equal(s.teams.home.active.length,10);
});

test('both teams use independent substitution windows and have independent sanctions',()=>{
  let s=advanceUntil(begin(),300);
  s=use(s,substitution(s,{id:'a'}));
  s=use(s,substitution(s,{id:'b',side:'away'}));
  s=use(s,red(s,'r-away',awayBench[0],'direct-red','away'));
  assert.equal(s.teams.away.active.length,10);
  assert.equal(s.teams.home.active.length,11);
  assert.deepEqual(s.substitutions.teams.home.opportunityTimes,[300]);
  assert.deepEqual(s.substitutions.teams.away.opportunityTimes,[300]);
  assert.equal(s.timeline.length,3);
});

test('goalkeeper dismissal and below-seven status halt further play, not synthetic 0-3',()=>{
  let x=advanceUntil(begin(),300);
  x=use(x,red(x,'red-gk',homeKeeper));
  assert.equal(x.status,'awaiting-goalkeeper');
  invalid(advanceM1Availability(input,policy,x),'REFEREE_RULING_REQUIRED');
  invalid(submitM1AvailabilityAction(input,policy,x,substitution(x,{id:'repair'})),
    'REFEREE_RULING_REQUIRED');
  let y=advanceUntil(begin(),300);
  for(let i=0;i<5;i++)y=use(y,red(y,'red-'+i,homeOut[i]));
  assert.equal(y.teams.home.active.length,6);
  assert.equal(y.status,'below-seven');
  invalid(advanceM1Availability(input,policy,y),'REFEREE_RULING_REQUIRED');
  assert.equal(y.substitutions.clock.elapsedSeconds,300);
});

test('chronological single timeline replay exactly preserves serialized state and final whistle',()=>{
  let s=advanceUntil(begin(),300);
  s=use(s,red(s,'caution-1',homeOut[0],'caution'));
  s=use(s,substitution(s,{id:'sub-1',outId:homeOut[1],inId:homeBench[0]}));
  s=advanceUntil(s,2700);
  s=use(s,red(s,'red-late',homeBench[0]));
  s=use(s,substitution(s,{id:'half',outId:homeOut[2],inId:homeBench[1]}));
  let copy=JSON.parse(JSON.stringify(s));
  for(let t=2700;t<5400;t+=300)copy=valid(advanceM1Availability(input,policy,copy));
  assert.equal(copy.status,'full-time');
  assert.equal(copy.timeline.length,4);
  assert.equal(copy.substitutions.clock.elapsedSeconds,5400);
  assert.deepEqual(valid(advanceM1Availability(input,policy,copy)),copy);
  invalid(submitM1AvailabilityAction(input,policy,copy,red(copy,'late')),
    'MATCH_FINISHED');
});

test('authoritative replay rejects forged saved sanctions, substitutions and additional fields',()=>{
  let s=advanceUntil(begin(),300);
  s=use(s,substitution(s));
  s=use(s,red(s,'yellow',homeBench[0],'caution'));
  const altered=[
    null,{},[],{...s,schemaVersion:2},{...s,rulesId:'bad'},
    {...s,extra:undefined},
    {...s,teams:{...s.teams,home:{...s.teams.home,
      active:[...s.teams.home.active,homeOut[0]]}}},
    {...s,teams:{...s.teams,home:{...s.teams.home,
      cautions:[]}}},
    {...s,substitutions:{...s.substitutions,
      clock:{...s.substitutions.clock,elapsedSeconds:600}}},
    {...s,timeline:[{...s.timeline[0],sequence:2},s.timeline[1]]},
    {...s,timeline:[s.timeline[0],{...s.timeline[1],effect:'straight-red'}]},
    {...s,timeline:[s.timeline[0],{...s.timeline[1],
      action:{...s.timeline[1].action,origin:'trusted-medical'}}]},
    {...s,timeline:[...s.timeline,undefined]},
  ];
  for(const candidate of altered)invalid(
    advanceM1Availability(input,policy,candidate),'INVALID_STATE');
});

test('bad authority, foreign team, medical/referee impersonation and ID reuse fail atomically',()=>{
  let s=advanceUntil(begin(),300);
  const before=JSON.stringify(s);
  for(const [candidate,error] of [
    [{...red(s,'wrong'),fixtureId:'another'},'WRONG_FIXTURE'],
    [{...red(s,'wrong-team'),teamId:'wrong-club'},'WRONG_TEAM'],
    [{...red(s,'wrong-time'),elapsedSeconds:600},'CLOCK_MISMATCH'],
    [{...red(s,'bad-med',homeOut[0],'injury-withdrawal'),
      origin:'trusted-referee'},'INVALID_ORIGIN'],
    [{...red(s,'bad-ref'),origin:'trusted-medical'},'INVALID_ORIGIN'],
    [{...red(s,'unknown'),playerId:'fake'},'NOT_ON_FIELD'],
    [{...red(s,'extra'),extra:true},'INVALID_ACTION'],
    [{...substitution(s,{id:'bad-actor'}),actor:{kind:'staff',staffId:'home-coach'}},
      'SUBSTITUTION_REJECTED'],
    [{...substitution(s,{id:'bad-bench'}),inPlayerId:'fake'},
      'SUBSTITUTION_REJECTED'],
  ]) {
    invalid(submitM1AvailabilityAction(input,policy,s,candidate),error);
    assert.equal(JSON.stringify(s),before);
  }
  s=use(s,red(s,'same'));
  invalid(submitM1AvailabilityAction(input,policy,s,
    substitution(s,{id:'same',outId:homeOut[1]})),'DUPLICATE_ID');
});

test('the input roster and prematch never mutate and invalid source is rejected',()=>{
  const old=JSON.stringify(input);
  let s=advanceUntil(begin(),300);
  s=use(s,red(s,'yellow',''+homeOut[0],'caution'));
  s=use(s,substitution(s,{id:'legal',outId:homeOut[1]}));
  assert.equal(JSON.stringify(input),old);
  invalid(startM1Availability({...input,rngSeed:0},policy),'INVALID_PREMATCH');
  invalid(startM1Availability(input,{}),'INVALID_PREMATCH');
});
