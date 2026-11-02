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
