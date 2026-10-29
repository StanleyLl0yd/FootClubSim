import test from 'node:test';
import assert from 'node:assert/strict';
import {commitM1V75MedicallyGatedFixture as commit}
  from '../dist/core/m1-v75-medical-admission-commit.js';
import {startM1V32ExposureJournal as start,
  applyM1V32ExposureBatch as apply,
  validateM1V32ExposureJournal as check}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {deriveM1V31CausalPhysicalExposure as source}
  from '../dist/core/m1-v24-physical-exposure.js';
import {createInitialCareer} from '../dist/core/save.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
const catalog=createSyntheticRplScaleCatalog(77);
const career=createInitialCareer(catalog,catalog.clubs[0].id,42,'m1-v75-commit');
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const rounds=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id));
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const empty=()=>{const r=start(career);assert.equal(r.ok,true);return r.journal;};
const prematch=(fixture,seed=1)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,
  homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed});
function firstValid(fixture,revision,journal){
  for(let seed=1;seed<=128;seed++){
    const p=prematch(fixture,seed),result=source(p,policy);
    if(!result.ok)continue;
    const proposed={schemaVersion:6,
      commandId:'m1-v75-command-'+revision,
      careerId:career.careerId,expectedRevision:revision,
      prematch:p,policy,halfTimeCommands:[],inPlayCommands:[],result};
    const outcome=commit(career,journal,proposed,revision);
    if(outcome.ok)return {proposed,outcome};
  }
  assert.fail('No v75 admissible source match');
}
test('v75 gates and appends one source-verified match using the same CAS revision',()=>{
  const journal=empty(),before=structuredClone(journal);
  const {proposed,outcome}=firstValid(rounds[0].fixtures[0],0,journal);
  assert.equal(outcome.journal.revision,1);
  assert.equal(outcome.previousRevision,0);
  assert.equal(outcome.fixtureId,proposed.prematch.fixture.id);
  assert.equal(outcome.durableIndexedDbCasCommitted,false);
  assert.equal(outcome.officialMedicalAndKdkAuthorityAuthenticated,false);
  assert.equal(check(career,outcome.journal).ok,true);
  assert.deepEqual(journal,before);
  assert.deepEqual(commit(career,journal,proposed,0),outcome);
  assert.deepEqual(commit(career,journal,proposed,1),
    {ok:false,error:'CAS_REVISION_MISMATCH'});
});
test('v75 rejects altered result and forged admission metadata without mutations',()=>{
  const journal=empty(),before=structuredClone(journal);
  const {proposed}=firstValid(rounds[0].fixtures[0],0,journal);
  const altered=structuredClone(proposed);
  altered.result.fixtureId='forged-fixture';
  assert.deepEqual(commit(career,journal,altered,0),
    {ok:false,error:'CLAIMED_SOURCE_RESULT_MISMATCH'});
  assert.equal(commit(career,journal,{...proposed,other:'untrusted'},0).error,
    'INVALID_INPUT');
  assert.deepEqual(journal,before);
});
test('v75 blocks currently held modelled injured player at the actual commit gate',()=>{
  const later=rounds[1].fixtures[0];
  const previous=rounds[0].fixtures.find(f=>f.homeClubId===later.homeClubId||
    f.awayClubId===later.homeClubId);
  assert.ok(previous);
  let past=null;
  for(let seed=1;seed<=128;seed++){
    const p=prematch(previous,seed),result=source(p,policy);
    if(!result.ok)continue;
    if(!result.physical.playerRows.some(row=>
      row.teamId===later.homeClubId&&row.permanentInjuryWithdrawals===1))
      continue;
    past={prematch:p,result};break;
  }
  assert.ok(past,'Need deterministic original source with home-club withdrawal');
  const initial=empty();
  const applied=apply(career,initial,[{
    schemaVersion:6,commandId:'m1-v75-prior-injury',
    careerId:career.careerId,expectedRevision:0,prematch:past.prematch,
    policy,halfTimeCommands:[],inPlayCommands:[],result:past.result,
  }],0);
  assert.equal(applied.ok,true);
  let blocked=false;
  for(let seed=1;seed<=64;seed++){
    const p=prematch(later,seed),result=source(p,policy);
    if(!result.ok)continue;
    const proposed={schemaVersion:6,commandId:'m1-v75-held-attempt',
      careerId:career.careerId,expectedRevision:1,
      prematch:p,policy,halfTimeCommands:[],inPlayCommands:[],result};
    const before=structuredClone(applied.journal);
    const rejected=commit(career,applied.journal,proposed,1);
    if(rejected.error==='ADMISSION_DENIED'&&
        rejected.gateError==='CURRENT_MODELLED_MEDICAL_HOLD'){
      assert.deepEqual(applied.journal,before);blocked=true;break;
    }
  }
  assert.equal(blocked,true);
});
