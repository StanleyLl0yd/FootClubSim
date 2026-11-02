import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {saveNewInitialCareer} from '../dist/browser/initial-career-store.js';
import {createM1V120PersistedJournal,commitM1V120PersistedSource,
  loadM1V120PersistedJournal}
  from '../dist/browser/m1-v120-journal-store.js';
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

function indexedDBStub() {
  const records=new Map(),stats={puts:0,aborts:0};
  return {stats, indexedDB:{open(database) {
    const db={close(){},objectStoreNames:{contains(){return true;}},
      transaction(store,mode) {
        const tx={error:null,oncomplete:null,onabort:null,onerror:null};
        let pending=0,aborted=false,completed=false;
        const writes=[];
        const finish=()=>{
          if(pending!==0||aborted||completed)return;
          queueMicrotask(()=>{
            if(pending!==0||aborted||completed)return;
            completed=true;
            for(const [key,value] of writes)records.set(key,value);
            tx.oncomplete?.();
          });
        };
        const fail=()=>{
          if(aborted||completed)return;
          aborted=true;stats.aborts++;
          queueMicrotask(()=>tx.onabort?.());
        };
        tx.abort=fail;
        tx.objectStore=()=>({
          get(key) {
            const request={result:undefined,error:null,onsuccess:null,onerror:null};
            pending++;
            queueMicrotask(()=>{
              if(aborted)return;
              request.result=structuredClone(records.get(database+':'+store+':'+key));
              pending--;request.onsuccess?.();finish();
            });
            return request;
          },
          add(value,key) {return write('add',value,key);},
          put(value,key) {return write('put',value,key);},
        });
        function write(operation,value,key) {
          assert.equal(mode,'readwrite');
          const request={error:null,onsuccess:null,onerror:null};
          pending++;
          queueMicrotask(()=>{
            if(aborted)return;
            const scoped=database+':'+store+':'+key;
            if(operation==='add'&&records.has(scoped)){
              request.error={name:'ConstraintError'};
              request.onerror?.();fail();return;
            }
            if(operation==='put')stats.puts++;
            writes.push([scoped,structuredClone(value)]);
            pending--;request.onsuccess?.();finish();
          });
          return request;
        }
        return tx;
      },
    };
    const request={result:db,error:null,onupgradeneeded:null,
      onerror:null,onblocked:null,onsuccess:null};
    queueMicrotask(()=>request.onsuccess?.());
    return request;
  }}};
}
function sourceValidBypass() {
  const catalog=createSyntheticRplScaleCatalog(2026);
  for(let seed=1;seed<=40;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v172-storage-hold-'+seed);
    const initial=startM1V120Journal(career);
    assert.equal(initial.ok,true);
    const first=prepareM1V166CombinedMatch(career,initial.journal,[]);
    if(!first?.ok||!first.fictionalIncidentCount)continue;
    const committed=applyM1V120Source(career,initial.journal,first.request);
    if(!committed.ok)continue;
    const before=committed.journal;
    const holds=reviewM1V126DenseSourceHolds(career,before);
    if(!holds.ok||!holds.holds.some(h=>h.activeForNextFixture))continue;
    const bare=buildM1V122NextOrdinaryFromVerified(career,before,new Set());
    if(!bare?.ok)continue;
    const lineup=bare.fixture.homeClubId===career.selectedClubId?
      bare.request.prematch.homeLineup:bare.request.prematch.awayLineup;
    if(!holds.holds.some(h=>h.activeForNextFixture&&
       (lineup.starters.includes(h.playerId)||lineup.bench.includes(h.playerId))))
      continue;
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
    const bypass=applyM1V120Source(career,before,attack);
    if(!bypass.ok)continue;
    if(reviewM1V126DenseSourceHolds(career,bypass.journal).ok)continue;
    return {career,first:first.request,attack};
  }
  throw new Error('No fixed source-valid hold bypass found');
}
test('v172 IndexedDB transaction never puts a held-player bypass',async()=>{
  const sample=sourceValidBypass();
  const stub=indexedDBStub();
  const old=globalThis.indexedDB;
  globalThis.indexedDB=stub.indexedDB;
  try{
    const id=sample.career.careerId;
    await saveNewInitialCareer(sample.career);
    const zero=await createM1V120PersistedJournal(id);
    assert.equal(zero.revision,0);
    const one=await commitM1V120PersistedSource(id,0,sample.first);
    assert.equal(one.revision,1);
    const previous=JSON.stringify(one),beforePuts=stub.stats.puts;
    await assert.rejects(
      commitM1V120PersistedSource(id,1,sample.attack),
      {code:'ELIGIBILITY_REJECTED'});
    assert.equal(stub.stats.puts,beforePuts);
    assert.ok(stub.stats.aborts>=1);
    assert.equal(JSON.stringify(await loadM1V120PersistedJournal(id)),previous);
    const legal=prepareM1V166CombinedMatch(sample.career,one,[]);
    assert.equal(legal?.ok,true,JSON.stringify(legal).slice(0,250));
    const two=await commitM1V120PersistedSource(id,1,legal.request);
    assert.equal(two.revision,2);
    await assert.rejects(
      commitM1V120PersistedSource(id,1,legal.request),
      {code:'STALE_REVISION'});
    assert.equal(JSON.stringify(await loadM1V120PersistedJournal(id)),
      JSON.stringify(two));
  }finally{
    if(old===undefined)delete globalThis.indexedDB;
    else globalThis.indexedDB=old;
  }
});
