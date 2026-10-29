import {createHash} from 'node:crypto';
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

const xgBands=[
  {name:'low_xg_lt_0_75',lo:0,hi:749},
  {name:'middle_xg_0_75_to_lt_1_50',lo:750,hi:1499},
  {name:'higher_xg_ge_1_50',lo:1500,hi:Infinity},
];
const shotBands=[
  {name:'few_shots_0_to_5',lo:0,hi:5},
  {name:'middle_shots_6_to_10',lo:6,hi:10},
  {name:'more_shots_11_to_18',lo:11,hi:18},
];
const group=bands=>bands.map(b=>({name:b.name,
  matches:0,scoreless:0,shots:0,goals:0,xgMilli:0}));
export function stratifyM1V71SourceXgObservations(observations){
  if(!Array.isArray(observations)||observations.length===0||
      observations.length>4096)throw Error('INVALID_SOURCE_XG_STRATA_INPUT');
  const xb=group(xgBands),sb=group(shotBands);
  let shots=0,goals=0,xgMilli=0,scoreless=0;
  const digest=createHash('sha256');
  for(const item of observations){
    if(!item||typeof item!=='object'||Array.isArray(item)||
        Object.keys(item).sort().join(',')!=='fixtureId,goals,seed,shots,xgMilli'||
        typeof item.fixtureId!=='string'||!item.fixtureId||
        ![item.goals,item.seed,item.shots,item.xgMilli].every(Number.isSafeInteger)||
        item.seed<1||item.shots<0||item.shots>18||item.goals<0||
        item.goals>item.shots||item.xgMilli<20*item.shots||
        item.xgMilli>600*item.shots) {
      throw Error('SOURCE_XG_STRATA_CONSERVATION_FAILED');
    }
    const x=xgBands.findIndex(b=>item.xgMilli>=b.lo&&item.xgMilli<=b.hi);
    const s=shotBands.findIndex(b=>item.shots>=b.lo&&item.shots<=b.hi);
    if(x<0||s<0)throw Error('SOURCE_XG_STRATA_BUCKET_FAILED');
    for(const row of [xb[x],sb[s]]){
      row.matches++;row.scoreless+=Number(item.goals===0);
      row.shots+=item.shots;row.goals+=item.goals;
      row.xgMilli+=item.xgMilli;
    }
    shots+=item.shots;goals+=item.goals;xgMilli+=item.xgMilli;
    scoreless+=Number(item.goals===0);
    digest.update(JSON.stringify(item)+'\n');
  }
  const report=rows=>rows.map(row=>({
    ...row,
    scorelessRate:row.matches===0?null:row.scoreless/row.matches,
    meanXgPerMatch:row.matches===0?null:row.xgMilli/(1000*row.matches),
    meanGoalsPerMatch:row.matches===0?null:row.goals/row.matches,
  }));
  return {schemaVersion:1,status:'SOURCE_XG_STRATA_NOT_CAUSAL_CALIBRATION',
    accepted:observations.length,shots,goals,xgMilli,scoreless,
    xgBands:report(xb),shotBands:report(sb),
    sourceSha256:digest.digest('hex'),
    internalXgOnly:true,independentExternalRplXgAvailable:false,
    holdout2024_25Used:false,modelNotTuned:true};
}
export function collectM1V71SourceXgStrata({
  firstfixture=1,fixtures=8,start=1,count=32,
}={}){
  if(![firstfixture,fixtures,start,count].every(x=>
      Number.isSafeInteger(x)&&x>0) ||
      firstfixture>240 || fixtures>32 || firstfixture+fixtures-1>240 ||
      count>128 || start+count-1>0xffffffff) {
    throw Error('BOUNDED_SOURCE_XG_STRATA_REQUIRED');
  }
  const catalog=createSyntheticRplScaleCatalog(77);
  const byClub=new Map(catalog.clubs.map(c=>[c.id,c]));
  const schedule=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures).slice(firstfixture-1,firstfixture+fixtures-1);
  if(schedule.length!==fixtures)throw Error('INVALID_FIXTURE_STRATA_RANGE');
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const observations=[],rejectionReasons={};
  let rejected=0;
  for(const fixture of schedule){
    const input={
      schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
      rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
      fixture,catalog,
      homeLineup:defaultSyntheticLineup(byClub.get(fixture.homeClubId)),
      awayLineup:defaultSyntheticLineup(byClub.get(fixture.awayClubId)),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION,
    };
    for(let seed=start;seed<start+count;seed++){
      const run=inspect({...input,rngSeed:seed},policy);
      if(!run.ok){
        if(!['SOURCE_MATCH_REJECTED','REFEREE_REPLAY_MISMATCH']
          .includes(run.error))throw Error('UNEXPECTED_SOURCE_XG_ERROR:'+run.error);
        rejected++;
        rejectionReasons[run.error]=(rejectionReasons[run.error]??0)+1;
        continue;
      }
      if(run.fullSourceReplayVerified!==true||
          run.fixtureId!==fixture.id||
          run.independentRealXgReferenceAvailable!==false||
          run.modelNotTuned!==true)throw Error('SOURCE_XG_REPLAY_NOT_VERIFIED');
      observations.push({fixtureId:fixture.id,seed,shots:run.sourceShots,
        goals:run.sourceOpenPlayGoals,xgMilli:run.sourceOpenPlayXgMilli});
    }
  }
  if(observations.length+rejected!==fixtures*count){
    throw Error('SOURCE_XG_STRATA_COVERAGE_FAILED');
  }
  return {attempted:fixtures*count,rejected,rejectionReasons,
    ...stratifyM1V71SourceXgObservations(observations)};
}
