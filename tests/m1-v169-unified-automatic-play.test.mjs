import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V166CombinedMatch}
  from '../dist/core/m1-v166-combined-playable.js';
import {verifyM1V166CombinedSourceClaim}
  from '../dist/core/m1-v166-combined-source.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);

test('v169 unified automatic next fixture excludes previously held players',()=>{
  let sample=null;
  for(let seed=1;seed<=40;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v169-unified-'+seed);
    const start=startM1V120Journal(career);
    assert.equal(start.ok,true);
    const first=prepareM1V166CombinedMatch(career,start.journal,[]);
    if(!first?.ok||first.fictionalIncidentCount===0)continue;
    const applied=applyM1V120Source(career,start.journal,first.request);
    if(!applied.ok)continue;
    const review=reviewM1V126DenseSourceHolds(career,applied.journal);
    if(!review.ok)continue;
    const held=review.holds.filter(h=>h.activeForNextFixture);
    if(!held.length)continue;
    const next=prepareM1V166CombinedMatch(career,applied.journal,[]);
    if(!next?.ok)continue;
    sample={career,journal:applied.journal,held,next};
    break;
  }
  assert.ok(sample,'A fixed synthetic seed must yield a legal held-player continuation');
  const {career,journal,held,next}=sample;
  const original=JSON.stringify(career);
  assert.equal(next.status,'REPLAY_VERIFIED_FICTIONAL_REFEREE_AUTOMATIC');
  const own=next.fixture.homeClubId===career.selectedClubId?
    next.request.prematch.homeLineup:next.request.prematch.awayLineup;
  for(const hold of held){
    assert.ok(!own.starters.includes(hold.playerId));
    assert.ok(!own.bench.includes(hold.playerId));
  }
  assert.equal(verifyM1V166CombinedSourceClaim(
    next.request.prematch,next.request.policy,
    next.request.plannedCommands,next.fixture.id,
    career.selectedClubId,career.rngState),true);
  const accepted=applyM1V120Source(career,journal,next.request);
  assert.equal(accepted.ok,true,JSON.stringify(accepted).slice(0,400));
  assert.equal(validateM1V120Journal(career,accepted.journal).ok,true);
  assert.equal(reviewM1V126DenseSourceHolds(career,accepted.journal).ok,true);
  const forged=structuredClone(next.request);
  const altered=next.fixture.homeClubId===career.selectedClubId?
    forged.prematch.homeLineup:forged.prematch.awayLineup;
  altered.starters[0]=held[0].playerId;
  assert.deepEqual(applyM1V120Source(career,journal,forged),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  assert.equal(JSON.stringify(career),original);
});
