import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V124DenseVirtualRefereeMatch}
  from '../dist/core/m1-v124-dense-internal-referee.js';
import {prepareM1V166CombinedMatch}
  from '../dist/core/m1-v166-combined-playable.js';
import {verifyM1V166CombinedSourceClaim}
  from '../dist/core/m1-v166-combined-source.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);

test('automatic zero-substitution and manual-capable v166 use one referee chronology',()=>{
  const initial=createInitialCareer(
    catalog,catalog.clubs[0].id,17,'v168-unified-auto');
  const start=startM1V120Journal(initial);
  assert.equal(start.ok,true);
  const legacy=prepareM1V124DenseVirtualRefereeMatch(
    initial,start.journal);
  const unified=prepareM1V166CombinedMatch(
    initial,start.journal,[]);
  assert.equal(legacy?.ok,true,JSON.stringify(legacy).slice(0,250));
  assert.equal(unified?.ok,true,JSON.stringify(unified).slice(0,250));
  assert.equal(unified.status,
    'REPLAY_VERIFIED_FICTIONAL_REFEREE_AUTOMATIC');
  assert.deepEqual(unified.request.plannedCommands,
    legacy.request.plannedCommands);
  assert.deepEqual(unified.request.result,legacy.request.result);
  assert.equal(verifyM1V166CombinedSourceClaim(
    unified.request.prematch,unified.request.policy,
    unified.request.plannedCommands,unified.fixture.id,
    initial.selectedClubId,initial.rngState),true);
  const commit=applyM1V120Source(
    initial,start.journal,unified.request);
  assert.equal(commit.ok,true,JSON.stringify(commit).slice(0,250));
  assert.equal(validateM1V120Journal(initial,commit.journal).ok,true);
  const holds=reviewM1V126DenseSourceHolds(initial,commit.journal);
  assert.equal(holds.ok,true,JSON.stringify(holds).slice(0,250));
  assert.equal(holds.sourceVerifiedVirtualFixtures,1);
  const forged=structuredClone(unified.request);
  forged.prematch.rngSeed^=1234567;
  assert.deepEqual(applyM1V120Source(initial,start.journal,forged),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const truncated=structuredClone(unified.request);
  truncated.plannedCommands.pop();
  assert.equal(verifyM1V166CombinedSourceClaim(
    truncated.prematch,truncated.policy,truncated.plannedCommands,
    unified.fixture.id,initial.selectedClubId,initial.rngState),
    truncated.plannedCommands.length===unified.request.plannedCommands.length);
});

test('missing or malformed choices cannot silently select automatic mode',()=>{
  const initial=createInitialCareer(
    catalog,catalog.clubs[0].id,18,'v168-no-silent-auto');
  const start=startM1V120Journal(initial);
  assert.equal(start.ok,true);
  for(const invalid of [undefined,null,'auto',{}]){
    const proposed=prepareM1V166CombinedMatch(initial,start.journal,invalid);
    assert.notEqual(proposed?.ok,true);
  }
});
