import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V166CombinedMatch}
  from '../dist/core/m1-v166-combined-playable.js';
import {buildM1V122NextOrdinaryFromVerified}
  from '../dist/core/m1-v122-dense-ordinary-season.js';
import {simulateM1V19InternalReferee}
  from '../dist/core/m1-v19-internal-foul-injury.js';
import {buildM1V124GeneratedCommands}
  from '../dist/core/m1-v124-generated-source.js';
import {simulateM1V105SpecialGoalChronology}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';

test('v171 denies source-valid historical hold bypass before write',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  let sample=null;
  for(let seed=1;seed<=40;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v171-hold-cas-'+seed);
    const start=startM1V120Journal(career);
    assert.equal(start.ok,true);
    const first=prepareM1V166CombinedMatch(career,start.journal,[]);
    if(!first?.ok||!first.fictionalIncidentCount)continue;
    const committed=applyM1V120Source(career,start.journal,first.request);
    if(!committed.ok)continue;
    const before=committed.journal;
    const review=reviewM1V126DenseSourceHolds(career,before);
    if(!review.ok)continue;
    const holds=review.holds.filter(h=>h.activeForNextFixture);
    if(!holds.length)continue;
    const bare=buildM1V122NextOrdinaryFromVerified(
      career,before,new Set());
    if(!bare?.ok)continue;
    const own=bare.fixture.homeClubId===career.selectedClubId?
      bare.request.prematch.homeLineup:bare.request.prematch.awayLineup;
    if(!holds.some(h=>own.starters.includes(h.playerId)||
      own.bench.includes(h.playerId)))continue;
    const generated=simulateM1V19InternalReferee(
      bare.request.prematch,bare.request.policy);
    if(!generated.ok)continue;
    const commands=buildM1V124GeneratedCommands(
      generated.generatedIncidents,bare.fixture.id);
    const result=simulateM1V105SpecialGoalChronology(
      bare.request.prematch,bare.request.policy,commands,[],[],[]);
    if(!result.ok)continue;
    const attack={...bare.request,
      commandId:'v166-combined-'+bare.fixture.id,
      plannedCommands:commands,result};
    const oldGate=applyM1V120Source(career,before,attack);
    if(!oldGate.ok)continue;
    const afterReview=reviewM1V126DenseSourceHolds(
      career,oldGate.journal);
    if(afterReview.ok||
       afterReview.error!=='HISTORICAL_HOLD_BYPASS')continue;
    sample={career,before,attack};
    break;
  }
  assert.ok(sample,'A reproducible source-valid held-player bypass is required');
  const {career,before,attack}=sample;
  const original=JSON.stringify(before);
  assert.deepEqual(admitM1V171SourceWithHolds(career,before,attack),
    {ok:false,error:'HISTORICAL_HOLD_BYPASS'});
  assert.equal(JSON.stringify(before),original);
  const legal=prepareM1V166CombinedMatch(career,before,[]);
  assert.equal(legal?.ok,true,JSON.stringify(legal).slice(0,300));
  const accepted=admitM1V171SourceWithHolds(
    career,before,legal.request);
  assert.equal(accepted.ok,true,JSON.stringify(accepted).slice(0,350));
  assert.equal(accepted.journal.revision,before.revision+1);
  assert.equal(JSON.stringify(before),original);
});
test('v171 refuses unidentified source and impersonated canonical-seed claims',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  const career=createInitialCareer(catalog,catalog.clubs[0].id,
    42,'v174-uncertified-source');
  const started=startM1V120Journal(career);
  assert.equal(started.ok,true);
  const base=buildM1V122NextOrdinaryFromVerified(
    career,started.journal,new Set());
  assert.equal(base?.ok,true);
  const pristine=JSON.stringify(started.journal);

  // Existing v120 replay accepts an unknown no-command namespace.
  // The old v126 hold projector skips it instead of certifying origin.
  const unknown={...base.request,
    commandId:'unverified-'+base.fixture.id};
  const oldAccepted=applyM1V120Source(
    career,started.journal,unknown);
  assert.equal(oldAccepted.ok,true);
  assert.equal(reviewM1V126DenseSourceHolds(
    career,oldAccepted.journal).ok,true);
  assert.deepEqual(admitM1V171SourceWithHolds(
    career,started.journal,unknown),
    {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});

  // A recognized legacy continuation command ID also cannot certify a
  // different caller-chosen fixture RNG seed and self-replayed score.
  const prematch={...base.request.prematch,rngSeed:
    base.request.prematch.rngSeed===1?2:1};
  const result=simulateM1V105SpecialGoalChronology(
    prematch,base.request.policy,[],[],[],[]);
  assert.equal(result.ok,true);
  const impersonated={...base.request,
    commandId:'v128-fictional-continuation-'+base.fixture.id,
    prematch,result};
  assert.equal(applyM1V120Source(
    career,started.journal,impersonated).ok,true);
  assert.deepEqual(admitM1V171SourceWithHolds(
    career,started.journal,impersonated),
    {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});

  const legal=admitM1V171SourceWithHolds(
    career,started.journal,base.request);
  assert.equal(legal.ok,true);
  const canonicalManual=admitM1V171SourceWithHolds(
    career,started.journal,{...base.request,
      commandId:'v128-fictional-continuation-'+base.fixture.id});
  assert.equal(canonicalManual.ok,true);

  // Backward-compatible v120 replay is read-only for uncertified history,
  // but it can never be silently promoted to an authoritative CAS write.
  const next=buildM1V122NextOrdinaryFromVerified(
    career,oldAccepted.journal,new Set());
  assert.equal(next?.ok,true);
  assert.deepEqual(admitM1V171SourceWithHolds(
    career,oldAccepted.journal,next.request),
    {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
  assert.equal(JSON.stringify(started.journal),pristine);
});
test('v175 denies changed tactics under valid v122/v128 source labels',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  const career=createInitialCareer(catalog,catalog.clubs[0].id,
    42,'v175-fake-generated-source');
  const started=startM1V120Journal(career);
  assert.equal(started.ok,true);
  const base=buildM1V122NextOrdinaryFromVerified(
    career,started.journal,new Set());
  assert.equal(base?.ok,true);
  const original=JSON.stringify(started.journal);
  for(const commandId of [
    'v122-ordinary-'+base.fixture.id,
    'v128-fictional-continuation-'+base.fixture.id,
  ]){
    const prematch=structuredClone(base.request.prematch);
    prematch.homeTactics.tempo=51;
    const result=simulateM1V105SpecialGoalChronology(
      prematch,base.request.policy,[],[],[],[]);
    assert.equal(result.ok,true);
    const forged={...base.request,commandId,prematch,result};
    // Previously, the full physical replay and canonical-seed checks were
    // satisfied but the request did not originate from either generator.
    assert.equal(applyM1V120Source(
      career,started.journal,forged).ok,true);
    assert.equal(reviewM1V126DenseSourceHolds(
      career,applyM1V120Source(
        career,started.journal,forged).journal).ok,true);
    assert.deepEqual(admitM1V171SourceWithHolds(
      career,started.journal,forged),
      {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
  }
  const ordinary=admitM1V171SourceWithHolds(
    career,started.journal,base.request);
  assert.equal(ordinary.ok,true);
  const manual=admitM1V171SourceWithHolds(
    career,started.journal,{...base.request,
      commandId:'v128-fictional-continuation-'+base.fixture.id});
  assert.equal(manual.ok,true);
  assert.equal(JSON.stringify(started.journal),original);
});
