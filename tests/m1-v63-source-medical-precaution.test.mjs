import test from 'node:test';
import assert from 'node:assert/strict';
import {admitM1V63SourceMedicalPrecaution as admit,
  simulateM1V63PrecautionGatedFixture as run,
  verifyM1V63PrecautionGatedFixture as verify}
  from '../dist/core/m1-v63-source-medical-precaution.js';
import {startM1V32ExposureJournal as start,
  applyM1V32ExposureBatch as apply}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {deriveM1V31CausalPhysicalExposure as source}
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
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const career=createInitialCareer(catalog,catalog.clubs[0].id,
  42,'m1-v63-two-club-precaution');
const rounds=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id));
const first=rounds[0].fixtures[0],next=rounds[1].fixtures[0];
const prior=rounds[0].fixtures.filter(f=>
  [next.homeClubId,next.awayClubId].some(id=>
    id===f.homeClubId||id===f.awayClubId));
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const prematch=(fixture,seed=1)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});
const ok=x=>{assert.equal(x.ok,true,JSON.stringify(x).slice(0,350));
  return x.journal??x;};
const empty=()=>ok(start(career));
function findGame(fixture,{injuryClub=null,withoutAnyInjury=false}={}){
  for(let seed=1;seed<=384;seed++){
    const p=prematch(fixture,seed),result=source(p,policy);
    if(!result.ok)continue;
    if(result.physical.playerRows.some(row=>
      row.straightRedDismissals||row.secondYellowDismissals))continue;
    const injuryRows=result.physical.playerRows.filter(row=>
      row.permanentInjuryWithdrawals>0);
    if(injuryClub!==null&&
        !injuryRows.some(row=>row.teamId===injuryClub))continue;
    if(withoutAnyInjury&&injuryRows.length>0)continue;
    return {p,result,injuryRows};
  }
  assert.fail('Cannot find fully replayed un-dismissed fixture '+fixture.id);
}
const make=(specs)=> {
  const commands=specs.map(({p,result},index)=>({
    schemaVersion:6,commandId:'v63-round-one-'+index,
    careerId:career.careerId,expectedRevision:index,
    prematch:p,policy,halfTimeCommands:[],inPlayCommands:[],result,
  }));
  return ok(apply(career,empty(),commands,0));
};
let blockFixture;
function withModelledWithdrawal(){
  if(blockFixture)return structuredClone(blockFixture);
  assert.ok(prior.length===1||prior.length===2);
  const club=[next.homeClubId,next.awayClubId].find(id=>
    id===prior[0].homeClubId||id===prior[0].awayClubId);
  assert.ok(club);
  const withInjury=findGame(prior[0],{injuryClub:club});
  const others=prior.slice(1).map(f=>
    findGame(f,{withoutAnyInjury:true}));
  const journal=make([withInjury,...others]);
  const injured=withInjury.injuryRows.find(r=>r.teamId===club);
  assert.ok(injured);
  blockFixture={club,journal,injured:injured.playerId,
    sourceFixture:prior[0].id};
  return structuredClone(blockFixture);
}

test('first round may play only after source-verified two-club medical precaution',()=>{
  const journal=empty(),before=structuredClone(journal);
  const accepted=admit(career,journal,prematch(first));
  assert.equal(accepted.ok,true);
  assert.equal(accepted.priorClubFixtures.home,null);
  assert.equal(accepted.priorClubFixtures.away,null);
  assert.equal(accepted.actualClinicalFitnessEstablished,false);
  assert.equal(accepted.modelledPrecautionIsNotMedicalClearance,true);
  let found;
  for(let seed=1;seed<=24;seed++){
    const p=prematch(first,seed),candidate=run(career,journal,p,policy);
    if(candidate.ok){found={p,candidate};break;}
  }
  assert.ok(found);
  assert.equal(found.candidate.game.fullReplayVerified,true);
  assert.equal(found.candidate.clinicalClearanceNotEstablished,true);
  assert.equal(verify(career,journal,found.p,policy,[],[],
    found.candidate),true);
  assert.equal(verify(career,journal,found.p,policy,[],[],
    {...found.candidate,clinicalClearanceNotEstablished:false}),false);
  assert.deepEqual(journal,before);
});

test('next fixture rejects a named player withdrawn in source-replayed previous club match',()=>{
  const {club,journal,injured,sourceFixture}=withModelledWithdrawal();
  const original=structuredClone(journal);
  const result=admit(career,journal,prematch(next));
  assert.equal(result.ok,false);
  assert.equal(result.error,club===next.homeClubId?
    'HOME_MODELLED_PRECAUTION':'AWAY_MODELLED_PRECAUTION');
  assert.equal(result.priorFixtureId,sourceFixture);
  assert.ok(result.affectedPlayerIds.includes(injured));
  const candidate=run(career,journal,prematch(next),policy);
  assert.equal(candidate.ok,false);
  assert.equal(candidate.error,result.error);
  assert.ok(candidate.affectedPlayerIds.includes(injured));
  assert.deepEqual(journal,original);
});

test('incomplete and forged injury histories reject without silently clearing',()=>{
  const missing=admit(career,empty(),prematch(next));
  assert.equal(missing.ok,false);
  assert.equal(missing.error,'HOME_DISCIPLINE_DENIED');
  const {journal}=withModelledWithdrawal();
  const fake=structuredClone(journal);
  const record=fake.results.find(row=>
    row.facts.playerRows.some(p=>p.permanentInjuryWithdrawals>0));
  assert.ok(record);
  const row=record.facts.playerRows.find(p=>p.permanentInjuryWithdrawals>0);
  row.permanentInjuryWithdrawals=0;
  assert.deepEqual(admit(career,fake,prematch(next)),
    {ok:false,error:'INVALID_JOURNAL'});
  let reads=0;
  const poison=structuredClone(journal);
  Object.defineProperty(poison.results[0].source.prematch,'fixture',{
    enumerable:true,get(){reads++;throw Error('getter');},
  });
  assert.equal(admit(career,poison,prematch(next)).ok,false);
  assert.equal(reads,0);
  assert.equal(admit(career,journal,null).ok,false);
});

test('fully replayed previous club rounds without permanent injury admit next game',()=>{
  const journal=make(prior.map(f=>
    findGame(f,{withoutAnyInjury:true})));
  const admitted=admit(career,journal,prematch(next));
  assert.equal(admitted.ok,true,JSON.stringify(admitted).slice(0,550));
  assert.deepEqual(admitted.affectedPriorWithdrawals,
    {home:[],away:[]});
  assert.equal(admitted.journalRevision,prior.length);
  assert.equal(admitted.noPriorFixtureModelledInjuryWithdrawnPlayerNamed,true);
});
