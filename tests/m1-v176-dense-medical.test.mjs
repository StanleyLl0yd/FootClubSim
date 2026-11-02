import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V176DenseMedicalMatch,
  regenerateM1V176MedicalSource,verifyM1V176MedicalSourceClaim}
  from '../dist/core/m1-v176-dense-medical.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

let example;
function sourceVerifiedMedicalMatch(){
  if(example)return example;
  const catalog=createSyntheticRplScaleCatalog(2026);
  for(let seed=1;seed<=128;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v176-medical-'+seed);
    const started=startM1V120Journal(career);
    assert.equal(started.ok,true);
    const proposal=prepareM1V176DenseMedicalMatch(
      career,started.journal);
    if(!proposal?.ok||
        !proposal.request.checkpointMedical.some(
          a=>a.kind==='treatment-exit'))continue;
    const accepted=admitM1V171SourceWithHolds(
      career,started.journal,proposal.request);
    if(!accepted.ok)continue;
    example={career,started,proposal,accepted};
    return example;
  }
  assert.fail('No positive medical+referee source in 128 deterministic seeds');
}

test('v176 persists one generated referee and medical physical-XI source',()=>{
  const {career,started,proposal,accepted}=sourceVerifiedMedicalMatch();
  assert.equal(proposal.refereeAndMedicalAuthorityAuthenticated,false);
  assert.equal(proposal.clinicalClearanceAuthenticated,false);
  assert.ok(proposal.fictionalIncidentCount>0);
  assert.ok(proposal.generatedMedicalDepartureAndReturnCount>=2);
  assert.equal(proposal.generatedMedicalDepartureAndReturnCount,
    proposal.request.checkpointMedical.length);
  assert.equal(verifyM1V176MedicalSourceClaim(
    proposal.request.prematch,proposal.request.policy,
    proposal.request.plannedCommands,proposal.request.checkpointMedical,
    proposal.fixture.id,career.rngState),true);
  assert.equal(accepted.journal.revision,1);
  assert.equal(validateM1V120Journal(career,accepted.journal).ok,true);
  const holds=reviewM1V126DenseSourceHolds(career,accepted.journal);
  assert.equal(holds.ok,true,JSON.stringify(holds).slice(0,350));
  assert.equal(holds.sourceVerifiedVirtualFixtures,1);
  assert.equal(holds.modelledIncidentCount,proposal.fictionalIncidentCount);
  const events=proposal.request.result.events;
  for(const departure of proposal.request.checkpointMedical.filter(
    a=>a.kind==='treatment-exit')){
    const back=proposal.request.checkpointMedical.find(a=>
      a.kind==='treatment-return'&&a.playerId===departure.playerId&&
      a.teamId===departure.teamId);
    assert.ok(back);
    assert.equal(back.elapsedSeconds-departure.elapsedSeconds,300);
    assert.ok(events.filter(e=>e.type==='source'&&
      e.source.type==='shot'&&e.source.playerId===departure.playerId&&
      e.elapsedSeconds>=departure.elapsedSeconds&&
      e.elapsedSeconds<back.elapsedSeconds).length===0);
  }
  assert.equal(JSON.stringify(started.journal),
    JSON.stringify(startM1V120Journal(career).journal));
});

test('v176 rejects invented medical action, referee ID and stale CAS',()=>{
  const {career,started,proposal,accepted}=sourceVerifiedMedicalMatch();
  const request=proposal.request;
  const forgedMedical=structuredClone(request);
  forgedMedical.checkpointMedical[0].playerId='invented-patient';
  assert.deepEqual(applyM1V120Source(
    career,started.journal,forgedMedical),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const forgedReferee=structuredClone(request);
  forgedReferee.plannedCommands[0].id+='-invented';
  assert.deepEqual(applyM1V120Source(
    career,started.journal,forgedReferee),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const badResult=structuredClone(request);
  badResult.result.report.home.goals+=1;
  assert.deepEqual(applyM1V120Source(
    career,started.journal,badResult),
    {ok:false,error:'CLAIMED_RESULT_MISMATCH'});
  assert.deepEqual(admitM1V171SourceWithHolds(
    career,accepted.journal,request),
    {ok:false,error:'STALE_REVISION'});
  const corrupted=structuredClone(accepted.journal);
  corrupted.entries[0].source.checkpointMedical[0].playerId='ghost';
  assert.deepEqual(validateM1V120Journal(career,corrupted),
    {ok:false,error:'INVALID_JOURNAL'});
});

test('v176 refuses source-replayable changed tactics before native CAS',()=>{
  const {career,started,proposal}=sourceVerifiedMedicalMatch();
  const original=JSON.stringify(started.journal);
  let forged=null;
  for(const tempo of [49,51,48,52]){
    const prematch=structuredClone(proposal.request.prematch);
    if(prematch.homeTactics.tempo===tempo)continue;
    prematch.homeTactics.tempo=tempo;
    const generated=regenerateM1V176MedicalSource(
      prematch,proposal.request.policy);
    if(!generated.ok)continue;
    const candidate={...proposal.request,prematch,
      plannedCommands:generated.plannedCommands,
      checkpointMedical:generated.checkpointMedical,result:generated.result};
    const legacy=applyM1V120Source(career,started.journal,candidate);
    if(!legacy.ok)continue;
    assert.equal(reviewM1V126DenseSourceHolds(
      career,legacy.journal).ok,true);
    forged=candidate;
    break;
  }
  assert.ok(forged,'source-valid canonical-seed tactical tamper required');
  assert.deepEqual(admitM1V171SourceWithHolds(
    career,started.journal,forged),
    {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
  assert.equal(JSON.stringify(started.journal),original);
});
