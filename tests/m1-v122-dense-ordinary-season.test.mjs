import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal} from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V122DenseOrdinaryMatch}
  from '../dist/core/m1-v122-dense-ordinary-season.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const career=createInitialCareer(catalog,catalog.clubs[0].id,42,
  'v122-dense-ordinary-season');
test('v122 sequential original-calendar dense matches replay with immutable M0 and v8 untouched',()=>{
  const original=JSON.stringify(career);
  const started=startM1V120Journal(career);
  assert.equal(started.ok,true);
  let journal=started.journal,seen=new Set();
  for(let i=0;i<4;i++){
    const proposal=prepareM1V122DenseOrdinaryMatch(career,journal);
    assert.equal(proposal?.ok,true,JSON.stringify(proposal).slice(0,450));
    assert.equal(proposal.request.result.rngDraws,270);
    assert.ok(!seen.has(proposal.fixture.id));
    seen.add(proposal.fixture.id);
    const next=applyM1V120Source(career,journal,proposal.request);
    assert.equal(next.ok,true,JSON.stringify(next).slice(0,400));
    journal=next.journal;
    assert.equal(journal.revision,i+1);
    assert.equal(validateM1V120Journal(career,journal).ok,true);
    assert.equal(JSON.stringify(career),original);
  }
  assert.equal(seen.size,4);
  assert.equal(journal.entries.every(item=>
    item.source.plannedCommands.length===0&&
    item.source.intraphaseMedical.length===0),true);
});
test('v122 mutated journal cannot permit another fixture',()=>{
  const start=startM1V120Journal(career);
  const one=prepareM1V122DenseOrdinaryMatch(career,start.journal);
  assert.equal(one.ok,true);
  const accepted=applyM1V120Source(career,start.journal,one.request);
  assert.equal(accepted.ok,true);
  const corrupt=structuredClone(accepted.journal);
  corrupt.entries[0].result.report.home.goals+=1;
  assert.deepEqual(prepareM1V122DenseOrdinaryMatch(career,corrupt),
    {ok:false,error:'INVALID_JOURNAL'});
});
