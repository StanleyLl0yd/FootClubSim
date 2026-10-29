import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import evidence from '../data/m1-p5-v83-balanced-fixture-evidence.json' with {type:'json'};
import reference from '../data/rpl-2025-26-p5-reference.json' with {type:'json'};

const FIELDS=['attempted','accepted','rejected','homeWins','draws','awayWins',
  'zeroZero','goals','homeGoals','awayGoals','shots','medicalWithdrawals'];
const empty=()=>Object.fromEntries(FIELDS.map(x=>[x,0]));
const add=(target,row)=>{for(const k of FIELDS)target[k]+=row[k];};
const boundedInt=x=>Number.isSafeInteger(x)&&x>=0;
const rate=(n,d)=>n/d;
const percentile=(sorted,q)=>sorted[Math.min(sorted.length-1,Math.max(0,
  Math.floor(q*(sorted.length-1))))];
const pairKey=(a,b)=>[a,b].sort().join('|');

export function verifyM1V83PairedEvidence(){
  if(evidence.schemaVersion!==1||evidence.shards.length!==16||
      evidence.sourceWorkflowRun!==40904920782||
      evidence.matchCount!==3840||evidence.fixtureCount!==240||
      evidence.seedsPerFixture!==16||
      evidence.holdout2024_25Used!==false||
      evidence.modelRngOrSaveChanged!==false)throw Error('V83_BAD_PROVENANCE');
  const names=new Set(),teams=new Map(),pairs=new Map();
  const accumulated=empty(),groupTotals=empty();
  for(let group=0;group<16;group++){
    const shard=evidence.shards[group];
    if(shard.group!==group||shard.perFixture.length!==15||
        !/^[a-f0-9]{64}$/.test(shard.sha256)||
        !boundedInt(shard.jobId))throw Error('V83_BAD_SHARD');
    const sum=empty();
    for(const row of shard.perFixture){
      if(typeof row.fixtureId!=='string'||names.has(row.fixtureId)||
          typeof row.homeClubId!=='string'||typeof row.awayClubId!=='string'||
          row.homeClubId===row.awayClubId||!boundedInt(row.round)||
          !FIELDS.every(k=>boundedInt(row[k]))||
          row.attempted!==16||row.accepted!==16||row.rejected!==0||
          row.homeWins+row.draws+row.awayWins!==16||
          row.zeroZero>row.draws||
          row.homeGoals+row.awayGoals!==row.goals){
        throw Error('V83_BAD_FIXTURE_ROW');
      }
      names.add(row.fixtureId);
      add(sum,row);add(accumulated,row);
      for(const [team,side] of [[row.homeClubId,'home'],
        [row.awayClubId,'away']]){
        const record=teams.get(team)??{home:0,away:0};
        record[side]++;teams.set(team,record);
      }
      const key=pairKey(row.homeClubId,row.awayClubId);
      const pair=pairs.get(key)??[];
      pair.push(row);pairs.set(key,pair);
    }
    for(const field of FIELDS)if(sum[field]!==shard.synthetic[field])
      throw Error('V83_SHARD_CONSERVATION_'+field);
    add(groupTotals,shard.synthetic);
  }
  if(names.size!==240||teams.size!==16||pairs.size!==120||
      [...teams.values()].some(v=>v.home!==15||v.away!==15)||
      [...pairs.values()].some(rows=>rows.length!==2||
        rows[0].homeClubId!==rows[1].awayClubId||
        rows[0].awayClubId!==rows[1].homeClubId||
        rows[0].round===rows[1].round)){
    throw Error('V83_CALENDAR_NOT_MIRRORED');
  }
  for(const field of FIELDS){
    if(accumulated[field]!==groupTotals[field]||
        accumulated[field]!==evidence.aggregates[field])
      throw Error('V83_GLOBAL_CONSERVATION_'+field);
  }
  if(accumulated.accepted!==3840||accumulated.goals!==4899||
      accumulated.draws!==1704||accumulated.zeroZero!==774||
      accumulated.homeWins!==1088||accumulated.awayWins!==1048||
      accumulated.shots!==24511)throw Error('V83_AGGREGATE_INCONSISTENT');
  const ref=reference.reference;
  if(ref.matches!==240||ref.goalsAllTypes!==609||
      ref.homeWins!==109||ref.awayWins!==64||
      ref.drawnMatches!==67||ref.scorelessFullTimeMatches!==15)
    throw Error('V83_EXTERNAL_REFERENCE_CHANGED');
  return {total:accumulated,pairs:[...pairs.entries()]
    .sort(([a],[b])=>a.localeCompare(b)).map(([key,rows])=>({key,rows}))};
}

// The RNG below is for deterministic statistical resampling only;
// it NEVER runs the game engine and does not modify source seed mapping.
function makeBootstrapRng(seed){
  let x=seed>>>0;
  return ()=>{
    x=(x+0x6D2B79F5)>>>0;
    let t=Math.imul(x^(x>>>15),1|x);
    t^=t+Math.imul(t^(t>>>7),61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
const indicators=(t)=>({
  finalGoalsPerMatch:rate(t.goals,t.accepted),
  homeWinPercent:rate(100*t.homeWins,t.accepted),
  drawPercent:rate(100*t.draws,t.accepted),
  awayWinPercent:rate(100*t.awayWins,t.accepted),
  finalZeroZeroPercent:rate(100*t.zeroZero,t.accepted),
  sourceShotsPerMatch:rate(t.shots,t.accepted),
  modelGoalPerSourceShot:rate(t.goals,t.shots),
  homeGoalsPerMatch:rate(t.homeGoals,t.accepted),
  awayGoalsPerMatch:rate(t.awayGoals,t.accepted),
  modelWithdrawalRowsPerMatch:rate(t.medicalWithdrawals,t.accepted),
});
const referenceIndicators=()=>({
  finalGoalsPerMatch:reference.reference.goalsAllTypes/reference.reference.matches,
  homeWinPercent:100*reference.reference.homeWins/reference.reference.matches,
  drawPercent:100*reference.reference.drawnMatches/reference.reference.matches,
  awayWinPercent:100*reference.reference.awayWins/reference.reference.matches,
  finalZeroZeroPercent:100*reference.reference.scorelessFullTimeMatches/
    reference.reference.matches,
});
// These are preliminary calibration-target WINDOWS, not approved release gates.
// They must be audited before any engine alteration or validation on holdout.
export const PROVISIONAL_TARGET_WINDOWS=Object.freeze({
  finalGoalsPerMatch:0.35,homeWinPercent:8,drawPercent:7,
  awayWinPercent:8,finalZeroZeroPercent:5,
});
export function analyzeM1V83Evidence(repetitions=2000){
  if(!Number.isSafeInteger(repetitions)||repetitions<100||
      repetitions>10000)throw Error('INVALID_V83_REPETITIONS');
  const verified=verifyM1V83PairedEvidence();
  const observed=indicators(verified.total),real=referenceIndicators();
  const rng=makeBootstrapRng(0x51832026);
  const draws={};
  for(const k of Object.keys(real))draws[k]=[];
  for(let iteration=0;iteration<repetitions;iteration++){
    const selected=empty();
    for(let i=0;i<verified.pairs.length;i++){
      const pair=verified.pairs[Math.floor(rng()*verified.pairs.length)];
      for(const row of pair.rows)add(selected,row);
    }
    const scored=indicators(selected);
    for(const k of Object.keys(real))draws[k].push(scored[k]);
  }
  const comparisons=Object.fromEntries(Object.keys(real).map(k=>{
    draws[k].sort((a,b)=>a-b);
    const difference=observed[k]-real[k];
    return[k,{synthetic:observed[k],reference:real[k],difference,
      illustrativePairedBootstrap95:{
        low:percentile(draws[k],0.025),
        high:percentile(draws[k],0.975),
      },
      provisionalAbsoluteTolerance:PROVISIONAL_TARGET_WINDOWS[k],
      withinProvisionalWindow:Math.abs(difference)<=
        PROVISIONAL_TARGET_WINDOWS[k]}];
  }));
  return{
    schemaVersion:1,
    status:'P5_V83_FULL_CALENDAR_REPLAY_EVIDENCE_NOT_RELEASE_CALIBRATION',
    dataSourceCommit:evidence.sourceCommit,
    dataSourceRun:evidence.sourceWorkflowRun,
    sourceReplayedFixtures:240,syntheticOutcomes:3840,
    twoLegClubPairs:verified.pairs.length,
    outcomeSums:verified.total,
    comparisons,
    furtherSyntheticOnlyIndicators:{
      sourceShotsPerMatch:observed.sourceShotsPerMatch,
      modelGoalPerSourceShot:observed.modelGoalPerSourceShot,
      homeGoalsPerMatch:observed.homeGoalsPerMatch,
      awayGoalsPerMatch:observed.awayGoalsPerMatch,
      modelWithdrawalRowsPerMatch:observed.modelWithdrawalRowsPerMatch,
    },
    bootstrap:{resamples:repetitions,analysisSeed:'0x51832026',
      unit:'two-leg club pair, 32 matches (same 16 seeds)',
      caution:'Descriptive sensitivity only: clubs shared between pairs; '+
        'one real reference season; not independent real match samples'},
    preliminaryThresholdsAreReleaseAcceptance:false,
    holdout2024_25Used:false,
    allProductionRngAndSavesUnmodified:true,
    actualRealShotOrXgReferenceAvailable:false,
    actualMedicalOrRefereeAuthorityAuthenticated:false,
    formalCalibrationAccepted:false,
  };
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(argv.length!==2)throw Error('V83_NO_ARGUMENTS_ACCEPTED');
    process.stdout.write('V83_PAIRED_REPORT='+JSON.stringify(
      analyzeM1V83Evidence())+'\n');
  }catch(error){
    process.stderr.write('V83_ANALYSIS_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
