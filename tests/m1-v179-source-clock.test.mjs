import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal} from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V132DenseManagerSubstitution}
  from '../dist/core/m1-v132-dense-manager-substitution.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';
import {projectM1V179MatchClock}
  from '../dist/core/m1-v179-source-clock.js';

const catalog=createSyntheticRplScaleCatalog(2026);
function sample(seed=23){
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,
    seed,'v179-clock-'+seed);
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const p=prepareM1V128ManualFictionalContinuation(initial,started.journal);
  assert.equal(p?.ok,true);
  return {initial,journal:started.journal,request:p.request};
}
test('v179 derives one running/wall and actual XI view from the replayed v105 source',()=>{
  const s=sample();
  const inputBefore=JSON.stringify(s.request);
  const result=projectM1V179MatchClock(
    s.request.prematch,s.request.result);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,220));
  assert.equal(result.sourceReplayRequired,true);
  assert.equal(result.officialRefereeTimingAuthenticated,false);
  assert.equal(result.medicalExceptionsAuthenticated,false);
  assert.equal(result.snapshots.length,s.request.result.events.length);
  assert.equal(result.runningFullTimeSeconds,5400);
  assert.ok(result.wallFullTimeSeconds>=6300);
  assert.equal(result.modelledPausedSeconds,
    result.wallFullTimeSeconds-5400);
  assert.ok(result.managerStopsFromSource.includes(2700));
  const lastFirstHalf=result.snapshots.findLast(e=>e.runningSeconds<2700);
  const firstSecondHalf=result.snapshots.find(e=>e.runningSeconds>=2700);
  assert.ok(firstSecondHalf.wallSeconds-lastFirstHalf.wallSeconds>=900);
  for(let i=1;i<result.snapshots.length;i++){
    assert.ok(result.snapshots[i].runningSeconds>=
      result.snapshots[i-1].runningSeconds);
    assert.ok(result.snapshots[i].wallSeconds>=
      result.snapshots[i-1].wallSeconds);
  }
  for(let i=0;i<s.request.result.events.length;i++){
    const e=s.request.result.events[i];
    if(e.type!=='source'||e.source.type!=='shot')continue;
    const side=e.source.teamId===s.request.prematch.fixture.homeClubId?
      'homePresent':'awayPresent';
    assert.ok(result.snapshots[i][side].includes(e.source.playerId));
    if(e.source.outcome==='goal'&&e.elapsedSeconds<5399)
      assert.ok(result.managerStopsFromSource.includes(e.elapsedSeconds+1));
  }
  assert.equal(JSON.stringify(s.request),inputBefore);
});
test('v179 rejects forged physical player and event sequence',()=>{
  const s=sample();
  const original=JSON.stringify(s.request.result);
  const broken=structuredClone(s.request.result);
  const index=broken.events.findIndex(e=>
    e.type==='source'&&e.source.type==='shot');
  assert.ok(index>=0);
  broken.events[index].source.playerId='missing-player';
  assert.deepEqual(projectM1V179MatchClock(s.request.prematch,broken),
    {ok:false,error:'INVALID_XI_CHRONOLOGY'});
  const misordered=structuredClone(s.request.result);
  misordered.events[index].sequence=9999;
  assert.deepEqual(projectM1V179MatchClock(s.request.prematch,misordered),
    {ok:false,error:'INVALID_MATCH_CLOCK_SOURCE'});
  assert.equal(JSON.stringify(s.request.result),original);
});
test('v179 keeper of physical on-field state after a lawful saved substitution',()=>{
  let observed=false;
  for(let seed=1;seed<=15&&!observed;seed++){
    const s=sample(seed);
    const p=s.request.prematch;
    const xi=p.fixture.homeClubId===s.initial.selectedClubId?
      p.homeLineup:p.awayLineup;
    const players=new Map(s.initial.catalog.players.map(x=>[x.id,x]));
    const outs=xi.starters.filter(id=>players.get(id)?.primaryPosition!=='GK');
    const ins=xi.bench.filter(id=>players.get(id)?.primaryPosition!=='GK');
    for(const out of outs.slice(0,6)){
      if(observed)break;
      for(const incoming of ins.slice(0,7)){
        const prepared=prepareM1V132DenseManagerSubstitution(
          s.initial,s.journal,{outPlayerId:out,inPlayerId:incoming,
            elapsedSeconds:2700});
        if(!prepared?.ok)continue;
        const admitted=admitM1V171SourceWithHolds(
          s.initial,s.journal,prepared.request);
        if(!admitted.ok)continue;
        const projected=projectM1V179MatchClock(
          prepared.request.prematch,prepared.request.result);
        assert.equal(projected.ok,true);
        const command=projected.snapshots.find(x=>
          x.sourceKind==='physical-transition'&&
          x.runningSeconds===2700&&x.homePresent.includes(incoming)||
          x.sourceKind==='physical-transition'&&
          x.runningSeconds===2700&&x.awayPresent.includes(incoming));
        assert.ok(command,'Substitute must enter from the same physical event');
        assert.ok(![...command.homePresent,...command.awayPresent].includes(out));
        observed=true;break;
      }
    }
  }
  assert.equal(observed,true,'One genuine half-time source-substitution required');
});
