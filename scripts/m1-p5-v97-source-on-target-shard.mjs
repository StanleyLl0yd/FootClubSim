import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {inspectM1V88SourceShotOnTarget}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import reference from '../data/rpl-2025-26-p5-shot-discipline-reference.json'
  with {type:'json'};

const SHARDS=16,PER_SHARD=15,SEEDS=8;
const blank=()=>({attempted:0,accepted:0,rejected:0,shots:0,
  shotsOnTarget:0,openPlayGoals:0,openPlayXgMilli:0});
const add=(target,row)=>{
  for(const key of Object.keys(blank()))target[key]+=row[key];
};
export function researchSeedM1V97(fixtureId,index){
  if(typeof fixtureId!=='string'||fixtureId.length<1||
      fixtureId.length>128||!Number.isSafeInteger(index)||
      index<1||index>SEEDS)throw Error('V97_INVALID_SEED_PAIR');
  const h=createHash('sha256').update(JSON.stringify([
    'FootClubSim-P5-v97-on-target',fixtureId,index])).digest();
  return h.readUInt32BE(0)||1;
}
export function runM1V97TargetSourceShard(group){
  if(!Number.isSafeInteger(group)||group<0||group>=SHARDS)
    throw Error('V97_INVALID_FIXTURE_SHARD');
  const ref=reference.regularSeason;
  if(ref.matches!==240||ref.shotsAll!==5548||
      ref.shotsOnTarget!==1879||ref.goalsAllTypes!==609)
    throw Error('V97_REFERENCE_PROVENANCE_CHANGED');
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const calendar=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures);
  if(calendar.length!==240)throw Error('V97_UNBALANCED_CALENDAR');
  const fixtures=calendar.slice(group*PER_SHARD,(group+1)*PER_SHARD);
  if(fixtures.length!==15)throw Error('V97_INCOMPLETE_SHARD');
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const totals=blank(),digest=createHash('sha256');
  const used=new Set(),perFixture=[],started=performance.now();
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
    const row=blank(),reasons={};
    for(let index=1;index<=SEEDS;index++){
      const seed=researchSeedM1V97(fixture.id,index);
      if(used.has(seed))throw Error('V97_SEED_COLLISION');
      used.add(seed);
      row.attempted++;totals.attempted++;
      const result=inspectM1V88SourceShotOnTarget(
        {...base,rngSeed:seed},policy);
      if(!result.ok){
        row.rejected++;totals.rejected++;
        reasons[result.error]=(reasons[result.error]??0)+1;
        digest.update(JSON.stringify({id:fixture.id,index,
          seed,error:result.error})+'\n');
        continue;
      }
      if(result.fixtureId!==fixture.id||
          result.fullyReplayedV8PhysicalXi!==true||
          result.realWorldShotDefinitionVerified!==false||
          !Number.isSafeInteger(result.sourceShots)||
          !Number.isSafeInteger(result.sourceShotsOnTarget)||
          !Number.isSafeInteger(result.sourceOpenPlayGoals)||
          !Number.isSafeInteger(result.sourceOpenPlayXgMilli)||
          result.sourceShots<0||result.sourceShots>18||
          result.sourceShotsOnTarget>result.sourceShots||
          result.sourceOpenPlayGoals>result.sourceShotsOnTarget||
          result.sourceOpenPlayXgMilli<0)
        throw Error('V97_SOURCE_INVARIANT');
      row.accepted++;totals.accepted++;
      for(const [k,v]of [
        ['shots',result.sourceShots],
        ['shotsOnTarget',result.sourceShotsOnTarget],
        ['openPlayGoals',result.sourceOpenPlayGoals],
        ['openPlayXgMilli',result.sourceOpenPlayXgMilli],
      ]){row[k]+=v;totals[k]+=v;}
      digest.update(JSON.stringify({id:fixture.id,index,seed,
        shots:result.sourceShots,onTarget:result.sourceShotsOnTarget,
        goals:result.sourceOpenPlayGoals,
        xg:result.sourceOpenPlayXgMilli})+'\n');
    }
    if(row.attempted!==SEEDS||
        row.accepted+row.rejected!==SEEDS)
      throw Error('V97_FIXTURE_CONSERVATION');
    perFixture.push({fixtureId:fixture.id,
      homeClubId:fixture.homeClubId,awayClubId:fixture.awayClubId,
      round:fixture.round,...row,rejectionReasons:reasons});
  }
  const check=blank();
  for(const row of perFixture)add(check,row);
  for(const k of Object.keys(check))
    if(check[k]!==totals[k])throw Error('V97_SHARD_CONSERVATION_'+k);
  if(totals.attempted!==120||
      totals.accepted+totals.rejected!==120||
      used.size!==120)throw Error('V97_SHARD_CARDINALITY');
  return {schemaVersion:1,
    status:'P5_V97_SOURCE_SHOTS_ON_TARGET_NOT_RELEASE_CALIBRATION',
    fixtureGroup:group,fixtureCount:15,seedsPerFixture:8,
    researchSeedDomain:'SHA256 fixture-index',
    researchSeedsUnique:used.size,synthetic:totals,
    perFixture,digestSha256:digest.digest('hex'),
    realReference:{matches:240,shots:5548,shotsOnTarget:1879,
      totalGoals:609,realXg:null},
    shotDefinitionVerifiedAgainstPublisher:false,
    modelOpenPlayGoalsNotComparableToAllRealGoals:true,
    independentRealXgUnavailable:true,
    clinicalOrRefereeAuthorityClaimed:false,
    2024_25_holdout_used:false,
    productionRngOrSavedSchemaChanged:false,
    releaseCalibrationAccepted:false,
    runtimeObservation:{elapsedMs:Math.round(
      (performance.now()-started)*1000)/1000},
  };
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(argv.length!==3||!/^(?:[0-9]|1[0-5])$/.test(argv[2]))
      throw Error('V97_EXPECTED_SHARD_0_TO_15');
    process.stdout.write('V97_SHARD_RESULT='+JSON.stringify(
      runM1V97TargetSourceShard(Number(argv[2])))+'\n');
  }catch(error){
    process.stderr.write('V97_SHARD_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
