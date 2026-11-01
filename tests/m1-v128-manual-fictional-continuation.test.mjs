import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal} from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V122DenseOrdinaryMatch}
  from '../dist/core/m1-v122-dense-ordinary-season.js';
import {prepareM1V124DenseVirtualRefereeMatch}
  from '../dist/core/m1-v124-dense-internal-referee.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';

const catalog=createSyntheticRplScaleCatalog(2026);
test('v128 empty-history manual path preserves the v122 ordinary game source',()=>{
  const career=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v128-empty-source');
  const start=startM1V120Journal(career);
  assert.equal(start.ok,true);
  const ordinary=prepareM1V122DenseOrdinaryMatch(career,start.journal);
  const manual=prepareM1V128ManualFictionalContinuation(
    career,start.journal);
  assert.equal(ordinary?.ok,true);
  assert.equal(manual?.ok,true);
  assert.deepEqual(manual.request.prematch,ordinary.request.prematch);
  assert.deepEqual(manual.request.result,ordinary.request.result);
  assert.equal(manual.activeControlledClubHolds.length,0);
  assert.equal(manual.manualActionRequired,true);
  assert.equal(manual.clinicalReturnAuthenticated,false);
  assert.equal(manual.completeOpponentHistory,false);
});

test('v128 explicitly triggered source-verified simulated continuation never fields a held player',()=>{
  let selected=null;
  for(let seed=1;seed<=40;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v128-incident-'+seed);
    const start=startM1V120Journal(career);
    assert.equal(start.ok,true);
    const proposal=prepareM1V124DenseVirtualRefereeMatch(
      career,start.journal);
    if(!proposal?.ok||proposal.incidents===0)continue;
    const accepted=applyM1V120Source(career,start.journal,
      proposal.request);
    if(!accepted.ok)continue;
    const holds=reviewM1V126DenseSourceHolds(
      career,accepted.journal);
    if(!holds.ok||!holds.holds.some(h=>h.activeForNextFixture))continue;
    const candidate=prepareM1V128ManualFictionalContinuation(
      career,accepted.journal);
    if(candidate?.ok){selected={career,journal:accepted.journal};break;}
  }
  assert.ok(selected,'At least one fixed seed must have a legal held-player continuation');
  const {career}=selected;
  let {journal}=selected;
  const original=JSON.stringify(career);
  assert.deepEqual(prepareM1V122DenseOrdinaryMatch(career,journal),
    {ok:false,error:'PREVIOUS_EXCEPTION_NOT_SUPPORTED'});
  for(let step=0;step<4;step++){
    const review=reviewM1V126DenseSourceHolds(career,journal);
    assert.equal(review.ok,true);
    const active=review.holds.filter(h=>h.activeForNextFixture);
    const candidate=prepareM1V128ManualFictionalContinuation(
      career,journal);
    assert.equal(candidate?.ok,true,JSON.stringify(candidate).slice(0,500));
    const own=candidate.fixture.homeClubId===career.selectedClubId?
      candidate.request.prematch.homeLineup:
      candidate.request.prematch.awayLineup;
    for(const hold of active){
      assert.ok(!own.starters.includes(hold.playerId));
      assert.ok(!own.bench.includes(hold.playerId));
    }
    assert.equal(candidate.activeControlledClubHolds.length,active.length);
    const accepted=applyM1V120Source(career,journal,candidate.request);
    assert.equal(accepted.ok,true,JSON.stringify(accepted).slice(0,450));
    journal=accepted.journal;
    assert.equal(validateM1V120Journal(career,journal).ok,true);
    assert.equal(reviewM1V126DenseSourceHolds(career,journal).ok,true);
    assert.equal(JSON.stringify(career),original);
  }
});

test('v128 never treats a forged virtual namespace or damaged result as trusted',()=>{
  const career=createInitialCareer(catalog,catalog.clubs[0].id,17,
    'v128-forged-source');
  const started=startM1V120Journal(career);
  assert.equal(started.ok,true);
  const virtual=prepareM1V124DenseVirtualRefereeMatch(
    career,started.journal);
  assert.equal(virtual?.ok,true);
  const accepted=applyM1V120Source(career,started.journal,virtual.request);
  assert.equal(accepted.ok,true);
  if(virtual.incidents>0){
    const forged=structuredClone(accepted.journal);
    forged.entries[0].commandId='v122-ordinary-'+virtual.fixtureId;
    assert.deepEqual(prepareM1V128ManualFictionalContinuation(
      career,forged),{ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
  }
  const corrupt=structuredClone(accepted.journal);
  corrupt.entries[0].result.report.home.goals++;
  assert.deepEqual(prepareM1V128ManualFictionalContinuation(
    career,corrupt),{ok:false,error:'INVALID_JOURNAL'});
});
