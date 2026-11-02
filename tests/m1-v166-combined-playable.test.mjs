import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V166CombinedMatch}
  from '../dist/core/m1-v166-combined-playable.js';
import {verifyM1V166CombinedSourceClaim}
  from '../dist/core/m1-v166-combined-source.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);
let cached;
function validCombined(){
  if(cached)return cached;
  for(let seed=1;seed<=40;seed++){
    const initial=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v166-combined-'+seed);
    const start=startM1V120Journal(initial);
    assert.equal(start.ok,true);
    const base=prepareM1V128ManualFictionalContinuation(
      initial,start.journal);
    if(!base?.ok)continue;
    const own=base.fixture.homeClubId===initial.selectedClubId?
      base.request.prematch.homeLineup:base.request.prematch.awayLineup;
    const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
    const outs=own.starters.filter(p=>
      players.get(p)?.primaryPosition!=='GK');
    const ins=own.bench.filter(p=>
      players.get(p)?.primaryPosition!=='GK');
    for(let i=0;i<Math.min(3,outs.length,ins.length);i++){
      const chosen=[{outPlayerId:outs[i],inPlayerId:ins[i],
        elapsedSeconds:2700}];
      const proposal=prepareM1V166CombinedMatch(
        initial,start.journal,chosen);
      if(proposal?.ok&&proposal.fictionalIncidentCount>0){
        cached={initial,start,proposal};return cached;
      }
    }
  }
  assert.fail('No legal combined fictional event + halftime change in 40 seeds');
}
test('v166 combines regenerated referee events and one manager change in v120 CAS',()=>{
  const {initial,start,proposal}=validCombined();
  const source=proposal.request;
  assert.equal(verifyM1V166CombinedSourceClaim(
    source.prematch,source.policy,source.plannedCommands,
    proposal.fixture.id,initial.selectedClubId,initial.rngState),true);
  assert.ok(source.plannedCommands.some(c=>c.kind==='substitute-normal'));
  assert.ok(source.plannedCommands.some(c=>c.id?.startsWith('m1-v19-ref-')));
  const accepted=applyM1V120Source(initial,start.journal,source);
  assert.equal(accepted.ok,true,JSON.stringify(accepted).slice(0,450));
  assert.equal(validateM1V120Journal(initial,accepted.journal).ok,true);
  const holds=reviewM1V126DenseSourceHolds(initial,accepted.journal);
  assert.equal(holds.ok,true,JSON.stringify(holds).slice(0,450));
  assert.equal(holds.sourceVerifiedVirtualFixtures,1);
  assert.equal(holds.modelledIncidentCount,proposal.fictionalIncidentCount);
});
test('v166 refuses alternate seed, forged referee and fabricated stoppage',()=>{
  const {initial,start,proposal}=validCombined();
  const request=proposal.request;
  const forgedSeed=structuredClone(request);
  forgedSeed.prematch.rngSeed^=1234567;
  assert.deepEqual(applyM1V120Source(initial,start.journal,forgedSeed),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const forgedReferee=structuredClone(request);
  const incident=forgedReferee.plannedCommands.find(c=>c.id);
  assert.ok(incident);
  incident.id+='-forged';
  assert.deepEqual(applyM1V120Source(initial,start.journal,forgedReferee),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const fakeStop=structuredClone(request);
  const substitution=fakeStop.plannedCommands.find(
    c=>c.kind==='substitute-normal');
  substitution.elapsedSeconds=300;
  substitution.stoppage='referee-authorized';
  assert.deepEqual(applyM1V120Source(initial,start.journal,fakeStop),
    {ok:false,error:'SOURCE_REPLAY_REJECTED'});
  const good=applyM1V120Source(initial,start.journal,request);
  assert.equal(good.ok,true);
  const corrupted=structuredClone(good.journal);
  corrupted.entries[0].source.plannedCommands.find(c=>c.id).id+='-forged';
  assert.deepEqual(validateM1V120Journal(initial,corrupted),
    {ok:false,error:'INVALID_JOURNAL'});
});
