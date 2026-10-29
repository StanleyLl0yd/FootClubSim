import {argv} from 'node:process';
import {runM1V100Shard} from './m1-p5-v100-intraphase-shard.mjs';
import evidence from '../data/m1-p5-v102-v100-shard-evidence.json' with {type:'json'};
import reference from '../data/rpl-2025-26-p5-shot-discipline-reference.json' with {type:'json'};

const fields=['matchesAttempted','matchesAccepted','matchesRejected',
  'shots','onTarget','openPlayGoals'];
const sourceKeys={
  matchesAttempted:'attempted',matchesAccepted:'accepted',
  matchesRejected:'rejected',shots:'shots',onTarget:'onTarget',
  openPlayGoals:'goals',
};

export function summarizeM1V102JointGap(snapshot=evidence){
  const total=snapshot.observedModelTotals,real=reference.regularSeason;
  if(total.matchesAccepted!==1920||real.matches!==240||
      snapshot.interpretation.releaseCalibrationAccepted!==false||
      snapshot.interpretation.holdout2024_25Used!==false)
    throw Error('V102_BOUNDARY_MISMATCH');
  const model={
    shotsPerMatch:total.shots/total.matchesAccepted,
    onTargetPerMatch:total.onTarget/total.matchesAccepted,
    openPlayGoalsPerMatch:total.openPlayGoals/total.matchesAccepted,
    onTargetShare:total.onTarget/total.shots,
    openPlayGoalsPerShot:total.openPlayGoals/total.shots,
    xgPerMatch:total.xgMilli/(1000*total.matchesAccepted),
  };
  const observed={
    shotsPerMatch:real.shotsAll/real.matches,
    onTargetPerMatch:real.shotsOnTarget/real.matches,
    allTypesGoalsPerMatch:real.goalsAllTypes/real.matches,
    onTargetShare:real.shotsOnTarget/real.shotsAll,
    allTypesGoalsPerShot:real.goalsAllTypes/real.shotsAll,
  };
  return {
    status:'P5_V102_OBSERVED_NOT_CALIBRATED',
    sourceSchema:snapshot.evidence.sourceSchema,
    accepted:snapshot.observedModelTotals.matchesAccepted,
    model,observed,
    perMatchRatios:{
      shots:model.shotsPerMatch/observed.shotsPerMatch,
      onTarget:model.onTargetPerMatch/observed.onTargetPerMatch,
      modelOpenPlayVsAllRealGoals:
        model.openPlayGoalsPerMatch/observed.allTypesGoalsPerMatch,
    },
    strictGoalComparisonValid:false,
    strictShotTaxonomyComparisonValid:false,
    xgReferenceAvailable:false,
    holdout2024_25Used:false,releaseCalibrationAccepted:false,
  };
}

export function replayM1V102FrozenShardEvidence(){
  const aggregate={attempted:0,accepted:0,rejected:0,
    shots:0,onTarget:0,goals:0,saved:0,blocked:0,offTarget:0,xgMilli:0,
    over18ShotMatches:0,maxShots:0};
  for(const entry of evidence.shards){
    const actual=runM1V100Shard(entry.group);
    if(actual.fixtureGroup!==entry.group||
        actual.digestSha256!==entry.digestSha256||
        actual.fixtureCount!==15||actual.seedsPerFixture!==8||
        actual.sourceVersion!==99||actual.holdout2024_25Used!==false)
      throw Error('V102_SOURCE_REPLAY_DRIFT_GROUP_'+entry.group);
    for(const field of fields)
      if(actual.synthetic[sourceKeys[field]]!==entry[field])
        throw Error('V102_SOURCE_COUNT_DRIFT_'+entry.group+'_'+field);
    for(const [field,value] of Object.entries(actual.synthetic)){
      if(field==='maxShots')
        aggregate.maxShots=Math.max(aggregate.maxShots,value);
      else aggregate[field]+=value;
    }
  }
  const stored=evidence.observedModelTotals;
  for(const [field,value] of Object.entries(aggregate)){
    const renamed=field==='attempted'?'matchesAttempted':
      field==='accepted'?'matchesAccepted':
      field==='rejected'?'matchesRejected':
      field==='goals'?'openPlayGoals':field;
    if(stored[renamed]!==value)throw Error('V102_GLOBAL_COUNT_DRIFT_'+field);
  }
  return summarizeM1V102JointGap();
}

if(argv[1]?.endsWith('m1-p5-v102-joint-gap.mjs')){
  try{
    if(argv.length!==3||!['--summary','--replay'].includes(argv[2]))
      throw Error('V102_EXPECTED_SUMMARY_OR_REPLAY');
    const result=argv[2]==='--replay'?
      replayM1V102FrozenShardEvidence():summarizeM1V102JointGap();
    process.stdout.write('V102_JOINT_GAP='+JSON.stringify(result)+'\n');
  }catch(error){
    process.stderr.write('V102_JOINT_GAP_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
