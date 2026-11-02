import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V132DenseManagerSubstitution}
  from '../dist/core/m1-v132-dense-manager-substitution.js';
import {prepareM1V136DenseDoubleSubstitution}
  from '../dist/core/m1-v136-dense-double-substitution.js';
import {prepareM1V138DenseFiveSubstitutions}
  from '../dist/core/m1-v138-dense-five-substitutions.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';

const catalog=createSyntheticRplScaleCatalog(2026);
function candidate(seed){
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,
    seed,'v178-manager-stops-'+seed);
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const journal=started.journal;
  const base=prepareM1V128ManualFictionalContinuation(initial,journal);
  if(!base?.ok)return null;
  const own=base.fixture.homeClubId===initial.selectedClubId?
    base.request.prematch.homeLineup:base.request.prematch.awayLineup;
  const positions=new Map(initial.catalog.players.map(p=>
    [p.id,p.primaryPosition]));
  const outs=own.starters.filter(id=>positions.get(id)!=='GK');
  const ins=own.bench.filter(id=>positions.get(id)!=='GK');
  if(outs.length<3||ins.length<3)return null;
  const goalStops=new Set(base.request.result.events.filter(e=>
    e.type==='source'&&e.source.type==='shot'&&
    e.source.outcome==='goal').map(e=>e.elapsedSeconds+1));
  return {initial,journal,outs,ins,goalStops};
}
function propose(s,n,at){
  const choices=Array.from({length:n},(_,i)=>({
    outPlayerId:s.outs[i],inPlayerId:s.ins[i],elapsedSeconds:at,
  }));
  return n===1?
    prepareM1V132DenseManagerSubstitution(
      s.initial,s.journal,choices[0]):
    n===2?
      prepareM1V136DenseDoubleSubstitution(
        s.initial,s.journal,choices):
      prepareM1V138DenseFiveSubstitutions(
        s.initial,s.journal,choices);
}
test('v178 prevents unsupported legacy manager stoppages before CAS',()=>{
  const witnessed=new Set();
  for(let seed=1;seed<=24&&witnessed.size<3;seed++){
    const s=candidate(seed);
    if(!s)continue;
    const nonStop=Array.from({length:17},(_,i)=>(i+1)*300)
      .find(t=>t!==2700&&!s.goalStops.has(t));
    if(!nonStop)continue;
    for(const n of [1,2,3]){
      if(witnessed.has(n))continue;
      const old=propose(s,n,nonStop);
      if(!old?.ok)continue;
      const legacy=applyM1V120Source(s.initial,s.journal,old.request);
      if(!legacy.ok)continue;
      const before=JSON.stringify(s.journal);
      assert.deepEqual(admitM1V171SourceWithHolds(
        s.initial,s.journal,old.request),
        {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'});
      assert.equal(JSON.stringify(s.journal),before);
      const halftime=propose(s,n,2700);
      assert.equal(halftime?.ok,true,
        'Halftime must remain available to manager choices '+n);
      assert.equal(admitM1V171SourceWithHolds(
        s.initial,s.journal,halftime.request).ok,true);
      witnessed.add(n);
    }
  }
  assert.deepEqual([...witnessed].sort(),[1,2,3]);
});
test('v178 retains a verified goal-triggered in-play manager substitution',()=>{
  let verified=false;
  for(let seed=1;seed<=24&&!verified;seed++){
    const s=candidate(seed);
    if(!s)continue;
    for(const at of s.goalStops){
      if(at===2700||at>5100||at%300!==0)continue;
      const p=propose(s,1,at);
      if(!p?.ok)continue;
      const accepted=admitM1V171SourceWithHolds(
        s.initial,s.journal,p.request);
      if(!accepted.ok)continue;
      assert.equal(accepted.journal.revision,s.journal.revision+1);
      verified=true;break;
    }
  }
  assert.equal(verified,true,'A source-derived restart is required');
});
