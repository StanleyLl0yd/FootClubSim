#!/usr/bin/env node
import {argv} from 'node:process';
import {openSync,readSync,closeSync} from 'node:fs';
import {Buffer} from 'node:buffer';

export const M1_P5_V142_CLUSTER_INTERVAL_SCHEMA=142;
const fields=['goals','shots','onTarget','openPlayXgMilli',
  'homeWins','draws','awayWins','cautions','straightReds',
  'fictionalInjuryWithdrawals','secondYellowDismissals','fixturesWithEvents'];
const rates=new Set(['homeWins','draws','awayWins','fixturesWithEvents']);
const fail=code=>{throw Error('V142_'+code);};
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
const sum=(rows,key)=>rows.reduce((total,row)=>total+row[key],0);

/** Treat each source-replayed seed career as one correlated cluster.
 * The 2.1 multiplier is exploratory and conservative relative to
 * a large-sample z cutoff; not an exact finite-sample coverage claim.
 */
export function analyzeM1P5V142ClusterIntervals(shards){
  if(!Array.isArray(shards)||shards.length<1||shards.length>64)
    fail('INVALID_SHARDS');
  const careers=[],seen=new Set();
  let fixturesPerCareer=null;
  for(const shard of shards){
    if(!shard||typeof shard!=='object'||Array.isArray(shard)||
       shard.schemaVersion!==141||
       shard.status!=='PER_CAREER_FICTIONAL_SOURCE_CLUSTERS_NOT_CALIBRATION'||
       shard.source!=='v131-v19-v124-v130-v120-replayed-per-seed'||
       shard.independentUnit!=='SEED_CAREER_NOT_FIXTURE'||
       shard.holdout2024_25Used!==false||
       shard.releaseP5Accepted!==false||
       shard.factualProviderMetricDefinitionsAligned!==false||
       !Number.isSafeInteger(shard.fixturesPerCareer)||
       shard.fixturesPerCareer<1||shard.fixturesPerCareer>6||
       !Array.isArray(shard.careers)||shard.careers.length<1||
       !Number.isSafeInteger(shard.seedCount)||
       shard.seedCount<1||shard.seedCount>8||
       !Number.isSafeInteger(shard.firstSeed)||
       shard.firstSeed<1||
       shard.firstSeed+shard.seedCount-1>0xffffffff||
       shard.seedCount!==shard.careers.length)
      fail('UNVERIFIED_SHARD');
    if(fixturesPerCareer!==null&&fixturesPerCareer!==shard.fixturesPerCareer)
      fail('INCOMPATIBLE_EXPOSURES');
    fixturesPerCareer=shard.fixturesPerCareer;
    const first=shard.careers[0]?.seed;
    if(!Number.isSafeInteger(first)||first!==shard.firstSeed)
      fail('UNVERIFIED_SHARD');
    for(let i=0;i<shard.careers.length;i++){
      const row=shard.careers[i];
      if(!row||typeof row!=='object'||Array.isArray(row)||
         !Number.isSafeInteger(row.seed)||row.seed!==first+i||
         seen.has(row.seed)||!nonnegative(row.attempted)||
         !nonnegative(row.accepted)||!nonnegative(row.rejected)||
         row.accepted+row.rejected!==row.attempted||
         row.attempted>shard.fixturesPerCareer||
         row.replayedJournals!==1||
         row.verifiedVirtualSources!==row.accepted||
         !row.totals||typeof row.totals!=='object'||
         fields.some(f=>!nonnegative(row.totals[f]))||
         row.totals.homeWins+row.totals.draws+
           row.totals.awayWins!==row.accepted||
         row.totals.onTarget>row.totals.shots||
         row.totals.fixturesWithEvents>row.accepted||
         row.totals.secondYellowDismissals>
           Math.floor(row.totals.cautions/2))
        fail('UNVERIFIED_CAREER');
      seen.add(row.seed);
      careers.push(row);
    }
    if(!nonnegative(shard.accepted)||!nonnegative(shard.attempted)||
       !nonnegative(shard.rejected)||
       sum(shard.careers,'accepted')!==shard.accepted||
       sum(shard.careers,'attempted')!==shard.attempted||
       sum(shard.careers,'rejected')!==shard.rejected||
       fields.some(f=>!nonnegative(shard.totals?.[f])||
         shard.careers.reduce((s,r)=>s+r.totals[f],0)!==shard.totals[f]))
      fail('SHARD_AGGREGATE_DRIFT');
  }
  careers.sort((a,b)=>a.seed-b.seed);
  const attempted=sum(careers,'attempted');
  const accepted=sum(careers,'accepted');
  const rejected=sum(careers,'rejected');
  const n=careers.length;
  if(n>512||!Number.isSafeInteger(attempted)||
     !Number.isSafeInteger(accepted)||accepted+rejected!==attempted)
    fail('INVALID_TOTALS');
  const sufficientlyIndependentClusters=n>=30&&accepted>=30;
  const metrics={};
  for(const field of fields){
    const divisor=field==='openPlayXgMilli'?1000:1;
    const count=careers.reduce((s,row)=>s+row.totals[field],0);
    if(!Number.isSafeInteger(count))fail('METRIC_OVERFLOW');
    const rate=accepted>0?count/(divisor*accepted):null;
    let lower=null,upper=null,margin=null;
    if(sufficientlyIndependentClusters){
      const residuals=careers.reduce((s,row)=>{
        const r=row.totals[field]/divisor-rate*row.accepted;
        return s+r*r;
      },0);
      margin=2.1*Math.sqrt(n/(n-1)*residuals)/accepted;
      lower=Math.max(0,rate-margin);
      upper=rate+margin;
      if(rates.has(field)){lower=Math.min(1,lower);upper=Math.min(1,upper);}
    }
    metrics[field]={perAcceptedFixture:rate,
      exploratory95ClusterInterval:
        sufficientlyIndependentClusters?{lower,upper,margin}:null};
  }
  return {schemaVersion:M1_P5_V142_CLUSTER_INTERVAL_SCHEMA,
    independentUnit:'SEED_CAREER_NOT_FIXTURE',
    intervalMethod:'EXPLORATORY_CLUSTER_SANDWICH_MULTIPLIER_2_1',
    clusters:n,fixturesPerCareer,attempted,accepted,rejected,metrics,
    intervalEligible:sufficientlyIndependentClusters,
    recordConsistencyChecked:true,
    referenceCategoryAligned:false,
    releaseP5Accepted:false,holdout2024_25Used:false};
}
/** Read no more than the admitted byte limit from one open file descriptor.
 * The extra byte detects oversize input without a stat/read TOCTOU gap.
 */
export function readM1P5V142BoundedRecord(path){
  const fd=openSync(path,'r');
  try{
    const buffer=Buffer.alloc(1_048_577);
    let used=0;
    while(used<buffer.length){
      const count=readSync(fd,buffer,used,buffer.length-used,null);
      if(count===0)break;
      used+=count;
    }
    if(used>1_048_576)fail('INPUT_TOO_LARGE');
    return buffer.toString('utf8',0,used).trim();
  }finally{closeSync(fd);}
}
function run(){
  if(argv.length<3)fail('MISSING_INPUT');
  const files=argv.slice(2);
  if(files.length>64||files.some(s=>s.startsWith('-')))fail('INVALID_FILES');
  const shards=files.map(path=>{
    const raw=readM1P5V142BoundedRecord(path);
    const prefix='V141_CAREER_CLUSTERS=';
    if(!raw.startsWith(prefix)||raw.includes('\n'))fail('INVALID_RECORD');
    return JSON.parse(raw.slice(prefix.length));
  });
  process.stdout.write('V142_CLUSTER_INTERVALS='+
    JSON.stringify(analyzeM1P5V142ClusterIntervals(shards))+'\n');
}
if(argv[1]?.endsWith('m1-p5-v142-cluster-intervals.mjs')){
  try{run();}catch(e){
    process.stderr.write('V142_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
