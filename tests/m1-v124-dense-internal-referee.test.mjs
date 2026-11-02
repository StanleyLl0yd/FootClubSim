import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal} from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V122DenseOrdinaryMatch}
  from '../dist/core/m1-v122-dense-ordinary-season.js';
import {simulateM1V105SpecialGoalChronology}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {verifyM1V124GeneratedSourceClaim}
  from '../dist/core/m1-v124-generated-source.js';
import {prepareM1V124DenseVirtualRefereeMatch,
  verifyM1V124DenseVirtualRefereeSource}
  from '../dist/core/m1-v124-dense-internal-referee.js';

test('v124 source-regenerated virtual cards/withdrawals persist in dense replay but cannot silently expire',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  const club=catalog.clubs[0].id;
  let chosen=null;
  for(let seed=1;seed<=40;seed++){
    const career=createInitialCareer(catalog,club,seed,
      'm1-v124-virtual-referee-'+seed);
    const started=startM1V120Journal(career);
    assert.equal(started.ok,true);
    const proposed=prepareM1V124DenseVirtualRefereeMatch(
      career,started.journal);
    if(proposed?.ok && proposed.incidents>0){
      chosen={career,started,proposed};break;
    }
  }
  assert.ok(chosen,'A fixed 40-seed sweep must yield a valid modelled incident');
  const {career,started,proposed}=chosen;
  const unchanged=JSON.stringify(career);
  const admitted=applyM1V120Source(career,started.journal,
    proposed.request);
  assert.equal(admitted.ok,true,JSON.stringify(admitted).slice(0,450));
  assert.equal(admitted.journal.revision,1);
  assert.equal(validateM1V120Journal(career,admitted.journal).ok,true);
  assert.equal(verifyM1V124DenseVirtualRefereeSource(
    career,admitted.journal,proposed.fixtureId),true);
  assert.deepEqual(prepareM1V122DenseOrdinaryMatch(
    career,admitted.journal),
    {ok:false,error:'PREVIOUS_EXCEPTION_NOT_SUPPORTED'});
  const tampered=structuredClone(admitted.journal);
  tampered.entries[0].source.plannedCommands[0].origin='forged';
  assert.equal(verifyM1V124DenseVirtualRefereeSource(
    career,tampered,proposed.fixtureId),false);
  assert.equal(JSON.stringify(career),unchanged);
});
test('v124 validation denies unsupported historical state rather than clearing sanctions',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  const career=createInitialCareer(catalog,catalog.clubs[0].id,77,
    'm1-v124-ordinary-then-virtual');
  const started=startM1V120Journal(career);
  assert.equal(started.ok,true);
  const first=prepareM1V122DenseOrdinaryMatch(career,started.journal);
  assert.equal(first.ok,true);
  const written=applyM1V120Source(career,started.journal,first.request);
  assert.equal(written.ok,true);
  assert.equal(verifyM1V124DenseVirtualRefereeSource(
    career,written.journal,first.fixture.id),false);
  const second=prepareM1V124DenseVirtualRefereeMatch(career,written.journal);
  assert.equal(second?.ok,true,JSON.stringify(second).slice(0,450));
  assert.equal(second.fixtureId!==first.fixture.id,true);
  const commit=applyM1V120Source(career,written.journal,second.request);
  assert.equal(commit.ok,true);
  assert.equal(verifyM1V124DenseVirtualRefereeSource(
    career,commit.journal,second.fixtureId),true);
});

test('v124 journal refuses independently replayable but noncanonical referee seed',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  let exercised=false;
  for(let seed=1;seed<=40&&!exercised;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,seed,
      'm1-v124-canonical-source-'+seed);
    const started=startM1V120Journal(career);
    assert.equal(started.ok,true);
    const proposal=prepareM1V124DenseVirtualRefereeMatch(
      career,started.journal);
    if(!proposal?.ok||proposal.incidents===0)continue;
    const forged=structuredClone(proposal.request);
    forged.prematch.rngSeed=
      (forged.prematch.rngSeed^0x9e3779b9)>>>0||1;
    const alternate=simulateM1V105SpecialGoalChronology(
      forged.prematch,forged.policy,forged.plannedCommands,[],[],[]);
    if(!alternate.ok)continue;
    forged.result=alternate;
    assert.equal(verifyM1V124GeneratedSourceClaim(
      forged.prematch,forged.policy,forged.plannedCommands,
      proposal.fixtureId,career.rngState),false);
    assert.deepEqual(applyM1V120Source(
      career,started.journal,forged),
      {ok:false,error:'SOURCE_REPLAY_REJECTED'});
    const original=applyM1V120Source(
      career,started.journal,proposal.request);
    assert.equal(original.ok,true);
    const tampered=structuredClone(original.journal);
    tampered.entries[0].source.prematch.rngSeed=
      forged.prematch.rngSeed;
    tampered.entries[0].result=alternate;
    assert.deepEqual(validateM1V120Journal(career,tampered),
      {ok:false,error:'INVALID_JOURNAL'});
    exercised=true;
  }
  assert.equal(exercised,true,
    'A replayable noncanonical source must be rejected at write and read');
});
