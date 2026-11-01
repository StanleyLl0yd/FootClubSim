import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {prepareM1V138DenseFiveSubstitutions}
  from '../dist/core/m1-v138-dense-five-substitutions.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';

const catalog=createSyntheticRplScaleCatalog(2026);
function fixture(){
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v138-five-normal');
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const base=prepareM1V128ManualFictionalContinuation(
    initial,started.journal);
  assert.equal(base?.ok,true);
  const line=base.fixture.homeClubId===initial.selectedClubId?
    base.request.prematch.homeLineup:base.request.prematch.awayLineup;
  const byId=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const out=line.starters.filter(id=>byId.get(id)?.primaryPosition!=='GK');
  const bench=line.bench.filter(id=>byId.get(id)?.primaryPosition!=='GK');
  assert.ok(out.length>=5&&bench.length>=5);
  return {initial,journal:started.journal,out,bench};
}
const times=[900,2700,2700,3300,3900];
const selections=(s,count,seconds=times)=>
  Array.from({length:count},(_,i)=>({
    outPlayerId:s.out[i],inPlayerId:s.bench[i],
    elapsedSeconds:seconds[i],
  }));
test('v138 source replay supports three, four and five normal changes',()=>{
  const s=fixture();
  for(const n of [3,4,5]){
    const prepared=prepareM1V138DenseFiveSubstitutions(
      s.initial,s.journal,selections(s,n));
    assert.equal(prepared?.ok,true,JSON.stringify(prepared).slice(0,300));
    assert.equal(prepared.substitutionCount,n);
    assert.equal(prepared.request.plannedCommands.length,n);
    const saved=applyM1V120Source(s.initial,s.journal,prepared.request);
    assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,450));
    const verified=reviewM1V126DenseSourceHolds(s.initial,saved.journal);
    assert.equal(verified.ok,true,JSON.stringify(verified).slice(0,450));
    assert.equal(verified.sourceVerifiedVirtualFixtures,0);
    const next=prepareM1V128ManualFictionalContinuation(
      s.initial,saved.journal);
    assert.equal(next?.ok,true,JSON.stringify(next).slice(0,350));
  }
});
test('v138 uses one halftime opportunity for five replacements',()=>{
  const s=fixture();
  const p=prepareM1V138DenseFiveSubstitutions(s.initial,s.journal,
    selections(s,5,[2700,2700,2700,2700,2700]));
  assert.equal(p?.ok,true,JSON.stringify(p).slice(0,350));
  assert.equal(p.substitutionCount,5);
});
test('v138 refuses fourth in-play window, duplicates and tampered source',()=>{
  const s=fixture();
  assert.equal(prepareM1V138DenseFiveSubstitutions(s.initial,s.journal,
    selections(s,4,[900,1500,2100,3300]))?.ok,false);
  const good=selections(s,5);
  for(const bad of [
    good.slice(0,2),[...good,good[0]],
    [good[0],{...good[1],outPlayerId:good[0].outPlayerId},...good.slice(2)],
    [{...good[0],elapsedSeconds:3900},...good.slice(1)],
    good.map((x,i)=>i===4?{...x,inPlayerId:'invalid-reserve'}:x),
  ]){
    assert.equal(prepareM1V138DenseFiveSubstitutions(
      s.initial,s.journal,bad)?.ok,false);
  }
  const valid=prepareM1V138DenseFiveSubstitutions(
    s.initial,s.journal,good);
  assert.equal(valid?.ok,true);
  const saved=applyM1V120Source(s.initial,s.journal,valid.request);
  assert.equal(saved.ok,true);
  const spoof=structuredClone(saved.journal);
  spoof.entries[0].source.plannedCommands.pop();
  assert.equal(reviewM1V126DenseSourceHolds(s.initial,spoof).ok,false);
});
