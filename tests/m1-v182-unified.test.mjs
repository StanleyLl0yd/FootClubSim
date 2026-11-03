import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V182UnifiedMatch}
  from '../dist/core/m1-v182-unified-playable.js';
import {regenerateM1V182UnifiedSource,
  verifyM1V182UnifiedSourceClaim}
  from '../dist/core/m1-v182-unified-source.js';
import {simulateM1V23TemporaryTreatment}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {projectM1V179MatchClock}
  from '../dist/core/m1-v179-source-clock.js';

const catalog=createSyntheticRplScaleCatalog(2026);
function career(seed){
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,
    seed,'v182-unified-'+seed);
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  return {initial,journal:started.journal};
}
function candidate(seed,changes=[]){
  const {initial,journal}=career(seed);
  const proposed=prepareM1V182UnifiedMatch(initial,journal,changes);
  return {initial,journal,proposed};
}
function sourceSeed(){
  for(let seed=1;seed<=24;seed++){
    const value=candidate(seed);
    if(!value.proposed?.ok||
        value.proposed.modelledMedicalDepartures===0)continue;
    const accepted=admitM1V171SourceWithHolds(
      value.initial,value.journal,value.proposed.request);
    if(accepted.ok)return {...value,accepted,seed};
  }
  assert.fail('No replayable automatic unified source in 24 seeds');
}
let automatic;
test('v182 automatic referee and medical path shares v120 replay and v126 holds',()=>{
  automatic=sourceSeed();
  const {initial,journal,proposed,accepted}=automatic;
  assert.equal(proposed.automatic,true);
  assert.equal(proposed.refereeAndMedicalAuthorityAuthenticated,false);
  assert.equal(accepted.journal.revision,1);
  assert.equal(validateM1V120Journal(initial,accepted.journal).ok,true);
  const holds=reviewM1V126DenseSourceHolds(initial,accepted.journal);
  assert.equal(holds.ok,true,holds.ok?'':holds.error);
  assert.equal(holds.sourceVerifiedVirtualFixtures,1);
  assert.equal(holds.modelledIncidentCount,proposed.fictionalIncidentCount);
  const clock=projectM1V179MatchClock(
    proposed.request.prematch,proposed.request.result);
  assert.equal(clock.ok,true,clock.ok?'':clock.error);
  assert.ok(clock.snapshots.length>0);
  const directly=regenerateM1V182UnifiedSource(
    proposed.request.prematch,proposed.request.policy,[]);
  assert.equal(directly.ok,true);
  assert.deepEqual(directly.plannedCommands,proposed.request.plannedCommands);
  assert.deepEqual(directly.checkpointMedical,proposed.request.checkpointMedical);
  assert.equal(verifyM1V182UnifiedSourceClaim(
    proposed.request.prematch,proposed.request.policy,
    proposed.request.plannedCommands,proposed.request.checkpointMedical,
    proposed.fixture.id,initial.selectedClubId,initial.rngState),true);
  assert.equal(journal.revision,0);
});

test('v182 forged referee or treatment source and stale CAS fail closed',()=>{
  const {initial,journal,proposed,accepted}=automatic??sourceSeed();
  const forged=structuredClone(proposed.request);
  if(forged.checkpointMedical.length>0){
    forged.checkpointMedical[0].playerId='invented-patient';
  }else if(forged.plannedCommands.length>0){
    forged.plannedCommands[0].id='forged-referee';
  }else{
    forged.result.report.home.goals++;
  }
  assert.equal(admitM1V171SourceWithHolds(
    initial,journal,forged).ok,false);
  const stale=admitM1V171SourceWithHolds(
    initial,accepted.journal,proposed.request);
  assert.deepEqual(stale,{ok:false,error:'STALE_REVISION'});
  const altered=structuredClone(accepted.journal);
  if(altered.entries[0].source.plannedCommands.length){
    altered.entries[0].source.plannedCommands[0].id='forged';
  }else{
    altered.entries[0].result.report.home.goals++;
  }
  assert.equal(validateM1V120Journal(initial,altered).ok,false);
});

test('v182 accepts manager changes only from one causal physical source',()=>{
  let good=null;
  for(let seed=1;seed<=24&&!good;seed++){
    const {initial,journal}=career(seed);
    const base=prepareM1V128ManualFictionalContinuation(initial,journal);
    if(!base?.ok)continue;
    const p=base.request.prematch;
    const own=p.fixture.homeClubId===initial.selectedClubId?
      p.homeLineup:p.awayLineup;
    const players=new Map(catalog.players.map(x=>[x.id,x]));
    const outgoing=own.starters.filter(id=>
      players.get(id)?.primaryPosition!=='GK');
    const incoming=own.bench.filter(id=>
      players.get(id)?.primaryPosition!=='GK');
    const referee=simulateM1V23TemporaryTreatment(
      p,base.request.policy);
    if(!referee.ok)continue;
    const times=referee.generatedIncidents.filter(i=>
      i.sanction!=='injury-withdrawal').slice(-2).reverse()
      .map(x=>x.elapsedSeconds);
    for(const time of times){
      if(good)break;
      for(const outPlayerId of outgoing.slice(0,2)){
        if(good)break;
        for(const inPlayerId of incoming.slice(0,2)){
          const prepared=prepareM1V182UnifiedMatch(initial,journal,[{
            outPlayerId,inPlayerId,elapsedSeconds:time,
          }]);
          if(!prepared?.ok||
              prepared.modelledMedicalDepartures===0)continue;
          const accepted=admitM1V171SourceWithHolds(
            initial,journal,prepared.request);
          if(!accepted.ok)continue;
          good={initial,journal,prepared,accepted,time};
          break;
        }
      }
    }
  }
  assert.ok(good,'One legal physical manager/referee/medical source');
  const {initial,journal,prepared,accepted,time}=good;
  assert.notEqual(time,2700,'The in-play stop must be generated');
  assert.ok(prepared.modelledMedicalDepartures>0,
    'A generated in-play change must coexist with temporary treatment');
  assert.equal(accepted.journal.revision,1);
  assert.equal(verifyM1V182UnifiedSourceClaim(
    prepared.request.prematch,prepared.request.policy,
    prepared.request.plannedCommands,prepared.request.checkpointMedical,
    prepared.fixture.id,initial.selectedClubId,initial.rngState),true);
  const timeSub=prepared.request.plannedCommands.find(c=>
    c.kind==='substitute-normal');
  assert.equal(timeSub.elapsedSeconds,time);
  const treatment=prepared.request.checkpointMedical.filter(c=>
    c.kind==='treatment-exit');
  assert.ok(treatment.length>0);
  const events=prepared.request.result.events;
  for(const leave of treatment){
    const back=prepared.request.checkpointMedical.find(c=>
      c.kind==='treatment-return'&&c.playerId===leave.playerId&&
      c.teamId===leave.teamId);
    assert.ok(back);
    assert.equal(back.elapsedSeconds-leave.elapsedSeconds,300);
    assert.ok(!events.some(event=>event.type==='source'&&
      event.source.type==='shot'&&
      event.source.playerId===leave.playerId&&
      event.elapsedSeconds>=leave.elapsedSeconds&&
      event.elapsedSeconds<back.elapsedSeconds));
  }
  const bad=structuredClone(prepared.request);
  bad.plannedCommands=bad.plannedCommands.filter(c=>
    !(c.kind==='caution'&&c.elapsedSeconds===time));
  if(bad.plannedCommands.length!==prepared.request.plannedCommands.length)
    assert.equal(applyM1V120Source(initial,journal,bad).ok,false);
});
