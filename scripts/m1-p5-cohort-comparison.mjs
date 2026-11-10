import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const METRICS=['goals','shots','penaltiesTaken','penaltyGoals',
  'cautions','dismissals'];
const integer=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const invalid=message=>{throw new TypeError('INVALID_CALIBRATION_EVIDENCE: '+message);};
const mean=values=>values.reduce((sum,n)=>sum+n,0)/values.length;
// Two-sided 95% Student-t critical values, df=3..31 (4..32 seeds).
const t95=[3.182446,2.776445,2.570582,2.446912,2.364624,2.306004,2.262157,2.228139,2.200985,2.178813,2.160369,2.144787,2.13145,2.119905,2.109816,2.100922,2.093024,2.085963,2.079614,2.073873,2.068658,2.063899,2.059539,2.055529,2.051831,2.048407,2.04523,2.042272,2.039513];
const seededMean95Interval=(values,floorAtZero=true)=>{
  const n=values.length,average=mean(values);
  const squared=values.reduce((sum,v)=>sum+(v-average)**2,0);
  const margin=t95[n-4]*Math.sqrt(squared/(n*(n-1)));
  return [Number((floorAtZero?Math.max(0,average-margin):average-margin).toFixed(2)),
    Number((average+margin).toFixed(2))];
};

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
      observedSeedMean95Interval:seededMean95Interval(observed),
      observedRange:[Math.min(...observed),Math.max(...observed)],
      relativeDeltaPct:Number((100*(average/referenceTotal-1)).toFixed(2)),
      sourceUrl:reference.sourceByMetric[k]}];
  }));
  return{schemaVersion:1,
    status:'DESCRIPTIVE_2025_26_COMPARISON_NOT_M1_P5_ACCEPTED',
    engineSource:cohort.provenance,
    seasonCount:results.length,fixturesPerSeason:240,
    referenceSeason:reference.season,metrics,
    seedMean95Method:'Two-sided Student t interval across complete seeded seasons; '+
      'assumes independent pseudo-random seeds; does not quantify reference uncertainty',
    sourceRightsReviewed:false,
    semanticsHarmonized:false,calibrationToleranceApproved:false,
    heldOut2024_25Used:false,releaseAccepted:false,
    warning:'Descriptive mean of reproducible fictional seeds. '+
      'Not equivalent event taxonomies, not official 2026/27 data and '+
      'not proof of model fitness or permission to reuse provider databases.'};
}


/** Paired v190/v191 observational cohorts, not an acceptance gate. */
export function describeM1P5PairedSourceVariants(evidence){
  const base=evidence?.source1,changed=evidence?.source2;
  if(evidence?.schemaVersion!==1||!base||!changed||
      base.specialGoalSourceVersion!==1||
      changed.specialGoalSourceVersion!==2||
      base.catalogId!=='liga-prikolov-preview'||
      changed.catalogId!==base.catalogId||
      base.refereeEventAuthorityAuthenticated!==false||
      changed.refereeEventAuthorityAuthenticated!==false||
      base.independentExternalRateComparison!==false||
      changed.independentExternalRateComparison!==false||
      !Array.isArray(base.seeds)||base.seeds.length<4||
      base.seeds.length>32||
      !Array.isArray(base.results)||!Array.isArray(changed.results)||
      !Array.isArray(changed.seeds)||
      base.seeds.length!==base.results.length||
      base.seeds.length!==changed.results.length||
      base.seeds.length!==changed.seeds.length||
      base.sampleSize!==base.seeds.length||
      changed.sampleSize!==base.seeds.length||
      new Set(base.seeds).size!==base.seeds.length||
      base.seeds.some((s,i)=>!Number.isSafeInteger(s)||s<1||
        s>0xffffffff||s!==changed.seeds[i]))
    invalid('paired cohorts require matching 4..32 independent seeds and source versions');
  const fields=['goals','openPlayGoals','shots','penaltiesTaken',
    'penaltyGoals','ownGoalsFor','cautions','straightReds',
    'secondYellowDismissals','fictionalInjuryWithdrawals'];
  const validate=(r,seed)=>{
    const t=r?.eventTotals;
    if(r?.seed!==seed||r.fixtureCount!==240||
        !t||!integer(r.totalGoals)||
        fields.some(k=>!integer(t[k]))||
        t.goals!==r.totalGoals||
        t.goals!==t.openPlayGoals+t.penaltyGoals+t.ownGoalsFor||
        t.penaltyGoals>t.penaltiesTaken||
        t.shots<t.openPlayGoals||
        typeof r.finalTableHash!=='string'||
        !/^[0-9a-f]{64}$/.test(r.finalTableHash))
      invalid('paired source fixture, replay or event conservation failed');
    return t;
  };
  const paired=base.seeds.map((seed,i)=>({
    seed,old:validate(base.results[i],seed),
    next:validate(changed.results[i],seed)}));
  const metrics=Object.fromEntries(fields.map(k=>{
    const observedOld=paired.map(p=>p.old[k]);
    const observedNew=paired.map(p=>p.next[k]);
    const differences=paired.map(p=>p.next[k]-p.old[k]);
    return[k,{source1Mean:Number(mean(observedOld).toFixed(2)),
      source2Mean:Number(mean(observedNew).toFixed(2)),
      pairedDifferences:differences,
      pairedMeanDifference:Number(mean(differences).toFixed(2)),
      pairedMean95Interval:seededMean95Interval(differences,false)}];
  }));
  return{schemaVersion:1,
    status:'PAIRED_INTERNAL_SOURCE_VARIANTS_NOT_CALIBRATED',
    sampleSize:paired.length,fixturesPerSeason:240,
    seeds:[...base.seeds],metrics,
    method:'Two-sided 95% Student-t interval on paired whole-season seed differences',
    releaseAccepted:false,heldOut2024_25Used:false,
    sourceRightsReviewed:false,semanticsHarmonized:false,
    warning:'Paired synthetic outcomes only. Not a real RPL calibration pass.'};
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
