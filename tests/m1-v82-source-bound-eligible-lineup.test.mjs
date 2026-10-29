import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {startM1V32ExposureJournal,applyM1V32ExposureBatch}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {deriveM1V82SourceBoundAvailableLineups as propose}
  from '../dist/core/m1-v82-source-bound-eligible-lineup.js';
import {simulateM1V63UnresolvedMedicalHoldFixture}
  from '../dist/core/m1-v63-unresolved-medical-hold.js';
import {deriveM1V31CausalPhysicalExposure}
  from '../dist/core/m1-v24-physical-exposure.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import {validateLineup} from '../dist/core/validation.js';

const catalog=createSyntheticRplScaleCatalog(77);
const initial=createInitialCareer(catalog,catalog.clubs[0].id,42,
  'm1-v82-test-career');
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const clubMap=new Map(catalog.clubs.map(c=>[c.id,c]));
const players=new Map(catalog.players.map(p=>[p.id,p]));
const rules={starterCount:11,maxBench:12,maxForeignersOnField:7};
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const empty=startM1V32ExposureJournal(initial);
assert.equal(empty.ok,true);
function prematch(fixture,seed){
  return {schemaVersion:MATCH_LEDGER_VERSION,
    engineVersion:M1_ENGINE_VERSION,rulesPackId:M0_RULES_PACK_ID,
    rulesPackVersion:M0_RULES_PACK_VERSION,fixture,catalog,
    homeLineup:defaultSyntheticLineup(clubMap.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(clubMap.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:rules,rngAlgorithmVersion:RNG_VERSION,rngSeed:seed};
}

test('v82 no-history source-bound proposal reproduces unchanged registered XI',()=>{
  const fixture=fixtures[0],run=propose(initial,empty.journal,fixture);
  assert.equal(run.ok,true);
  assert.equal(run.excludedMedicalPlayers.length,0);
  assert.deepEqual(run.homeLineup,
    defaultSyntheticLineup(clubMap.get(fixture.homeClubId)));
  assert.deepEqual(run.awayLineup,
    defaultSyntheticLineup(clubMap.get(fixture.awayClubId)));
  assert.equal(run.subsequentV76AdmissionStillRequired,true);
  assert.equal(run.medicalRecoveryOrTreatmentGranted,false);
});

test('v82 rejects tampered source journals, invented fixtures, invalid inputs',()=>{
  const f=fixtures[0];
  assert.equal(propose(initial,{...empty.journal,revision:1},f).error,
    'INVALID_SOURCE_JOURNAL');
  assert.equal(propose(initial,empty.journal,{...f,round:99}).error,
    'UNKNOWN_OR_TAMPERED_FIXTURE');
  assert.equal(propose(initial,empty.journal,null).error,'INVALID_INPUT');
});

test('v82 excludes source-replayed withdrawn player from both bench and XI',()=>{
  const previous=fixtures[0];
  let seedResult=null,held=null;
  for(let seed=1;seed<=128;seed++){
    const source=prematch(previous,seed);
    const result=deriveM1V31CausalPhysicalExposure(source,policy,[],[]);
    if(!result.ok)continue;
    const injured=result.physical.playerRows.find(p=>
      p.permanentInjuryWithdrawals===1);
    if(injured){seedResult={source,result};held=injured;break;}
  }
  assert.ok(seedResult,'a deterministic seed must yield modelled withdrawal');
  const applied=applyM1V32ExposureBatch(initial,empty.journal,[{
    schemaVersion:6,commandId:'v82-medical-evidence',
    careerId:initial.careerId,expectedRevision:0,
    prematch:seedResult.source,policy,halfTimeCommands:[],
    inPlayCommands:[],result:seedResult.result,
  }]);
  assert.equal(applied.ok,true);
  const future=fixtures.find(f=>f.round===2&&
    [f.homeClubId,f.awayClubId].includes(held.teamId));
  assert.ok(future);
  const suggested=propose(initial,applied.journal,future);
  assert.equal(suggested.ok,true);
  assert.equal(suggested.journalRevision,1);
  assert.ok(suggested.excludedMedicalPlayers.some(x=>
    x.playerId===held.playerId&&x.teamId===held.teamId&&
    x.sourceFixtureId===previous.id));
  const side=future.homeClubId===held.teamId?
    suggested.homeLineup:suggested.awayLineup;
  assert.ok(!side.starters.includes(held.playerId));
  assert.ok(!side.bench.includes(held.playerId));
  assert.equal(validateLineup(suggested.homeLineup,
    clubMap.get(future.homeClubId),players,rules).length,0);
  assert.equal(validateLineup(suggested.awayLineup,
    clubMap.get(future.awayClubId),players,rules).length,0);
  const raw=prematch(future,101);
  const defaultAdmission=simulateM1V63UnresolvedMedicalHoldFixture(
    initial,applied.journal,raw,policy);
  assert.equal(defaultAdmission.ok,false);
  assert.equal(defaultAdmission.error,'CURRENT_MODELLED_MEDICAL_HOLD');
  const safeAdmission=simulateM1V63UnresolvedMedicalHoldFixture(
    initial,applied.journal,{...raw,
      homeLineup:suggested.homeLineup,awayLineup:suggested.awayLineup},policy);
  assert.notEqual(safeAdmission.error,'CURRENT_MODELLED_MEDICAL_HOLD');
  assert.notEqual(safeAdmission.error,'HISTORICAL_UNRESOLVED_MEDICAL_CONFLICT');
});
