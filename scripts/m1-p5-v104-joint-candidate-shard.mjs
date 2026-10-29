import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {simulateM1V104JointCandidate}
  from '../dist/core/m1-v104-joint-candidate.js';
import {simulateM1V99IntraphaseShots}
  from '../dist/core/m1-v99-intraphase-shots.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import {seedM1V100} from './m1-p5-v100-intraphase-shard.mjs';
import evidence from '../data/m1-p5-v102-v100-shard-evidence.json' with {type:'json'};
import reference from '../data/rpl-2025-26-p5-shot-discipline-reference.json' with {type:'json'};

export const P5_V104_CANDIDATES=Object.freeze({
  baseline:Object.freeze({shotOpportunityMultiplier:1,xgMultiplier:1,saveMultiplier:1}),
  candidateA:Object.freeze({shotOpportunityMultiplier:1.08,xgMultiplier:0.62,saveMultiplier:0.72}),
  candidateB:Object.freeze({shotOpportunityMultiplier:1.08,xgMultiplier:0.60,saveMultiplier:0.68}),
});
const blank=()=>({matches:0,shots:0,onTarget:0,goals:0,saved:0,
  blocked:0,offTarget:0,xgMilli:0});
const shotDetails=r=>r.events.filter(e=>e.type==='shot')
  .map(({schemaVersion,id,...e})=>e);
export function runM1V104JointShard(group){
  if(!Number.isSafeInteger(group)||group<0||group>15)
    throw Error('V104_INVALID_GROUP');
  if(reference.regularSeason.matches!==240||
      reference.regularSeason.shotsAll!==5548||
      reference.regularSeason.shotsOnTarget!==1879||
      reference.regularSeason.goalsAllTypes!==609||
      evidence.observedModelTotals.matchesAccepted!==1920)
    throw Error('V104_FROZEN_REFERENCE_DRIFT');
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures);
  if(fixtures.length!==240)throw Error('V104_FIXTURE_COUNT_DRIFT');
  const selected=fixtures.slice(group*15,(group+1)*15);
  if(selected.length!==15)throw Error('V104_SHARD_SCOPE_DRIFT');
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const totals=Object.fromEntries(Object.keys(P5_V104_CANDIDATES)
    .map(k=>[k,blank()]));
  const hashes=Object.fromEntries(Object.keys(P5_V104_CANDIDATES)
    .map(k=>[k,createHash('sha256')]));
  const seen=new Set();
  for(const fixture of selected){
    const base={schemaVersion:MATCH_LEDGER_VERSION,
      engineVersion:M1_ENGINE_VERSION,rulesPackId:M0_RULES_PACK_ID,
      rulesPackVersion:M0_RULES_PACK_VERSION,fixture,catalog,
      homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
      awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION};
    for(let i=1;i<=8;i++){
      const seed=seedM1V100(fixture.id,i);
      if(seen.has(seed))throw Error('V104_SEED_COLLISION');
      seen.add(seed);
      const input={...base,rngSeed:seed};
      for(const [name,parameters] of Object.entries(P5_V104_CANDIDATES)){
        const run=simulateM1V104JointCandidate(input,policy,parameters);
        if(!run.ok||run.rngDraws!==270||
            run.releaseCalibrationAccepted!==false||
            run.holdout2024_25Used!==false||
            run.careerCasAdmissionSupported!==false)
          throw Error('V104_RESEARCH_SOURCE_REJECTED_'+name);
        if(name==='baseline'){
          const original=simulateM1V99IntraphaseShots(input,policy);
          if(!original.ok||
              original.rngState!==run.rngState||
              !isDeepStrictEqual(original.report,run.report)||
              !isDeepStrictEqual(shotDetails(original),shotDetails(run)))
            throw Error('V104_BASELINE_V99_REPLAY_PARITY');
        }
        const shots=run.events.filter(e=>e.type==='shot');
        const counts={goal:0,saved:0,blocked:0,'off-target':0};
        for(const shot of shots)counts[shot.outcome]++;
        const sum=counts.goal+counts.saved+counts.blocked+counts['off-target'];
        const row=totals[name];
        if(sum!==shots.length||sum>54||
            counts.goal+counts.saved!==
              run.report.home.shotsOnTarget+run.report.away.shotsOnTarget||
            counts.goal!==run.report.home.goals+run.report.away.goals)
          throw Error('V104_OUTCOME_CONSERVATION_'+name);
        row.matches++;
        row.shots+=sum;
        row.onTarget+=counts.goal+counts.saved;
        row.goals+=counts.goal;
        row.saved+=counts.saved;
        row.blocked+=counts.blocked;
        row.offTarget+=counts['off-target'];
        row.xgMilli+=run.report.home.xgMilli+run.report.away.xgMilli;
        hashes[name].update(JSON.stringify([fixture.id,i,seed,
          run.rngState,run.report,counts])+'\n');
      }
    }
  }
  const frozen=evidence.shards.find(x=>x.group===group);
  if(!frozen||seen.size!==120||
      totals.baseline.matches!==120||
      totals.baseline.shots!==frozen.shots||
      totals.baseline.onTarget!==frozen.onTarget||
      totals.baseline.goals!==frozen.openPlayGoals||
      Object.values(totals).some(x=>x.matches!==120))
    throw Error('V104_V100_FROZEN_COHORT_DRIFT');
  const digests=Object.fromEntries(Object.entries(hashes)
    .map(([k,h])=>[k,h.digest('hex')]));
  return {schemaVersion:104,
    status:'RESEARCH_ONLY_JOINT_CANDIDATE_NOT_CALIBRATED',
    group,fixtures:15,seedsPerFixture:8,uniqueSeeds:seen.size,
    parameters:P5_V104_CANDIDATES,totals,digests,
    reference:{matches:240,shots:5548,onTarget:1879,
      goalsAllTypes:609},
    accuracyTaxonomyHarmonized:false,
    syntheticGoalsOpenPlayOnly:true,holdout2024_25Used:false,
    modelAndSavedFormatsUnmodified:true,
    externalRefereeAndMedicalAuthorityVerified:false,
    careerCasAdmissionSupported:false,releaseCalibrationAccepted:false};
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(argv.length!==3||!/^(?:[0-9]|1[0-5])$/.test(argv[2]))
      throw Error('V104_EXPECTED_GROUP_0_TO_15');
    process.stdout.write('V104_SHARD_RESULT='+
      JSON.stringify(runM1V104JointShard(Number(argv[2])))+'\n');
  }catch(error){
    process.stderr.write('V104_SHARD_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
