import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1V31CausalPhysicalExposure as derive,
  verifyM1V31CausalPhysicalExposure as verify,
  deriveM1V24PhysicalExposure as legacyV24,
  verifyM1V24PhysicalExposure as verifyV24 }
  from '../dist/core/m1-v24-physical-exposure.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
const prematch=(fixture,seed)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,
  homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});

test('v31 physical seconds and medical exits derive from exact v29 source events',()=>{
  let accepted=0,quick=0,offField=0;
  for(let seed=1;seed<=128;seed++){
    const input=prematch(fixtures[0],seed);
    const run=derive(input,policy);
    if(!run.ok){
      assert.ok(['SOURCE_MATCH_REJECTED','REFEREE_REPLAY_MISMATCH']
        .includes(run.error),JSON.stringify(run));
      continue;
    }
    accepted++;
    assert.equal(run.fixtureId,fixtures[0].id);
    assert.equal(run.source.careerJournalIntegrated,false);
    assert.equal(run.careerJournalIntegrated,false);
    assert.equal(run.replayBoundPhysicalTime,true);
    assert.equal(run.realWorldInjuryAuthenticated,false);
    assert.equal(run.externalMedicalAuthorityAuthenticated,false);
    assert.equal(run.crossFixtureFitnessAndSanctionsCalibrated,false);
    assert.equal(run.physical.playingSeconds,5400);
    assert.equal(run.source.source.refereeRngDraws,90);
    assert.equal(run.source.source.treatmentRngDraws,54);
    assert.equal(run.source.source.match.rngDraws,90);
    assert.equal(verify(input,policy,[],[],run),true);
    assert.deepEqual(derive(input,policy),run);
    const rows=run.physical.playerRows;
    for(const side of ['home','away']){
      const teamId=side==='home'?fixtures[0].homeClubId:
        fixtures[0].awayClubId;
      const total=rows.filter(x=>x.teamId===teamId)
        .reduce((n,x)=>n+x.physicalSeconds,0);
      assert.equal(total,run.physical.teamPhysicalPlayerSeconds[side]);
      assert.ok(total>=7*5400&&total<=11*5400);
    }
    const physicalExitCount=rows.reduce((n,x)=>
      n+x.temporaryTreatmentExits,0);
    const physicalReturnCount=rows.reduce((n,x)=>
      n+x.temporaryTreatmentReturns,0);
    assert.equal(physicalExitCount,
      run.source.source.syntheticTemporaryExitCount);
    assert.equal(physicalReturnCount,
      run.source.source.syntheticTemporaryReturnCount);
    for(const assessment of run.source.assessments){
      const patient=rows.find(x=>x.playerId===assessment.patientPlayerId &&
        x.teamId===assessment.patientTeamId);
      assert.ok(patient);
      if(assessment.transition==='on-field-quick'){
        quick++;
        assert.equal(assessment.medicalExitEventId,null);
      }else{
        offField++;
        assert.ok(patient.temporaryTreatmentExits>0);
        assert.ok(patient.temporaryTreatmentReturns>0);
      }
    }
  }
  assert.ok(accepted>=8);
  assert.ok(quick>0);
  assert.ok(offField>0);
});

test('legacy v24 simulator and verification retain historical source contract',()=>{
  for(const seed of [1,3,7,11,17,41]){
    const input=prematch(fixtures[0],seed);
    const prior=legacyV24(input,policy);
    if(!prior.ok)continue;
    assert.equal(prior.schemaVersion,1);
    assert.equal(prior.match.causalAssessments,undefined);
    assert.equal(verifyV24(input,policy,[],[],prior),true);
    assert.deepEqual(legacyV24(input,policy),prior);
  }
});

test('v31 rejects forged exposure, decision, authority and malformed source',()=>{
  assert.equal(derive(null,policy).error,'INVALID_SOURCE');
  const sample=Array.from({length:128},(_,i)=>({
    seed:i+1,result:derive(prematch(fixtures[0],i+1),policy),
  })).find(x=>x.result.ok && x.result.source.assessments.length>0);
  assert.ok(sample);
  const input=prematch(fixtures[0],sample.seed);
  const genuine=sample.result;
  const forgedExposure=structuredClone(genuine);
  forgedExposure.physical.playerRows[0].physicalSeconds++;
  assert.equal(verify(input,policy,[],[],forgedExposure),false);
  const forgedAuthority=structuredClone(genuine);
  forgedAuthority.externalMedicalAuthorityAuthenticated=true;
  assert.equal(verify(input,policy,[],[],forgedAuthority),false);
  const forgedDecision=structuredClone(genuine);
  forgedDecision.source.assessments[0].patientPlayerId='fake-person';
  assert.equal(verify(input,policy,[],[],forgedDecision),false);
  const poisonedInput=structuredClone(input);
  let accesses=0;
  Object.defineProperty(poisonedInput,'fixture',{
    enumerable:true,get(){accesses++;return fixtures[0]},
  });
  assert.equal(derive(poisonedInput,policy).error,'INVALID_SOURCE');
  assert.equal(accesses,0);
});
