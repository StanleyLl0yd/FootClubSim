import {createHash} from 'node:crypto';
import {SeededRng} from '../dist/core/rng.js';
import {measureM1V29SourceXgCohort}
  from './m1-p5-v70-source-xg-corpus.mjs';
import {inspectM1V29SourceOpenPlayXg as inspect}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

/** Domain-separated deterministic *seed mapping*, not a new game RNG. */
export function researchSeedFromIndex(index){
  if(!Number.isSafeInteger(index)||index<1||index>128)
    throw Error('INVALID_RESEARCH_SEED_INDEX');
  const hash=createHash('sha256')
    .update('FootClubSim-P5-v73-independent-seed-map:'+index).digest();
  return hash.readUInt32BE(0)||1;
}
export const firstPossessionDraw=seed=>new SeededRng(seed).nextFloat();

export function compareM1V73SeedCoverage({
  firstfixture=1,fixtures=8,start=1,count=32,
}={}){
  if(![firstfixture,fixtures,start,count].every(x=>
      Number.isSafeInteger(x)&&x>0)||
      firstfixture>240||fixtures>8||firstfixture+fixtures-1>240||
      count>32||start+count-1>128) {
    throw Error('BOUNDED_P5_SEED_COVERAGE_REQUIRED');
  }
  const low=Array.from({length:count},(_,i)=>start+i);
  const mapped=low.map(researchSeedFromIndex);
  if(new Set(mapped).size!==count)
    throw Error('RESEARCH_SEED_MAP_COLLISION');
  const firstDrawSummary=seeds=>{
    const draws=seeds.map(firstPossessionDraw);
    return {
      min:Math.min(...draws),max:Math.max(...draws),
      mean:draws.reduce((sum,x)=>sum+x,0)/draws.length,
      belowHalf:draws.filter(x=>x<0.5).length,
      belowOneHundredth:draws.filter(x=>x<0.01).length,
      count:draws.length,
    };
  };
  const lowFirstDraw=firstDrawSummary(low);
  const mappedFirstDraw=firstDrawSummary(mapped);
  const baseline=measureM1V29SourceXgCohort({
    firstfixture,fixtures,start,count,
  });
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const schedule=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures).slice(firstfixture-1,firstfixture+fixtures-1);
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  let accepted=0,rejected=0,shots=0,goals=0,xgMilli=0,scoreless=0;
  const rejectionReasons={};
  const digest=createHash('sha256');
  for(const fixture of schedule){
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
    for(let i=0;i<count;i++){
      const seed=mapped[i];
      const x=inspect({...base,rngSeed:seed},policy);
      if(!x.ok){
        if(!['SOURCE_MATCH_REJECTED','REFEREE_REPLAY_MISMATCH']
          .includes(x.error))
          throw Error('UNEXPECTED_MAPPED_SEED_REJECTION:'+x.error);
        rejected++;
        rejectionReasons[x.error]=(rejectionReasons[x.error]??0)+1;
        digest.update(JSON.stringify({fixtureId:fixture.id,seed,error:x.error})+'\n');
        continue;
      }
      if(x.fixtureId!==fixture.id||
          x.fullSourceReplayVerified!==true||
          x.independentRealXgReferenceAvailable!==false||
          x.modelNotTuned!==true||
          x.sourceShots>18||x.sourceOpenPlayGoals>x.sourceShots){
        throw Error('RESEARCH_MAPPED_SEED_SOURCE_INVALID');
      }
      accepted++;shots+=x.sourceShots;goals+=x.sourceOpenPlayGoals;
      xgMilli+=x.sourceOpenPlayXgMilli;
      scoreless+=Number(x.sourceOpenPlayGoals===0);
      digest.update(JSON.stringify({fixtureId:fixture.id,seed,
        shots:x.sourceShots,goals:x.sourceOpenPlayGoals,
        xgMilli:x.sourceOpenPlayXgMilli})+'\n');
    }
  }
  if(accepted+rejected!==fixtures*count)
    throw Error('RESEARCH_SEED_COVERAGE_MISMATCH');
  return {
    schemaVersion:1,status:'RNG_SEED_REUSE_SENSITIVITY_NOT_REALISM_CALIBRATION',
    attempted:fixtures*count,firstfixture,fixtures,start,count,
    rngVersion:RNG_VERSION,lowFirstDraw,mappedFirstDraw,
    original:{accepted:baseline.accepted,rejected:baseline.rejected,
      shots:baseline.sourceShots,goals:baseline.sourceOpenPlayGoals,
      xgMilli:baseline.sourceOpenPlayXgMilli,
      zeroOpenPlayGoals:baseline.shotlessMatches+
        baseline.scorelessMatchesWithShots,
      sourceSha256:baseline.deterministicSha256},
    mapped:{accepted,rejected,rejectionReasons,shots,goals,xgMilli,
      scoreless,sourceSha256:digest.digest('hex')},
    sameFixtureAndIndexCount:true,
    engineAndMatchRngUnmodified:true,
    mappedSeedsAreDifferentCounterfactualRuns:true,
    independentFootballReferenceAvailable:false,
    holdout2024_25Used:false,modelNotTuned:true,
  };
}
