#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {analyzeM1P5V142ClusterIntervals}
  from './m1-p5-v142-cluster-intervals.mjs';

export const M1_P5_V147_BOOTSTRAP_SCHEMA=147;
const prefix='V141_CAREER_CLUSTERS=';
const sourceCommit='66c71880e0bddd32f91503f91cff0030a79103ac';
const sourceRun=41353522380;
const fields=['goals','shots','onTarget','openPlayXgMilli',
  'homeWins','draws','awayWins','cautions','straightReds',
  'fictionalInjuryWithdrawals','secondYellowDismissals','fixturesWithEvents'];
const probabilities=new Set(['homeWins','draws','awayWins','fixturesWithEvents']);
const fail=code=>{throw Error('V147_'+code);};
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
const quantile=(ordered,p)=>{
  const scaled=(ordered.length-1)*p;
  const lower=Math.floor(scaled),upper=Math.ceil(scaled);
  return ordered[lower]+(ordered[upper]-ordered[lower])*(scaled-lower);
};

/** Research-only percentile bootstrap: resample whole seed careers, not
 * correlated fixtures. All source lines must match pinned job SHA-256.
 */
export function analyzeM1P5V147ObservedBootstrap(raw,manifest,replicates=4096){
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>1_048_576||
      !manifest||typeof manifest!=='object'||Array.isArray(manifest)||
      manifest.schemaVersion!==143||
      manifest.kind!=='OBSERVED_V141_CAREER_CLUSTERS_EXACT_SOURCE_RECORDS'||
      manifest.sourceCommit!==sourceCommit||manifest.workflowRun!==sourceRun||
      manifest.independentUnit!=='SEED_CAREER_NOT_FIXTURE'||
      manifest.holdout2024_25Used!==false||
      manifest.releaseP5Accepted!==false||
      manifest.sourceLineCount!==8||!Array.isArray(manifest.records)||
      manifest.records.length!==8)
    fail('SOURCE_MANIFEST');
  if(!Number.isSafeInteger(replicates)||replicates<256||replicates>10000)
    fail('REPLICATE_LIMIT');
  const lines=raw.split('\n');
  if(lines.length!==9||lines.at(-1)!=='')fail('SOURCE_LINES');
  const shards=lines.slice(0,-1).map((line,i)=>{
    const item=manifest.records[i];
    if(!item||item.firstSeed!==1+8*i||
        !Number.isSafeInteger(item.jobId)||item.jobId<1||
        !/^[a-f0-9]{64}$/.test(item.sha256??'')||
        !line.startsWith(prefix)||hash(line+'\n')!==item.sha256)
      fail('SOURCE_DIGEST');
    let parsed;
    try{parsed=JSON.parse(line.slice(prefix.length));}
    catch{fail('SOURCE_JSON');}
    if(parsed.firstSeed!==item.firstSeed)fail('SOURCE_ORDER');
    return parsed;
  });
  const observed=analyzeM1P5V142ClusterIntervals(shards);
  const careers=shards.flatMap(shard=>shard.careers);
  if(!observed.intervalEligible||observed.clusters!==64||
      observed.accepted!==256||observed.rejected!==0||
      careers.some(row=>row.accepted!==4)||
      fields.some(field=>!Object.hasOwn(observed.metrics,field)))
    fail('UNEXPECTED_SOURCE_COHORT');
  // Bootstrap RNG is isolated from, and never advances, match PRNG.
  const sourceHash=hash(raw);
  let state=(parseInt(hash('FootClubSim-P5-v147:'+sourceHash).slice(0,8),16)
    >>>0)||0x9e3779b9;
  const next=()=>{
    state^=state<<13;
    state^=state>>>17;
    state^=state<<5;
    return state>>>0;
  };
  const replicatesByMetric=Object.fromEntries(
    fields.map(field=>[field,[]]));
  for(let i=0;i<replicates;i++){
    const totals=Object.fromEntries(fields.map(field=>[field,0]));
    let accepted=0;
    for(let j=0;j<careers.length;j++){
      const career=careers[Math.floor(next()/4294967296*careers.length)];
      accepted+=career.accepted;
      for(const field of fields)totals[field]+=career.totals[field];
    }
    if(accepted===0)fail('EMPTY_RESAMPLE');
    for(const field of fields){
      const scale=field==='openPlayXgMilli'?1000:1;
      replicatesByMetric[field].push(totals[field]/(accepted*scale));
    }
  }
  const metrics={};
  for(const field of fields){
    const ordered=replicatesByMetric[field].sort((a,b)=>a-b);
    let lower=quantile(ordered,0.025),upper=quantile(ordered,0.975);
    if(probabilities.has(field)){
      lower=Math.max(0,Math.min(1,lower));
      upper=Math.max(0,Math.min(1,upper));
    }
    metrics[field]={
      perAcceptedFixture:observed.metrics[field].perAcceptedFixture,
      exploratoryBootstrapPercentile95:{lower,upper},
    };
  }
  return {schemaVersion:M1_P5_V147_BOOTSTRAP_SCHEMA,
    status:'OBSERVED_CAREER_BOOTSTRAP_RESEARCH_NOT_CALIBRATED',
    independentUnit:'SEED_CAREER_NOT_FIXTURE',
    intervalMethod:'EXPLORATORY_WHOLE_CAREER_PERCENTILE_BOOTSTRAP',
    bootstrapReplicates:replicates,sourceCommit,sourceRun,
    sourceSha256:sourceHash,clusters:careers.length,
    accepted:observed.accepted,rejected:observed.rejected,
    sourceDigestsMatched:true,sourceJobOriginIndependentlyAuthenticated:false,
    finiteSampleCoverageGuaranteed:false,
    referenceCategoryAligned:false,releaseP5Accepted:false,
    holdout2024_25Used:false,metrics};
}
function run(){
  if(process.argv.length!==2)fail('NO_ARGUMENTS_ACCEPTED');
  const data=new URL('../data/',import.meta.url);
  const raw=readFileSync(new URL('m1-p5-v143-observed-careers.jsonl',data),'utf8');
  const manifest=JSON.parse(readFileSync(
    new URL('m1-p5-v143-observed-manifest.json',data),'utf8'));
  process.stdout.write('V147_CAREER_BOOTSTRAP='+
    JSON.stringify(analyzeM1P5V147ObservedBootstrap(raw,manifest))+'\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{run();}catch(e){
    process.stderr.write('V147_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
