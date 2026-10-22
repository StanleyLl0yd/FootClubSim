#!/usr/bin/env node
/**
 * v29 + v31 same-fixture/seed tactical perturbation, preserving the full
 * internally generated referee and medical replay. NOT an RPL benchmark.
 */
import {createHash} from 'node:crypto';
import {argv} from 'node:process';
import {deriveM1V31CausalPhysicalExposure}
  from '../dist/core/m1-v24-physical-exposure.js';
import {verifyM1V31CausalPhysicalExposure}
  from '../dist/core/m1-v24-physical-exposure.js';
import {m1Wilson95} from '../dist/core/m1-diagnostics.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

function option(name,defaultValue){
  const entries=argv.slice(2).filter(a=>a.startsWith('--'+name+'='));
  if(entries.length>1)throw Error('DUPLICATE_OPTION:'+name);
  if(entries.length===0)return defaultValue;
  const x=entries[0].split('=')[1];
  if(!/^(?:0|[1-9][0-9]*)$/.test(x)||!Number.isSafeInteger(+x)){
    throw Error('INVALID_OPTION:'+name);
  }
  return +x;
}
class Sample {
  constructor(){this.count=0;this.total=0;this.m2=0;this.avg=0;}
  add(value){
    if(!Number.isSafeInteger(value))throw Error('INVALID_DELTA');
    this.count++;this.total+=value;
    const shift=value-this.avg;
    this.avg+=shift/this.count;
    this.m2+=shift*(value-this.avg);
  }
  report(){
    const variance=this.count>1?Math.max(0,this.m2/(this.count-1)):null;
    const sd=variance===null?null:Math.sqrt(variance);
    const margin=sd===null?null:
      1.959963984540054*sd/Math.sqrt(this.count);
    return {count:this.count,total:this.total,mean:this.total/this.count,
      sampleStdDev:sd,normalMean95:margin===null?null:{
        lower:this.avg-margin,upper:this.avg+margin,
      }};
  }
}
export function runPairedCorpus(){
  const allowed=new Set(['start','count','fixtures','tempo']);
  for(const arg of argv.slice(2)){
    if(!/^--[a-z]+=(?:0|[1-9][0-9]*)$/.test(arg)||
        !allowed.has(arg.slice(2).split('=')[0])){
      throw Error('UNKNOWN_OPTION');
    }
  }
  const start=option('start',1),count=option('count',6);
  const fixtureCount=option('fixtures',2);
  const variantTempo=option('tempo',100);
  if(start<1||start>0xffffffff||count<1||count>64||
      start+count-1>0xffffffff||fixtureCount<1||fixtureCount>8||
      variantTempo>100)throw Error('INVALID_PAIRED_PLAN');
  const catalog=createSyntheticRplScaleCatalog(77);
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(x=>x.fixtures).slice(0,fixtureCount);
  if(fixtures.length!==fixtureCount)throw Error('FIXTURE_COVERAGE_INVALID');
  const policy={
    home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]},
  };
  const delta=new Map([
    ['homeGoals',new Sample()],['awayGoals',new Sample()],
    ['homeShots',new Sample()],['awayShots',new Sample()],
    ['homePhysicalPlayerSeconds',new Sample()],
    ['modelledMedicalAssessments',new Sample()],
    ['syntheticGeneratedFouls',new Sample()],
    ['homeFirstYellowCards',new Sample()],
  ]);
  let compared=0,rejectedPairs=0,positive=0,tied=0,negative=0;
  const rejectedReasons={};
  const digest=createHash('sha256');
  const summaries=[];
  for(const fixture of fixtures){
    const originalPlan=defaultSyntheticLineup(clubs.get(fixture.homeClubId));
    const away=defaultSyntheticLineup(clubs.get(fixture.awayClubId));
    const homeTactics=defaultTacticalPlan(fixture.homeClubId);
    const awayTactics=defaultTacticalPlan(fixture.awayClubId);
    let fixtureCompared=0,fixtureRejected=0;
    for(let seed=start;seed<start+count;seed++){
      const prematch={
        schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
        rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
        fixture,catalog,homeLineup:originalPlan,awayLineup:away,
        homeTactics,awayTactics,
        rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
        rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
      };
      const modified={...prematch,
        homeTactics:{...homeTactics,tempo:variantTempo}};
      const a=deriveM1V31CausalPhysicalExposure(prematch,policy);
      const b=deriveM1V31CausalPhysicalExposure(modified,policy);
      if(!a.ok||!b.ok){
        if(!a.ok&&!['SOURCE_MATCH_REJECTED','REFEREE_REPLAY_MISMATCH']
          .includes(a.error))throw Error('BASE_UNEXPECTED_REJECTION:'+a.error);
        if(!b.ok&&!['SOURCE_MATCH_REJECTED','REFEREE_REPLAY_MISMATCH']
          .includes(b.error))throw Error('VARIANT_UNEXPECTED_REJECTION:'+b.error);
        const reason=(a.ok?'OK':a.error)+'/'+(b.ok?'OK':b.error);
        rejectedPairs++;fixtureRejected++;
        rejectedReasons[reason]=(rejectedReasons[reason]??0)+1;
        digest.update(JSON.stringify({fixtureId:fixture.id,seed,
          rejectedPair:reason})+'\n');
        continue;
      }
      if(!verifyM1V31CausalPhysicalExposure(prematch,policy,[],[],a)||
          !verifyM1V31CausalPhysicalExposure(modified,policy,[],[],b)||
          a.source.source.refereeRngDraws!==90||
          b.source.source.refereeRngDraws!==90||
          a.source.source.treatmentRngDraws!==54||
          b.source.source.treatmentRngDraws!==54||
          a.source.source.match.rngDraws!==90||
          b.source.source.match.rngDraws!==90){
        throw Error('PAIRED_SOURCE_REPLAY_FAILURE:'+fixture.id+':'+seed);
      }
      const m=(z)=>{
        const rows=z.physical.playerRows;
        const bySide=club=>rows.filter(row=>row.teamId===club);
        return {
          homeGoals:z.source.source.match.finalScore.home,
          awayGoals:z.source.source.match.finalScore.away,
          homeShots:bySide(fixture.homeClubId)
            .reduce((n,row)=>n+row.shots,0),
          awayShots:bySide(fixture.awayClubId)
            .reduce((n,row)=>n+row.shots,0),
          homePhysicalPlayerSeconds:z.physical.teamPhysicalPlayerSeconds.home,
          modelledMedicalAssessments:z.source.assessments.length,
          syntheticGeneratedFouls:z.source.source.match.generatedFoulStoppages,
          homeFirstYellowCards:bySide(fixture.homeClubId)
            .reduce((n,row)=>n+row.firstYellowCards,0),
        };
      };
      const first=m(a),second=m(b);
      for(const [key,sample] of delta){
        sample.add(second[key]-first[key]);
      }
      const shotShift=second.homeShots-first.homeShots;
      positive+=Number(shotShift>0);tied+=Number(shotShift===0);
      negative+=Number(shotShift<0);
      compared++;fixtureCompared++;
      digest.update(JSON.stringify({
        fixtureId:fixture.id,seed,
        baseline:{score:a.source.source.match.finalScore,
          rng:a.source.source.match.rngState,
          referee:a.source.source.refereeRngState,
          treatment:a.source.source.treatmentRngState,
          metrics:first},
        variant:{score:b.source.source.match.finalScore,
          rng:b.source.source.match.rngState,
          referee:b.source.source.refereeRngState,
          treatment:b.source.source.treatmentRngState,
          metrics:second},
      })+'\n');
    }
    summaries.push({fixtureId:fixture.id,compared:fixtureCompared,
      rejected:fixtureRejected});
  }
  if(compared+rejectedPairs!==count*fixtureCount||compared===0||
      positive+tied+negative!==compared)throw Error('PAIR_COVERAGE_INVALID');
  const rate=n=>({count:n,denominator:compared,rate:n/compared,
    wilson95:m1Wilson95(n,compared)});
  return {
    schemaVersion:1,status:'SYNTHETIC_V29_PAIRED_TACTICAL_NOT_CALIBRATED',
    pairPolicy:'SAME_SYNTHETIC_FIXTURE_SEED_CATALOG_ROSTER_AND_REFEREE_RNG',
    start,count,fixtureCount,baselineHomeTempo:50,
    variantHomeTempo:variantTempo,
    attemptedPairs:count*fixtureCount,comparedPairs:compared,
    rejectedPairs,rejectedReasons,fixtureSummaries:summaries,
    pairedMeanDeltas:Object.fromEntries(
      [...delta].map(([key,s])=>[key,s.report()])),
    homeShotDirection:{increased:rate(positive),tied:rate(tied),
      decreased:rate(negative)},
    deterministicSha256:digest.digest('hex'),
    referenceSourceStatus:'NO_LAWFUL_COMPARABLE_RPL_TACTICAL_EFFECT_REFERENCE',
    acceptedRealismCalibration:false,
    medicalRateCalibrated:false,externalRefereeAuthorityVerified:false,
    holdoutUsed:false,
  };
}
try{
  process.stdout.write(JSON.stringify(runPairedCorpus())+'\n');
}catch(e){
  process.stderr.write('M1_V57_PAIRED_ERROR:'+
    (e instanceof Error?e.message:'UNKNOWN')+'\n');
  process.exitCode=1;
}
