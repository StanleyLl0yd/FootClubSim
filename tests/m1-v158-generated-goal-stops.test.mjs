import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {deriveM1FixtureSeed} from '../dist/core/m1-fixture-seed.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V138DenseFiveSubstitutions}
  from '../dist/core/m1-v138-dense-five-substitutions.js';
import {prepareM1V158GeneratedGoalSubstitutions}
  from '../dist/core/m1-v158-dense-goal-substitutions.js';
import {verifyM1V158GeneratedGoalStops,
  verifyM1V158SourceClaim}
  from '../dist/core/m1-v158-generated-goal-stops.js';
import {simulateM1V105SpecialGoalChronology}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);
let cached;
function locateGeneratedGoal(){
  if(cached)return cached;
  for(let seed=1;seed<=24;seed++){
    const initial=createInitialCareer(catalog,catalog.clubs[0].id,seed,
      'v158-generated-goal-'+seed);
    const started=startM1V120Journal(initial);
    assert.equal(started.ok,true);
    const base=prepareM1V128ManualFictionalContinuation(
      initial,started.journal);
    assert.equal(base?.ok,true);
    const replay=simulateM1V105SpecialGoalChronology(
      base.request.prematch,base.request.policy,[],[],[],[]);
    assert.equal(replay.ok,true);
    const goalTimes=replay.events.filter(e=>
      e.type==='source'&&e.source.type==='shot'&&
      e.source.outcome==='goal'&&e.elapsedSeconds%300===299&&
      e.elapsedSeconds<5099).map(e=>e.elapsedSeconds+1);
    if(goalTimes.length===0)continue;
    const own=base.fixture.homeClubId===initial.selectedClubId?
      base.request.prematch.homeLineup:base.request.prematch.awayLineup;
    const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
    const starters=own.starters.filter(id=>
      players.get(id)?.primaryPosition!=='GK');
    const bench=own.bench.filter(id=>
      players.get(id)?.primaryPosition!=='GK');
    assert.ok(starters.length>=3&&bench.length>=3);
    for(const time of goalTimes){
      const chosen=Array.from({length:3},(_,i)=>({
        outPlayerId:starters[i],inPlayerId:bench[i],elapsedSeconds:time,
      }));
      const accepted=prepareM1V158GeneratedGoalSubstitutions(
        initial,started.journal,chosen);
      if(accepted?.ok){
        cached={initial,journal:started.journal,chosen,accepted,replay};
        return cached;
      }
    }
  }
  assert.fail('No legal synthetic three-player goal stop in 24 seeds');
}
test('v158 generated goal stop admits legal user changes and source replay',()=>{
  const s=locateGeneratedGoal();
  const p=s.accepted;
  assert.equal(p.schemaVersion,158);
  assert.equal(p.internalGeneratedGoalStopsVerified,true);
  assert.ok(p.request.commandId.startsWith('v158-goal-multi-'));
  assert.ok(p.request.plannedCommands.every((c,i)=>
    c.commandId==='v158-sub-'+p.fixture.id+'-'+i));
  const saved=applyM1V120Source(s.initial,s.journal,p.request);
  assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,450));
  const review=reviewM1V126DenseSourceHolds(s.initial,saved.journal);
  assert.equal(review.ok,true,JSON.stringify(review).slice(0,450));
  assert.equal(review.sourceVerifiedVirtualFixtures,0);
  const continued=prepareM1V128ManualFictionalContinuation(
    s.initial,saved.journal);
  assert.equal(continued?.ok,true,JSON.stringify(continued).slice(0,450));
});
test('v158 refuses user-declared non-generated whistle and unverified source',()=>{
  const s=locateGeneratedGoal();
  const {initial,journal,chosen,replay,accepted}=s;
  const goals=new Set(replay.events.filter(e=>
    e.type==='source'&&e.source.type==='shot'&&
    e.source.outcome==='goal').map(e=>e.elapsedSeconds+1));
  const noGoal=Array.from({length:17},(_,i)=>(i+1)*300)
    .find(t=>t!==2700&&!goals.has(t));
  assert.ok(noGoal);
  const forged=chosen.map(c=>({...c,elapsedSeconds:noGoal}));
  const legacy=prepareM1V138DenseFiveSubstitutions(
    initial,journal,forged);
  assert.equal(legacy?.ok,true,JSON.stringify(legacy).slice(0,300));
  const stricter=prepareM1V158GeneratedGoalSubstitutions(
    initial,journal,forged);
  assert.deepEqual(stricter,
    {ok:false,error:'NO_GENERATED_GOAL_STOP'});
  assert.equal(verifyM1V158GeneratedGoalStops(
    accepted.request.prematch,accepted.request.policy,
    forged.map((c,i)=>({...accepted.request.plannedCommands[i],
      elapsedSeconds:noGoal}))),false);
  assert.equal(verifyM1V158GeneratedGoalStops(
    accepted.request.prematch,accepted.request.policy,[]),false);
});
test('v158 supports halftime without fabricating an in-play goal',()=>{
  const s=locateGeneratedGoal();
  const halftime=s.chosen.map(c=>({...c,elapsedSeconds:2700}));
  const p=prepareM1V158GeneratedGoalSubstitutions(
    s.initial,s.journal,halftime);
  assert.equal(p?.ok,true,JSON.stringify(p).slice(0,350));
  assert.equal(verifyM1V158GeneratedGoalStops(
    p.request.prematch,p.request.policy,p.request.plannedCommands),true);
});

test('v158 generic CAS rejects forged goal-source authority',()=>{
  const s=locateGeneratedGoal();
  const {initial,journal,accepted,replay,chosen}=s;
  assert.equal(verifyM1V158SourceClaim(
    accepted.request.prematch,accepted.request.policy,
    accepted.request.plannedCommands,
    accepted.fixture.id,initial.selectedClubId,initial.rngState),true);
  assert.equal(accepted.request.prematch.rngSeed,
    deriveM1FixtureSeed(initial.rngState,accepted.fixture.id));
  const fakeSeed=structuredClone(accepted.request);
  fakeSeed.prematch.rngSeed=
    ((fakeSeed.prematch.rngSeed+1)>>>0)||1;
  assert.deepEqual(applyM1V120Source(initial,journal,fakeSeed),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const wrong=structuredClone(accepted.request);
  wrong.plannedCommands[0].commandId='v138-sub-'+accepted.fixture.id+'-0';
  assert.deepEqual(applyM1V120Source(initial,journal,wrong),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const goals=new Set(replay.events.filter(e=>
    e.type==='source'&&e.source.type==='shot'&&
    e.source.outcome==='goal').map(e=>e.elapsedSeconds+1));
  const time=Array.from({length:17},(_,i)=>(i+1)*300)
    .find(t=>t!==2700&&!goals.has(t));
  assert.ok(time);
  const legacy=prepareM1V138DenseFiveSubstitutions(initial,journal,
    chosen.map(c=>({...c,elapsedSeconds:time})));
  assert.equal(legacy?.ok,true);
  const untrusted={...legacy.request,
    commandId:'v158-goal-multi-'+legacy.fixture.id,
    plannedCommands:legacy.request.plannedCommands.map((c,i)=>({
      ...c,actor:{kind:'player'},
      commandId:'v158-sub-'+legacy.fixture.id+'-'+i,
    }))};
  assert.deepEqual(applyM1V120Source(initial,journal,untrusted),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  assert.equal(journal.revision,0);
});

test('v158 source-verified goals admit one or two physical replacements',()=>{
  const s=locateGeneratedGoal();
  for(const n of [1,2]){
    const subset=s.chosen.slice(0,n);
    const prepared=prepareM1V158GeneratedGoalSubstitutions(
      s.initial,s.journal,subset);
    assert.equal(prepared?.ok,true,JSON.stringify(prepared).slice(0,450));
    assert.equal(prepared.substitutionCount,n);
    const saved=applyM1V120Source(
      s.initial,s.journal,prepared.request);
    assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,450));
    const review=reviewM1V126DenseSourceHolds(s.initial,saved.journal);
    assert.equal(review.ok,true,JSON.stringify(review).slice(0,450));
    const next=prepareM1V128ManualFictionalContinuation(
      s.initial,saved.journal);
    assert.equal(next?.ok,true,JSON.stringify(next).slice(0,450));
  }
});
test('v158 one and two changes cannot invent a source goal restart',()=>{
  const s=locateGeneratedGoal();
  const goals=new Set(s.replay.events.filter(e=>
    e.type==='source'&&e.source.type==='shot'&&
    e.source.outcome==='goal').map(e=>e.elapsedSeconds+1));
  const noGoal=Array.from({length:17},(_,i)=>(i+1)*300)
    .find(time=>time!==2700&&!goals.has(time));
  assert.ok(noGoal);
  for(const n of [1,2]){
    const forged=s.chosen.slice(0,n).map(c=>({
      ...c,elapsedSeconds:noGoal,
    }));
    assert.deepEqual(prepareM1V158GeneratedGoalSubstitutions(
      s.initial,s.journal,forged),
      {ok:false,error:'NO_GENERATED_GOAL_STOP'});
  }
});
