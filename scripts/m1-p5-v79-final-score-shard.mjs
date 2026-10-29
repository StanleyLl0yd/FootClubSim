import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {v74ShardPlan,v74CoveragePlans} from './m1-p5-v74-seed-shard.mjs';
import {researchSeedFromIndex} from './m1-p5-v73-seed-coverage.mjs';
import {deriveM1V31CausalPhysicalExposure}
  from '../dist/core/m1-v24-physical-exposure.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import reference from '../data/rpl-2025-26-p5-reference.json' with {type:'json'};

export function v79Plans(){return v74CoveragePlans();}
const int=x=>Number.isSafeInteger(x)&&x>=0;
const empty=()=>({attempted:0,accepted:0,rejected:0,homeWins:0,draws:0,
  awayWins:0,finalScoreless:0,finalScoreGoals:0,sourceShotEvents:0,
  modelledPermanentWithdrawals:0});

export function runM1V79FinalScoreShard(fixtureGroup,seedGroup){
  const plan=v74ShardPlan(fixtureGroup,seedGroup);
  if(reference.reference.matches!==240||
      reference.reference.homeWins+reference.reference.drawnMatches+
      reference.reference.awayWins!==240||
      reference.reference.goalsAllTypes!==609||
      reference.reference.scorelessFullTimeMatches!==15||
      reference.reference.openPlayGoals!==null){
    throw Error('V79_REFERENCE_SCOPE_INVALID');
  }
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(round=>round.fixtures)
    .slice(plan.firstfixture-1,plan.firstfixture-1+plan.fixtures);
  if(fixtures.length!==8)throw Error('V79_FIXTURE_SET_INVALID');
  const mapped=Array.from({length:plan.count},(_,i)=>
    researchSeedFromIndex(plan.start+i));
  if(new Set(mapped).size!==mapped.length)throw Error('V79_SEED_COLLISION');
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const total=empty(),perFixture=[],digest=createHash('sha256');
  const start=performance.now(),heapStart=process.memoryUsage().heapUsed;
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
    const row=empty(),errors={};
    for(let i=0;i<plan.count;i++){
      const index=plan.start+i,seed=mapped[i];
      const result=deriveM1V31CausalPhysicalExposure(
        {...base,rngSeed:seed},policy,[],[]);
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
        throw Error('V79_REPLAY_PROVENANCE_INVALID');
      }
      const match=result.source.source.match;
      const h=match.finalScore.home,a=match.finalScore.away;
      if(!int(h)||!int(a)||h+a>40||
          !Array.isArray(match.events)||match.events.length>10000){
        throw Error('V79_FINAL_SCORE_INVALID');
      }
      row.accepted++;total.accepted++;
      const category=h>a?'homeWins':h<a?'awayWins':'draws';
      row[category]++;total[category]++;
      const scoreless=Number(h===0&&a===0);
      row.finalScoreless+=scoreless;total.finalScoreless+=scoreless;
      row.finalScoreGoals+=h+a;total.finalScoreGoals+=h+a;
      const shots=match.events.filter(e=>e.kind==='shot').length;
      row.sourceShotEvents+=shots;total.sourceShotEvents+=shots;
      const withdrawals=result.physical.playerRows.reduce(
        (n,p)=>n+p.permanentInjuryWithdrawals,0);
      row.modelledPermanentWithdrawals+=withdrawals;
      total.modelledPermanentWithdrawals+=withdrawals;
      digest.update(JSON.stringify({fixtureId:fixture.id,index,seed,
        home:h,away:a,shots,withdrawals})+'\n');
    }
    perFixture.push({fixtureId:fixture.id,...row,rejectionReasons:errors});
  }
  const finish=performance.now();
  if(total.attempted!==256||
      total.accepted+total.rejected!==total.attempted||
      total.homeWins+total.awayWins+total.draws!==total.accepted||
      total.finalScoreless>total.draws||
      perFixture.some(x=>x.attempted!==32)){
    throw Error('V79_COHORT_CONSERVATION_FAILED');
  }
  return {schemaVersion:1,
    status:'P5_V79_SOURCE_REPLAYED_FINAL_SCORE_REFERENCE_OBSERVATION',
    fixtureGroup,seedGroup,firstFixture:plan.firstfixture,seedIndexStart:plan.start,
    fixtureCount:plan.fixtures,seedsPerFixture:plan.count,
    sourceEngineVersion:M1_ENGINE_VERSION,rngVersion:RNG_VERSION,
    sourceReplayBound:true,referenceScope:'2025/26-RPL-regular-season',
    reference:{matches:240,totalScoreGoals:609,homeWins:109,
      draws:67,awayWins:64,fullTimeZeroZero:15},
    synthetic:total,perFixture,deterministicSha256:digest.digest('hex'),
    runtimeObservation:{wallMilliseconds:Math.round((finish-start)*1000)/1000,
      heapDeltaBytes:process.memoryUsage().heapUsed-heapStart},
    syntheticFixturesAreNotIndependent:true,
    externalMedicalAndRefereeSourcesAuthenticated:false,
    clinicalInjuryReferenceAvailable:false,
    xgReferenceAvailable:false,
    formalReleaseCalibrationAccepted:false,
    originalProductionRngUnmodified:true,
    holdout2024_25Used:false};
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=argv.slice(2);
    if(args.length!==2||args.some(a=>!/^[0-3]$/.test(a)))
      throw Error('EXPECTED_V79_FIXTURE_AND_SEED_GROUP');
    const report=runM1V79FinalScoreShard(Number(args[0]),Number(args[1]));
    process.stdout.write('V79_SHARD_RESULT='+JSON.stringify(report)+'\n');
  }catch(error){
    process.stderr.write('V79_SHARD_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
