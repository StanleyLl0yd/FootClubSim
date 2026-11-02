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

const catalog=createSyntheticRplScaleCatalog(2026);
const create=()=>createInitialCareer(catalog,catalog.clubs[0].id,42,'v136-double');
function choices(initial,journal,second=2700){
  const prepared=prepareM1V128ManualFictionalContinuation(initial,journal);
  assert.equal(prepared?.ok,true);
  const match=prepared.request.prematch;
  const lineup=prepared.fixture.homeClubId===initial.selectedClubId?
    match.homeLineup:match.awayLineup;
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const starting=lineup.starters.filter(id=>players.get(id)?.primaryPosition!=='GK');
  const reserves=lineup.bench.filter(id=>players.get(id)?.primaryPosition!=='GK');
  for(const out1 of starting.slice(0,5)){
    for(const in1 of reserves.slice(0,5)){
      for(const out2 of starting.filter(id=>id!==out1).slice(0,5)){
        for(const in2 of reserves.filter(id=>id!==in1).slice(0,5)){
          const selected=[
            {outPlayerId:out1,inPlayerId:in1,elapsedSeconds:900},
            {outPlayerId:out2,inPlayerId:in2,elapsedSeconds:second},
          ];
          const run=prepareM1V136DenseDoubleSubstitution(initial,journal,selected);
          if(run?.ok)return {run,selected};
        }
      }
    }
  }
  throw Error('No legal double substitution available in fixed synthetic fixture');
}
test('v136 records both named changes at separate legal dense windows',()=>{
  const initial=create(),started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const {run,selected}=choices(initial,started.journal);
  assert.equal(run.request.plannedCommands.length,2);
  const [one,two]=run.request.plannedCommands;
  assert.equal(one.outPlayerId,selected[0].outPlayerId);
  assert.equal(two.inPlayerId,selected[1].inPlayerId);
  assert.equal(one.elapsedSeconds,900);
  assert.equal(two.elapsedSeconds,2700);
  assert.equal(one.stoppage,'referee-authorized');
  assert.equal(two.stoppage,'half-time');
  const saved=applyM1V120Source(initial,started.journal,run.request);
  assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,400));
  const reviewed=reviewM1V126DenseSourceHolds(initial,saved.journal);
  assert.equal(reviewed.ok,true,JSON.stringify(reviewed).slice(0,400));
  assert.equal(reviewed.sourceVerifiedVirtualFixtures,0);
  const continued=prepareM1V128ManualFictionalContinuation(initial,saved.journal);
  assert.equal(continued?.ok,true);
});
test('v136 rejects duplicate participants, reversed clock, forged namespace',()=>{
  const initial=create(),started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const {run,selected}=choices(initial,started.journal);
  for(const bad of [
    [selected[0],{...selected[1],outPlayerId:selected[0].outPlayerId}],
    [selected[0],{...selected[1],inPlayerId:selected[0].inPlayerId}],
    [{...selected[0],elapsedSeconds:2700},
      {...selected[1],elapsedSeconds:900}],
    selected.slice(0,1),
  ]){
    assert.equal(prepareM1V136DenseDoubleSubstitution(
      initial,started.journal,bad)?.ok,false);
  }
  const valid=applyM1V120Source(initial,started.journal,run.request);
  assert.equal(valid.ok,true);
  const spoof=structuredClone(valid.journal);
  spoof.entries[0].commandId='v124-virtual-referee-'+run.fixture.id;
  assert.deepEqual(reviewM1V126DenseSourceHolds(initial,spoof),
    {ok:false,error:'INVALID_JOURNAL'});
});
