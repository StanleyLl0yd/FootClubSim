import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V124DenseVirtualRefereeMatch}
  from '../dist/core/m1-v124-dense-internal-referee.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V132DenseManagerSubstitution}
  from '../dist/core/m1-v132-dense-manager-substitution.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const select=(initial,journal)=>{
  const base=prepareM1V128ManualFictionalContinuation(initial,journal);
  assert.equal(base?.ok,true,JSON.stringify(base).slice(0,350));
  const fixture=base.fixture;
  const lineup=fixture.homeClubId===initial.selectedClubId?
    base.request.prematch.homeLineup:base.request.prematch.awayLineup;
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  for(const out of lineup.starters.filter(id=>
    players.get(id)?.primaryPosition!=='GK')){
    for(const incoming of lineup.bench.filter(id=>
      players.get(id)?.primaryPosition!=='GK')){
      const requested={outPlayerId:out,inPlayerId:incoming,elapsedSeconds:900};
      const proposed=prepareM1V132DenseManagerSubstitution(
        initial,journal,requested);
      if(proposed?.ok)return {proposed,requested};
    }
  }
  return null;
};

test('v132 accepts explicit manager-selected legal dense-clock replacement in native v120 source',()=>{
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,
    42,'v132-basic-manager');
  const initialState=JSON.stringify(initial);
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const chosen=select(initial,started.journal);
  assert.ok(chosen,'There must be at least one legal named substitution');
  const {proposed,requested}=chosen;
  const cmd=proposed.request.plannedCommands[0];
  assert.equal(cmd.kind,'substitute-normal');
  assert.equal(cmd.commandId,'v132-sub-'+proposed.fixture.id);
  assert.equal(cmd.elapsedSeconds,900);
  assert.equal(cmd.stoppage,'referee-authorized');
  assert.equal(cmd.actor.kind,'player');
  assert.equal(cmd.outPlayerId,requested.outPlayerId);
  assert.equal(cmd.inPlayerId,requested.inPlayerId);
  const applied=applyM1V120Source(initial,started.journal,proposed.request);
  assert.equal(applied.ok,true,JSON.stringify(applied).slice(0,500));
  assert.equal(applied.journal.revision,1);
  const reviewed=reviewM1V126DenseSourceHolds(initial,applied.journal);
  assert.equal(reviewed.ok,true,JSON.stringify(reviewed).slice(0,400));
  assert.equal(reviewed.sourceVerifiedVirtualFixtures,0);
  assert.equal(reviewed.modelledIncidentCount,0);
  const next=prepareM1V128ManualFictionalContinuation(
    initial,applied.journal);
  assert.equal(next?.ok,true,JSON.stringify(next).slice(0,400));
  assert.equal(JSON.stringify(initial),initialState);
});

test('v132 refuses fake bench participants, invalid clock and forged saved command',()=>{
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,
    7,'v132-negative');
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const selected=select(initial,started.journal);
  assert.ok(selected);
  const choice=selected.requested;
  for(const invalid of [
    {...choice,elapsedSeconds:299},{...choice,elapsedSeconds:5400},
    {...choice,elapsedSeconds:901},{...choice,inPlayerId:'missing-player'},
    {...choice,outPlayerId:choice.inPlayerId},
    {...choice,extra:true},
  ]){
    const rejected=prepareM1V132DenseManagerSubstitution(
      initial,started.journal,invalid);
    assert.equal(rejected?.ok,false,JSON.stringify(rejected).slice(0,300));
  }
  const applied=applyM1V120Source(initial,started.journal,
    selected.proposed.request);
  assert.equal(applied.ok,true);
  const corrupted=structuredClone(applied.journal);
  corrupted.entries[0].source.plannedCommands[0].commandId='fake-sub';
  assert.equal(reviewM1V126DenseSourceHolds(initial,corrupted).ok,false);
});

test('v132 preserves a prior genuine fictional injury/discipline hold',()=>{
  let selected=null;
  for(let seed=1;seed<=30;seed++){
    const initial=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v132-held-'+seed);
    const start=startM1V120Journal(initial);
    assert.equal(start.ok,true);
    const first=prepareM1V124DenseVirtualRefereeMatch(initial,start.journal);
    if(!first?.ok||first.incidents===0)continue;
    const applied=applyM1V120Source(initial,start.journal,first.request);
    if(!applied.ok)continue;
    const holds=reviewM1V126DenseSourceHolds(initial,applied.journal);
    if(!holds.ok||!holds.holds.some(h=>h.activeForNextFixture))continue;
    const next=select(initial,applied.journal);
    if(!next)continue;
    selected={initial,journal:applied.journal,holds,next};
    break;
  }
  assert.ok(selected,'A genuine held-player substitution continuation must exist');
  const {initial,journal,holds,next}=selected;
  const fixture=next.proposed.fixture;
  const own=fixture.homeClubId===initial.selectedClubId?
    next.proposed.request.prematch.homeLineup:
    next.proposed.request.prematch.awayLineup;
  for(const hold of holds.holds.filter(h=>h.activeForNextFixture)){
    assert.ok(!own.starters.includes(hold.playerId));
    assert.ok(!own.bench.includes(hold.playerId));
  }
  const accepted=applyM1V120Source(initial,journal,next.proposed.request);
  assert.equal(accepted.ok,true);
  const reviewed=reviewM1V126DenseSourceHolds(initial,accepted.journal);
  assert.equal(reviewed.ok,true,JSON.stringify(reviewed).slice(0,350));
  assert.equal(reviewed.sourceVerifiedVirtualFixtures,1);
});
