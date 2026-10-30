import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {startM1V109SignedJournal as start,
  validateM1V109SignedJournal as validate,
  appendM1V109SignedSource as append}
  from '../dist/core/m1-v109-signed-journal.js';
import {M1_V107_PURPOSE} from '../dist/core/m1-v107-signed-v105-source.js';
import {simulateM1V105SpecialGoalChronology as simulate}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {createInitialCareer} from '../dist/core/save.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const initial=createInitialCareer(catalog,catalog.clubs[0].id,42,'v109-career');
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const prematch=(fixture)=>({schemaVersion:MATCH_LEDGER_VERSION,
  engineVersion:M1_ENGINE_VERSION,rulesPackId:M0_RULES_PACK_ID,
  rulesPackVersion:M0_RULES_PACK_VERSION,fixture,catalog,
  homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:42});
const caseFor=(fixture,index)=>{const source=[prematch(fixture),policy,[],[],[],[]];
  const result=simulate(...source);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,200));
  const context={careerId:initial.careerId,fixtureId:fixture.id,
    expectedRevision:index,challengeId:'challenge-'+index};
  return {source,result,context};
};
const sign=async(keys,{source,context})=>{
  const payload=JSON.stringify({schemaVersion:107,purpose:M1_V107_PURPOSE,
    ...context,sourceSha256:createHash('sha256')
      .update(JSON.stringify(source)).digest('hex')});
  return {schemaVersion:107,payload,signature:Buffer.from(
    await webcrypto.subtle.sign('Ed25519',keys.privateKey,
      new TextEncoder().encode(payload))).toString('base64url')};
};
const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
  ['sign','verify']);
async function add(journal,fixture,index){
  const item=caseFor(fixture,index);
  const envelope=await sign(keys,item);
  return append(initial,keys.publicKey,'research-key',journal,
    item.context,envelope,item.source,item.result);
}
test('v109 signed journal is additive, replayable and bound to M0 fixtures',async()=>{
  const started=start(initial,'research-key');
  assert.equal(started.ok,true);
  const first=await add(started.journal,fixtures[0],0);
  assert.equal(first.ok,true,JSON.stringify(first).slice(0,200));
  const second=await add(first.journal,fixtures[1],1);
  assert.equal(second.ok,true,JSON.stringify(second).slice(0,200));
  assert.equal(second.journal.revision,2);
  const imported=JSON.parse(JSON.stringify(second.journal));
  const loaded=await validate(initial,keys.publicKey,'research-key',imported);
  assert.equal(loaded.ok,true);
  assert.deepEqual(loaded.journal,second.journal);
  assert.deepEqual(started.journal.entries,[]);
});
test('v109 fails closed on duplicate challenges, fixtures and stale revisions',async()=>{
  const j=start(initial,'research-key').journal;
  const first=(await add(j,fixtures[0],0)).journal;
  const sameChallenge=caseFor(fixtures[1],1);
  sameChallenge.context.challengeId='challenge-0';
  const env=await sign(keys,sameChallenge);
  assert.deepEqual(await append(initial,keys.publicKey,'research-key',first,
    sameChallenge.context,env,sameChallenge.source,sameChallenge.result),
    {ok:false,error:'DUPLICATE_CHALLENGE'});
  const duplicate=await add(first,fixtures[0],1);
  assert.deepEqual(duplicate,{ok:false,error:'DUPLICATE_FIXTURE'});
  const stale=await add(first,fixtures[2],0);
  assert.deepEqual(stale,{ok:false,error:'STALE_REVISION'});
  assert.equal(first.revision,1);
});
test('v109 validates all historical signed entries and rejects tampering',async()=>{
  const started=start(initial,'research-key').journal;
  const appended=(await add(started,fixtures[0],0)).journal;
  const bad=structuredClone(appended);
  bad.entries[0].source[1].home.availableStaffIds.push('forged-staff');
  assert.deepEqual(await validate(initial,keys.publicKey,'research-key',bad),
    {ok:false,error:'INVALID_JOURNAL'});
  const changed=structuredClone(appended);
  changed.entries[0].context.challengeId='replaced';
  assert.deepEqual(await validate(initial,keys.publicKey,'research-key',changed),
    {ok:false,error:'INVALID_JOURNAL'});
  const wrongPack=structuredClone(appended);
  wrongPack.basePackVersion='forged-pack';
  assert.deepEqual(await validate(initial,keys.publicKey,'research-key',wrongPack),
    {ok:false,error:'INVALID_JOURNAL'});
  const other=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
    ['sign','verify']);
  assert.deepEqual(await validate(initial,other.publicKey,'research-key',appended),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.deepEqual(await validate(initial,keys.publicKey,'wrong-key',appended),
    {ok:false,error:'INVALID_JOURNAL'});
});
test('v109 rejects a signed alternate catalog and unknown canonical fixture',async()=>{
  const j=start(initial,'research-key').journal;
  const changed=caseFor(fixtures[0],0);
  changed.source[0].catalog.packVersion='altered';
  const env=await sign(keys,changed);
  assert.deepEqual(await append(initial,keys.publicKey,'research-key',j,
    changed.context,env,changed.source,changed.result),
    {ok:false,error:'UNTRUSTED_PACK'});
  const changedFixture=caseFor(fixtures[0],0);
  changedFixture.source[0].fixture.round++;
  const env2=await sign(keys,changedFixture);
  assert.deepEqual(await append(initial,keys.publicKey,'research-key',j,
    changedFixture.context,env2,changedFixture.source,changedFixture.result),
    {ok:false,error:'UNKNOWN_FIXTURE'});
});
test('v109 captures pre-await entry snapshot despite caller mutation',async()=>{
  const j=start(initial,'research-key').journal;
  const item=caseFor(fixtures[0],0);
  const envelope=await sign(keys,item);
  const pending=append(initial,keys.publicKey,'research-key',j,item.context,
    envelope,item.source,item.result);
  item.source[5].push({forged:true});
  item.context.challengeId='changed-after-start';
  const actual=await pending;
  assert.equal(actual.ok,true,JSON.stringify(actual).slice(0,200));
  assert.equal(actual.journal.entries[0].context.challengeId,'challenge-0');
  assert.equal(actual.journal.entries[0].source[5].length,0);
});
