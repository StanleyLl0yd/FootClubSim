import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V122DenseOrdinaryMatch}
  from '../dist/core/m1-v122-dense-ordinary-season.js';
import {prepareM1V124DenseVirtualRefereeMatch}
  from '../dist/core/m1-v124-dense-internal-referee.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);

test('v134 rejects virtual-referee identity spoofed with zero source events',()=>{
  let source=null;
  for(let seed=1;seed<=20;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,seed,
      'v134-referee-identity-'+seed);
    const started=startM1V120Journal(career);
    assert.equal(started.ok,true);
    const virtual=prepareM1V124DenseVirtualRefereeMatch(
      career,started.journal);
    if(virtual?.ok&&virtual.incidents>0){
      source={career,journal:started.journal,virtual};
      break;
    }
  }
  assert.ok(source,'Fixed seed cohort must generate a real fictional incident');
  const {career,journal,virtual}=source;
  const ordinary=prepareM1V122DenseOrdinaryMatch(career,journal);
  assert.equal(ordinary?.ok,true);
  const impersonation={...ordinary.request,
    commandId:'v124-virtual-referee-'+ordinary.fixture.id};
  const forged=applyM1V120Source(career,journal,impersonation);
  assert.deepEqual(forged,{ok:false,error:'SOURCE_REPLAY_REJECTED'});

  const actual=applyM1V120Source(career,journal,virtual.request);
  assert.equal(actual.ok,true);
  const reviewed=reviewM1V126DenseSourceHolds(career,actual.journal);
  assert.equal(reviewed.ok,true,JSON.stringify(reviewed).slice(0,400));
  assert.equal(reviewed.sourceVerifiedVirtualFixtures,1);
  assert.equal(reviewed.modelledIncidentCount,virtual.incidents);
});

test('ordinary zero-event v122 journal remains supported',()=>{
  const career=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'v134-ordinary');
  const started=startM1V120Journal(career);
  assert.equal(started.ok,true);
  const ordinary=prepareM1V122DenseOrdinaryMatch(career,started.journal);
  assert.equal(ordinary?.ok,true);
  const applied=applyM1V120Source(career,started.journal,ordinary.request);
  assert.equal(applied.ok,true);
  const review=reviewM1V126DenseSourceHolds(career,applied.journal);
  assert.equal(review.ok,true);
  assert.equal(review.sourceVerifiedVirtualFixtures,0);
  assert.equal(review.modelledIncidentCount,0);
});
