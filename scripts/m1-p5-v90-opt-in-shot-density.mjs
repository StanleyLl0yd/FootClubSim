import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {startM1PlayerControl,advanceM1PlayerControl}
  from '../dist/core/m1-player-control.js';
import {computeM1V5PhaseShot,simulateM1V5Phases}
  from '../dist/core/m1-phases-v5.js';
import {SeededRng,RNG_VERSION} from '../dist/core/rng.js';
import {M1_ENGINE_VERSION,M1_CLOCK_MAX_EVENTS}
  from '../dist/core/m1-clock.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import reference from '../data/rpl-2025-26-p5-shot-discipline-reference.json'
  with {type:'json'};

export const V90_DENSITIES=[1,2,3,4];
const SHARDS=16,PER_SHARD=15,SEEDS=8;
const blank=()=>({matches:0,shots:0,onTarget:0,goals:0,xgMilli:0,
  homeShots:0,awayShots:0,homeGoals:0,awayGoals:0,sourceRejected:0});
const accumulate=(target,source)=>{
  for(const key of Object.keys(target))target[key]+=source[key];
};
export function researchSeedV90(fixtureId,index){
  if(typeof fixtureId!=='string'||!fixtureId||fixtureId.length>128||
      !Number.isSafeInteger(index)||index<1||index>SEEDS)
    throw Error('V90_BAD_RESEARCH_SEED_PAIR');
  return createHash('sha256')
    .update(JSON.stringify(['FootClubSim-P5-v90-phase-density',fixtureId,index]))
    .digest().readUInt32BE(0)||1;
}

/**
 * Reuse EXACT public, deterministic v5 shot math/actor selection.
 * Multiple evaluations at a single five-minute checkpoint are only
 * research counterfactuals, never authenticated or persistable events.
 */
export function inspectM1V90ShotDensity(prematch,policy,shotsPerCheckpoint){
  if(!V90_DENSITIES.includes(shotsPerCheckpoint))
    return {ok:false,error:'V90_UNSUPPORTED_DENSITY'};
  const start=startM1PlayerControl(prematch,policy);
  if(!start.ok)return {ok:false,error:'V90_INVALID_PREMATCH_OR_POLICY'};
  const input=prematch;
  const players=new Map(input.catalog.players.map(p=>[p.id,p]));
  const active={home:input.homeLineup.starters,
    away:input.awayLineup.starters};
  let state=start.state;
  const rng=new SeededRng(input.rngSeed);
  const stats=blank();
  stats.matches=1;
  for(let phase=0;phase<M1_CLOCK_MAX_EVENTS;phase++){
    for(let slot=0;slot<shotsPerCheckpoint;slot++){
      const shot=computeM1V5PhaseShot(input,state,players,active,
        phase,rng,stats.shots+1);
      if(!shot)continue;
      const home=shot.teamId===input.fixture.homeClubId;
      if(!home&&shot.teamId!==input.fixture.awayClubId)
        return {ok:false,error:'V90_UNKNOWN_SHOOTING_TEAM'};
      if(!(home?active.home:active.away).includes(shot.playerId))
        return {ok:false,error:'V90_SHOOTER_NOT_ON_FIELD'};
      stats.shots++;
      stats.xgMilli+=shot.xgMilli;
      if(home)stats.homeShots++;else stats.awayShots++;
      if(shot.outcome==='goal'||shot.outcome==='saved')stats.onTarget++;
      if(shot.outcome==='goal'){
        stats.goals++;
        if(home)stats.homeGoals++;else stats.awayGoals++;
      }
    }
    const next=advanceM1PlayerControl(input,policy,state);
    if(!next.ok)return {ok:false,error:'V90_INVALID_PHASE_CONTINUATION'};
    state=next.state;
  }
  if(stats.shots!==stats.homeShots+stats.awayShots||
      stats.goals!==stats.homeGoals+stats.awayGoals||
      stats.goals>stats.onTarget||stats.onTarget>stats.shots)
    return {ok:false,error:'V90_INTERNAL_CONSERVATION'};
  return {ok:true,schemaVersion:1,
    status:'RESEARCH_ONLY_COUNTERFACTUAL_NOT_ADMISSIBLE_MATCH_SOURCE',
    fixtureId:input.fixture.id,shotsPerCheckpoint,
    stats,rngSeed:input.rngSeed,rngState:rng.snapshot(),
    rngDraws:5*M1_CLOCK_MAX_EVENTS*shotsPerCheckpoint,
    syntheticSubphaseEventProvenanceAuthenticated:false,
    substitutionsAndMedicalModelled:false,
    refereeOrKdkAuthorityAuthenticated:false,
    canPersistInV76CareerJournal:false,
    productionEngineAndSavedSchemasUnmodified:true,
  };
}

export function compareM1V90WithOriginalV5(prematch,policy){
  const original=simulateM1V5Phases(prematch,policy,[]);
  const probe=inspectM1V90ShotDensity(prematch,policy,1);
  if(!original.ok||!probe.ok)
    return {ok:false,error:'V90_BASELINE_SOURCE_REJECTED'};
  const old=original.report;
  if(probe.stats.shots!==old.home.shots+old.away.shots||
      probe.stats.onTarget!==old.home.shotsOnTarget+old.away.shotsOnTarget||
      probe.stats.goals!==old.home.goals+old.away.goals||
      probe.stats.xgMilli!==old.home.xgMilli+old.away.xgMilli||
      probe.stats.homeShots!==old.home.shots||
      probe.stats.awayShots!==old.away.shots||
      probe.stats.homeGoals!==old.home.goals||
      probe.stats.awayGoals!==old.away.goals||
      probe.rngState!==original.rngState||
      probe.rngDraws!==original.rngDraws)
    return {ok:false,error:'V90_BASELINE_NOT_SOURCE_PARITY'};
  return {ok:true,baselineParityVerified:true,fixtureId:old.fixtureId};
}
export function runM1V90ResearchShard(group){
  if(!Number.isSafeInteger(group)||group<0||group>=SHARDS)
    throw Error('V90_INVALID_GROUP');
  if(reference.regularSeason.matches!==240||
      reference.regularSeason.shotsAll!==5548||
      reference.regularSeason.goalsAllTypes!==609)
    throw Error('V90_INDEPENDENT_REFERENCE_CHANGED');
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubMap=new Map(catalog.clubs.map(x=>[x.id,x]));
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(x=>x.id))
    .flatMap(x=>x.fixtures);
  if(fixtures.length!==240)throw Error('V90_CALENDAR_SCOPE_CHANGED');
  const selected=fixtures.slice(group*PER_SHARD,(group+1)*PER_SHARD);
  if(selected.length!==PER_SHARD)throw Error('V90_SHARD_SCOPE_CHANGED');
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const totals=Object.fromEntries(V90_DENSITIES.map(k=>[String(k),blank()]));
  const digest=createHash('sha256'),used=new Set();
  const timer=performance.now();
  for(const fixture of selected){
    const base={
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
    for(let index=1;index<=SEEDS;index++){
      const seed=researchSeedV90(fixture.id,index);
      if(used.has(seed))throw Error('V90_SHARD_RESEARCH_SEED_COLLISION');
      used.add(seed);
      const prematch={...base,rngSeed:seed};
      for(const density of V90_DENSITIES){
        const result=inspectM1V90ShotDensity(prematch,policy,density);
        const stats=totals[String(density)];
        if(!result.ok){
          stats.sourceRejected++;
          digest.update(JSON.stringify([fixture.id,index,density,
            'ERROR',result.error])+'\n');
          continue;
        }
        accumulate(stats,result.stats);
        digest.update(JSON.stringify([fixture.id,index,density,
          result.stats,result.rngState])+'\n');
      }
    }
  }
  for(const density of V90_DENSITIES){
    const t=totals[String(density)];
    if(t.matches+t.sourceRejected!==PER_SHARD*SEEDS||
        t.shots!==t.homeShots+t.awayShots||
        t.goals!==t.homeGoals+t.awayGoals)
      throw Error('V90_SHARD_CONSERVATION');
  }
  return {schemaVersion:1,status:'V90_FREQUENCY_QUALITY_COUPLED_PROBE_NOT_CALIBRATION',
    fixtureGroup:group,fixtureCount:PER_SHARD,seedPairs:PER_SHARD*SEEDS,
    densityModes:V90_DENSITIES,researchSeedDomain:'SHA256 fixture-index',
    researchSeedsUnique:used.size,modelRngVersion:RNG_VERSION,
    realReference:{matches:240,shots:5548,goals:609},
    totals,digestSha256:digest.digest('hex'),
    performanceObservation:{elapsedMs:Math.round(
      (performance.now()-timer)*1000)/1000},
    noMedicalOrSubstitutionScenariosOnly:true,
    sourceMatchReplayOrPersistenceClaimed:false,
    noChangesToExistingEngineRngOrSave:true,
    holdout2024_25Used:false,
    formalP5CalibrationAccepted:false,
  };
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(argv.length!==3||!/^(?:[0-9]|1[0-5])$/.test(argv[2]))
      throw Error('V90_EXPECTED_SHARD_0_TO_15');
    process.stdout.write('V90_SHARD_RESULT='+JSON.stringify(
      runM1V90ResearchShard(Number(argv[2])))+'\n');
  }catch(error){
    process.stderr.write('V90_SHARD_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
