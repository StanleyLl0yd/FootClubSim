import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V122DenseOrdinaryMatch}
  from '../dist/core/m1-v122-dense-ordinary-season.js';
import {simulateM1V105SpecialGoalChronology}
  from '../dist/core/m1-v105-special-goal-chronology.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const initial=createInitialCareer(catalog,catalog.clubs[0].id,47,
  'm1-v164-ordinary-source');

test('v122 ordinary source uses career seed at write and historical replay',()=>{
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const proposal=prepareM1V122DenseOrdinaryMatch(initial,started.journal);
  assert.equal(proposal?.ok,true);
  const original=applyM1V120Source(initial,started.journal,
    proposal.request);
  assert.equal(original.ok,true);
  assert.equal(validateM1V120Journal(initial,original.journal).ok,true);
  const forged=structuredClone(proposal.request);
  forged.prematch.rngSeed=(forged.prematch.rngSeed^0x9e3779b9)>>>0;
  const alternate=simulateM1V105SpecialGoalChronology(
    forged.prematch,forged.policy,forged.plannedCommands,
    forged.checkpointMedical,forged.intraphaseMedical,
    forged.trustedDecisions);
  assert.equal(alternate.ok,true);
  forged.result=alternate;
  assert.deepEqual(applyM1V120Source(initial,started.journal,forged),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const historical=structuredClone(original.journal);
  historical.entries[0].source.prematch.rngSeed=
    forged.prematch.rngSeed;
  historical.entries[0].result=alternate;
  assert.deepEqual(validateM1V120Journal(initial,historical),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.equal(started.journal.revision,0);
  assert.equal(original.journal.revision,1);
});

test('v122 ordinary namespace refuses a substituted command and wrong id',()=>{
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const proposal=prepareM1V122DenseOrdinaryMatch(initial,started.journal);
  assert.equal(proposal?.ok,true);
  const forged={...proposal.request,
    commandId:'v122-ordinary-forged-fixture'};
  assert.deepEqual(applyM1V120Source(initial,started.journal,forged),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const withDecision={...proposal.request,
    trustedDecisions:[{schemaVersion:1,id:'forged'}]};
  assert.deepEqual(applyM1V120Source(initial,started.journal,
    withDecision),{ok:false,error:'SOURCE_REPLAY_REJECTED'});
});
