import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';
import {encodeM1V188FullCareerBackup,decodeM1V188FullCareerBackup}
  from '../dist/browser/m1-v188-full-career-backup.js';

if(!globalThis.crypto)
  Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const catalog=createSyntheticRplScaleCatalog(2026);
const start=(seed,id)=>{
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,seed,id);
  const first=startM1V188LeagueJournal(initial);
  assert.equal(first.ok,true);
  return {initial,journal:first.journal};
};
const prepare=(i,j,version)=>prepareM1V188LeagueMatch(i,j,[],
  undefined,undefined,undefined,version);

test('new career can persist versioned goals with independently replayable old source',()=>{
  const {initial,journal}=start(41,'m1-special-new-career');
  const old=prepare(initial,journal,undefined);
  const fresh=prepare(initial,journal,1);
  assert.equal(old?.ok,true);
  assert.equal(fresh?.ok,true,JSON.stringify(fresh).slice(0,250));
  if(!old?.ok||!fresh?.ok)return;
  assert.equal(old.request.specialGoalSourceVersion,undefined);
  assert.equal(fresh.request.specialGoalSourceVersion,1);
  assert.equal(fresh.request.result.rngDraws,old.request.result.rngDraws);
  assert.equal(fresh.request.result.rngState,old.request.result.rngState);
  const applied=applyM1V188LeagueMatch(initial,journal,fresh.request);
  assert.equal(applied.ok,true,JSON.stringify(applied).slice(0,250));
  if(!applied.ok)return;
  assert.equal(applied.journal.entries[0].source.specialGoalSourceVersion,1);
  assert.equal(validateM1V188LeagueJournal(initial,applied.journal).ok,true);
  const next=prepare(initial,applied.journal,1);
  assert.equal(next?.ok,true,JSON.stringify(next).slice(0,250));
  const downgrade=prepare(initial,applied.journal,undefined);
  assert.deepEqual(downgrade,{ok:false,error:'INVALID_REQUEST'});
  assert.equal(JSON.stringify(journal),JSON.stringify(start(41,
    'm1-special-new-career').journal));
});
test('legacy started career never changes match source model midseason',()=>{
  const {initial,journal}=start(11,'m1-special-old-career');
  const old=prepare(initial,journal,undefined);
  assert.equal(old?.ok,true);
  if(!old?.ok)return;
  const saved=applyM1V188LeagueMatch(initial,journal,old.request);
  assert.equal(saved.ok,true);
  if(!saved.ok)return;
  assert.equal(saved.journal.entries[0].source.specialGoalSourceVersion,
    undefined);
  assert.deepEqual(prepare(initial,saved.journal,1),
    {ok:false,error:'INVALID_REQUEST'});
  assert.equal(prepare(initial,saved.journal,undefined)?.ok,true);
  assert.equal(validateM1V188LeagueJournal(initial,saved.journal).ok,true);
});
test('mutated experimental result and model version fail closed',()=>{
  const {initial,journal}=start(41,'m1-special-adversarial');
  const good=prepare(initial,journal,1);
  assert.equal(good?.ok,true);
  if(!good?.ok)return;
  const tampered=structuredClone(good.request);
  tampered.result.report.home.goals++;
  assert.deepEqual(applyM1V188LeagueMatch(initial,journal,tampered),
    {ok:false,error:'SOURCE_MISMATCH'});
  const invalid=structuredClone(good.request);
  invalid.specialGoalSourceVersion=8;
  assert.deepEqual(applyM1V188LeagueMatch(initial,journal,invalid),
    {ok:false,error:'INVALID_REQUEST'});
  assert.equal(prepare(initial,journal,8)?.ok,false);
  assert.equal(validateM1V188LeagueJournal(initial,journal).ok,true);
});
test('versioned full archive roundtrip preserves result and old snapshot',async()=>{
  const {initial,journal}=start(41,'m1-special-archive');
  const next=prepare(initial,journal,1);
  assert.equal(next?.ok,true);
  if(!next?.ok)return;
  const applied=applyM1V188LeagueMatch(initial,journal,next.request);
  assert.equal(applied.ok,true);
  if(!applied.ok)return;
  const encoded=await encodeM1V188FullCareerBackup(initial,applied.journal);
  const decoded=await decodeM1V188FullCareerBackup(encoded,[catalog]);
  assert.deepEqual(decoded.journal,applied.journal);
  assert.equal(decoded.journal.entries[0].source.specialGoalSourceVersion,1);
  assert.equal(decoded.initial.careerId,initial.careerId);
});

test('new v191 source option is deterministic and version-gated independently',()=>{
  const {initial,journal}=start(41,'m1-v191-new-career');
  const v1=prepare(initial,journal,1);
  const v2=prepare(initial,journal,2);
  assert.equal(v1?.ok,true,JSON.stringify(v1).slice(0,240));
  assert.equal(v2?.ok,true,JSON.stringify(v2).slice(0,240));
  if(!v1?.ok||!v2?.ok)return;
  assert.equal(v2.request.specialGoalSourceVersion,2);
  assert.equal(v2.request.result.rngDraws,v1.request.result.rngDraws);
  assert.equal(v2.request.result.rngState,v1.request.result.rngState);
  assert.deepEqual(prepare(initial,journal,2)?.request.result,
    v2.request.result,'same seed/source must replay identically');
  const saved=applyM1V188LeagueMatch(initial,journal,v2.request);
  assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,240));
  if(!saved.ok)return;
  assert.equal(validateM1V188LeagueJournal(initial,saved.journal).ok,true);
  assert.equal(saved.journal.entries[0].source.specialGoalSourceVersion,2);
  assert.equal(prepare(initial,saved.journal,2)?.ok,true);
  assert.deepEqual(prepare(initial,saved.journal,1),
    {ok:false,error:'INVALID_REQUEST'});
  assert.deepEqual(prepare(initial,saved.journal,undefined),
    {ok:false,error:'INVALID_REQUEST'});
  const forged=structuredClone(v2.request);
  forged.specialGoalSourceVersion=1;
  assert.deepEqual(applyM1V188LeagueMatch(initial,journal,forged),
    {ok:false,error:'SOURCE_MISMATCH'});
  const forgedGoal=structuredClone(v2.request);
  forgedGoal.result.report.home.goals++;
  assert.deepEqual(applyM1V188LeagueMatch(initial,journal,forgedGoal),
    {ok:false,error:'SOURCE_MISMATCH'});
});

test('v191 keeps v190 baseline shot identities and only reduces their xG',()=>{
  let shared=0,strict=0,newExtras=0;
  for(const seed of [11,41,71,101]){
    const {initial,journal}=start(seed,'m1-v191-paired-'+seed);
    const baseline=prepare(initial,journal,1);
    const tuned=prepare(initial,journal,2);
    assert.equal(baseline?.ok,true,'v190 seed '+seed);
    assert.equal(tuned?.ok,true,'v191 seed '+seed);
    if(!baseline?.ok||!tuned?.ok)continue;
    const shots=result=>result.request.result.events
      .filter(event=>event.type==='source'&&event.source.type==='shot')
      .map(event=>event.source);
    const bShots=shots(baseline),tShots=shots(tuned);
    const revised=new Map(tShots.map(event=>[event.id,event]));
    assert.ok(tShots.length>=bShots.length,
      'higher opportunity multiplier cannot remove existing baseline shots');
    newExtras+=tShots.length-bShots.length;
    for(const shot of bShots){
      const now=revised.get(shot.id);
      assert.ok(now,'pre-existing source shot must remain '+shot.id);
      assert.equal(now.teamId,shot.teamId);
      assert.equal(now.playerId,shot.playerId);
      assert.ok(now.xgMilli<=shot.xgMilli,
        'v191 xG reduction never increases existing shot quality');
      if(now.xgMilli<shot.xgMilli)strict++;
      shared++;
    }
    assert.equal(tuned.request.result.rngState,
      baseline.request.result.rngState);
    assert.equal(tuned.request.result.rngDraws,270);
  }
  assert.ok(shared>0,'no shared source shots');
  assert.ok(strict>0,'shot hypothesis never changed source quality');
  assert.ok(newExtras>=0);
});
