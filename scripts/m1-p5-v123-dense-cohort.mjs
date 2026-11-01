#!/usr/bin/env node
import {argv} from 'node:process';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V122DenseOrdinaryMatch}
  from '../dist/core/m1-v122-dense-ordinary-season.js';
import goalsReference from '../data/rpl-2025-26-p5-reference.json' with {type:'json'};
import shotsReference from '../data/rpl-2025-26-p5-shot-discipline-reference.json' with {type:'json'};

const error=code=>{throw Error('V123_'+code);};
const integer=(n,max)=>Number.isSafeInteger(n)&&n>=1&&n<=max;
function wilson(count,n) {
  if(!n)return null;
  const z=1.959963984540054,z2=z*z,p=count/n,d=1+z2/n;
  const center=(p+z2/(2*n))/d;
  const radius=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/d;
  return {lower:Math.max(0,center-radius),upper:Math.min(1,center+radius)};
}
function reference(){
  const a=goalsReference.reference,b=shotsReference.regularSeason;
  if(goalsReference.season!=='2025/26'||
      shotsReference.season!=='2025/26'||a.matches!==240||
      b.matches!==240||a.goalsAllTypes!==b.goalsAllTypes||
      a.homeWins+a.drawnMatches+a.awayWins!==240||
      b.shotsAll<b.shotsOnTarget||
      shotsReference.metricLimits.realShotEventTaxonomyMapped!==false||
      shotsReference.holdout2024_25Used!==false)error('REFERENCE_DRIFT');
  return {season:'2025/26',matches:240,
    finalGoalsPerMatch:a.goalsAllTypes/240,
    shotsPerMatch:b.shotsAll/240,
    onTargetPerMatch:b.shotsOnTarget/240,
    homeWinShare:a.homeWins/240,
    drawShare:a.drawnMatches/240,
    awayWinShare:a.awayWins/240,
    scorelessShare:a.scorelessFullTimeMatches/240};
}
/**
 * The new 100s-source actual v120 career is replayed in full after every
 * accepted fixture. Never substitute the isolated v104 research generator.
 */
export function runM1V123DensePlayableCohort({
  firstSeed=1,seedCount=1,fixturesPerCareer=4,
}={}){
  if(!integer(firstSeed,0xffffffff)||!integer(seedCount,32)||
      firstSeed+seedCount-1>0xffffffff||
      !integer(fixturesPerCareer,30))error('INVALID_OPTIONS');
  const real=reference();
  const catalog=createSyntheticRplScaleCatalog(2026);
  const selected=catalog.clubs[0].id;
  const totals={goals:0,shots:0,onTarget:0,xgMilli:0,
    homeWins:0,draws:0,awayWins:0,scoreless:0,
    matchesOverLegacy18ShotCeiling:0};
  const errors={};const seeds=[];
  let attempted=0,accepted=0,replayedJournals=0;
  for(let seed=firstSeed;seed<firstSeed+seedCount;seed++){
    const career=createInitialCareer(catalog,selected,seed,
      'm1-v123-dense-source-'+seed);
    const initial=startM1V120Journal(career);
    if(!initial.ok)error('CANNOT_START');
    let journal=initial.journal,failed=null;
    for(let index=0;index<fixturesPerCareer;index++){
      attempted++;
      const proposal=prepareM1V122DenseOrdinaryMatch(career,journal);
      if(!proposal?.ok){
        failed=proposal===null?'PREMATURE_END_OF_CAREER':proposal.error;
        errors[failed]=(errors[failed]??0)+1;break;
      }
      const next=applyM1V120Source(career,journal,proposal.request);
      if(!next.ok){
        failed=next.error;
        errors[failed]=(errors[failed]??0)+1;break;
      }
      journal=next.journal;
      const report=journal.entries.at(-1).result.report;
      const h=report.home,a=report.away;
      totals.goals+=h.goals+a.goals;
      totals.shots+=h.shots+a.shots;
      totals.onTarget+=h.shotsOnTarget+a.shotsOnTarget;
      totals.xgMilli+=h.xgMilli+a.xgMilli;
      totals.matchesOverLegacy18ShotCeiling+=Number(h.shots+a.shots>18);
      totals.homeWins+=Number(h.goals>a.goals);
      totals.awayWins+=Number(h.goals<a.goals);
      totals.draws+=Number(h.goals===a.goals);
      totals.scoreless+=Number(h.goals+a.goals===0);
      accepted++;
    }
    const verified=validateM1V120Journal(career,journal);
    if(!verified.ok||verified.journal.revision!==
        (failed===null?fixturesPerCareer:journal.revision))
      error('SOURCE_REPLAY_DRIFT');
    replayedJournals++;
    seeds.push({seed,accepted:journal.revision,failed});
  }
  if(attempted!==accepted+Object.values(errors).reduce((x,y)=>x+y,0)||
      totals.homeWins+totals.draws+totals.awayWins!==accepted||
      totals.onTarget>totals.shots||
      totals.matchesOverLegacy18ShotCeiling>accepted)
    error('COUNT_CONSERVATION');
  const divisor=accepted||1;
  return {schemaVersion:123,
    status:'DENSE_SOURCE_COEFFICIENT_FREE_RESEARCH_NOT_CALIBRATED',
    engine:'M1_V105_THREE_SHOT_SLOTS_PER_300_SECOND_CHECKPOINT',
    sourceJournalSchema:120,syntheticCatalogSeed:2026,
    firstSeed,seedCount,fixturesPerCareer,attempted,accepted,
    rejected:attempted-accepted,failures:errors,replayedJournals,seeds,
    totals,perMatch:accepted?{
      goals:totals.goals/divisor,shots:totals.shots/divisor,
      onTarget:totals.onTarget/divisor,
      openPlayXg:totals.xgMilli/(1000*divisor),
    }:null,
    homeWinWilson95:wilson(totals.homeWins,accepted),
    drawWilson95:wilson(totals.draws,accepted),
    awayWinWilson95:wilson(totals.awayWins,accepted),
    scorelessWilson95:wilson(totals.scoreless,accepted),
    reference:real,
    structural:{openPlayShotSlotsPerMatch:54,
      v8LegacyShotSlotsPerMatch:18,
      referenceShotsPerMatch:real.shotsPerMatch,
      denserSourceCanRepresentReferenceMeanShots:true},
    missingCoverage:{refereeCards:null,clinicalInjuries:null,
      independentlyDefinedOnTarget:false,
      independentlyDefinedAllTypeGoals:false,
      fullOpponentHistory:false,
      nativeBrowserDurationSla:false,
      independentStatisticalCalibration:false},
    holdout2024_25Used:false,releaseP5Accepted:false};
}
function parse(args){
  const valid=['first-seed','seed-count','fixtures'];const values={};
  for(const arg of args){
    const match=/^--([a-z-]+)=([0-9]{1,10})$/.exec(arg);
    if(!match||!valid.includes(match[1])||
        Object.hasOwn(values,match[1]))error('CLI_ARGS');
    values[match[1]]=Number(match[2]);
  }
  return {firstSeed:values['first-seed']??1,
    seedCount:values['seed-count']??1,
    fixturesPerCareer:values.fixtures??4};
}
if(argv[1]?.endsWith('m1-p5-v123-dense-cohort.mjs')){
  try{
    process.stdout.write('V123_DENSE_PLAYABLE='+
      JSON.stringify(runM1V123DensePlayableCohort(
        parse(argv.slice(2))))+'\n');
  }catch(e){
    process.stderr.write('V123_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
