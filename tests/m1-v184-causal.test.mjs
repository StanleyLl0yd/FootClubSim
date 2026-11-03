import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V184CausalMatch}
  from '../dist/core/m1-v182-unified-playable.js';
import {regenerateM1V184CausalSource,
  verifyM1V184CausalSourceClaim}
  from '../dist/core/m1-v182-unified-source.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {projectM1V179MatchClock}
  from '../dist/core/m1-v179-source-clock.js';

const catalog=createSyntheticRplScaleCatalog(2026);
function career(seed){
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,
    seed,'v184-causal-'+seed);
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  return {initial,journal:started.journal};
}
function medicalFixture(){
  for(let seed=1;seed<=64;seed++){
    const {initial,journal}=career(seed);
    const prepared=prepareM1V184CausalMatch(initial,journal);
    if(!prepared?.ok||!prepared.causalAssessments?.some(a=>
      a.transition==='off-field-return'))continue;
    const accepted=admitM1V171SourceWithHolds(
      initial,journal,prepared.request);
    if(accepted.ok)return {seed,initial,journal,prepared,accepted};
  }
  assert.fail('No causal, source-admitted synthetic medical fixture');
}
let chosen;
test('v184 selected physical victim belongs to opposing XI at source whistle',()=>{
  chosen=medicalFixture();
  const {initial,journal,prepared,accepted}=chosen;
  assert.equal(prepared.automatic,true);
  assert.equal(prepared.refereeAndMedicalAuthorityAuthenticated,false);
  assert.equal(prepared.completeOpponentHistoryAvailable,false);
  assert.equal(accepted.journal.revision,1);
  assert.equal(validateM1V120Journal(initial,accepted.journal).ok,true);
  const holds=reviewM1V126DenseSourceHolds(initial,accepted.journal);
  assert.equal(holds.ok,true,holds.ok?'':holds.error);
  assert.equal(holds.sourceVerifiedVirtualFixtures,1);
  const causal=regenerateM1V184CausalSource(prepared.request.prematch,
    prepared.request.policy,[]);
  assert.equal(causal.ok,true);
  assert.deepEqual(causal.plannedCommands,prepared.request.plannedCommands);
  assert.deepEqual(causal.checkpointMedical,prepared.request.checkpointMedical);
  assert.deepEqual(causal.causalAssessments,prepared.causalAssessments);
  assert.equal(verifyM1V184CausalSourceClaim(
    prepared.request.prematch,prepared.request.policy,
    prepared.request.plannedCommands,prepared.request.checkpointMedical,
    prepared.fixture.id,initial.selectedClubId,initial.rngState),true);
  for(const assessment of prepared.causalAssessments){
    const incident=causal.generatedIncidents.find(i=>
      i.id===assessment.incidentId);
    assert.ok(incident,'no matching source offence');
    assert.notEqual(assessment.patientTeamId,incident.teamId,
      'patient must oppose offender at original whistle');
    assert.equal(assessment.elapsedSeconds,incident.elapsedSeconds);
    assert.ok(assessment.foulWhistleEventId);
    assert.ok(assessment.foulRestartEventId);
    const savedReferee=prepared.request.result.events.find(e=>
      e.type==='source'&&e.source.type==='physical-transition'&&
      e.source.source.type==='availability'&&
      e.source.source.source.entry.action.id===incident.decisionId);
    assert.ok(savedReferee,'v29 decision missing from saved v105 physical events');
    assert.equal(savedReferee.elapsedSeconds,assessment.elapsedSeconds);
    assert.equal(assessment.externalMedicalAuthorityAuthenticated,false);
  }
  const clock=projectM1V179MatchClock(
    prepared.request.prematch,prepared.request.result);
  assert.equal(clock.ok,true,clock.ok?'':clock.error);
  assert.ok(clock.snapshots.length>0);
  assert.equal(journal.revision,0);
});

test('v184 stale/forged medical, referee and version claims fail closed',()=>{
  const {initial,journal,prepared,accepted}=chosen??medicalFixture();
  const forged=structuredClone(prepared.request);
  forged.checkpointMedical[0].playerId='forged-medical-patient';
  assert.equal(admitM1V171SourceWithHolds(
    initial,journal,forged).ok,false);
  const forgedOrigin={...prepared.request,
    commandId:'v182-unified-'+prepared.fixture.id};
  assert.equal(admitM1V171SourceWithHolds(
    initial,journal,forgedOrigin).ok,false);
  const stale=admitM1V171SourceWithHolds(
    initial,accepted.journal,prepared.request);
  assert.deepEqual(stale,{ok:false,error:'STALE_REVISION'});
  const altered=structuredClone(accepted.journal);
  altered.entries[0].source.checkpointMedical[0].playerId='phantom';
  assert.equal(validateM1V120Journal(initial,altered).ok,false);
  const unauthorized=structuredClone(prepared.request);
  unauthorized.trustedDecisions=[{kind:'medical-clearance'}];
  assert.equal(applyM1V120Source(initial,journal,unauthorized).ok,false);
});

test('v184 actual halftime manager change shares causal source and XI',()=>{
  let selected=null;
  const players=new Map(catalog.players.map(p=>[p.id,p]));
  for(let seed=1;seed<=24&&!selected;seed++){
    const {initial,journal}=career(seed);
    const base=prepareM1V184CausalMatch(initial,journal);
    if(!base?.ok)continue;
    const p=base.request.prematch;
    const own=p.fixture.homeClubId===initial.selectedClubId?
      p.homeLineup:p.awayLineup;
    const outPlayerId=own.starters.find(id=>
      players.get(id)?.primaryPosition!=='GK');
    const inPlayerId=own.bench.find(id=>
      players.get(id)?.primaryPosition!=='GK');
    if(!outPlayerId||!inPlayerId)continue;
    const proposed=prepareM1V184CausalMatch(initial,journal,[{
      outPlayerId,inPlayerId,elapsedSeconds:2700,
    }]);
    if(!proposed?.ok)continue;
    const admitted=admitM1V171SourceWithHolds(
      initial,journal,proposed.request);
    if(admitted.ok)selected={initial,journal,proposed,admitted,
      outPlayerId,inPlayerId};
  }
  assert.ok(selected,'no v184 lawful manager-selected causal source');
  assert.equal(selected.admitted.journal.revision,1);
  const subs=selected.proposed.request.plannedCommands.filter(c=>
    c.kind==='substitute-normal');
  assert.equal(subs.length,1);
  assert.equal(subs[0].commandId,'v184-sub-'+
    selected.proposed.fixture.id+'-0');
  assert.ok(selected.proposed.request.result.events.some(e=>
    e.type==='source'&&e.source.type==='physical-transition'&&
    e.source.source.type==='availability'&&
    e.source.source.source.entry.action.kind==='substitute-normal'&&
    e.source.source.source.entry.action.inPlayerId===selected.inPlayerId));
});
