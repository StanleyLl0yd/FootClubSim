import {argv} from 'node:process';
import evidence from '../data/m1-p5-v106-v104-shard-evidence.json' with {type:'json'};
import {summarizeM1V106Evidence}
  from './m1-p5-v106-frozen-joint-evidence.mjs';

const cases=['baseline','candidateA','candidateB'];
const fail=(code)=>{throw Error('V108_'+code);};

/**
 * Bounds refer to the simulator's own categories, not independently
 * established Sport-Express, Sportbox, PerformanceOdds or Opta definitions.
 * Its generic blocked category has no last-line-defender subtype.
 */
export function deriveM1V108TaxonomyEnvelope(snapshot=evidence){
  const pinned=summarizeM1V106Evidence(snapshot);
  const candidates={};
  for(const name of cases){
    const row=pinned.observedTotals[name];
    if(!row||row.matches!==1920||row.onTarget!==row.goals+row.saved||
        row.shots!==row.onTarget+row.blocked+row.offTarget)
      fail('SOURCE_CONSERVATION');
    const upper=row.onTarget+row.blocked;
    if(upper>row.shots||row.goals>row.onTarget)fail('INVALID_BOUND');
    candidates[name]={
      matches:row.matches,
      shots:row.shots,
      modelOpenPlayGoals:row.goals,
      modelSaved:row.saved,
      modelGenericBlocks:row.blocked,
      modelOffTarget:row.offTarget,
      modelReportedOnTarget:row.onTarget,
      hypotheticalOnTargetIfAllGenericBlocksWereLastLine:upper,
      unresolvedLastLineBlockSplit:row.blocked,
      reportedOnTargetPerMatch:row.onTarget/row.matches,
      hypotheticalUpperOnTargetPerMatch:upper/row.matches,
      targetDefinitionComparableToPublisher:false,
      allGoalTypesComparableToPublisher:false,
    };
  }
  return {
    schemaVersion:108,
    status:'P5_V108_MODEL_CLASSIFICATION_UNCERTAINTY_NOT_CALIBRATION',
    sourceSchema:106,
    sourceMatchesPerCandidate:1920,
    referenceSeason:'2025/26',
    referenceMatches:240,
    referenceShotsPerMatch:pinned.referencePerMatch.shots,
    referenceOnTargetPerMatch:pinned.referencePerMatch.onTarget,
    referenceGoalsAllTypesPerMatch:pinned.referencePerMatch.allTypesGoals,
    candidates,
    providerShotDefinitionVerified:false,
    providerLastLineBlocksIdentified:false,
    realAndModelGoalDefinitionsHarmonized:false,
    holdout2024_25Used:false,
    researchProbabilityChangesOnly:true,
    releaseCalibrationAccepted:false,
  };
}
if(argv[1]?.endsWith('m1-p5-v108-taxonomy-envelope.mjs')){
  try{
    if(argv.length!==3||argv[2]!=='--summary')fail('EXPECTED_SUMMARY');
    process.stdout.write('V108_TAXONOMY='+
      JSON.stringify(deriveM1V108TaxonomyEnvelope())+'\n');
  }catch(error){
    process.stderr.write('V108_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
