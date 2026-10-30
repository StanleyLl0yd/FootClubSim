import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {verifyM1V107SignedV105Source as verify,
  M1_V107_PURPOSE}
  from '../dist/core/m1-v107-signed-v105-source.js';
import {simulateM1V105SpecialGoalChronology as simulate}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION}
  from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const fixture=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const prematch={schemaVersion:MATCH_LEDGER_VERSION,
  engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,
  homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:42};
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const source=[prematch,policy,[],[],[],[]];
const context={careerId:'career-v107',fixtureId:fixture.id,
  expectedRevision:0,challengeId:'challenge-001'};
const result=simulate(...source);
const sign=async(privateKey,src=source,ctx=context)=>{
  const sourceSha256=createHash('sha256').update(JSON.stringify(src)).digest('hex');
  const payload=JSON.stringify({schemaVersion:107,purpose:M1_V107_PURPOSE,
    ...ctx,sourceSha256});
  const signature=Buffer.from(await webcrypto.subtle.sign('Ed25519',
    privateKey,new TextEncoder().encode(payload))).toString('base64url');
  return {schemaVersion:107,payload,signature};
};
test('v107 accepts externally anchored signature only for exact v105 source',async()=>{
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,200));
  const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
    ['sign','verify']);
  const envelope=await sign(keys.privateKey);
  const actual=await verify(keys.publicKey,context,envelope,source,result);
  assert.equal(actual.ok,true,JSON.stringify(actual).slice(0,200));
  assert.equal(actual.sourceSha256,
    createHash('sha256').update(JSON.stringify(source)).digest('hex'));
  assert.deepEqual(actual.result,result);
  assert.equal(actual.signedByProvidedTrustAnchor,true);
  assert.equal(actual.officialRefereeAndPhysicianIdentityEstablished,false);
  assert.equal(actual.externalChallengeReplayProtectionEstablished,false);
  assert.equal(actual.immutableM0CareerJournalValidated,false);
  assert.equal(actual.durableCareerCASCommitted,false);
});
test('v107 fails closed on tamper, wrong scope, unknown key and forged result',async()=>{
  const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
    ['sign','verify']);
  const another=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
    ['sign','verify']);
  const envelope=await sign(keys.privateKey);
  const check=async(key,ctx,env,src,candidate,error)=>{
    assert.deepEqual(await verify(key,ctx,env,src,candidate),
      {ok:false,error});
  };
  await check(keys.publicKey,{...context,expectedRevision:1},
    envelope,source,result,'SCOPE_MISMATCH');
  await check(keys.publicKey,context,envelope,
    [prematch,{...policy,other:true},[],[],[],[]],result,'SCOPE_MISMATCH');
  await check(another.publicKey,context,envelope,source,result,
    'INVALID_SIGNATURE');
  await check(null,context,envelope,source,result,
    'TRUST_ANCHOR_UNAVAILABLE');
  await check(keys.publicKey,context,
    {...envelope,signature:envelope.signature.slice(0,85)+'!'},
    source,result,'INVALID_ENVELOPE');
  await check(keys.publicKey,context,envelope,source,
    {...result,rngDraws:0},'CLAIMED_RESULT_MISMATCH');
  await check(keys.publicKey,{...context,challengeId:'not-the-signed-one'},
    envelope,source,result,'SCOPE_MISMATCH');
  await check(keys.publicKey,context,envelope,[...source,[]],
    result,'INVALID_SOURCE');
  await check(keys.publicKey,context,envelope,source,null,
    'CLAIMED_RESULT_MISMATCH');
});
test('v107 signed bytes do not override invalid v105 source',async()=>{
  const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
    ['sign','verify']);
  const bad=[prematch,policy,[],[],[],[{unrecognized:true}]];
  const envelope=await sign(keys.privateKey,bad);
  assert.deepEqual(await verify(keys.publicKey,context,envelope,bad,result),
    {ok:false,error:'V105_SOURCE_REJECTED'});
});
test('v107 replays an immutable signed snapshot across asynchronous verification',async()=>{
  const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
    ['sign','verify']);
  const mutableSource=structuredClone(source);
  const mutableContext={...context};
  const envelope=await sign(keys.privateKey,mutableSource,mutableContext);
  const pending=verify(keys.publicKey,mutableContext,envelope,mutableSource,result);
  mutableSource[5].push({unrecognized:true});
  mutableContext.careerId='modified-after-submission';
  const actual=await pending;
  assert.equal(actual.ok,true,JSON.stringify(actual).slice(0,200));
  assert.deepEqual(actual.result,result);
  assert.equal(actual.careerId,context.careerId);
  assert.equal(actual.sourceSha256,
    createHash('sha256').update(JSON.stringify(source)).digest('hex'));
});
