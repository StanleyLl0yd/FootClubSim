import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
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
import reference from '../data/rpl-2025-26-p5-reference.json' with {type:'json'};

const SHARDS=16,FIXTURES_PER_SHARD=15,SEEDS_PER_FIXTURE=16;
export function v81BalancedPlans(){
  return Array.from({length:SHARDS},(_,g)=>({
    fixtureGroup:g,firstFixture:g*FIXTURES_PER_SHARD+1,
    fixtureCount:FIXTURES_PER_SHARD,seedCount:SEEDS_PER_FIXTURE,
  }));
}
const validGroup=g=>Number.isSafeInteger(g)&&g>=0&&g<SHARDS;
export function runM1V81BalancedScoreShard(fixtureGroup){
  if(!validGroup(fixtureGroup))throw Error('INVALID_V81_FIXTURE_GROUP');
  if(reference.reference.matches!==240||
      reference.reference.homeWins!==109||
      reference.reference.awayWins!==64||
      reference.reference.drawnMatches!==67||
      reference.reference.goalsAllTypes!==609||
      reference.reference.scorelessFullTimeMatches!==15){
    throw Error('V81_REFERENCE_SCOPE_INVALID');
  }
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubMap=new Map(catalog.clubs.map(c=>[c.id,c]));
  const allFixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(round=>round.fixtures);
  if(allFixtures.length!==240)throw Error('V81_FULL_CALENDAR_MISSING');
  const first=fixtureGroup*FIXTURES_PER_SHARD;
  const fixtures=allFixtures.slice(first,first+FIXTURES_PER_SHARD);
  if(fixtures.length!==FIXTURES_PER_SHARD)
    throw Error('V81_SHARD_FIXTURE_COVERAGE_INVALID');
  const seeds=Array.from({length:SEEDS_PER_FIXTURE},(_,i)=>
    researchSeedFromIndex(i+1));
  if(new Set(seeds).size!==SEEDS_PER_FIXTURE)
    throw Error('V81_MAPPED_SEED_COLLISION');
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const blank=()=>({attempted:0,accepted:0,rejected:0,homeWins:0,
    draws:0,awayWins:0,zeroZero:0,goals:0,homeGoals:0,awayGoals:0,
    shots:0,medicalWithdrawals:0});
  const total=blank(),perFixture=[],digest=createHash('sha256');
  const started=performance.now(),heapBefore=process.memoryUsage().heapUsed;
  for(const fixture of fixtures){
    const prematch={
      schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
      rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
      fixture,catalog,
      homeLineup:defaultSyntheticLineup(clubMap.get(fixture.homeClubId)),
      awayLineup:defaultSyntheticLineup(clubMap.get(fixture.awayClubId)),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION,
    };
    const row=blank(),errors={};
    for(let i=0;i<SEEDS_PER_FIXTURE;i++){
      const index=i+1,seed=seeds[i];
      const result=deriveM1V31CausalPhysicalExposure(
        {...prematch,rngSeed:seed},policy,[],[]);
      row.attempted++;total.attempted++;
      if(!result.ok){
        row.rejected++;total.rejected++;
        errors[result.error]=(errors[result.error]??0)+1;
        digest.update(JSON.stringify({fixtureId:fixture.id,index,
          error:result.error})+'\n');
        continue;
      }
      if(result.fixtureId!==fixture.id||
          result.replayBoundPhysicalTime!==true||
          result.externalRefereeAuthorityAuthenticated!==false||
          result.externalMedicalAuthorityAuthenticated!==false){
        throw Error('V81_REPLAY_BOUNDARY_FAILED');
      }
      const match=result.source.source.match,h=match.finalScore.home,
        a=match.finalScore.away;
      if(!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||
          h<0||a<0||h+a>40||!Array.isArray(match.events))
        throw Error('V81_INVALID_FINAL_SCORE');
      const outcome=h>a?'homeWins':h<a?'awayWins':'draws';
      row.accepted++;total.accepted++;
      row[outcome]++;total[outcome]++;
      row.goals+=h+a;total.goals+=h+a;
      row.homeGoals+=h;total.homeGoals+=h;
      row.awayGoals+=a;total.awayGoals+=a;
      const zero=Number(h===0&&a===0);
      row.zeroZero+=zero;total.zeroZero+=zero;
      const shots=match.events.filter(e=>e.kind==='shot').length;
      row.shots+=shots;total.shots+=shots;
      const injured=result.physical.playerRows.reduce(
        (n,p)=>n+p.permanentInjuryWithdrawals,0);
      row.medicalWithdrawals+=injured;total.medicalWithdrawals+=injured;
      digest.update(JSON.stringify({fixtureId:fixture.id,index,seed,
        home:h,away:a,shots,injured})+'\n');
    }
    if(row.attempted!==16||
        row.homeWins+row.draws+row.awayWins!==row.accepted||
        row.zeroZero>row.draws){
      throw Error('V81_FIXTURE_OUTCOME_CONSERVATION_FAILED');
    }
    perFixture.push({fixtureId:fixture.id,
      homeClubId:fixture.homeClubId,awayClubId:fixture.awayClubId,
      round:fixture.round,...row,rejectionReasons:errors});
  }
  if(total.attempted!==FIXTURES_PER_SHARD*SEEDS_PER_FIXTURE||
      total.accepted+total.rejected!==total.attempted||
      total.homeWins+total.awayWins+total.draws!==total.accepted||
      total.homeGoals+total.awayGoals!==total.goals||
      total.zeroZero>total.draws){
    throw Error('V81_TOTAL_OUTCOME_CONSERVATION_FAILED');
  }
  return {schemaVersion:1,
    status:'P5_V81_BALANCED_CALENDAR_FINAL_SCORE_OBSERVATION_NOT_CALIBRATED',
    fixtureGroup,firstFixture:first+1,fixtureCount:FIXTURES_PER_SHARD,
    seedsPerFixture:SEEDS_PER_FIXTURE,
    sourceEngineVersion:M1_ENGINE_VERSION,rngVersion:RNG_VERSION,
    sourceReplayBound:true,balancedDoubleRoundRobinFullCalendar:true,
    sameMappedSeedsForEachFixture:true,
    reference:{matches:240,goals:609,homeWins:109,draws:67,
      awayWins:64,zeroZero:15},
    synthetic:total,perFixture,
    deterministicSha256:digest.digest('hex'),
    runtimeObservation:{wallMilliseconds:Math.round(
      (performance.now()-started)*1000)/1000,
      heapDeltaBytes:process.memoryUsage().heapUsed-heapBefore},
    artificialReplayedFixturesAreNotIndependent:true,
    holdsNotCarriedAcrossIndependentSamples:true,
    formalCalibrationAccepted:false,originalProductionRngUnmodified:true,
    holdout2024_25Used:false};
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=argv.slice(2);
    if(args.length!==1||!/^(?:[0-9]|1[0-5])$/.test(args[0]))
      throw Error('EXPECTED_V81_FIXTURE_GROUP_0_TO_15');
    const report=runM1V81BalancedScoreShard(Number(args[0]));
    process.stdout.write('V81_SHARD_RESULT='+JSON.stringify(report)+'\n');
  }catch(error){
    process.stderr.write('V81_SHARD_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
