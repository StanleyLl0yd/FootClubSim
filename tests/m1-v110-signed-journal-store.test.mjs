import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {createInitialCareer} from '../dist/core/save.js';
import {saveNewInitialCareer} from '../dist/browser/initial-career-store.js';
import {createM1V110PersistedSignedJournal as create,
  loadM1V110PersistedSignedJournal as load,
  commitM1V110PersistedSignedSource as commit}
  from '../dist/browser/m1-v110-signed-journal-store.js';
import {M1_V107_PURPOSE} from '../dist/core/m1-v107-signed-v105-source.js';
import {simulateM1V105SpecialGoalChronology as simulate}
  from '../dist/core/m1-v105-special-goal-chronology.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

// A minimal serialized IDB mock with staged writes; success means commit.
function fakeIndexedDB(){
  const dbs=new Map(),pending=new Map();
  let quotaPut=false;
  function space(name,store){
    if(!dbs.has(name))dbs.set(name,new Map());
    const stores=dbs.get(name);
    if(!stores.has(store))stores.set(store,new Map());
    return stores.get(store);
  }
  function database(name){
    const stores=dbs.get(name)??new Map();
    dbs.set(name,stores);
    return {
      objectStoreNames:{contains(key){return stores.has(key);}},
      createObjectStore(key){
        if(stores.has(key))throw Error('exists');
        stores.set(key,new Map());
      },
      close(){},
      transaction(store,mode){
        const queue=pending.get(name)??[];
        pending.set(name,queue);
        const ops=[];
        let staged,done=false,aborted=false;
        const tx={error:null,oncomplete:null,onabort:null,onerror:null,
          abort(){if(done)throw Error('inactive');aborted=true;},
          objectStore(key){
            if(key!==store)throw Error('wrong store');
            const req=(kind,value,id)=>{
              if(mode!=='readwrite'&&kind!=='get')throw Error('readonly');
              const r={result:undefined,error:null,onsuccess:null,onerror:null};
              ops.push({kind,value:kind==='get'?undefined:structuredClone(value),id,r});
              return r;
            };
            return {
              get(id){return req('get',null,id);},
              add(value,id){return req('add',value,id);},
              put(value,id){return req('put',value,id);},
            };
          },
        };
        const context={start};
        function finish(ok){
          if(done)return;
          done=true;
          if(ok){
            dbs.get(name).set(store,staged);
            tx.oncomplete?.();
          }else tx.onabort?.();
          assert.equal(queue.shift(),context);
          if(queue.length)queueMicrotask(queue[0].start);
        }
        function drain(){
          if(aborted){finish(false);return;}
          const op=ops.shift();
          if(!op){finish(true);return;}
          let error=null;
          if(op.kind==='get')
            op.r.result=staged.has(op.id)?structuredClone(staged.get(op.id)):undefined;
          else if(op.kind==='add'&&staged.has(op.id))error='ConstraintError';
          else if(op.kind==='put'&&quotaPut)error='QuotaExceededError';
          else staged.set(op.id,structuredClone(op.value));
          if(error){
            op.r.error={name:error};
            tx.error={name:error};
            op.r.onerror?.();
            aborted=true;
          }else op.r.onsuccess?.();
          queueMicrotask(drain);
        }
        function start(){
          staged=new Map([...space(name,store)].map(([k,v])=>[k,structuredClone(v)]));
          queueMicrotask(drain);
        }
        queue.push(context);
        if(queue.length===1)queueMicrotask(start);
        return tx;
      },
    };
  }
  return {
    entries(name,store){return space(name,store);},
    setQuotaPut(x){quotaPut=x;},
    indexedDB:{open(name){
      const r={result:database(name),error:null,onupgradeneeded:null,
        onerror:null,onblocked:null,onsuccess:null};
      queueMicrotask(()=>{r.onupgradeneeded?.();r.onsuccess?.();});
      return r;
    }},
  };
}
const catalog=createSyntheticRplScaleCatalog(77);
const initial=createInitialCareer(catalog,catalog.clubs[0].id,7,'v110-career');
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
  ['sign','verify']);
function item(fixture,revision,challengeId){
  const prematch={schemaVersion:MATCH_LEDGER_VERSION,
    engineVersion:M1_ENGINE_VERSION,rulesPackId:M0_RULES_PACK_ID,
    rulesPackVersion:M0_RULES_PACK_VERSION,fixture,catalog,
    homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:revision+42};
  const source=[prematch,policy,[],[],[],[]];
  const result=simulate(...source);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,200));
  return {context:{careerId:initial.careerId,fixtureId:fixture.id,
    expectedRevision:revision,challengeId},source,result};
}
async function signed(fixture,revision,challengeId){
  const x=item(fixture,revision,challengeId);
  const payload=JSON.stringify({schemaVersion:107,purpose:M1_V107_PURPOSE,
    ...x.context,sourceSha256:createHash('sha256')
      .update(JSON.stringify(x.source)).digest('hex')});
  return {...x,envelope:{schemaVersion:107,payload,
    signature:Buffer.from(await webcrypto.subtle.sign('Ed25519',
      keys.privateKey,new TextEncoder().encode(payload))).toString('base64url')}};
}
async function withStore(callback){
  const old=globalThis.indexedDB;
  const db=fakeIndexedDB();
  globalThis.indexedDB=db.indexedDB;
  try{
    await saveNewInitialCareer(initial);
    return await callback(db);
  }finally{
    if(old===undefined)delete globalThis.indexedDB;
    else globalThis.indexedDB=old;
  }
}
const write=(x,revision)=>commit(initial.careerId,keys.publicKey,
  'research-key',revision,x.context,x.envelope,x.source,x.result);

test('v110 persists signed source across load, add-only creation and replay',async()=>{
  await withStore(async()=>{
    await assert.rejects(load(initial.careerId,keys.publicKey,'research-key'),
      {code:'NOT_FOUND'});
    const empty=await create(initial.careerId,'research-key');
    assert.equal(empty.revision,0);
    await assert.rejects(create(initial.careerId,'research-key'),
      {code:'ALREADY_EXISTS'});
    const first=await write(await signed(fixtures[0],0,'challenge-a'),0);
    assert.equal(first.revision,1);
    assert.deepEqual(await load(initial.careerId,keys.publicKey,'research-key'),
      first);
  });
});
test('v110 serializes concurrent tabs and cannot overwrite signed history',async()=>{
  await withStore(async()=>{
    await create(initial.careerId,'research-key');
    const [a,b]=await Promise.all([
      signed(fixtures[0],0,'challenge-a'),
      signed(fixtures[1],0,'challenge-b')]);
    const settled=await Promise.allSettled([write(a,0),write(b,0)]);
    assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
    const failure=settled.find(x=>x.status==='rejected');
    assert.equal(failure.reason.code,'STALE_REVISION');
    const current=await load(initial.careerId,keys.publicKey,'research-key');
    assert.equal(current.revision,1);
    assert.equal(current.entries.length,1);
  });
});
test('v110 quota failure rolls back and does not consume challenge',async()=>{
  await withStore(async db=>{
    const empty=await create(initial.careerId,'research-key');
    const x=await signed(fixtures[0],0,'challenge-retry');
    db.setQuotaPut(true);
    await assert.rejects(write(x,0),{code:'QUOTA_EXCEEDED'});
    assert.deepEqual(await load(initial.careerId,keys.publicKey,'research-key'),
      empty);
    db.setQuotaPut(false);
    const stored=await write(x,0);
    assert.equal(stored.revision,1);
  });
});
test('v110 fails closed on tamper, stale snapshot and untrusted authority',async()=>{
  await withStore(async db=>{
    await create(initial.careerId,'research-key');
    const x=await signed(fixtures[0],0,'challenge-a');
    const committed=await write(x,0);
    const store=db.entries('footclubsim-m1-v110','signed-v105-journals');
    const mutated=structuredClone(committed);
    mutated.entries[0].source[5].push({forged:true});
    store.set(initial.careerId,mutated);
    await assert.rejects(load(initial.careerId,keys.publicKey,'research-key'),
      {code:'CORRUPTED'});
    await assert.rejects(write(await signed(fixtures[1],1,'challenge-b'),1),
      {code:'DOMAIN_REJECTED',domainError:'INVALID_JOURNAL'});
    store.set(initial.careerId,committed);
    const other=await webcrypto.subtle.generateKey({name:'Ed25519'},true,
      ['sign','verify']);
    await assert.rejects(load(initial.careerId,other.publicKey,'research-key'),
      {code:'CORRUPTED'});
    await assert.rejects(load(initial.careerId,keys.publicKey,'wrong-key'),
      {code:'CORRUPTED'});
    await assert.rejects(write(x,0),
      {code:'DOMAIN_REJECTED',domainError:'STALE_REVISION'});
  });
});
test('v110 does not accept missing IDB or invalid career ID',async()=>{
  await withStore(async()=>{
    await assert.rejects(create('bad id','research-key'),{code:'INVALID_ID'});
    const old=globalThis.indexedDB;
    try{
      delete globalThis.indexedDB;
      await assert.rejects(create(initial.careerId,'research-key'),
        {code:'UNAVAILABLE'});
    }finally{globalThis.indexedDB=old;}
  });
});
