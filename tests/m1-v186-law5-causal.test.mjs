import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V184CausalMatch}
  from '../dist/core/m1-v182-unified-playable.js';
import {regenerateM1V184CausalSource}
  from '../dist/core/m1-v182-unified-source.js';
import {simulateM1V29CausalMedicalSource}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {deriveM1V186Law5FromCausalSource}
  from '../dist/core/m1-v186-law5-causal.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);
function findBoth(){
  let onField=null,offField=null;
  for(let seed=1;seed<=64&&(onField===null||offField===null);seed++){
    const initial=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'m1-v186-law5-'+seed);
    const started=startM1V120Journal(initial);
    assert.equal(started.ok,true);
    const source=prepareM1V184CausalMatch(initial,started.journal);
    if(!source?.ok||source.law5SourceBoundEvidence.length===0)continue;
    const causal=simulateM1V29CausalMedicalSource(
      source.request.prematch,source.request.policy,[],[]);
    assert.equal(causal.ok,true);
    const verified=deriveM1V186Law5FromCausalSource(
      causal,source.request.result);
    assert.equal(verified.ok,true,verified.ok?'':verified.error);
    assert.deepEqual(verified.evidence,source.law5SourceBoundEvidence);
    const accepted=admitM1V171SourceWithHolds(
      initial,started.journal,source.request);
    assert.equal(accepted.ok,true,accepted.ok?'':accepted.error);
    assert.equal(validateM1V120Journal(
      initial,accepted.journal).ok,true);
    const sample={initial,started,source,causal,verified,accepted};
    if(!onField&&verified.evidence.some(e=>
      e.modelledDisposition==='may-remain-after-assessment'))onField=sample;
    if(!offField&&verified.evidence.some(e=>
      e.modelledDisposition==='voluntary-extended-off-field-assessment'))
      offField=sample;
  }
  assert.ok(onField,'No sanctioned physical offence with on-field treatment');
  assert.ok(offField,'No source-verified 300s off-field assessment');
  return {onField,offField};
}
let chosen;
test('Law5 2026/27: carded physical foul permits an on-field victim',()=>{
  chosen=findBoth();
  for(const sample of [chosen.onField,chosen.offField]){
    const {verified}=sample;
    assert.equal(verified.physicalOffenceExceptionSourceVerified,true);
    assert.equal(verified.refereeAuthorityAuthenticated,false);
    assert.equal(verified.externalMedicalAuthorityAuthenticated,false);
    assert.equal(verified.otherLaw5ExceptionsSupported,false);
    for(const e of verified.evidence){
      assert.equal(e.exception,'opponent-carded-physical-offence');
      assert.notEqual(e.offenderTeamId,e.patientTeamId);
      assert.equal(e.minimumRunningSecondsSatisfied,true);
    }
  }
  const staying=chosen.onField.verified.evidence.find(e=>
    e.modelledDisposition==='may-remain-after-assessment');
  assert.equal(staying.exitEventId,null);
  assert.equal(staying.returnEventId,null);
});

test('Law5 2026/27: voluntary off-field assessment has lawful source return',()=>{
  const {verified}=chosen.offField;
  const entry=verified.evidence.find(e=>
    e.modelledDisposition==='voluntary-extended-off-field-assessment');
  assert.ok(entry.exitEventId);
  assert.ok(entry.returnEventId);
  assert.equal(entry.minimumRunningSecondsSatisfied,true);
});

test('Law5 source rejects forged victim, missing return and fake referee permission',()=>{
  const {causal,source}=chosen.offField;
  const injured=causal.causalAssessments.find(a=>
    a.transition==='off-field-return');
  assert.ok(injured);
  const first=structuredClone(causal);
  const entry=first.syntheticTreatmentActions.find(a=>
    a.kind==='treatment-return'&&a.playerId===injured.patientPlayerId);
  assert.ok(entry);
  entry.refereeSignalId='externally-authorized-without-evidence';
  assert.equal(deriveM1V186Law5FromCausalSource(
    first,source.request.result).ok,false);
  const second=structuredClone(causal);
  const changed=second.causalAssessments.find(a=>
    a.incidentId===injured.incidentId);
  changed.patientTeamId=second.generatedIncidents.find(i=>
    i.id===changed.incidentId).teamId;
  assert.equal(deriveM1V186Law5FromCausalSource(
    second,source.request.result).ok,false);
  const third=structuredClone(causal);
  third.syntheticTreatmentActions=third.syntheticTreatmentActions.filter(a=>
    a.id!==entry.id);
  assert.equal(deriveM1V186Law5FromCausalSource(
    third,source.request.result).ok,false);
  const fourth=structuredClone(source.request.result);
  fourth.events.find(e=>e.type==='source'&&
    e.source.type==='physical-transition'&&
    e.source.source.type==='medical').source.source.action.id='forged-action';
  assert.equal(deriveM1V186Law5FromCausalSource(
    causal,fourth).ok,false);
});

test('Law5 source rejects externally claimed unsupported exceptions',()=>{
  const {causal,source}=chosen.onField;
  const forged=structuredClone(causal);
  forged.causalAssessments[0].transition='keeper-injury';
  assert.equal(deriveM1V186Law5FromCausalSource(
    forged,source.request.result).ok,false);
  const plain=regenerateM1V184CausalSource(
    source.request.prematch,source.request.policy,[]);
  assert.equal(plain.ok,true);
  assert.ok(Array.isArray(plain.law5Evidence));
  assert.deepEqual(plain.law5Evidence,source.law5SourceBoundEvidence);
});
