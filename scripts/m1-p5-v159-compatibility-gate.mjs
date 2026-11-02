import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const here=new URL('../data/',import.meta.url);
const read=(name)=>JSON.parse(readFileSync(new URL(name,here),'utf8'));
const real=read('rpl-2025-26-p5-shot-discipline-reference.json');
const synthetic=read('m1-p5-v155-observed-full-calendar.json');
const invalid=(code)=>{throw Error('M1_P5_V159_'+code);};

/** Safe-only source definition review; numerical similarity is never
 * an authorization to tune the fictional engine to a third-party rate.
 */
export function inspectM1P5V159Compatibility(reference=real,model=synthetic){
  if(!reference||reference.schemaVersion!==1||
      reference.season!=='2025/26'||
      reference.referenceOnly!==true||
      reference.regularSeason?.matches!==240||
      reference.holdout2024_25Used!==false||
      !model||model.schemaVersion!==155||
      model.referenceCategoryAligned!==false||
      model.releaseP5Accepted!==false||
      model.holdout2024_25Used!==false||
      model.syntheticFixtures!==240||
      model.uniqueFixtureSeedPairs!==11520||
      model.sourceReplayVerified!==true)invalid('SOURCE_CONTRACT');
  const categories=[
    ['goals','OPEN_PLAY_ONLY_VS_ALL_TYPES'],
    ['shots','PROVIDER_ATTEMPT_DEFINITION_NOT_HARMONIZED'],
    ['onTarget','UNKNOWN_LAST_LINE_BLOCK_AND_SAVE_TAXONOMY'],
    ['xg','NO_REAL_RPL_XG_REFERENCE'],
    ['yellowCards','NO_COMPARABLE_SYNTHETIC_V155_CARD_CATEGORY'],
    ['redCards','NO_COMPARABLE_SYNTHETIC_V155_CARD_CATEGORY'],
    ['medicalWithdrawals','NO_REAL_RPL_CLINICAL_REFERENCE'],
    ['outcomes','V155_AGGREGATE_HAS_NO_HDA_REFERENCE'],
    ['penalties','NO_EQUIVALENT_SYNTHETIC_PENALTY_SOURCE'],
  ];
  const models=['baseline','candidateA','candidateB'];
  const totals={};
  for(const name of models){
    const row=model.totals?.[name];
    if(!row||row.attempted!==11520||row.accepted!==11520||
        row.rejected!==0||
        !['goals','shots','onTarget','xgMilli'].every(key=>
          Number.isSafeInteger(row[key])&&row[key]>=0)||
        row.goals>row.onTarget||row.onTarget>row.shots)
      invalid('MODEL_DENOMINATOR');
    totals[name]={accepted:row.accepted,goals:row.goals,
      shots:row.shots,onTarget:row.onTarget,xgMilli:row.xgMilli};
  }
  const metrics=Object.fromEntries(categories.map(([name,reason])=>
    [name,{comparable:false,reason}]));
  return {schemaVersion:159,
    status:'BLOCKED_UNHARMONIZED_METRIC_TAXONOMY',
    referenceSeason:'2025/26',
    sourceReferenceUrl:reference.source.url,
    sourceResearchSha:model.sourceCommit,
    observedModelRuns:model.modelRunAttempts,
    observedModelCases:totals,metrics,
    providerLicenseAndUpstreamUseApproved:false,
    externalMetricComparisonAuthorized:false,
    modelTuningAuthorized:false,
    holdout2024_25Used:false,
    releaseCalibrationAccepted:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    if(process.argv.length!==3||process.argv[2]!=='--summary')
      invalid('USAGE');
    process.stdout.write('V159_COMPATIBILITY='+
      JSON.stringify(inspectM1P5V159Compatibility())+'\n');
  }catch(error){
    process.stderr.write(String(error)+'\n');
    process.exitCode=1;
  }
}
