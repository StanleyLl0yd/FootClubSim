import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V63UnresolvedMedicalHoldFixture as run,
  verifyM1V63UnresolvedMedicalHoldFixture as verify}
  from '../dist/core/m1-v63-unresolved-medical-hold.js';
import {startM1V32ExposureJournal as start,
  applyM1V32ExposureBatch as apply}
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
const career=createInitialCareer(catalog,catalog.clubs[0].id,42,
  'm1-v63-modelled-medical-hold');
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const rounds=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id));
const first=rounds[0].fixtures[0];
const second=rounds[1].fixtures[0];
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
function input(fixture,seed=42){
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
const get=result=>{
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,250));
  return result.journal;
};
const empty=()=>get(start(career));
function acceptablePast(fixture,requiresInjury){
  for(let seed=1;seed<=128;seed++){
    const prematch=input(fixture,seed);
    const result=source(prematch,policy);
    if(!result.ok)continue;
    const rows=result.physical.playerRows;
    if(rows.some(row=>row.straightRedDismissals>0||
        row.secondYellowDismissals>0))continue;
    const injured=rows.filter(row=>
      row.permanentInjuryWithdrawals>0);
    if(requiresInjury&&injured.length===0)continue;
    return {prematch,result,injured};
  }
  assert.fail('No validated generated medical test source: '+fixture.id);
}
let cached;
function historyWithInjury(){
  if(cached)return structuredClone(cached);
  const needed=rounds[0].fixtures.filter(f=>
    [second.homeClubId,second.awayClubId].some(teamId=>
      f.homeClubId===teamId||f.awayClubId===teamId));
  assert.ok(needed.length>=1&&needed.length<=2);
  const commands=[];
  let injured=[];
  for(const [index,fixture] of needed.entries()){
    const candidate=acceptablePast(fixture,index===0);
    const relevant=candidate.injured.filter(row=>
      row.teamId===second.homeClubId||row.teamId===second.awayClubId);
    if(index===0)assert.ok(relevant.length>0);
    injured=[...injured,...relevant];
    commands.push({
      schemaVersion:6,commandId:'v63-medical-source-'+index,
      careerId:career.careerId,expectedRevision:index,
      prematch:candidate.prematch,policy,halfTimeCommands:[],
      inPlayCommands:[],result:candidate.result,
    });
  }
  assert.ok(injured.length>0);
  const journal=get(apply(career,empty(),commands,0));
  cached={journal,injured};
  return structuredClone(cached);
}
function currentWithoutHeldPlayers(sourceInput,injured){
  const next=structuredClone(sourceInput);
  const held=new Map();
  for(const row of injured){
    const set=held.get(row.teamId)??new Set();
    set.add(row.playerId);held.set(row.teamId,set);
  }
  for(const teamId of [second.homeClubId,second.awayClubId]){
    const sheet=teamId===second.homeClubId?
      next.homeLineup:next.awayLineup;
    const blocked=held.get(teamId)??new Set();
    for(const player of [...blocked]){
      if(!sheet.starters.includes(player))continue;
      const replacement=sheet.bench.find(id=>!blocked.has(id)&&
        Number(id.split('-').at(-1))<=17);
      assert.ok(replacement,'No available non-foreign bench replacement');
      sheet.starters=sheet.starters.map(id=>
        id===player?replacement:id);
      sheet.bench=sheet.bench.filter(id=>id!==replacement);
    }
    sheet.bench=sheet.bench.filter(id=>!blocked.has(id));
    assert.equal(new Set([...sheet.starters,...sheet.bench]).size,
      sheet.starters.length+sheet.bench.length);
  }
  return next;
}
test('source-replayed withdrawal blocks both XI and named bench before any match',()=>{
  const {journal,injured}=historyWithInjury();
  const before=structuredClone(journal);
  const result=run(career,journal,input(second),policy);
  assert.equal(result.ok,false);
  assert.equal(result.error,'CURRENT_MODELLED_MEDICAL_HOLD');
  assert.equal(result.affectedFixtureId,second.id);
  assert.ok(injured.some(row=>result.affectedPlayerIds.includes(row.playerId)));
  assert.ok([second.homeClubId,second.awayClubId]
    .includes(result.affectedTeamId));
  assert.deepEqual(journal,before);
});
test('omitting the injured player does not automatically clear the hold',()=>{
  const {journal,injured}=historyWithInjury();
  const fresh=currentWithoutHeldPlayers(input(second),injured);
  let accepted=null;
  for(let seed=1;seed<=24;seed++){
    const prematch={...fresh,rngSeed:seed};
    const match=source(prematch,policy);
    if(!match.ok)continue;
    const result=run(career,journal,prematch,policy);
    if(result.ok){accepted={prematch,result};break;}
  }
  assert.ok(accepted,'No eligible v63 source replay with held player omitted');
  const {prematch,result}=accepted;
  assert.equal(result.schemaVersion,1);
  assert.ok(result.pendingMedicalHolds.length>=1);
  assert.equal(result.sourceCareerFullyReplayed,true);
  assert.equal(result.bothCurrentNamedLineupsChecked,true);
  assert.equal(result.result.match.replayBoundPhysicalTime,true);
  assert.equal(result.medicalClearanceProtocolImplemented,false);
  assert.equal(result.actualRecoveryOrFitnessVerified,false);
  assert.equal(result.officialInjuryDiagnosesAuthenticated,false);
  assert.equal(result.changesPersisted,false);
  assert.equal(verify(career,journal,prematch,policy,[],[],result),true);
  assert.equal(verify(career,journal,prematch,policy,[],[],
    {...result,actualRecoveryOrFitnessVerified:true}),false);
  assert.deepEqual(result,run(career,journal,prematch,policy));
});
test('source alteration, omitted history and malicious input fail closed',()=>{
  const {journal}=historyWithInjury();
  const altered=structuredClone(journal);
  altered.results[0].facts.playerRows[0].physicalSeconds++;
  assert.deepEqual(run(career,altered,input(second),policy),
    {ok:false,error:'INVALID_INITIAL_OR_JOURNAL'});
  const missing=run(career,empty(),input(second),policy);
  assert.equal(missing.ok,false);
  assert.equal(missing.error,'DISCIPLINE_OR_MATCH_DENIED');
  assert.equal(missing.underlyingError,'HOME_DISCIPLINE_DENIED');
  assert.deepEqual(run(career,journal,null,policy),
    {ok:false,error:'INVALID_INPUT'});
  let reads=0;
  const evil=structuredClone(journal);
  Object.defineProperty(evil.results[0].source.prematch,'fixture',{
    enumerable:true,get(){reads++;throw Error('evil');},
  });
  assert.equal(run(career,evil,input(second),policy).ok,false);
  assert.equal(reads,0);
});
test('first fixture starts with no phantom source medical holds',()=>{
  const journal=empty();
  let good=null;
  for(let seed=1;seed<=24;seed++){
    const prematch=input(first,seed);
    const actual=source(prematch,policy);
    if(!actual.ok)continue;
    const result=run(career,journal,prematch,policy);
    if(result.ok){good=result;break;}
  }
  assert.ok(good,'At least one first fixture should replay');
  assert.deepEqual(good.pendingMedicalHolds,[]);
  assert.equal(good.result.sameJournalForBothClubs,true);
});

test('previously withdrawn player cannot be laundered through a committed later XI or bench',()=>{
  const {journal,injured}=historyWithInjury();
  const held=injured.find(row=>
    row.teamId===second.homeClubId||row.teamId===second.awayClubId);
  assert.ok(held,'replayed first-round withdrawal must affect second round');
  const future=rounds[2].fixtures.find(f=>
    f.homeClubId===held.teamId||f.awayClubId===held.teamId);
  assert.ok(future,'same club must have a subsequent scheduled match');
  for(const benchOnly of [false,true]){
    let candidate=null;
    for(let seed=1;seed<=64;seed++){
      const prematch=input(second,seed);
      const lineup=held.teamId===second.homeClubId?
        prematch.homeLineup:prematch.awayLineup;
      assert.ok(lineup.starters.includes(held.playerId),
        'historically withdrawn player begins in original XI');
      if(benchOnly){
        const substitute=lineup.bench.find(id=>
          Number(id.split('-').at(-1))<=17);
        assert.ok(substitute,'eligible player required for bench-only bypass');
        lineup.starters=lineup.starters.map(id=>
          id===held.playerId?substitute:id);
        lineup.bench=lineup.bench.map(id=>
          id===substitute?held.playerId:id);
        assert.ok(!lineup.starters.includes(held.playerId));
        assert.ok(lineup.bench.includes(held.playerId));
      }
      const replay=source(prematch,policy);
      if(replay.ok){candidate={prematch,replay};break;}
    }
    assert.ok(candidate,'fully source-replayed historical eligibility breach');
    const posted=get(apply(career,journal,[{
      schemaVersion:6,
      commandId:benchOnly?'v72-history-medical-bench':'v72-history-medical-xi',
      careerId:career.careerId,expectedRevision:journal.revision,
      prematch:candidate.prematch,policy,
      halfTimeCommands:[],inPlayCommands:[],
      result:candidate.replay,
    }],journal.revision));
    const before=structuredClone(posted);
    const rejected=run(career,posted,input(future),policy);
    assert.equal(rejected.ok,false);
    assert.equal(rejected.error,'HISTORICAL_UNRESOLVED_MEDICAL_CONFLICT');
    assert.equal(rejected.affectedFixtureId,second.id);
    assert.equal(rejected.affectedTeamId,held.teamId);
    assert.ok(rejected.affectedPlayerIds.includes(held.playerId));
    assert.deepEqual(posted,before);
  }
});
