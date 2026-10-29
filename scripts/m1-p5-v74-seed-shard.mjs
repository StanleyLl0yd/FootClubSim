import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compareM1V73SeedCoverage,firstPossessionDraw,researchSeedFromIndex}
  from './m1-p5-v73-seed-coverage.mjs';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';

const FIXTURES_PER_SHARD=8;
const INDICES_PER_SHARD=32;
const GROUPS=4;

export function v74ShardPlan(fixtureGroup,seedGroup){
  if(![fixtureGroup,seedGroup].every(x=>Number.isSafeInteger(x)&&
      x>=0&&x<GROUPS))throw Error('INVALID_P5_V74_SHARD');
  return {fixtureGroup,seedGroup,firstfixture:9+fixtureGroup*8,
    fixtures:FIXTURES_PER_SHARD,start:1+seedGroup*32,
    count:INDICES_PER_SHARD};
}

export function v74CoveragePlans(){
  return Array.from({length:16},(_,i)=>v74ShardPlan(
    Math.floor(i/GROUPS),i%GROUPS));
}

/** Mirrors the first-phase threshold calculation for unchanged default XIs. */
export function v74InitialThreshold(fixture,catalog,clubs){
  const getIds=teamId=>defaultSyntheticLineup(clubs.get(teamId)).starters;
  const idsH=getIds(fixture.homeClubId),idsA=getIds(fixture.awayClubId);
  const players=new Map(catalog.players.map(p=>[p.id,p]));
  const avg=(ids,key)=>ids.reduce((sum,id)=>
    sum+players.get(id).attributes[key],0)/ids.length;
  const share=0.535+
    (avg(idsH,'shortPassing')-avg(idsA,'shortPassing'))/500+
    (avg(idsH,'decisions')-avg(idsA,'decisions'))/900;
  return Math.max(0.27,Math.min(0.73,share));
}

export function runM1V74SeedShard(fixtureGroup,seedGroup){
  const plan=v74ShardPlan(fixtureGroup,seedGroup);
  const x=compareM1V73SeedCoverage(plan);
  if(x.attempted!==256||x.original.accepted+x.original.rejected!==256||
      x.mapped.accepted+x.mapped.rejected!==256||
      x.engineAndMatchRngUnmodified!==true||
      x.independentFootballReferenceAvailable!==false||
      x.holdout2024_25Used!==false||
      x.original.sourceSha256===undefined) {
    throw Error('V74_SOURCE_COVERAGE_INVALID');
  }
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures).slice(
      plan.firstfixture-1,plan.firstfixture-1+plan.fixtures);
  if(fixtures.length!==8)throw Error('V74_FIXTURE_SET_INVALID');
  const originalSeeds=Array.from({length:32},(_,i)=>plan.start+i);
  const mappedSeeds=originalSeeds.map(researchSeedFromIndex);
  const perFixture=fixtures.map(fixture=>{
    const threshold=v74InitialThreshold(fixture,catalog,clubs);
    const homeFirstOriginal=originalSeeds.filter(seed=>
      firstPossessionDraw(seed)<threshold).length;
    const homeFirstMapped=mappedSeeds.filter(seed=>
      firstPossessionDraw(seed)<threshold).length;
    return {fixtureId:fixture.id,homePossessionThreshold:threshold,
      homeFirstOriginal,homeFirstMapped,attemptedPerArm:32};
  });
  const originalHomeFirst=perFixture.reduce((n,f)=>n+f.homeFirstOriginal,0);
  const mappedHomeFirst=perFixture.reduce((n,f)=>n+f.homeFirstMapped,0);
  const mappedSeedDigest=createHash('sha256')
    .update(JSON.stringify(mappedSeeds)).digest('hex');
  if(originalHomeFirst!==256||originalHomeFirst<0||
      mappedHomeFirst<0||mappedHomeFirst>256||
      new Set(mappedSeeds).size!==32){
    throw Error('V74_INITIAL_PHASE_INVARIANT_FAILED');
  }
  return {schemaVersion:1,
    status:'P5_V74_SYNTHETIC_SEED_COVERAGE_NOT_CALIBRATED',
    cohort:'preregistered-fixtures-9-40-indices-1-128',
    fixtureGroup,seedGroup,firstFixture:plan.firstfixture,
    fixtureCount:8,firstIndex:plan.start,indexCount:32,
    attemptedPerArm:256,
    mappedSeedDigest,perFixture,
    original:{...x.original,initialHomePhaseCount:originalHomeFirst},
    mapped:{...x.mapped,initialHomePhaseCount:mappedHomeFirst},
    rngVersion:x.rngVersion,
    fullSourceReplayRequired:true,
    mappedSeedsAreDifferentCounterfactualRuns:true,
    validIndependentRealFootballReference:false,
    engineAndMatchRngUnmodified:true,
    holdout2024_25Used:false,
    syntheticObservationsNotIndependent:true};
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=argv.slice(2);
    if(args.length!==2||args.some(a=>!/^[0-3]$/.test(a)))
      throw Error('EXPECTED_FIXTURE_GROUP_AND_SEED_GROUP');
    const report=runM1V74SeedShard(Number(args[0]),Number(args[1]));
    process.stdout.write('V74_SHARD_RESULT='+JSON.stringify(report)+'\n');
  }catch(e){
    process.stderr.write('V74_SHARD_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
