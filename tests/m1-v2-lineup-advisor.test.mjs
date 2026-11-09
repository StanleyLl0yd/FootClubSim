import test from 'node:test';
import assert from 'node:assert/strict';
import {createLigaPrikolovPreviewCatalog}
  from '../dist/app/ligaPrikolovPreviewCatalog.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import {inspectM1V2FormationFit,m1V2TacticalShape}
  from '../dist/core/m1-v2-formation-fit.js';
import {suggestM1V2FormationXI}
  from '../dist/core/m1-v2-lineup-advisor.js';

const catalog=createLigaPrikolovPreviewCatalog(2026);
const club=catalog.clubs[0];
const players=new Map(catalog.players.map(p=>[p.id,p]));
const available=club.registeredPlayerIds;
const original=available.slice(0,11);

test('adviser chooses reproducible legal elevens fitted to v2 formations',()=>{
  for(const formation of ['4-3-3','4-2-3-1','3-5-2']){
    const advice=suggestM1V2FormationXI(formation,available,players,original);
    assert.ok(advice,formation);
    assert.equal(advice.starters.length,11);
    assert.equal(new Set(advice.starters).size,11);
    assert.equal(advice.starters.filter(id=>
      players.get(id).primaryPosition==='GK').length,1);
    assert.ok(advice.starters.every(id=>available.includes(id)));
    assert.ok(advice.starters.filter(id=>
      players.get(id).foreignerForCompetition).length<=7);
    assert.equal(advice.fit.expected.defenders,Number(formation[0]));
    assert.deepEqual(advice.fit,inspectM1V2FormationFit(
      formation,advice.starters,players));
    const baseline=inspectM1V2FormationFit(formation,original,players);
    if(baseline)assert.ok(advice.fit.mismatch<=baseline.mismatch);
    const tactics={...defaultTacticalPlan(club.id),schemaVersion:2,formation};
    assert.deepEqual(m1V2TacticalShape(tactics,advice.starters,players),{
      attack:advice.fit.attack,defense:advice.fit.defense,
    });
    assert.deepEqual(suggestM1V2FormationXI(
      formation,available,players,original),advice);
    const shorthanded=advice.starters.slice(0,10);
    assert.equal(inspectM1V2FormationFit(
      formation,shorthanded,players),null);
    const liveShape=m1V2TacticalShape(
      tactics,shorthanded,players);
    assert.ok(liveShape.attack!==0||liveShape.defense!==0,
      'Dismissals must not disable the v2 tactical model');
  }
});

test('adviser cannot silently construct illegal or unsupported lineups',()=>{
  const noKeeper=available.filter(id=>players.get(id).primaryPosition!=='GK');
  assert.equal(suggestM1V2FormationXI('4-3-3',noKeeper,players),null);
  assert.equal(suggestM1V2FormationXI('4-4-4',available,players),null);
  assert.equal(suggestM1V2FormationXI('4-3-3',
    [...available,available[0]],players),null);
  assert.equal(suggestM1V2FormationXI('4-3-3',
    available.slice(0,10),players),null);
  const v1=defaultTacticalPlan(club.id);
  assert.deepEqual(m1V2TacticalShape(v1,original,players),{
    attack:0,defense:0,
  });
});
