import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1V34CrossFixtureReview as derive,
  verifyM1V34CrossFixtureReview as verify }
  from '../dist/core/m1-v34-cross-fixture-review.js';
import { startM1V32ExposureJournal as start,
  applyM1V32ExposureBatch as apply }
  from '../dist/core/m1-v32-causal-medical-journal.js';
import { deriveM1V31CausalPhysicalExposure as simulate }
  from '../dist/core/m1-v24-physical-exposure.js';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const career=createInitialCareer(catalog,catalog.clubs[0].id,
  42,'m1-v34-review-career');
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(round=>round.fixtures);
const first=fixtures[0];
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
function input(fixture,seed){
  return {
    schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,
    homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
  };
}
function request(fixture,revision,choose){
  for(let seed=1;seed<=128;seed++){
    const prematch=input(fixture,seed);
    const result=simulate(prematch,policy);
    if(!result.ok || !choose(result))continue;
    return {
      schemaVersion:6,commandId:'review-fixture-'+revision,
      careerId:career.careerId,expectedRevision:revision,
      prematch,policy,halfTimeCommands:[],inPlayCommands:[],result,
    };
  }
  assert.fail('No matching accepted seeded game for '+fixture.id);
}
const ok=r=>{
  assert.equal(r.ok,true,JSON.stringify(r).slice(0,400));
  return r.journal??r;
};
let fixturePair;
function pair(){
  if(fixturePair)return structuredClone(fixturePair);
  const earlier=request(first,1,run=>run.physical.playerRows.some(row=>
    (row.permanentInjuryWithdrawals>0 ||
      row.secondYellowDismissals>0 ||
      row.straightRedDismissals>0) &&
    clubs.get(row.teamId).registeredPlayerIds.slice(0,11)
      .includes(row.playerId)));
  const patient=earlier.result.physical.playerRows.find(row=>
    (row.permanentInjuryWithdrawals>0 ||
      row.secondYellowDismissals>0 ||
      row.straightRedDismissals>0) &&
    clubs.get(row.teamId).registeredPlayerIds.slice(0,11)
      .includes(row.playerId));
  assert.ok(patient);
  const later=fixtures.find(f=>f.round>first.round &&
    (f.homeClubId===patient.teamId || f.awayClubId===patient.teamId));
  assert.ok(later);
  const newer=request(later,0,run=>run.physical.playerRows.some(row=>
    row.teamId===patient.teamId && row.playerId===patient.playerId &&
    row.physicalSeconds>0));
  const original=ok(start(career));
  // Explicitly post a later round FIRST, testing chronology != revision.
  const journal=ok(apply(career,original,[newer,earlier],0));
  fixturePair={journal,earlier,newer,patient};
  return structuredClone(fixturePair);
}

test('empty schema-6 state has no fictitious medical or discipline evidence',()=>{
  const journal=ok(start(career));
  const review=ok(derive(career,journal));
  assert.deepEqual(review.signals,[]);
  assert.deepEqual(review.laterPhysicalAppearances,[]);
  assert.equal(review.fixtureCount,0);
  assert.equal(review.fullSourceReplayVerified,true);
  assert.equal(review.syntheticRoundOrderVerified,true);
  assert.equal(review.officialCalendarAuthenticated,false);
  assert.equal(review.medicalDiagnosisOrClearanceAuthenticated,false);
  assert.equal(review.disciplinarySanctionsAuthenticated,false);
  assert.equal(review.playerEligibilityVerified,false);
  assert.equal(review.fatigueCalibrated,false);
  assert.equal(verify(career,journal,review),true);
});

test('physical return review follows source round, never posting order',()=>{
  const {journal,earlier,newer,patient}=pair();
  const before=structuredClone(journal);
  const view=ok(derive(career,journal));
  assert.equal(view.revision,2);
  assert.equal(view.fixtureCount,2);
  const signal=view.signals.find(x=>x.fixtureId===earlier.prematch.fixture.id &&
    x.teamId===patient.teamId && x.playerId===patient.playerId);
  assert.ok(signal);
  assert.equal(signal.round,earlier.prematch.fixture.round);
  assert.equal(signal.postedRevision,2);
  assert.equal(signal.permanentInjuryWithdrawals,
    patient.permanentInjuryWithdrawals);
  assert.equal(signal.secondYellowDismissals,patient.secondYellowDismissals);
  assert.equal(signal.straightRedDismissals,patient.straightRedDismissals);
  const later=view.laterPhysicalAppearances.find(x=>
    x.fixtureId===newer.prematch.fixture.id &&
    x.teamId===patient.teamId && x.playerId===patient.playerId);
  assert.ok(later);
  assert.equal(later.postedRevision,1);
  assert.ok(later.round>signal.round);
  assert.equal(later.physicalSeconds,
    newer.result.physical.playerRows.find(x=>
      x.teamId===patient.teamId&&x.playerId===patient.playerId).physicalSeconds);
  assert.equal(later.afterWithdrawalFixtureId,
    patient.permanentInjuryWithdrawals>0 ? signal.fixtureId:null);
  assert.equal(later.afterDismissalFixtureId,
    patient.secondYellowDismissals+patient.straightRedDismissals>0 ?
      signal.fixtureId:null);
  assert.equal(view.medicalDiagnosisOrClearanceAuthenticated,false);
  assert.equal(view.disciplinarySanctionsAuthenticated,false);
  assert.equal(view.playerEligibilityVerified,false);
  assert.equal(verify(career,journal,view),true);
  assert.deepEqual(derive(career,journal),view);
  assert.deepEqual(journal,before);
});

test('spoofed evidence, chronology, authority or journal cannot pass verification',()=>{
  const {journal}=pair();
  const genuine=ok(derive(career,journal));
  const forged=structuredClone(genuine);
  forged.signals[0].round+=1;
  assert.equal(verify(career,journal,forged),false);
  const future=structuredClone(genuine);
  future.laterPhysicalAppearances[0].afterDismissalFixtureId='fake';
  assert.equal(verify(career,journal,future),false);
  assert.equal(verify(career,journal,
    {...genuine,playerEligibilityVerified:true}),false);
  const corrupted=structuredClone(journal);
  corrupted.results[0].facts.playerRows[0].physicalSeconds++;
  assert.deepEqual(derive(career,corrupted),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.deepEqual(derive(career,{...journal,schemaVersion:5}),
    {ok:false,error:'INVALID_JOURNAL'});
  let getterReads=0;
  const getter=structuredClone(journal);
  Object.defineProperty(getter.results[0].source.prematch,'fixture',{
    enumerable:true,get(){getterReads++;return null;},
  });
  assert.deepEqual(derive(career,getter),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.equal(getterReads,0);
});
