import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V138DenseFiveSubstitutions}
  from '../dist/core/m1-v138-dense-five-substitutions.js';

function make(){
  const catalog=createSyntheticRplScaleCatalog(2026);
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v145-substitute-replacement');
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const base=prepareM1V128ManualFictionalContinuation(
    initial,started.journal);
  assert.equal(base?.ok,true);
  const line=base.fixture.homeClubId===initial.selectedClubId?
    base.request.prematch.homeLineup:base.request.prematch.awayLineup;
  const byId=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const starters=line.starters.filter(id=>byId.get(id)?.primaryPosition!=='GK');
  const bench=line.bench.filter(id=>byId.get(id)?.primaryPosition!=='GK');
  assert.ok(starters.length>=3&&bench.length>=4);
  return {initial,journal:started.journal,starters,bench};
}
test('v145 replacement of an incoming substitute follows active XI source',()=>{
  const s=make();
  const choices=[
    {outPlayerId:s.starters[0],inPlayerId:s.bench[0],elapsedSeconds:900},
    {outPlayerId:s.starters[1],inPlayerId:s.bench[1],elapsedSeconds:2700},
    {outPlayerId:s.bench[1],inPlayerId:s.bench[2],elapsedSeconds:3300},
  ];
  const p=prepareM1V138DenseFiveSubstitutions(s.initial,s.journal,choices);
  assert.equal(p?.ok,true,JSON.stringify(p).slice(0,500));
  const saved=applyM1V120Source(s.initial,s.journal,p.request);
  assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,500));
  assert.equal(reviewM1V126DenseSourceHolds(s.initial,saved.journal).ok,true);
  assert.deepEqual(saved.journal.entries[0].source.plannedCommands.map(
    x=>[x.outPlayerId,x.inPlayerId]),choices.map(
    x=>[x.outPlayerId,x.inPlayerId]));
});
test('v145 rejects a reserve not yet on field and removed-player reentry',()=>{
  const s=make();
  const wrong=[
    {outPlayerId:s.starters[0],inPlayerId:s.bench[0],elapsedSeconds:900},
    {outPlayerId:s.bench[2],inPlayerId:s.bench[1],elapsedSeconds:2700},
    {outPlayerId:s.starters[1],inPlayerId:s.bench[3],elapsedSeconds:3300},
  ];
  assert.equal(prepareM1V138DenseFiveSubstitutions(
    s.initial,s.journal,wrong)?.ok,false);
  const reused=[
    {outPlayerId:s.starters[0],inPlayerId:s.bench[0],elapsedSeconds:900},
    {outPlayerId:s.bench[0],inPlayerId:s.bench[1],elapsedSeconds:2700},
    {outPlayerId:s.starters[1],inPlayerId:s.starters[0],elapsedSeconds:3300},
  ];
  assert.equal(prepareM1V138DenseFiveSubstitutions(
    s.initial,s.journal,reused)?.ok,false);
});
