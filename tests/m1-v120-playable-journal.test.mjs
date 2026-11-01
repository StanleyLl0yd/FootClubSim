import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { createInitialCareer } from '../dist/core/save.js';
import { startM1V8MatchJournal }
  from '../dist/core/m1-v8-result-journal.js';
import { prepareM1V113PlayableMatch }
  from '../dist/core/m1-v113-browser-playtest.js';
import { simulateM1V105SpecialGoalChronology }
  from '../dist/core/m1-v105-special-goal-chronology.js';
import { startM1V120Journal,applyM1V120Source,validateM1V120Journal }
  from '../dist/core/m1-v120-playable-journal.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const career=createInitialCareer(catalog,catalog.clubs[0].id,
  42,'v120-versioned-dense-journal');
function prepare(){
  const first=startM1V8MatchJournal(career);
  assert.equal(first.ok,true);
  const v8=prepareM1V113PlayableMatch(career,first.journal,'ordinary');
  assert.equal(v8?.ok,true);
  const prematch=v8.request.prematch,policy=v8.request.policy;
  const result=simulateM1V105SpecialGoalChronology(prematch,policy);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,400));
  const request={schemaVersion:120,commandId:'v120-first-fixture',
    careerId:career.careerId,expectedRevision:0,
    prematch,policy,plannedCommands:[],
    checkpointMedical:[],intraphaseMedical:[],trustedDecisions:[],result};
  return {v8,request};
}
test('v120 independently source-replays real 100-second physical match without rewriting v8',()=>{
  const unchanged=JSON.stringify(career);
  const started=startM1V120Journal(career);
  assert.equal(started.ok,true);
  const {v8,request}=prepare();
  assert.equal(request.result.rngDraws,270);
  assert.equal(request.result.report.home.goals >= 0,true);
  const accepted=applyM1V120Source(career,started.journal,request);
  assert.equal(accepted.ok,true,JSON.stringify(accepted).slice(0,450));
  assert.equal(accepted.journal.revision,1);
  assert.equal(accepted.journal.entries[0].fixtureId,v8.fixture.id);
  assert.equal(Object.hasOwn(accepted.journal.entries[0].source.prematch,'catalog'),false);
  const reviewed=validateM1V120Journal(career,accepted.journal);
  assert.equal(reviewed.ok,true);
  assert.deepEqual(reviewed.journal,accepted.journal);
  assert.equal(accepted.browserIndexedDbCasCommitted,false);
  assert.equal(accepted.calibratedRealismAccepted,false);
  assert.equal(JSON.stringify(career),unchanged);
});
test('v120 rejects forged outcomes, stale revisions, and wrong catalog',()=>{
  const start=startM1V120Journal(career);
  const {request}=prepare();
  const forged=structuredClone(request);
  forged.result.report.home.goals+=1;
  assert.deepEqual(applyM1V120Source(career,start.journal,forged),
    {ok:false,error:'CLAIMED_RESULT_MISMATCH'});
  const wrong=structuredClone(request);
  wrong.prematch.catalog.players[0].displayName='fake';
  assert.deepEqual(applyM1V120Source(career,start.journal,wrong),
    {ok:false,error:'UNTRUSTED_CATALOG'});
  const valid=applyM1V120Source(career,start.journal,request);
  assert.equal(valid.ok,true);
  assert.deepEqual(applyM1V120Source(career,valid.journal,request),
    {ok:false,error:'STALE_REVISION'});
  const altered=structuredClone(valid.journal);
  altered.entries[0].result.report.away.goals+=1;
  assert.deepEqual(validateM1V120Journal(career,altered),
    {ok:false,error:'INVALID_JOURNAL'});
});
