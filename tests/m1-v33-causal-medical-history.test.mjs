import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveM1V33CausalMedicalHistory as derive,
  verifyM1V33CausalMedicalHistory as verify}
  from '../dist/core/m1-v33-causal-medical-history.js';
import {startM1V32ExposureJournal as start,
  applyM1V32ExposureBatch as apply}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {deriveM1V31CausalPhysicalExposure}
  from '../dist/core/m1-v24-physical-exposure.js';
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
const career=createInitialCareer(catalog,catalog.clubs[0].id,42,
  'm1-v33-causal-history');
const all=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(round=>round.fixtures);
const first=all[0];
const second=all.find((f,index)=>index>0 &&
  [f.homeClubId,f.awayClubId].includes(first.homeClubId));
assert.ok(second);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
const ok=(r)=>{
  assert.equal(r.ok,true,JSON.stringify(r).slice(0,300));
  return r.journal ?? r;
};
function request(fixture,rev){
  const prematch={
    schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,
    homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:1,
  };
  let fallback=null,selected=null;
  for(let seed=1;seed<=128;seed++){
    prematch.rngSeed=seed;
    const result=deriveM1V31CausalPhysicalExposure(prematch,policy);
    if(!result.ok)continue;
    const evidence={prematch:structuredClone(prematch),
      result:structuredClone(result)};
    if(!fallback)fallback=evidence;
    if(result.source.assessments.length>0){
      selected=evidence;
      break;
    }
  }
  const chosen=selected??fallback;
  assert.ok(chosen,'no accepted source for '+fixture.id);
  return {
    schemaVersion:6,commandId:'v33-post-'+rev,
    careerId:career.careerId,expectedRevision:rev,
    prematch:chosen.prematch,policy,
    halfTimeCommands:[],inPlayCommands:[],result:chosen.result,
  };
}
let cached;
function two(){
  if(!cached){
    const initial=ok(start(career));
    const requests=[request(first,0),request(second,1)];
    const journal=ok(apply(career,initial,requests,0));
    cached={initial,requests,journal};
  }
  return structuredClone(cached);
}
test('empty schema-6 history does not fabricate medical or sanction state',()=>{
  const journal=ok(start(career));
  const view=ok(derive(career,journal));
  assert.equal(view.fixtureCount,0);
  assert.equal(view.playerFixtureRows,0);
  assert.equal(view.modelMedicalEpisodeCount,0);
  assert.deepEqual(view.players,[]);
  assert.deepEqual(view.episodes,[]);
  assert.equal(view.calendarChronologyAuthenticated,false);
  assert.equal(view.independentMedicalDiagnosisAuthenticated,false);
  assert.equal(view.medicalReturnAndClearanceAuthenticated,false);
  assert.equal(view.disciplinaryCarryoverAuthenticated,false);
  assert.equal(view.fatigueDeltasCalibrated,false);
  assert.equal(view.officialLeaguePointsAwarded,false);
  assert.equal(verify(career,journal,view),true);
});

test('every posted patient and player exposure derives only from historical source',()=>{
  const {journal}=two();
  const snapshot=structuredClone(journal);
  const view=ok(derive(career,journal));
  assert.equal(view.revision,2);
  assert.equal(view.fixtureCount,2);
  assert.equal(view.sourcePlayerFixtureRows,undefined);
  assert.equal(view.playerFixtureRows,
    journal.results.reduce((sum,x)=>sum+x.facts.playerRows.length,0));
  assert.equal(view.modelMedicalEpisodeCount,
    journal.results.reduce((sum,x)=>sum+x.facts.causalAssessments.length,0));
  assert.ok(view.modelMedicalEpisodeCount>0,'no seeded medical episode');
  assert.ok(view.players.some(p=>p.fixtureRecords===2),
    'repeat-team player not carried across posted matches');
  const fields=['physicalSeconds','shots','goals','firstYellowCards',
    'secondYellowDismissals','straightRedDismissals',
    'permanentInjuryWithdrawals','temporaryTreatmentExits',
    'temporaryTreatmentReturns','substitutionsIn','substitutionsOut'];
  for(const player of view.players){
    const sources=journal.results.flatMap(match=>
      match.facts.playerRows.filter(row=>row.teamId===player.teamId &&
        row.playerId===player.playerId).map(row=>({fixtureId:match.fixtureId,row})));
    assert.equal(player.fixtureRecords,sources.length);
    assert.equal(player.lastPostedFixtureId,sources.at(-1).fixtureId);
    assert.equal(player.onFieldAtLastPostedFixture,
      sources.at(-1).row.onFieldAtFullTime);
    for(const field of fields)assert.equal(player[field],
      sources.reduce((sum,x)=>sum+x.row[field],0));
    const patientEvents=view.episodes.filter(x=>
      x.patientTeamId===player.teamId&&x.patientPlayerId===player.playerId);
    assert.equal(player.modelOnFieldAssessments,
      patientEvents.filter(x=>x.transition==='on-field-quick').length);
    assert.equal(player.modelOffFieldAssessments,
      patientEvents.filter(x=>x.transition==='off-field-return').length);
    assert.equal(player.lastPostedMedicalFixtureId,
      patientEvents.at(-1)?.fixtureId??null);
    assert.equal(player.lastModelIncidentId,
      patientEvents.at(-1)?.incidentId??null);
  }
  for(const ep of view.episodes){
    const match=journal.results[ep.postedRevision-1];
    assert.equal(ep.fixtureId,match.fixtureId);
    const source=match.facts.causalAssessments.find(x=>
      x.incidentId===ep.incidentId);
    assert.ok(source);
    assert.equal(ep.patientPlayerId,source.patientPlayerId);
    assert.equal(ep.simulatedMedicalNeed,true);
    assert.equal(ep.externalMedicalAuthorityAuthenticated,false);
  }
  assert.deepEqual(journal,snapshot);
  assert.equal(verify(career,journal,view),true);
  assert.deepEqual(derive(career,journal),view);
});

test('poisoned patient, journal or claimed authority fails closed',()=>{
  const {journal}=two(),genuine=ok(derive(career,journal));
  const forgedPatient=structuredClone(genuine);
  forgedPatient.episodes[0].patientPlayerId='attacker';
  assert.equal(verify(career,journal,forgedPatient),false);
  assert.equal(verify(career,journal,
    {...genuine,medicalReturnAndClearanceAuthenticated:true}),false);
  const altered=structuredClone(journal);
  altered.results[0].facts.refereeRngState ^= 1;
  assert.deepEqual(derive(career,altered),{ok:false,error:'INVALID_JOURNAL'});
  assert.deepEqual(derive(career,{...journal,schemaVersion:5}),
    {ok:false,error:'INVALID_JOURNAL'});
  const getter=structuredClone(journal);
  let reads=0;
  Object.defineProperty(getter.results[0].facts,'causalAssessments',{
    enumerable:true,get(){reads++;return []},
  });
  assert.deepEqual(derive(career,getter),{ok:false,error:'INVALID_JOURNAL'});
  assert.equal(reads,0);
});
