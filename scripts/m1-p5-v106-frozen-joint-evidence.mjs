import {argv} from 'node:process';
import {isDeepStrictEqual} from 'node:util';
import evidence from '../data/m1-p5-v106-v104-shard-evidence.json' with {type:'json'};
import source from '../data/m1-p5-v102-v100-shard-evidence.json' with {type:'json'};
import reference from '../data/rpl-2025-26-p5-shot-discipline-reference.json' with {type:'json'};
import {P5_V104_CANDIDATES,runM1V104JointShard}
  from './m1-p5-v104-joint-candidate-shard.mjs';

const fields=['matches','shots','onTarget','goals','saved',
  'blocked','offTarget','xgMilli'];
const names=['baseline','candidateA','candidateB'];
const fail=(code)=>{throw Error('V106_'+code)};
const isInt=x=>Number.isSafeInteger(x)&&x>=0;
function checkCounts(row){
  if(!row||Object.keys(row).length!==fields.length||
    !fields.every(k=>isInt(row[k]))||row.matches!==120||
    row.shots!==row.goals+row.saved+row.blocked+row.offTarget||
    row.onTarget!==row.goals+row.saved||
    row.shots>row.matches*54||row.goals>row.onTarget)
    fail('INVALID_SHARD_COUNTS');
}
function empty(){return Object.fromEntries(fields.map(x=>[x,0]));}
export function summarizeM1V106Evidence(snapshot=evidence){
  if(!snapshot||snapshot.schemaVersion!==1||
      snapshot.status!=='P5_V106_OBSERVED_JOINT_CANDIDATES_NOT_CALIBRATED'||
      snapshot.source?.pr!==382||
      snapshot.source?.headSha!=='183cc7c24ee96de2a9879027cf8e0209d642f624'||
      snapshot.source?.workflowRunId!==40954498398||
      snapshot.source?.fixtureGroups!==16||
      snapshot.source?.fixturesPerGroup!==15||
      snapshot.source?.seedsPerFixture!==8||
      snapshot.source?.baselineSchema!==99||
      snapshot.source?.candidateSchema!==104||
      snapshot.source?.replayedBaselineAgainstFrozenV102!==true||
      !isDeepStrictEqual(snapshot.parameters,P5_V104_CANDIDATES)||
      !Array.isArray(snapshot.shards)||snapshot.shards.length!==16||
      snapshot.interpretation?.releaseCalibrationAccepted!==false||
      snapshot.interpretation?.holdout2024_25Used!==false||
      snapshot.interpretation?.shotTaxonomyHarmonized!==false||
      snapshot.interpretation?.modelGoalsOpenPlayOnly!==true||
      snapshot.interpretation?.realGoalsAllTypes!==true||
      snapshot.interpretation?.careerCasAdmitted!==false)
    fail('INCOMPATIBLE_FROZEN_SOURCE');
  const totals=Object.fromEntries(names.map(k=>[k,empty()]));
  const distinctJobs=new Set();
  for(let i=0;i<16;i++){
    const shard=snapshot.shards[i];
    if(!shard||shard.group!==i||!isInt(shard.sourceJobId)||
        distinctJobs.has(shard.sourceJobId)||
        !isDeepStrictEqual(Object.keys(shard.totals).sort(),[...names].sort())||
        !isDeepStrictEqual(Object.keys(shard.digests).sort(),[...names].sort()))
      fail('SHARD_IDENTITY_OR_COVERAGE');
    distinctJobs.add(shard.sourceJobId);
    for(const name of names){
      const row=shard.totals[name];
      checkCounts(row);
      if(!/^[a-f0-9]{64}$/.test(shard.digests[name]))
        fail('MALFORMED_SOURCE_DIGEST');
      if(name==='baseline'){
        const old=source.shards.find(x=>x.group===i);
        if(!old||row.matches!==old.matchesAccepted||
            row.shots!==old.shots||row.onTarget!==old.onTarget||
            row.goals!==old.openPlayGoals)
          fail('FROZEN_V102_BASELINE_DRIFT');
      }
      for(const field of fields)totals[name][field]+=row[field];
    }
  }
  for(const name of names){
    const t=totals[name];
    if(!isDeepStrictEqual(snapshot.observedTotals[name],t)||t.matches!==1920)
      fail('AGGREGATE_DRIFT');
  }
  if(totals.baseline.shots!==source.observedModelTotals.shots||
      totals.baseline.onTarget!==source.observedModelTotals.onTarget||
      totals.baseline.goals!==source.observedModelTotals.openPlayGoals||
      totals.baseline.xgMilli!==source.observedModelTotals.xgMilli)
    fail('ORIGINAL_COHORT_DRIFT');
  const real=reference.regularSeason;
  if(!isDeepStrictEqual(snapshot.reference,{
    season:'2025/26',matches:real.matches,shots:real.shotsAll,
    onTarget:real.shotsOnTarget,goalsAllTypes:real.goalsAllTypes}))
    fail('REFERENCE_DRIFT');
  const metrics=Object.fromEntries(names.map(k=>{
    const t=totals[k],n=t.matches;
    return [k,{shotsPerMatch:t.shots/n,onTargetPerMatch:t.onTarget/n,
      openPlayGoalsPerMatch:t.goals/n,
      syntheticXgPerMatch:t.xgMilli/(1000*n),
      descriptiveOnTargetPerShot:t.onTarget/t.shots,
      deltaShotsPerMatch:t.shots/n-real.shotsAll/real.matches,
      descriptiveDeltaTargetPerMatch:t.onTarget/n-real.shotsOnTarget/real.matches,
      exploratoryOpenPlayVsAllTypesGoalsDifference:
        t.goals/n-real.goalsAllTypes/real.matches}];
  }));
  return {schemaVersion:106,
    status:'PINNED_SOURCE_COMPARISON_NOT_RELEASE_CALIBRATION',
    shardCount:16,uniqueSourceJobIds:distinctJobs.size,
    gamesPerCandidate:1920,observedTotals:totals,
    metrics,referencePerMatch:{shots:real.shotsAll/real.matches,
      onTarget:real.shotsOnTarget/real.matches,
      allTypesGoals:real.goalsAllTypes/real.matches},
    strictGoalMetricEquivalence:false,
    strictShotClassificationEquivalence:false,
    independentHoldoutUsed:false,releaseCalibrationAccepted:false};
}
export function replayM1V106Shard(group){
  if(!isInt(group)||group>=16)fail('INVALID_GROUP');
  const row=evidence.shards[group];
  const actual=runM1V104JointShard(group);
  if(actual.group!==group||
      !isDeepStrictEqual(actual.parameters,evidence.parameters)||
      !isDeepStrictEqual(actual.totals,row.totals)||
      !isDeepStrictEqual(actual.digests,row.digests))
    fail('SOURCE_REPLAY_DRIFT_'+group);
  return {group,sourceReplayVerified:true};
}
if(argv[1]?.endsWith('m1-p5-v106-frozen-joint-evidence.mjs')){
  try{
    if(argv.length===3&&argv[2]==='--summary')
      process.stdout.write('V106_PINNED='+JSON.stringify(summarizeM1V106Evidence())+'\n');
    else if(argv.length===4&&argv[2]==='--replay'&&
        /^(?:[0-9]|1[0-5])$/.test(argv[3]))
      process.stdout.write('V106_REPLAY='+JSON.stringify(
        replayM1V106Shard(Number(argv[3])))+'\n');
    else fail('EXPECTED_SUMMARY_OR_REPLAY_GROUP');
  }catch(e){
    process.stderr.write('V106_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
