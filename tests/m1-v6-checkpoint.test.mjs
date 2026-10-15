import test from 'node:test';
import assert from 'node:assert/strict';
import { createM1V6Checkpoint, resumeM1V6Checkpoint,
  M1_V6_CHECKPOINT_SCHEMA_VERSION } from '../dist/core/m1-v6-checkpoint.js';
import { simulateM1V6Phases } from '../dist/core/m1-phases-v6.js';
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
const homeBench=home.bench.filter(id=>players.get(id).primaryPosition!=='GK');
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
  away:{assignedActor:{kind:'staff',staffId:'away-coach'},availableStaffIds:['away-coach']}};
const card=(id,time=300,playerId=homeOut[0],kind='direct-red')=>({
  schemaVersion:1,id,fixtureId:fixture.id,teamId:fixture.homeClubId,
  playerId,elapsedSeconds:time,kind,
  origin:kind==='injury-withdrawal'?'trusted-medical':'trusted-referee',
});
const sub=(id,time=300)=>({
  schemaVersion:1,commandId:id,fixtureId:fixture.id,teamId:fixture.homeClubId,
  elapsedSeconds:time,actor:{kind:'player'},kind:'substitute-normal',
  outPlayerId:homeOut[1],inPlayerId:homeBench[0],
  stoppage:time===2700?'half-time':'referee-authorized',
});
const tactics=(id,time=300)=>({
  schemaVersion:1,commandId:id,fixtureId:fixture.id,teamId:fixture.homeClubId,
  elapsedSeconds:time,actor:{kind:'player'},kind:'set-tactics',
  plan:{...prematch.homeTactics,tempo:80},
});
function good(v){assert.equal(v.ok,true,JSON.stringify(v).slice(0,120));if(!v.ok)throw Error(v.error);return v.checkpoint;}
function bad(v,error){assert.deepEqual(v,{ok:false,error});}

test('v6 every one of 19 snapshot boundaries has precise clock and PRNG continuation',()=>{
  assert.equal(M1_V6_CHECKPOINT_SCHEMA_VERSION,1);
  for(let phase=0;phase<=18;phase++){
    const x=good(createM1V6Checkpoint(prematch,policy,phase));
    assert.equal(x.schemaVersion,1);
    assert.equal(x.actionSchemaVersion,6);
    assert.equal(x.completedPhases,phase);
    assert.equal(x.availability.substitutions.clock.elapsedSeconds,phase*300);
    assert.equal(x.controlled.controlled.clock.elapsedSeconds,phase*300);
    assert.equal(x.rngDraws,phase*5);
    const rng=new SeededRng(42);
    for(let j=0;j<phase*5;j++)rng.nextFloat();
    assert.equal(x.rngState,rng.snapshot());
    assert.ok(x.events.every(event=>event.elapsedSeconds<=phase*300));
    if(phase!==18)assert.equal(x.report,null);
  }
});

test('v6 snapshots survive JSON and preserve red, substitution and team-order chronology',()=>{
  let s=good(createM1V6Checkpoint(prematch,policy,0));
  const first=[card('red-first',0),tactics('tactics-first',0)];
  s=good(resumeM1V6Checkpoint(prematch,policy,s,3,first));
  assert.equal(s.commands.length,2);
  assert.equal(s.availability.teams.home.active.length,10);
  const prefix=structuredClone(s.events);
  s=JSON.parse(JSON.stringify(s));
  const second=[sub('normal',900),card('yellow-bench',900,homeBench[0],'caution')];
  s=good(resumeM1V6Checkpoint(prematch,policy,s,12,second));
  assert.deepEqual(s.events.filter(e=>e.elapsedSeconds<900),prefix);
  assert.equal(s.commands.length,4);
  assert.equal(s.availability.teams.home.active.length,10);
  assert.equal(s.availability.teams.home.cautions[0].playerId,homeBench[0]);
  const final=good(resumeM1V6Checkpoint(prematch,policy,s,18));
  const full=simulateM1V6Phases(prematch,policy,[...first,...second]);
  assert.equal(full.ok,true);
  if(full.ok){
    assert.deepEqual(final.events,full.events);
    assert.deepEqual(final.report,full.report);
    assert.deepEqual(final.controlled,full.controlled);
    assert.deepEqual(final.availability,full.availability);
    assert.equal(final.rngState,full.rngState);
  }
  assert.deepEqual(good(resumeM1V6Checkpoint(prematch,policy,final,18)),final);
});

test('split match equals uninterrupted v6 simulation across independent RNG seeds',()=>{
  for(const seed of [1,7,42,99,0x12345678,0xffffffff]){
    const input={...prematch,rngSeed:seed};
    const instructions=[sub('normal',300),card('yellow',900,homeBench[0],'caution')];
    let s=good(createM1V6Checkpoint(input,policy,0));
    s=good(resumeM1V6Checkpoint(input,policy,s,4,instructions));
    s=good(resumeM1V6Checkpoint(input,policy,s,18));
    const full=simulateM1V6Phases(input,policy,instructions);
    assert.equal(full.ok,true);
    if(!full.ok)continue;
    assert.deepEqual(s.events,full.events,'seed='+seed);
    assert.deepEqual(s.report,full.report,'seed='+seed);
    assert.equal(s.rngState,full.rngState,'seed='+seed);
  }
});

test('tampered saved source commands, actor, event, RNG, availability and extra keys fail',()=>{
  const c=[card('red',300)];
  const valid=good(createM1V6Checkpoint(prematch,policy,4,c));
  const changed=[
    null,{},[],{...valid,schemaVersion:2},{...valid,actionSchemaVersion:5},
    {...valid,completedPhases:5},{...valid,rngState:0},{...valid,rngDraws:15},
    {...valid,commands:[{...c[0],playerId:'forged'}]},
    {...valid,commands:[{...c[0],origin:'trusted-medical'}]},
    {...valid,events:[]},
    {...valid,events:[{...valid.events[0],id:'forged'},...valid.events.slice(1)]},
    {...valid,availability:{...valid.availability,status:'below-seven'}},
    {...valid,availability:{...valid.availability,teams:{
      ...valid.availability.teams,home:{
        ...valid.availability.teams.home,dismissed:[]}}}},
    {...valid,controlled:{...valid.controlled,controlled:{
      ...valid.controlled.controlled,clock:{
        ...valid.controlled.controlled.clock,elapsedSeconds:1500}}}},
    {...valid,extra:undefined},
    {...valid,events:[...valid.events,undefined]},
  ];
  for(const candidate of changed)
    bad(resumeM1V6Checkpoint(prematch,policy,candidate,5),'INVALID_CHECKPOINT');
});

test('future source commands, backdated orders and impossible referee holds refuse continuation',()=>{
  const s=good(createM1V6Checkpoint(prematch,policy,4));
  bad(resumeM1V6Checkpoint(prematch,policy,s,5,[card('old',300)]),
    'BACKDATED_COMMAND');
  bad(resumeM1V6Checkpoint(prematch,policy,s,3),'INVALID_PHASE');
  bad(resumeM1V6Checkpoint(prematch,policy,s,19),'INVALID_PHASE');
  bad(createM1V6Checkpoint(prematch,policy,19),'INVALID_PHASE');
  bad(createM1V6Checkpoint(prematch,policy,1,[card('future',300)]),'INVALID_SCHEDULE');
  bad(resumeM1V6Checkpoint(prematch,policy,s,5,[null]),'INVALID_SCHEDULE');
  const goalkeeper=home.starters.find(id=>players.get(id).primaryPosition==='GK');
  bad(createM1V6Checkpoint(prematch,policy,4,[card('GK',300,goalkeeper)]),
    'INVALID_SOURCE');
});

test('original prematch and user commands are not modified during v6 save/restore',()=>{
  const before=JSON.stringify(prematch),commands=[card('yellow',300,homeOut[0],'caution')];
  const inputBefore=JSON.stringify(commands);
  const s=good(createM1V6Checkpoint(prematch,policy,4,commands));
  assert.equal(JSON.stringify(commands),inputBefore);
  assert.equal(JSON.stringify(prematch),before);
  commands[0].playerId=homeOut[1];
  assert.equal(s.commands[0].playerId,homeOut[0],
    'saved original must be detached from later caller mutation');
});
