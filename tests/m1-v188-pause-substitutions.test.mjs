import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';
import {inspectM1V188PauseSubstitutions}
  from '../dist/core/m1-v188-pause-substitutions.js';
import {sameM1V188CheckpointPrefix}
  from '../dist/core/m1-v188-half-time.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const selected=catalog.clubs[0].id;
function make(seed){
  const career=createInitialCareer(catalog,selected,seed,'pause-sub-'+seed);
  const started=startM1V188LeagueJournal(career);
  assert.ok(started.ok);
  const baseline=prepareM1V188LeagueMatch(career,started.journal);
  assert.ok(baseline?.ok&&baseline.selectedClubFixture);
  return{career,journal:started.journal,baseline};
}
test('legal live substitution options are source-bound, not arbitrary pauses',()=>{
  const {career,journal,baseline}=make(101);
  assert.equal(inspectM1V188PauseSubstitutions(baseline,'forged',2700),null);
  assert.equal(inspectM1V188PauseSubstitutions(baseline,selected,301),null);
  const half=inspectM1V188PauseSubstitutions(baseline,selected,2700);
  assert.ok(half?.canSubstitute);
  assert.ok(half.pairs.length>0);
  const notStop=Array.from({length:17},(_,i)=>(i+1)*300)
    .find(s=>!baseline.clock.managerStopsFromSource.includes(s));
  assert.ok(notStop);
  const denied=inspectM1V188PauseSubstitutions(baseline,selected,notStop);
  assert.equal(denied?.reason,'NO_REFEREE_STOP');
  assert.equal(denied.canSubstitute,false);
  const illegal=prepareM1V188LeagueMatch(career,journal,[{
    ...half.pairs[0],elapsedSeconds:notStop,
  }]);
  assert.equal(illegal?.ok,false);
});
test('a live replacement preserves the played source and exact CAS',()=>{
  let accepted=null;
  for(const seed of [11,22,33,44,55]){
    const s=make(seed);
    const options=inspectM1V188PauseSubstitutions(
      s.baseline,selected,2700);
    assert.ok(options?.canSubstitute);
    for(const pair of options.pairs){
      const updated=prepareM1V188LeagueMatch(s.career,s.journal,
        [{...pair,elapsedSeconds:2700}]);
      if(updated?.ok){accepted={...s,updated,pair};break;}
    }
    if(accepted)break;
  }
  assert.ok(accepted,'no admitted half-time source replacement');
  const {career,journal,baseline,updated,pair}=accepted;
  assert.ok(sameM1V188CheckpointPrefix(
    baseline.request.result,updated.request.result,2700));
  const at60=inspectM1V188PauseSubstitutions(updated,selected,3600);
  assert.ok(at60);
  assert.equal(at60.usedSubstitutions,1);
  assert.ok(at60.pairs.every(x=>x.inPlayerId!==pair.inPlayerId&&
    x.outPlayerId!==pair.outPlayerId));
  const admitted=applyM1V188LeagueMatch(career,journal,updated.request);
  assert.ok(admitted.ok);
  assert.ok(validateM1V188LeagueJournal(career,admitted.journal).ok);
  const forged=structuredClone(updated.request);
  forged.plannedCommands.find(x=>x.kind==='substitute-normal')
    .teamId='forged';
  assert.equal(applyM1V188LeagueMatch(career,journal,forged).ok,false);
  assert.equal(journal.revision,0);
});
test('substitution and tactical instructions coexist at the same pause',()=>{
  const s=make(919);
  const options=inspectM1V188PauseSubstitutions(s.baseline,selected,2700);
  assert.ok(options?.canSubstitute);
  const input=s.baseline.request.prematch;
  const tactics=input.fixture.homeClubId===selected?
    input.homeTactics:input.awayTactics;
  const orders=[{kind:'team-tactics',elapsedSeconds:2700,
    plan:{...tactics,schemaVersion:2,formation:'3-4-3',
      mentality:2,pressing:100,tempo:100}}];
  let proposal=null;
  for(const pair of options.pairs){
    const p=prepareM1V188LeagueMatch(s.career,s.journal,
      [{...pair,elapsedSeconds:2700}],
      undefined,undefined,undefined,undefined,orders);
    if(p?.ok){proposal=p;break;}
  }
  assert.ok(proposal,'combined source must admit a legal player choice');
  assert.ok(sameM1V188CheckpointPrefix(s.baseline.request.result,
    proposal.request.result,2700));
  const committed=applyM1V188LeagueMatch(
    s.career,s.journal,proposal.request);
  assert.ok(committed.ok);
  assert.ok(validateM1V188LeagueJournal(
    s.career,committed.journal).ok);
});
