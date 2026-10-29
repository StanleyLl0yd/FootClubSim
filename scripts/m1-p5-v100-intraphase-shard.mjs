import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {simulateM1V99IntraphaseShots} from '../dist/core/m1-v99-intraphase-shots.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup} from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION} from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import reference from '../data/rpl-2025-26-p5-shot-discipline-reference.json' with {type:'json'};

const SHARDS=16,PER_SHARD=15,SEEDS=8;
const blank=()=>({attempted:0,accepted:0,rejected:0,shots:0,onTarget:0,
  goals:0,saved:0,blocked:0,offTarget:0,xgMilli:0,over18ShotMatches:0,maxShots:0});
export function seedM1V100(fixtureId,index){
  if(typeof fixtureId!=='string'||fixtureId.length<1||fixtureId.length>128||
    !Number.isSafeInteger(index)||index<1||index>SEEDS)
    throw Error('V100_INVALID_SEED_PAIR');
  const digest=createHash('sha256').update(JSON.stringify([
    'FootClubSim-P5-v100-versioned-intraphase',fixtureId,index])).digest();
  return digest.readUInt32BE(0)||1;
}
export function runM1V100Shard(group){
  if(!Number.isSafeInteger(group)||group<0||group>=SHARDS)
    throw Error('V100_INVALID_SHARD');
  if(reference.regularSeason.matches!==240||reference.regularSeason.shotsAll!==5548||
    reference.regularSeason.shotsOnTarget!==1879||
    reference.regularSeason.goalsAllTypes!==609)throw Error('V100_REFERENCE_CHANGED');
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(catalog.clubs.map(x=>[x.id,x]));
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(x=>x.id))
    .flatMap(r=>r.fixtures);
  if(fixtures.length!==240)throw Error('V100_CALENDAR_CHANGED');
  const selected=fixtures.slice(group*PER_SHARD,(group+1)*PER_SHARD);
  if(selected.length!==PER_SHARD)throw Error('V100_MISSING_FIXTURES');
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const totals=blank(),perFixture=[],digest=createHash('sha256'),
    seenSeeds=new Set(),started=performance.now();
  for(const fixture of selected){
    const base={schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
      rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
      fixture,catalog,
      homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
      awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION};
    const row=blank(),errors={};
    for(let index=1;index<=SEEDS;index++){
      const seed=seedM1V100(fixture.id,index);
      if(seenSeeds.has(seed))throw Error('V100_SEED_COLLISION');
      seenSeeds.add(seed);
      row.attempted++;totals.attempted++;
      const result=simulateM1V99IntraphaseShots({...base,rngSeed:seed},policy);
      if(!result.ok){
        row.rejected++;totals.rejected++;
        errors[result.error]=(errors[result.error]??0)+1;
        digest.update(JSON.stringify({fixtureId:fixture.id,index,seed,error:result.error})+'\n');
        continue;
      }
      if(result.fixtureId!==fixture.id||result.schemaVersion!==99||
        result.rngDraws!==270||result.canPersistInV76CareerJournal!==false||
        result.releaseCalibrationAccepted!==false||
        result.medicalAndSubstitutionTransitionsSupported!==false||
        result.refereeAndSpecialGoalsSupported!==false||
        result.events.at(-1)?.type!=='full-time'||
        result.events.at(-1)?.elapsedSeconds!==5400)
        throw Error('V100_SOURCE_BOUNDARY');
      const shots=result.events.filter(x=>x.type==='shot');
      const counts={goal:0,saved:0,blocked:0,'off-target':0};
      let previous=-1;
      for(let i=0;i<result.events.length;i++){
        const e=result.events[i];
        if(e.sequence!==i+1||e.elapsedSeconds<=previous)
          throw Error('V100_EVENT_ORDER');
        previous=e.elapsedSeconds;
        if(e.type!=='shot')continue;
        if(!Object.hasOwn(counts,e.outcome)||e.elapsedSeconds%100!==99)
          throw Error('V100_INVALID_SHOT_EVENT');
        counts[e.outcome]++;
      }
      const onTarget=counts.goal+counts.saved,attempts=shots.length;
      const xg=result.report.home.xgMilli+result.report.away.xgMilli;
      if(attempts>54||attempts!==Object.values(counts).reduce((a,b)=>a+b,0)||
        attempts!==result.report.home.shots+result.report.away.shots||
        onTarget!==result.report.home.shotsOnTarget+result.report.away.shotsOnTarget||
        counts.goal!==result.report.home.goals+result.report.away.goals||
        xg<0||onTarget>attempts||counts.goal>onTarget)
        throw Error('V100_SHOT_CONSERVATION');
      row.accepted++;totals.accepted++;
      for(const [k,v]of Object.entries({shots:attempts,onTarget,goals:counts.goal,
        saved:counts.saved,blocked:counts.blocked,
        offTarget:counts['off-target'],xgMilli:xg})){
        row[k]+=v;totals[k]+=v;
      }
      if(attempts>18){row.over18ShotMatches++;totals.over18ShotMatches++;}
      row.maxShots=Math.max(row.maxShots,attempts);
      totals.maxShots=Math.max(totals.maxShots,attempts);
      digest.update(JSON.stringify({fixtureId:fixture.id,index,seed,
        rngState:result.rngState,shots:attempts,onTarget,goals:counts.goal,
        blocked:counts.blocked,offTarget:counts['off-target'],xgMilli:xg})+'\n');
    }
    if(row.attempted!==SEEDS||row.accepted+row.rejected!==SEEDS)
      throw Error('V100_FIXTURE_CARDINALITY');
    perFixture.push({fixtureId:fixture.id,...row,errors});
  }
  const sum=blank();
  for(const row of perFixture)for(const key of Object.keys(sum)){
    if(key==='maxShots')sum.maxShots=Math.max(sum.maxShots,row.maxShots);
    else sum[key]+=row[key];
  }
  for(const key of Object.keys(sum))
    if(sum[key]!==totals[key])throw Error('V100_SHARD_CONSERVATION_'+key);
  if(totals.attempted!==120||totals.accepted+totals.rejected!==120||
    seenSeeds.size!==120)throw Error('V100_SHARD_CARDINALITY');
  return{schemaVersion:1,status:'P5_V100_UNCALIBRATED_VERSIONED_SOURCE_COHORT',
    fixtureGroup:group,fixtureCount:PER_SHARD,seedsPerFixture:SEEDS,
    uniqueResearchSeeds:seenSeeds.size,sourceVersion:99,sourceMaxPossibleShots:54,
    synthetic:totals,perFixture,digestSha256:digest.digest('hex'),
    reference:{matches:240,shots:5548,onTarget:1879,goalsAllTypes:609},
    referenceShotsDefinitionHarmonized:false,modelGoalsOpenPlayOnly:true,
    realGoalsAllTypes:true,realXgAvailable:false,holdout2024_25Used:false,
    noProductionModelOrRngChanged:true,
    refereeMedicalSubstitutionAdmissionImplemented:false,
    careerPersistenceAllowed:false,releaseCalibrationAccepted:false,
    runtimeObservation:{elapsedMs:Math.round((performance.now()-started)*1000)/1000}};
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(argv.length!==3||!/^(?:[0-9]|1[0-5])$/.test(argv[2]))
      throw Error('V100_EXPECTED_SHARD_0_TO_15');
    process.stdout.write('V100_SHARD_RESULT='+
      JSON.stringify(runM1V100Shard(Number(argv[2])))+'\n');
  }catch(e){
    process.stderr.write('V100_SHARD_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
