import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal} from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V124DenseVirtualRefereeMatch,
  verifyM1V124DenseVirtualRefereeSource}
  from '../dist/core/m1-v124-dense-internal-referee.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V130ManualVirtualRefereeContinuation}
  from '../dist/core/m1-v130-manual-virtual-referee.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);
test('v130 can generate second exact-source virtual fixture after manual held-player-safe continuation',()=>{
  let selected=null;
  for(let seed=1;seed<=40;seed++){
    const initial=createInitialCareer(catalog,catalog.clubs[0].id,seed,
      'v130-repeated-virtual-'+seed);
    const started=startM1V120Journal(initial);
    assert.equal(started.ok,true);
    const first=prepareM1V124DenseVirtualRefereeMatch(initial,started.journal);
    if(!first?.ok||first.incidents===0)continue;
    const accepted=applyM1V120Source(initial,started.journal,first.request);
    if(!accepted.ok)continue;
    const manual=prepareM1V128ManualFictionalContinuation(
      initial,accepted.journal);
    if(!manual?.ok)continue;
    const advanced=applyM1V120Source(initial,accepted.journal,manual.request);
    if(!advanced.ok)continue;
    const nextVirtual=prepareM1V130ManualVirtualRefereeContinuation(
      initial,advanced.journal);
    if(!nextVirtual?.ok)continue;
    selected={initial,journal:advanced.journal,first};
    break;
  }
  assert.ok(selected,'At least one legal two-fixture recovered source must exist');
  const {initial,first}=selected;
  const original=JSON.stringify(initial);
  let {journal}=selected;
  assert.equal(journal.revision,2);
  const second=prepareM1V130ManualVirtualRefereeContinuation(initial,journal);
  assert.equal(second?.ok,true,JSON.stringify(second).slice(0,500));
  assert.equal(second.schemaVersion,130);
  assert.notEqual(second.fixture.id,first.fixtureId);
  assert.equal(second.request.commandId,
    'v124-virtual-referee-'+second.fixture.id);
  assert.equal(second.kdkSanctionsAuthenticated,false);
  assert.equal(second.clinicalClearanceAuthenticated,false);
  assert.equal(second.automaticCareerAdvancementAuthorized,false);
  const before=reviewM1V126DenseSourceHolds(initial,journal);
  assert.equal(before.ok,true);
  const own=second.fixture.homeClubId===initial.selectedClubId?
    second.request.prematch.homeLineup:second.request.prematch.awayLineup;
  for(const hold of before.holds.filter(h=>h.activeForNextFixture)){
    assert.ok(!own.starters.includes(hold.playerId));
    assert.ok(!own.bench.includes(hold.playerId));
  }
  const accepted=applyM1V120Source(initial,journal,second.request);
  assert.equal(accepted.ok,true,JSON.stringify(accepted).slice(0,450));
  journal=accepted.journal;
  assert.equal(journal.revision,3);
  assert.equal(validateM1V120Journal(initial,journal).ok,true);
  assert.equal(verifyM1V124DenseVirtualRefereeSource(
    initial,journal,second.fixture.id),true);
  assert.equal(reviewM1V126DenseSourceHolds(initial,journal).ok,true);
  assert.equal(JSON.stringify(initial),original);
});

test('v130 rejects forged prior virtual event source and altered match result',()=>{
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v130-fail-closed');
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const first=prepareM1V124DenseVirtualRefereeMatch(initial,started.journal);
  assert.equal(first?.ok,true);
  const accepted=applyM1V120Source(initial,started.journal,first.request);
  assert.equal(accepted.ok,true);
  if(first.incidents>0){
    const forged=structuredClone(accepted.journal);
    forged.entries[0].commandId='v122-ordinary-'+first.fixtureId;
    assert.deepEqual(prepareM1V130ManualVirtualRefereeContinuation(
      initial,forged),{ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
  }
  const damaged=structuredClone(accepted.journal);
  damaged.entries[0].result.report.home.goals++;
  assert.deepEqual(prepareM1V130ManualVirtualRefereeContinuation(
    initial,damaged),{ok:false,error:'INVALID_JOURNAL'});
});
