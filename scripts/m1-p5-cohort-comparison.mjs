import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const METRICS=['goals','shots','penaltiesTaken','penaltyGoals',
  'cautions','dismissals'];
const integer=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const invalid=message=>{throw new TypeError('INVALID_CALIBRATION_EVIDENCE: '+message);};
const mean=values=>values.reduce((sum,n)=>sum+n,0)/values.length;

export function describeM1P5CohortVersusReference(cohort,reference){
  if(!cohort||typeof cohort!=='object'||!Array.isArray(cohort.results)||
     !Array.isArray(cohort.seeds)||cohort.results.length<4||
     cohort.results.length>32||
     cohort.results.length!==cohort.seeds.length||
     cohort.sampleSize!==cohort.results.length||
     new Set(cohort.seeds).size!==cohort.seeds.length)
    invalid('at least four independent seeded complete source seasons required');
  if(!reference||reference.schemaVersion!==1||
     reference.season!=='2025/26'||reference.matches!==240||
     !reference.totals||!reference.sourceByMetric||
     METRICS.some(k=>!integer(reference.totals[k])||
       reference.totals[k]===0||
       typeof reference.sourceByMetric[k]!=='string'||
       !reference.sourceByMetric[k].startsWith('https://')))
    invalid('reference must have positive documented aggregates');
  if(cohort.catalogId!=='liga-prikolov-preview'||
     cohort.refereeEventAuthorityAuthenticated!==false||
     cohort.independentExternalRateComparison!==false)
    invalid('source provenance and limitations must remain explicit');
  const results=cohort.results.map((r,index)=>{
    if(!r||r.seed!==cohort.seeds[index]||r.fixtureCount!==240||
       !r.eventTotals||!integer(r.totalGoals))
      invalid('invalid or nonmatching completed season');
    const t=r.eventTotals;
    const names=['goals','shots','penaltiesTaken','penaltyGoals',
      'cautions','straightReds','secondYellowDismissals',
      'openPlayGoals','ownGoalsFor'];
    if(names.some(k=>!integer(t[k]))||
       t.penaltyGoals>t.penaltiesTaken||
       t.goals!==r.totalGoals||
       t.goals!==t.openPlayGoals+t.penaltyGoals+t.ownGoalsFor||
       t.straightReds+t.secondYellowDismissals>240*22)
      invalid('replayed-event arithmetic or count validation failed');
    const metrics={goals:t.goals,shots:t.shots,
      penaltiesTaken:t.penaltiesTaken,penaltyGoals:t.penaltyGoals,
      cautions:t.cautions,
      dismissals:t.straightReds+t.secondYellowDismissals};
    return{seed:r.seed,metrics};
  });
  const metrics=Object.fromEntries(METRICS.map(k=>{
    const observed=results.map(r=>r.metrics[k]);
    const average=mean(observed),referenceTotal=reference.totals[k];
    return [k,{referenceTotal,
      observedTotals:observed,
      observedMean:Number(average.toFixed(4)),
      observedRange:[Math.min(...observed),Math.max(...observed)],
      relativeDeltaPct:Number((100*(average/referenceTotal-1)).toFixed(2)),
      sourceUrl:reference.sourceByMetric[k]}];
  }));
  return{schemaVersion:1,
    status:'DESCRIPTIVE_2025_26_COMPARISON_NOT_M1_P5_ACCEPTED',
    engineSource:cohort.provenance,
    seasonCount:results.length,fixturesPerSeason:240,
    referenceSeason:reference.season,metrics,
    sourceRightsReviewed:false,
    semanticsHarmonized:false,calibrationToleranceApproved:false,
    heldOut2024_25Used:false,releaseAccepted:false,
    warning:'Descriptive mean of reproducible fictional seeds. '+
      'Not equivalent event taxonomies, not official 2026/27 data and '+
      'not proof of model fitness or permission to reuse provider databases.'};
}

const current=process.argv[1];
if(current&&fileURLToPath(import.meta.url)===current){
  const [cohortPath,referencePath,outputPath]=process.argv.slice(2);
  if(!cohortPath||!referencePath)throw Error(
    'Usage: node scripts/m1-p5-cohort-comparison.mjs cohort.json reference.json [output.json]');
  const result=describeM1P5CohortVersusReference(
    JSON.parse(readFileSync(cohortPath,'utf8')),
    JSON.parse(readFileSync(referencePath,'utf8')));
  if(outputPath)writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
  console.log('M1_P5_NOT_ACCEPTED '+JSON.stringify(result));
}
