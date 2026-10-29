import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeM1V84MedicallyAndAutomaticallyEligibleLineups as propose}
  from '../dist/core/m1-v84-automatically-eligible-lineups.js';
import {deriveM1V82SourceBoundAvailableLineups as medicalProposal}
  from '../dist/core/m1-v82-source-bound-eligible-lineup.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V32ExposureJournal,applyM1V32ExposureBatch}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {deriveM1V31CausalPhysicalExposure}
  from '../dist/core/m1-v24-physical-exposure.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import {validateCatalog,validateLineup}
  from '../dist/core/validation.js';

const catalog=structuredClone(createSyntheticRplScaleCatalog(77));
const rounds=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id));
const next=rounds[1].fixtures[0],teamId=next.homeClubId;
const targetClub=catalog.clubs.find(c=>c.id===teamId);
const prototype=catalog.players.find(p=>p.id===targetClub.registeredPlayerIds[5]);
for(let number=24;number<=26;number++){
  const id=teamId+'-reserve-'+number;
  catalog.players.push({...structuredClone(prototype),id,
    displayName:'Extra Registered Reserve '+number,
    primaryPosition:'MC',foreignerForCompetition:false});
  targetClub.registeredPlayerIds.push(id);
}
assert.deepEqual(validateCatalog(catalog),[]);
assert.equal(targetClub.registeredPlayerIds.length,26);
const original=createInitialCareer(catalog,teamId,42,'m1-v95-reserve-pool');
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const players=new Map(catalog.players.map(p=>[p.id,p]));
const rules={starterCount:11,maxBench:12,maxForeignersOnField:7};
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const prematch=(fixture,seed)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:rules,rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});

test('v95 full registration recovers unseen reserves after source-replayed automatic ban',()=>{
  const initialState=startM1V32ExposureJournal(original);
  assert.equal(initialState.ok,true);
  const targetFirst=rounds[0].fixtures.find(f=>
    f.homeClubId===teamId||f.awayClubId===teamId);
  assert.ok(targetFirst);
  const relevant=new Set([next.homeClubId,next.awayClubId]);
  const commands=[];
  let bannedPlayerId=null;
  for(const [index,fixture] of rounds[0].fixtures.entries()){
    let accepted=null;
    for(let seed=1;seed<=512;seed++){
      const input=prematch(fixture,seed);
      const run=deriveM1V31CausalPhysicalExposure(input,policy,[],[]);
      if(!run.ok)continue;
      const playerRows=run.physical.playerRows;
      if(playerRows.some(p=>relevant.has(p.teamId)&&
          p.straightRedDismissals>0))continue;
      let banned=null;
      if(fixture.id===targetFirst.id){
        banned=playerRows.find(p=>p.teamId===teamId&&
          p.secondYellowDismissals>0&&
          p.permanentInjuryWithdrawals===0);
        if(!banned)continue;
      }
      accepted={input,run,banned};break;
    }
    assert.ok(accepted,'no suitable source-replayed fixture '+fixture.id);
    if(accepted.banned)bannedPlayerId=accepted.banned.playerId;
    commands.push({schemaVersion:6,commandId:'v95-first-'+index,
      careerId:original.careerId,expectedRevision:index,
      prematch:accepted.input,policy,halfTimeCommands:[],
      inPlayCommands:[],result:accepted.run});
  }
  assert.ok(bannedPlayerId);
  const applied=applyM1V32ExposureBatch(
    original,initialState.journal,commands,0);
  assert.equal(applied.ok,true,JSON.stringify(applied).slice(0,350));
  const medical=medicalProposal(original,applied.journal,next);
  assert.equal(medical.ok,true,JSON.stringify(medical).slice(0,350));
  const before=structuredClone(applied.journal);
  const nextInput=prematch(next,937);
  const result=propose(original,applied.journal,nextInput);
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,450));
  assert.ok(result.excludedAutomaticBanPlayers.includes(bannedPlayerId));
  assert.equal(result.subsequentV76AdmissionStillRequired,true);
  assert.equal(result.noMedicalRecoveryOrTreatmentGranted,true);
  const lineup=next.homeClubId===teamId?result.homeLineup:result.awayLineup;
  assert.ok(!lineup.starters.includes(bannedPlayerId));
  assert.ok(!lineup.bench.includes(bannedPlayerId));
  assert.equal(validateLineup(lineup,targetClub,players,rules).length,0);
  const excludedMed=new Set(medical.excludedMedicalPlayers
    .filter(x=>x.teamId===teamId).map(x=>x.playerId));
  const excludedBan=new Set(result.excludedAutomaticBanPlayers);
  const eligible=targetClub.registeredPlayerIds.filter(id=>
    !excludedMed.has(id)&&!excludedBan.has(id));
  assert.equal(lineup.bench.length,Math.min(12,eligible.length-11),
    'all eligible registered reserves must be considered after ban');
  const originalNamed=new Set([
    ...(next.homeClubId===teamId?medical.homeLineup:medical.awayLineup).starters,
    ...(next.homeClubId===teamId?medical.homeLineup:medical.awayLineup).bench]);
  if(eligible.length>=23){
    assert.ok([...lineup.starters,...lineup.bench].some(id=>
      !originalNamed.has(id)),
      'source-registered reserve beyond first M0 bench must be recovered');
  }
  assert.deepEqual(applied.journal,before);
});
