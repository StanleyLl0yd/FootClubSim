import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V122DenseOrdinaryMatch}
  from '../dist/core/m1-v122-dense-ordinary-season.js';
import {prepareM1V124DenseVirtualRefereeMatch}
  from '../dist/core/m1-v124-dense-internal-referee.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);
test('v126 accepts no fabricated sanctions from ordinary-only source',()=>{
  const career=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v126-dense-ordinary');
  const start=startM1V120Journal(career);
  assert.equal(start.ok,true);
  const first=prepareM1V122DenseOrdinaryMatch(career,start.journal);
  assert.equal(first.ok,true);
  const applied=applyM1V120Source(career,start.journal,first.request);
  assert.equal(applied.ok,true);
  const reviewed=reviewM1V126DenseSourceHolds(career,applied.journal);
  assert.equal(reviewed.ok,true);
  assert.equal(reviewed.holds.length,0);
  assert.equal(reviewed.modelledIncidentCount,0);
  assert.equal(reviewed.automaticCareerAdvancementAuthorized,false);
});
test('v126 source-verified virtual incidents and forged command namespace',()=>{
  let chosen=null;
  for(let seed=1;seed<=40;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,seed,
      'v126-source-'+seed);
    const start=startM1V120Journal(career);
    assert.equal(start.ok,true);
    const proposal=prepareM1V124DenseVirtualRefereeMatch(
      career,start.journal);
    if(proposal?.ok&&proposal.incidents>0){
      const applied=applyM1V120Source(career,start.journal,proposal.request);
      assert.equal(applied.ok,true);
      chosen={career,proposal,journal:applied.journal};
      break;
    }
  }
  assert.ok(chosen,'The fixed seed sweep must yield virtual events');
  const {career,proposal,journal}=chosen;
  const original=JSON.stringify(career);
  const reviewed=reviewM1V126DenseSourceHolds(career,journal);
  assert.equal(reviewed.ok,true);
  assert.equal(reviewed.sourceVerifiedVirtualFixtures,1);
  assert.equal(reviewed.modelledIncidentCount,proposal.incidents);
  assert.equal(reviewed.kdkSanctionsAuthenticated,false);
  assert.equal(reviewed.clinicalClearanceAuthenticated,false);
  assert.equal(reviewed.automaticCareerAdvancementAuthorized,false);
  assert.equal(reviewed.holds.every(h=>
    h.kind!=='fictional-injury'||
      h.modelledMissedCompleteClubFixtures>=1&&
      h.modelledMissedCompleteClubFixtures<=4),true);
  const renamed=structuredClone(journal);
  renamed.entries[0].commandId='v122-ordinary-'+proposal.fixtureId;
  assert.equal(validateM1V120Journal(career,renamed).ok,true);
  assert.deepEqual(reviewM1V126DenseSourceHolds(career,renamed),
    {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
  const corrupt=structuredClone(journal);
  corrupt.entries[0].source.plannedCommands[0].origin='forged';
  assert.deepEqual(reviewM1V126DenseSourceHolds(career,corrupt),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.equal(JSON.stringify(career),original);
});

test('v126 rejects replay-valid future XI/bench that bypasses a source-verified hold',()=>{
  let exercised=false;
  for(let seed=1;seed<=40;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,seed,
      'v126-historical-hold-'+seed);
    const started=startM1V120Journal(career);
    assert.equal(started.ok,true);
    const firstOrdinary=prepareM1V122DenseOrdinaryMatch(
      career,started.journal);
    assert.equal(firstOrdinary?.ok,true);
    const ordinaryFirst=applyM1V120Source(
      career,started.journal,firstOrdinary.request);
    assert.equal(ordinaryFirst.ok,true);
    const nextOrdinary=prepareM1V122DenseOrdinaryMatch(
      career,ordinaryFirst.journal);
    assert.equal(nextOrdinary?.ok,true);
    const firstVirtual=prepareM1V124DenseVirtualRefereeMatch(
      career,started.journal);
    if(!firstVirtual?.ok)continue;
    const virtualFirst=applyM1V120Source(
      career,started.journal,firstVirtual.request);
    if(!virtualFirst.ok)continue;
    const reviewed=reviewM1V126DenseSourceHolds(
      career,virtualFirst.journal);
    if(!reviewed.ok||!reviewed.holds.some(h=>h.activeForNextFixture))
      continue;
    const bypass=applyM1V120Source(
      career,virtualFirst.journal,nextOrdinary.request);
    assert.equal(bypass.ok,true);
    assert.equal(validateM1V120Journal(career,bypass.journal).ok,true);
    assert.deepEqual(reviewM1V126DenseSourceHolds(
      career,bypass.journal),{ok:false,error:'HISTORICAL_HOLD_BYPASS'});
    exercised=true;
    break;
  }
  assert.equal(exercised,true,
    'A bounded source-generated controlled-club hold must be exercised');
});
