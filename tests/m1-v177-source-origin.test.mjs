import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';
import {prepareM1V124DenseVirtualRefereeMatch}
  from '../dist/core/m1-v124-dense-internal-referee.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V130ManualVirtualRefereeContinuation}
  from '../dist/core/m1-v130-manual-virtual-referee.js';
import {prepareM1V132DenseManagerSubstitution}
  from '../dist/core/m1-v132-dense-manager-substitution.js';
import {prepareM1V166CombinedMatch}
  from '../dist/core/m1-v166-combined-playable.js';
import {simulateM1V19InternalReferee}
  from '../dist/core/m1-v19-internal-foul-injury.js';
import {buildM1V124GeneratedCommands}
  from '../dist/core/m1-v124-generated-source.js';
import {orderM1V166CombinedCommands}
  from '../dist/core/m1-v166-combined-source.js';
import {simulateM1V105SpecialGoalChronology}
  from '../dist/core/m1-v105-special-goal-chronology.js';

const catalog=createSyntheticRplScaleCatalog(2026);
function trySourceOriginForgery(initial,journal,request,kind){
  if(!request||!admitM1V171SourceWithHolds(initial,journal,request).ok)
    return null;
  const unchanged=JSON.stringify(journal);
  const forged=structuredClone(request);
  forged.prematch.homeTactics.tempo=
    forged.prematch.homeTactics.tempo===51?52:51;
  if(kind==='v124'||kind==='v166'){
    const referee=simulateM1V19InternalReferee(
      forged.prematch,forged.policy);
    if(!referee.ok)return null;
    const generated=buildM1V124GeneratedCommands(
      referee.generatedIncidents,forged.prematch.fixture.id);
    const manager=request.plannedCommands.filter(
      command=>command.kind==='substitute-normal');
    forged.plannedCommands=kind==='v124'?generated:
      orderM1V166CombinedCommands(generated,manager);
  }
  const result=simulateM1V105SpecialGoalChronology(
    forged.prematch,forged.policy,forged.plannedCommands,[],[],[]);
  if(!result.ok)return null;
  forged.result=result;
  const legacy=applyM1V120Source(initial,journal,forged);
  if(!legacy.ok)return null;
  if(!reviewM1V126DenseSourceHolds(initial,legacy.journal).ok)return null;
  assert.deepEqual(admitM1V171SourceWithHolds(initial,journal,forged),
    {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
  assert.equal(JSON.stringify(journal),unchanged);
  return legacy.journal;
}

test('v177 rejects v124/v166 source-replayable altered prematch',()=>{
  const found={v124:false,v166:false};
  for(let seed=1;seed<=24&&(!found.v124||!found.v166);seed++){
    const initial=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v177-referee-'+seed);
    const started=startM1V120Journal(initial);
    assert.equal(started.ok,true);
    if(!found.v124){
      const p=prepareM1V124DenseVirtualRefereeMatch(
        initial,started.journal);
      if(p?.ok)found.v124=!!trySourceOriginForgery(
        initial,started.journal,p.request,'v124');
    }
    if(!found.v166){
      const p=prepareM1V166CombinedMatch(initial,started.journal,[]);
      if(p?.ok)found.v166=!!trySourceOriginForgery(
        initial,started.journal,p.request,'v166');
    }
  }
  assert.deepEqual(found,{v124:true,v166:true});
});

test('v177 retains legal manager choices but rejects tactical forgery and inherited history',()=>{
  let manager=false,combined=false,historical=false;
  for(let seed=1;seed<=40&&(!manager||!combined||!historical);seed++){
    const initial=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v177-manager-'+seed);
    const started=startM1V120Journal(initial);
    assert.equal(started.ok,true);
    const base=prepareM1V128ManualFictionalContinuation(
      initial,started.journal);
    if(!base?.ok)continue;
    const own=base.fixture.homeClubId===initial.selectedClubId?
      base.request.prematch.homeLineup:base.request.prematch.awayLineup;
    const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
    const out=own.starters.find(p=>
      players.get(p)?.primaryPosition!=='GK');
    const incoming=own.bench.find(p=>
      players.get(p)?.primaryPosition!=='GK');
    if(!out||!incoming)continue;
    const choice={outPlayerId:out,inPlayerId:incoming,
      elapsedSeconds:2700};
    if(!manager||!historical){
      const p=prepareM1V132DenseManagerSubstitution(
        initial,started.journal,choice);
      if(p?.ok){
        const old=trySourceOriginForgery(
          initial,started.journal,p.request,'manager');
        if(old){
          manager=true;
          if(!historical){
            const next=prepareM1V128ManualFictionalContinuation(
              initial,old);
            if(next?.ok&&applyM1V120Source(
              initial,old,next.request).ok&&
              reviewM1V126DenseSourceHolds(
                initial,applyM1V120Source(
                  initial,old,next.request).journal).ok){
              assert.deepEqual(admitM1V171SourceWithHolds(
                initial,old,next.request),
                {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
              historical=true;
            }
          }
        }
      }
    }
    if(!combined){
      const p=prepareM1V166CombinedMatch(
        initial,started.journal,[choice]);
      if(p?.ok)combined=!!trySourceOriginForgery(
        initial,started.journal,p.request,'v166');
    }
  }
  assert.equal(manager,true,'ordinary manager source was not exercised');
  assert.equal(combined,true,'combined manager source was not exercised');
  assert.equal(historical,true,
    'older forged manager source was not rejected on a later write');
});

test('v177 preserves hold-aware v130 generated referee under v124 namespace',()=>{
  let found=false;
  for(let seed=1;seed<=40&&!found;seed++){
    const initial=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v177-hold-aware-v130-'+seed);
    const started=startM1V120Journal(initial);
    assert.equal(started.ok,true);
    const first=prepareM1V124DenseVirtualRefereeMatch(
      initial,started.journal);
    if(!first?.ok||first.incidents===0)continue;
    const one=admitM1V171SourceWithHolds(
      initial,started.journal,first.request);
    if(!one.ok)continue;
    const manual=prepareM1V128ManualFictionalContinuation(
      initial,one.journal);
    if(!manual?.ok)continue;
    const two=admitM1V171SourceWithHolds(
      initial,one.journal,manual.request);
    if(!two.ok)continue;
    const repeated=prepareM1V130ManualVirtualRefereeContinuation(
      initial,two.journal);
    if(!repeated?.ok)continue;
    assert.equal(repeated.request.commandId,
      'v124-virtual-referee-'+repeated.fixture.id);
    assert.ok(trySourceOriginForgery(
      initial,two.journal,repeated.request,'v124'));
    found=true;
  }
  assert.equal(found,true,
    'The source-authenticated v130 hold-aware continuation must remain legal');
});
