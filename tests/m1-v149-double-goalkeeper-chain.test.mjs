import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V136DenseDoubleSubstitution}
  from '../dist/core/m1-v136-dense-double-substitution.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

function setup(){
  const catalog=createSyntheticRplScaleCatalog(2026);
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v149-double-goalkeeper-chain');
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const next=prepareM1V128ManualFictionalContinuation(
    initial,started.journal);
  assert.equal(next?.ok,true);
  const lineup=next.fixture.homeClubId===initial.selectedClubId?
    next.request.prematch.homeLineup:next.request.prematch.awayLineup;
  const byId=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const goalkeeper=lineup.starters.find(id=>
    byId.get(id)?.primaryPosition==='GK');
  const reserves=lineup.bench.filter(id=>
    byId.get(id)?.primaryPosition==='GK');
  const outfield=lineup.bench.find(id=>
    byId.get(id)?.primaryPosition!=='GK');
  assert.ok(goalkeeper&&reserves.length>=2&&outfield);
  return {initial,journal:started.journal,goalkeeper,reserves,outfield};
}
test('v149 two legal goalkeeper changes may replace the first incoming GK',()=>{
  const s=setup();
  const choices=[
    {outPlayerId:s.goalkeeper,inPlayerId:s.reserves[0],
      elapsedSeconds:900},
    {outPlayerId:s.reserves[0],inPlayerId:s.reserves[1],
      elapsedSeconds:2700},
  ];
  const prepared=prepareM1V136DenseDoubleSubstitution(
    s.initial,s.journal,choices);
  assert.equal(prepared?.ok,true,JSON.stringify(prepared).slice(0,500));
  assert.deepEqual(prepared.request.plannedCommands.map(
    c=>[c.outPlayerId,c.inPlayerId,c.elapsedSeconds]),
    choices.map(c=>[c.outPlayerId,c.inPlayerId,c.elapsedSeconds]));
  assert.equal(prepared.request.plannedCommands[0].actor.kind,'player');
  assert.equal(prepared.request.plannedCommands[1].actor.kind,'player');
  assert.notStrictEqual(prepared.request.plannedCommands[0].actor,
    prepared.request.plannedCommands[1].actor);
  const saved=applyM1V120Source(s.initial,s.journal,prepared.request);
  assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,500));
  assert.equal(reviewM1V126DenseSourceHolds(
    s.initial,saved.journal).ok,true);
  assert.deepEqual(saved.journal.entries[0].source.plannedCommands.map(
    c=>[c.outPlayerId,c.inPlayerId]),
    choices.map(c=>[c.outPlayerId,c.inPlayerId]));
});
test('v149 goalkeeper chain rejects nonkeeper, reentry and invalid IDs',()=>{
  const s=setup();
  const first={outPlayerId:s.goalkeeper,inPlayerId:s.reserves[0],
    elapsedSeconds:900};
  const second={outPlayerId:s.reserves[0],inPlayerId:s.reserves[1],
    elapsedSeconds:2700};
  for(const attempts of [
    [{...first,inPlayerId:s.outfield},second],
    [first,{...second,inPlayerId:s.goalkeeper}],
    [first,{...second,outPlayerId:s.goalkeeper}],
    [first,{...second,inPlayerId:'unknown-goalkeeper'}],
    [{...first,elapsedSeconds:3300},second],
  ]){
    assert.equal(prepareM1V136DenseDoubleSubstitution(
      s.initial,s.journal,attempts)?.ok,false);
  }
});
