#!/usr/bin/env node
import {argv} from 'node:process';
import {runM1V131FictionalIncidentCohort}
  from './m1-p5-v131-incident-cohort.mjs';

export const M1_P5_V141_CAREER_CLUSTER_SCHEMA=141;
const keys=['goals','shots','onTarget','openPlayXgMilli',
  'homeWins','draws','awayWins','cautions','straightReds',
  'fictionalInjuryWithdrawals','secondYellowDismissals',
  'fixturesWithEvents'];
const error=code=>{throw Error('V141_'+code);};
const int=(value,lo,hi)=>Number.isSafeInteger(value)&&value>=lo&&value<=hi;
function sums(rows) {
  const totals=Object.fromEntries(keys.map(k=>[k,0]));
  for(const row of rows) {
    for(const key of keys){
      if(!int(row.totals[key],0,Number.MAX_SAFE_INTEGER))
        error('BAD_CAREER_METRIC');
      totals[key]+=row.totals[key];
      if(!Number.isSafeInteger(totals[key]))error('METRIC_OVERFLOW');
    }
  }
  return totals;
}
/** Genuine independent seed-career units: retain each four-game cluster
 * instead of misleadingly treating its fixtures as four IID data points.
 * Original v131/source production algorithms and saved formats unchanged.
 */
export function runM1P5V141CareerClusters({
  firstSeed=1,seedCount=1,fixturesPerCareer=4,
}={}) {
  if(!int(firstSeed,1,0xffffffff)||!int(seedCount,1,8)||
      firstSeed+seedCount-1>0xffffffff||
      !int(fixturesPerCareer,1,6))
    error('INVALID_OPTIONS');
  const careers=[];
  for(let seed=firstSeed;seed<firstSeed+seedCount;seed++){
    const report=runM1V131FictionalIncidentCohort({
      firstSeed:seed,seedCount:1,fixturesPerCareer});
    if(report.schemaVersion!==131||report.firstSeed!==seed||
        report.seedCount!==1||report.replayedJournals!==1||
        report.verifiedVirtualSources!==report.accepted||
        report.accepted+report.rejected!==report.attempted||
        report.seeds.length!==1||report.seeds[0].seed!==seed||
        report.holdout2024_25Used!==false||
        report.releaseP5Accepted!==false)
      error('UNVERIFIED_SOURCE');
    careers.push({seed,attempted:report.attempted,
      accepted:report.accepted,rejected:report.rejected,
      failures:report.failures,totals:report.totals,
      verifiedVirtualSources:report.verifiedVirtualSources,
      replayedJournals:report.replayedJournals});
  }
  const totals=sums(careers);
  const attempted=careers.reduce((t,row)=>t+row.attempted,0);
  const accepted=careers.reduce((t,row)=>t+row.accepted,0);
  const rejected=careers.reduce((t,row)=>t+row.rejected,0);
  if(accepted+rejected!==attempted||
      totals.homeWins+totals.draws+totals.awayWins!==accepted||
      totals.onTarget>totals.shots||
      careers.reduce((s,row)=>s+row.replayedJournals,0)!==seedCount||
      careers.reduce((s,row)=>s+row.verifiedVirtualSources,0)!==accepted)
    error('COUNT_CONSERVATION');
  return {schemaVersion:M1_P5_V141_CAREER_CLUSTER_SCHEMA,
    status:'PER_CAREER_FICTIONAL_SOURCE_CLUSTERS_NOT_CALIBRATION',
    source:'v131-v19-v124-v130-v120-replayed-per-seed',
    firstSeed,seedCount,fixturesPerCareer,
    attempted,accepted,rejected,totals,careers,
    independentUnit:'SEED_CAREER_NOT_FIXTURE',
    factualProviderMetricDefinitionsAligned:false,
    opponentFullHistory:false,externalRefereeOrClinicalAuthority:false,
    holdout2024_25Used:false,releaseP5Accepted:false};
}
function parse(args){
  const seen=new Set(),values={};
  for(const arg of args){
    const match=/^--(first-seed|seed-count|fixtures)=([0-9]{1,10})$/.exec(arg);
    if(!match||seen.has(match[1]))error('CLI_ARGS');
    seen.add(match[1]);values[match[1]]=Number(match[2]);
  }
  return {firstSeed:values['first-seed']??1,
    seedCount:values['seed-count']??1,
    fixturesPerCareer:values.fixtures??4};
}
if(argv[1]?.endsWith('m1-p5-v141-career-clusters.mjs')){
  try{
    process.stdout.write('V141_CAREER_CLUSTERS='+
      JSON.stringify(runM1P5V141CareerClusters(parse(argv.slice(2))))+'\n');
  }catch(e){
    process.stderr.write('V141_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
