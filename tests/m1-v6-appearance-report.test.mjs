import test from 'node:test';
import assert from 'node:assert/strict';
import { M1_V6_APPEARANCE_SCHEMA_VERSION,
  deriveM1VerifiedV6AppearanceReport } from '../dist/core/m1-v6-appearance-report.js';
import { simulateM1V6Phases } from '../dist/core/m1-phases-v6.js';
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
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const home=defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const away=defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const byId=new Map(catalog.players.map(p=>[p.id,p]));
const homeOut=home.starters.filter(id=>byId.get(id).primaryPosition!=='GK');
const awayOut=away.starters.filter(id=>byId.get(id).primaryPosition!=='GK');
const homeBench=home.bench.filter(id=>byId.get(id).primaryPosition!=='GK');
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
  away:{assignedActor:{kind:'staff',staffId:'away-coach'},availableStaffIds:['away-coach']},
};
const card=(id,at,playerId=homeOut[0],kind='caution')=>({
  schemaVersion:1,id,fixtureId:fixture.id,teamId:fixture.homeClubId,
  playerId,elapsedSeconds:at,kind,
  origin:kind==='injury-withdrawal'?'trusted-medical':'trusted-referee',
});
const sub=(id,at=300)=>({
  schemaVersion:1,commandId:id,fixtureId:fixture.id,
  teamId:fixture.homeClubId,elapsedSeconds:at,actor:{kind:'player'},
  kind:'substitute-normal',outPlayerId:homeOut[1],inPlayerId:homeBench[0],
  stoppage:at===2700?'half-time':'referee-authorized',
});
const ok=(commands=[],prematch=input)=>{
  const run=simulateM1V6Phases(prematch,policy,commands);
  assert.equal(run.ok,true);
  if(!run.ok)throw Error(run.error);
  const result=deriveM1VerifiedV6AppearanceReport(prematch,policy,commands,run);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,200));
  if(!result.ok)throw Error(result.error);
  return {run,report:result.report};
};

test('v6 appearance report explicitly excludes unimplemented penalty, own goal and bans',()=>{
  assert.equal(M1_V6_APPEARANCE_SCHEMA_VERSION,1);
  const {report,run}=ok();
  assert.equal(report.schemaVersion,1);
  assert.equal(report.status,'SYNTHETIC_V6_EVENTS_ONLY_NO_DISCIPLINARY_SANCTIONS');
  assert.equal(report.eventSchemaVersion,6);
  assert.deepEqual(report.match,run.report);
  assert.equal(report.appearances.length,22);
  assert.ok(report.appearances.every(p=>p.started && p.playedSeconds===5400));
  assert.equal(report.teams.home.playedSeconds,11*5400);
  assert.equal(report.teams.away.playedSeconds,11*5400);
  assert.ok(report.goals.every(g=>g.kind==='synthetic-open-play-shot'));
});

test('scorer, shots and xG always match full reproduced v6 action ledger',()=>{
  for(const seed of [1,2,3,7,13,42,88,0xffffffff]){
    const {run,report}=ok([],{...input,rngSeed:seed});
    const shots=run.events.filter(e=>e.type==='shot');
    const byPlayer=new Map(report.appearances.map(p=>[p.playerId,p]));
    assert.equal(shots.length,report.appearances.reduce((n,p)=>n+p.shots,0));
    assert.equal(shots.reduce((n,e)=>n+e.xgMilli,0),
      report.appearances.reduce((n,p)=>n+p.xgMilli,0));
    assert.equal(shots.filter(e=>e.outcome==='goal').length,report.goals.length);
    for(const g of report.goals){
      const e=shots.find(shot=>shot.id===g.eventId);
      assert.equal(e?.outcome,'goal');
      assert.equal(g.scorerId,e.playerId);
      assert.equal(g.teamId,e.teamId);
      assert.equal(byPlayer.get(g.scorerId)?.goals>0,true);
    }
  }
});

test('normal substitute, caution, direct red and confirmed medical withdrawal shorten minutes',()=>{
  const actions=[
    card('yellow',0,homeOut[0]),
    sub('bench',300),
    card('red-on-bench',600,homeBench[0],'direct-red'),
    card('medical',900,homeOut[2],'injury-withdrawal'),
  ];
  const {report}=ok(actions);
  const byPlayer=new Map(report.appearances.map(p=>[p.playerId,p]));
  assert.equal(byPlayer.get(homeOut[0]).yellowCards,1);
  assert.equal(byPlayer.get(homeOut[1]).playedSeconds,300);
  assert.equal(byPlayer.get(homeBench[0]).enteredAtSeconds,300);
  assert.equal(byPlayer.get(homeBench[0]).playedSeconds,300);
  assert.equal(byPlayer.get(homeBench[0]).dismissal,'straight-red');
  assert.equal(byPlayer.get(homeOut[2]).playedSeconds,900);
  assert.equal(byPlayer.get(homeOut[2]).medicalWithdrawn,true);
  assert.equal(report.teams.home.normalSubstitutions,1);
  assert.equal(report.teams.home.dismissals,1);
  assert.equal(report.teams.home.medicalWithdrawals,1);
  assert.equal(report.teams.home.yellowCards,1);
  assert.equal(report.teams.home.playedSeconds,
    11*5400-(5400-600)-(5400-900));
  assert.equal(report.teams.away.playedSeconds,11*5400);
});

test('second caution is one send-off and two yellows, no fictitious extra substitution',()=>{
  const {report}=ok([
    card('yellow-one',300,homeOut[0]),
    card('yellow-two',600,homeOut[0]),
  ]);
  const a=report.appearances.find(p=>p.playerId===homeOut[0]);
  assert.equal(a.yellowCards,2);
  assert.equal(a.dismissal,'second-yellow');
  assert.equal(a.playedSeconds,600);
  assert.equal(report.teams.home.yellowCards,2);
  assert.equal(report.teams.home.dismissals,1);
  assert.equal(report.teams.home.normalSubstitutions,0);
  assert.equal(report.teams.home.playedSeconds,11*5400-(5400-600));
});

test('forged player/score/PRNG/event stream and wrong source commands fail closed',()=>{
  const commands=[card('straight',300)];
  const valid=simulateM1V6Phases(input,policy,commands);
  assert.equal(valid.ok,true);
  if(!valid.ok)return;
  for(const candidate of [
    null,{},[],
    {...valid,rngSeed:99},
    {...valid,rngState:1234},
    {...valid,events:valid.events.slice(1)},
    {...valid,events:[...valid.events,{type:'goal'}]},
    {...valid,report:{...valid.report,home:{...valid.report.home,goals:99}}},
    {...valid,availability:{...valid.availability,status:'below-seven'}},
    {...valid,extra:undefined},
  ]){
    assert.deepEqual(deriveM1VerifiedV6AppearanceReport(input,policy,commands,candidate),
      {ok:false,error:'INVALID_MATCH_SOURCE'});
  }
  assert.deepEqual(deriveM1VerifiedV6AppearanceReport(input,policy,[],valid),
    {ok:false,error:'INVALID_MATCH_SOURCE'});
  assert.deepEqual(deriveM1VerifiedV6AppearanceReport(input,{},commands,valid),
    {ok:false,error:'INVALID_MATCH_SOURCE'});
});

test('real-world red-card stoppages are not invented in the output report',()=>{
  const {report}=ok([card('sendoff',300,homeOut[0],'direct-red')]);
  assert.equal(report.goals.every(x=>x.kind==='synthetic-open-play-shot'),true);
  assert.equal(report.teams.home.dismissals,1);
  assert.ok(!('suspensionMatches' in report));
  assert.ok(!('forfeitScore' in report));
});

test('source prematch and command history are unchanged by report projection',()=>{
  const previous=JSON.stringify(input);
  const commands=[card('yellow',300)];
  const before=JSON.stringify(commands);
  ok(commands);
  assert.equal(JSON.stringify(input),previous);
  assert.equal(JSON.stringify(commands),before);
});
