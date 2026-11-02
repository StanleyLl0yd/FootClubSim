import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {isPlainJsonTree} from '../dist/core/plain-json-tree.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V136DenseDoubleSubstitution}
  from '../dist/core/m1-v136-dense-double-substitution.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);
function setup(){
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v146-double-replace-incoming');
  const start=startM1V120Journal(initial);
  assert.equal(start.ok,true);
  const p=prepareM1V128ManualFictionalContinuation(initial,start.journal);
  assert.equal(p?.ok,true);
  const own=p.fixture.homeClubId===initial.selectedClubId?
    p.request.prematch.homeLineup:p.request.prematch.awayLineup;
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const legal=own.starters.map(starter=>({
    starter,reserves:own.bench.filter(id=>
      players.get(starter)?.primaryPosition!=='GK'&&
      players.get(id)?.primaryPosition!=='GK'&&
      players.get(id)?.foreignerForCompetition===
        players.get(starter)?.foreignerForCompetition),
  })).find(pair=>pair.reserves.length>=2);
  assert.ok(legal,'Need two bench players with unchanged foreigner count');
  return {initial,journal:start.journal,...legal};
}
test('v146 two normal changes can replace the first incoming player',()=>{
  const s=setup();
  const choices=[
    {outPlayerId:s.starter,inPlayerId:s.reserves[0],elapsedSeconds:900},
    {outPlayerId:s.reserves[0],inPlayerId:s.reserves[1],elapsedSeconds:2700},
  ];
  const p=prepareM1V136DenseDoubleSubstitution(
    s.initial,s.journal,choices);
  assert.equal(p?.ok,true,JSON.stringify(p).slice(0,500));
  assert.equal(isPlainJsonTree(p.request.plannedCommands),true);
  assert.notStrictEqual(p.request.plannedCommands[0].actor,
    p.request.plannedCommands[1].actor);
  const saved=applyM1V120Source(s.initial,s.journal,p.request);
  assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,500));
  assert.equal(reviewM1V126DenseSourceHolds(s.initial,saved.journal).ok,true);
  assert.deepEqual(saved.journal.entries[0].source.plannedCommands.map(
    x=>[x.outPlayerId,x.inPlayerId,x.elapsedSeconds]),
    choices.map(x=>[x.outPlayerId,x.inPlayerId,x.elapsedSeconds]));
});
test('v146 rejects duplicate incoming and reverse chronology',()=>{
  const s=setup();
  const ok=[
    {outPlayerId:s.starter,inPlayerId:s.reserves[0],elapsedSeconds:900},
    {outPlayerId:s.reserves[0],inPlayerId:s.reserves[1],elapsedSeconds:2700},
  ];
  for(const bad of [
    [ok[0],{...ok[1],inPlayerId:ok[0].inPlayerId}],
    [{...ok[0],elapsedSeconds:3300},ok[1]],
    [ok[0],{...ok[1],inPlayerId:'missing-reserve'}],
    [ok[0],{...ok[1],elapsedSeconds:2701}],
  ])assert.equal(prepareM1V136DenseDoubleSubstitution(
    s.initial,s.journal,bad)?.ok,false);
});
