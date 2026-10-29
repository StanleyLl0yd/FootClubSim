import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
export function researchFixtureSeedV87(fixtureId,index){
  if(typeof fixtureId!=='string'||!/^([ab]-[0-9]+-[0-9]+)$/.test(fixtureId)||
      !Number.isSafeInteger(index)||index<1||index>V87_FIXTURE_SEEDS)
    throw Error('INVALID_V87_FIXTURE_SEED');
  const hash=createHash('sha256').update(
    'FootClubSim-P5-v87-referee-fixture-separated-seed:'+fixtureId+':'+index
  ).digest();
  return hash.readUInt32BE(0)||1;
}

import {researchSeedFromIndex} from './m1-p5-v73-seed-coverage.mjs';
import {deriveM1V31CausalPhysicalExposure}
  from '../dist/core/m1-v24-physical-exposure.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import reference from '../data/rpl-2025-26-p5-shot-discipline-reference.json'
  with {type:'json'};

const SHARDS=16,PER_SHARD=15,SEEDS=8;
export const V87_FIXTURE_SEEDS=16;
const empty=()=>({attempted:0,accepted:0,rejected:0,shotEvents:0,
  openPlayGoals:0,sourceFirstYellows:0,sourceSecondYellowReds:0,
  sourceDirectReds:0,sourceGeneratedFoulStoppages:0,
  sourceGeneratedIncidents:0,sourceModelledWithdrawals:0});
const add=(to,row)=>{for(const k of Object.keys(to))to[k]+=row[k];};

export function v86Plans(){
  return Array.from({length:SHARDS},(_,group)=>({
    group,firstFixture:group*PER_SHARD+1,fixtureCount:PER_SHARD,
    seedsPerFixture:SEEDS,
  }));
}
export function runM1V86DisciplineSourceShard(group,mode='shared'){
  if(mode!=='shared'&&mode!=='fixture-domain-v87')
    throw Error('V87_INVALID_RESEARCH_MODE');
  const fixtureSeedMode=mode==='fixture-domain-v87';
  const seedCount=fixtureSeedMode?V87_FIXTURE_SEEDS:SEEDS;
  if(!Number.isSafeInteger(group)||group<0||group>=SHARDS)
    throw Error('V86_INVALID_GROUP');
  if(reference.regularSeason.matches!==240||
      reference.regularSeason.yellowCards!==1035||
      reference.regularSeason.redCards!==26||
      reference.regularSeason.penaltiesScored!==76||
      reference.regularSeason.shotsAll!==5548)
    throw Error('V86_REFERENCE_SCOPE_DRIFT');
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(catalog.clubs.map(x=>[x.id,x]));
  const all=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures);
  if(all.length!==240)throw Error('V86_INCOMPLETE_SYNTHETIC_CALENDAR');
  const fixtures=all.slice(group*PER_SHARD,(group+1)*PER_SHARD);
  if(fixtures.length!==PER_SHARD)throw Error('V86_BAD_FIXTURE_GROUP');
  const seeds=Array.from({length:seedCount},(_,i)=>researchSeedFromIndex(i+1));
  if(new Set(seeds).size!==seedCount)throw Error('V86_SEED_COLLISION');
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const total=empty(),perFixture=[],digest=createHash('sha256');
  const started=performance.now();
  for(const fixture of fixtures){
    const base={
      schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
      rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
      fixture,catalog,
      homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
      awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION,
    };
    const row=empty(),reasons={};
    for(let index=0;index<seedCount;index++){
      const seed=fixtureSeedMode?researchFixtureSeedV87(fixture.id,index+1):
        seeds[index];
      const replay=deriveM1V31CausalPhysicalExposure(
        {...base,rngSeed:seed},policy,[],[]);
      row.attempted++;total.attempted++;
      if(!replay.ok){
        row.rejected++;total.rejected++;
        reasons[replay.error]=(reasons[replay.error]??0)+1;
        digest.update(JSON.stringify({fixture:fixture.id,index:index+1,
          error:replay.error})+'\n');
        continue;
      }
      if(replay.fixtureId!==fixture.id||
          !replay.replayBoundPhysicalTime||
          replay.externalRefereeAuthorityAuthenticated!==false||
          replay.externalMedicalAuthorityAuthenticated!==false)
        throw Error('V86_SOURCE_REPLAY_INVARIANT');
      const generated=replay.source.source;
      if(generated.specialGoalsGenerated!==false)
        throw Error('V86_SPECIAL_GOAL_SCOPE_CHANGED');
      const match=generated.match,ref=match.sourceRefereeEffects;
      const physical=replay.physical.playerRows;
      const first=physical.reduce((v,p)=>v+p.firstYellowCards,0);
      const second=physical.reduce((v,p)=>v+p.secondYellowDismissals,0);
      const direct=physical.reduce((v,p)=>v+p.straightRedDismissals,0);
      const withdrawals=physical.reduce((v,p)=>
        v+p.permanentInjuryWithdrawals,0);
      if(first!==ref.yellow||second!==ref.secondYellowRed||
          direct!==ref.straightRed||
          withdrawals!==ref.injuryWithdrawn)
        throw Error('V86_REFEREE_PHYSICAL_CONSERVATION');
      const shots=match.events.filter(e=>e.kind==='shot').length;
      const goals=match.finalScore.home+match.finalScore.away;
      if(!Number.isSafeInteger(shots)||!Number.isSafeInteger(goals)||
          shots<goals||goals<0||
          !Number.isSafeInteger(match.generatedFoulStoppages)||
          !Array.isArray(generated.generatedIncidents))
        throw Error('V86_INVALID_SOURCE_EVENT_COUNTER');
      const counters={
        shotEvents:shots,openPlayGoals:goals,sourceFirstYellows:first,
        sourceSecondYellowReds:second,sourceDirectReds:direct,
        sourceGeneratedFoulStoppages:match.generatedFoulStoppages,
        sourceGeneratedIncidents:generated.generatedIncidents.length,
        sourceModelledWithdrawals:withdrawals,
      };
      row.accepted++;total.accepted++;
      for(const [k,value] of Object.entries(counters)){
        row[k]+=value;total[k]+=value;
      }
      digest.update(JSON.stringify({fixture:fixture.id,index:index+1,
        seed,...counters})+'\n');
    }
    if(row.attempted!==seedCount||row.accepted+row.rejected!==seedCount)
      throw Error('V86_FIXTURE_CONSERVATION');
    perFixture.push({fixtureId:fixture.id,
      homeClubId:fixture.homeClubId,awayClubId:fixture.awayClubId,
      round:fixture.round,...row,rejectionReasons:reasons});
  }
  if(total.attempted!==PER_SHARD*seedCount||
      total.accepted+total.rejected!==total.attempted||
      perFixture.length!==15)
    throw Error('V86_SHARD_CONSERVATION');
  return{
    schemaVersion:1,
    status:'P5_V86_GENERATED_DISCIPLINE_AND_FOUL_STOPPAGE_RESEARCH',
    fixtureGroup:group,firstFixture:group*PER_SHARD+1,
    fixtureCount:PER_SHARD,seedsPerFixture:seedCount,
    researchSeedStrategy:mode,
    modelEngineVersion:M1_ENGINE_VERSION,modelRngVersion:RNG_VERSION,
    modelScoreIncludesOnlyGeneratedOpenPlayGoals:true,
    independentlyGeneratedPenaltiesInThisDefaultPath:false,
    actualSourceShotsOnTarget:null,
    completePhysicalExposureReplay:true,
    externalRefereeAndMedicalAuthenticated:false,
    sourceFoulStoppagesAreNotAllRealWorldFouls:true,
    sourceCautionsMayNotMatchRealProviderCardTaxonomy:true,
    sourceInjuriesNotClinicalDiagnoses:true,
    reference:{regularSeasonMatches:240,realShots:5548,
      realYellowCards:1035,realRedCards:26,realFouls:6815,
      realPenaltiesRecorded:99,realPenaltiesScored:76},
    synthetic:total,perFixture,digestSha256:digest.digest('hex'),
    runtimeObservation:{elapsedMs:Math.round(
      (performance.now()-started)*1000)/1000},
    holdout2024_25Used:false,productionProbabilityOrRngModified:false,
    releaseCalibrationAccepted:false,
  };
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(argv.length!==3||!/^(?:[0-9]|1[0-5])$/.test(argv[2]))
      throw Error('V86_EXPECTED_GROUP_0_TO_15');
    process.stdout.write('V86_SHARD_RESULT='+JSON.stringify(
      runM1V86DisciplineSourceShard(Number(argv[2])))+'\n');
  }catch(error){
    process.stderr.write('V86_SHARD_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
