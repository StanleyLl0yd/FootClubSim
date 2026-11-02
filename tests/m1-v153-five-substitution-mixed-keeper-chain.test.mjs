import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V138DenseFiveSubstitutions}
  from '../dist/core/m1-v138-dense-five-substitutions.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

function fixture(){
  const catalog=createSyntheticRplScaleCatalog(2026);
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v153-five-mixed-goalkeeper-chain');
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const base=prepareM1V128ManualFictionalContinuation(
    initial,started.journal);
  assert.equal(base?.ok,true);
  const lineup=base.fixture.homeClubId===initial.selectedClubId?
    base.request.prematch.homeLineup:base.request.prematch.awayLineup;
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const isKeeper=id=>players.get(id)?.primaryPosition==='GK';
  const startingGk=lineup.starters.find(isKeeper);
  const benchGks=lineup.bench.filter(isKeeper);
  const startingOut=lineup.starters.filter(id=>!isKeeper(id));
  const benchOut=lineup.bench.filter(id=>!isKeeper(id));
  assert.ok(startingGk&&benchGks.length>=2&&
    startingOut.length>=3&&benchOut.length>=3);
  const choices=[
    {outPlayerId:startingGk,inPlayerId:benchGks[0],elapsedSeconds:900},
    {outPlayerId:benchGks[0],inPlayerId:benchGks[1],elapsedSeconds:2700},
    {outPlayerId:startingOut[0],inPlayerId:benchOut[0],elapsedSeconds:2700},
    {outPlayerId:startingOut[1],inPlayerId:benchOut[1],elapsedSeconds:3300},
    {outPlayerId:startingOut[2],inPlayerId:benchOut[2],elapsedSeconds:3900},
  ];
  return {initial,journal:started.journal,choices};
}

test('v153 five normal changes with chained GKs use only three in-play windows',()=>{
  const s=fixture();
  const prepared=prepareM1V138DenseFiveSubstitutions(
    s.initial,s.journal,s.choices);
  assert.equal(prepared?.ok,true,JSON.stringify(prepared).slice(0,500));
  assert.equal(prepared.substitutionCount,5);
  const commands=prepared.request.plannedCommands;
  assert.deepEqual(commands.map(c=>[c.outPlayerId,c.inPlayerId,c.elapsedSeconds]),
    s.choices.map(c=>[c.outPlayerId,c.inPlayerId,c.elapsedSeconds]));
  assert.deepEqual(commands.map(c=>c.stoppage),
    ['referee-authorized','half-time','half-time',
      'referee-authorized','referee-authorized']);
  assert.equal(new Set(commands.map(c=>c.actor)).size,5);
  const saved=applyM1V120Source(s.initial,s.journal,prepared.request);
  assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,500));
  const reviewed=reviewM1V126DenseSourceHolds(s.initial,saved.journal);
  assert.equal(reviewed.ok,true,JSON.stringify(reviewed).slice(0,500));
  assert.deepEqual(saved.journal.entries[0].source.plannedCommands.map(
    c=>[c.outPlayerId,c.inPlayerId]),s.choices.map(
    c=>[c.outPlayerId,c.inPlayerId]));
  const continued=prepareM1V128ManualFictionalContinuation(
    s.initial,saved.journal);
  assert.equal(continued?.ok,true,JSON.stringify(continued).slice(0,500));
});

test('v153 fail-closed on illegal GK reentry, repeated bench and fourth window',()=>{
  const s=fixture();
  const change=(i,updates)=>s.choices.map((x,j)=>j===i?{...x,...updates}:x);
  for(const invalid of [
    change(1,{outPlayerId:s.choices[0].outPlayerId}),
    change(1,{inPlayerId:s.choices[0].inPlayerId}),
    change(1,{inPlayerId:s.choices[0].outPlayerId}),
    change(2,{inPlayerId:s.choices[1].inPlayerId}),
    s.choices.map((x,i)=>({...x,elapsedSeconds:
      [900,1500,2100,3300,3900][i]})),
    change(0,{elapsedSeconds:3300}),
  ]){
    assert.equal(prepareM1V138DenseFiveSubstitutions(
      s.initial,s.journal,invalid)?.ok,false);
  }
  const good=prepareM1V138DenseFiveSubstitutions(
    s.initial,s.journal,s.choices);
  assert.equal(good?.ok,true);
  const aliased={...good.request,
    plannedCommands:structuredClone(good.request.plannedCommands)};
  aliased.plannedCommands[1].actor=aliased.plannedCommands[0].actor;
  assert.equal(applyM1V120Source(s.initial,s.journal,aliased).ok,false);
});
