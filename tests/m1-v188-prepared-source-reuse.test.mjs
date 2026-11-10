import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';

// A separately loaded module instance has NO prepared-source memo. This
// proves the fast result is byte-equivalent to an independent full replay.
const cold=await import(
  '../dist/core/m1-v188-league-source-journal.js?strict-cold-compare=1');
const catalog=createSyntheticRplScaleCatalog(2026);
function start(seed,tag){
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,seed,
    'v188-memo-'+tag);
  const zero=startM1V188LeagueJournal(initial);
  assert.equal(zero.ok,true);
  return {initial,zero:zero.journal};
}

test('same exact generated request yields identical warm and cold journal',()=>{
  for(const seed of [7,11,23]){
    const {initial,zero}=start(seed,'compare-'+seed);
    const before=JSON.stringify(zero);
    const proposed=prepareM1V188LeagueMatch(initial,zero);
    assert.equal(proposed?.ok,true);
    if(!proposed?.ok)return;
    const warm=applyM1V188LeagueMatch(initial,zero,proposed.request);
    const strict=cold.applyM1V188LeagueMatch(initial,zero,proposed.request);
    assert.equal(warm.ok,true);
    assert.deepEqual(warm,strict);
    assert.equal(JSON.stringify(zero),before);
    assert.equal(validateM1V188LeagueJournal(initial,warm.journal).ok,true);
    assert.deepEqual(applyM1V188LeagueMatch(
      initial,warm.journal,proposed.request),
      {ok:false,error:'STALE_REVISION'});
  }
});

test('changed score, event, policy or career never reuses prepared authority',()=>{
  const {initial,zero}=start(11,'tampering');
  const good=prepareM1V188LeagueMatch(initial,zero);
  assert.equal(good?.ok,true);
  if(!good?.ok)return;
  const original=JSON.stringify(zero);
  const changes=[
    request=>{request.result.report.home.goals++;},
    request=>{request.plannedCommands.push({kind:'forged-event'});},
    request=>{request.policy={home:null,away:null};},
    request=>{request.prematch.rngSeed=1;},
    request=>{request.expectedRevision=1;},
  ];
  for(const mutate of changes){
    const refresh=prepareM1V188LeagueMatch(initial,zero);
    assert.equal(refresh?.ok,true);
    const forged=structuredClone(refresh.request);
    mutate(forged);
    const rejected=applyM1V188LeagueMatch(initial,zero,forged);
    assert.equal(rejected.ok,false,
      'forged request unexpectedly used generator memo');
    assert.equal(JSON.stringify(zero),original,
      'failed commit changed persisted-source input');
  }
  // Previous rejected attempts must not make a valid request succeed via a
  // stale memo. A fully verified original request still has identical bytes.
  const strict=cold.applyM1V188LeagueMatch(initial,zero,good.request);
  const repeat=applyM1V188LeagueMatch(initial,zero,good.request);
  assert.deepEqual(repeat,strict);
  const other=createInitialCareer(catalog,catalog.clubs[0].id,11,
    'v188-memo-other-career');
  const otherZero=startM1V188LeagueJournal(other);
  assert.equal(otherZero.ok,true);
  assert.deepEqual(applyM1V188LeagueMatch(
    other,otherZero.journal,good.request),
    {ok:false,error:'WRONG_CAREER'});
});

test('medical v5 preparation retains independent replay requirements',()=>{
  const {initial,zero}=start(11,'medical-source');
  const proposal=prepareM1V188LeagueMatch(
    initial,zero,[],undefined,5);
  assert.equal(proposal?.ok,true,
    'v5 medical test fixture must generate an accepted source');
  if(!proposal?.ok)return;
  const fast=applyM1V188LeagueMatch(initial,zero,proposal.request);
  const strict=cold.applyM1V188LeagueMatch(initial,zero,proposal.request);
  assert.deepEqual(fast,strict);
  assert.equal(fast.ok,true);
  const mutated=structuredClone(proposal.request);
  mutated.autonomousMedicalOrigin=[{forged:true}];
  assert.equal(applyM1V188LeagueMatch(initial,zero,mutated).ok,false);
});
