import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeM1P5CohortVersusReference as compare,
  describeM1P5PairedSourceVariants as paired}
  from '../scripts/m1-p5-cohort-comparison.mjs';
const totals={goals:100,shots:500,penaltiesTaken:0,penaltyGoals:0,
  cautions:70,straightReds:3,secondYellowDismissals:5,
  openPlayGoals:100,ownGoalsFor:0};
const frozen=JSON.parse(readFileSync(new URL(
  '../data/research/rpl-2025-26-aggregate-reference.json',
  import.meta.url),'utf8'));
const seeds=[11,41,71,101];
const input=()=>({
  catalogId:'liga-prikolov-preview',
  provenance:'verified fictional v188 source, no real referee authority',
  refereeEventAuthorityAuthenticated:false,
  independentExternalRateComparison:false,
  sampleSize:4,seeds,
  results:seeds.map(seed=>({seed,fixtureCount:240,totalGoals:100,
    eventTotals:{...totals}})),
});
const ref=()=>({schemaVersion:1,season:'2025/26',matches:240,
  totals:{goals:200,shots:1000,penaltiesTaken:100,penaltyGoals:75,
    cautions:600,dismissals:60},
  sourceByMetric:Object.fromEntries(['goals','shots','penaltiesTaken',
    'penaltyGoals','cautions','dismissals'].map(k=>[k,'https://example.org/'+k])),
  taxonomy:structuredClone(frozen.taxonomy),
});
test('four independently seeded complete seasons generate descriptive only',()=>{
  const src=input(),reference=ref();
  const before=JSON.stringify(src);
  const result=compare(src,reference);
  assert.equal(result.releaseAccepted,false);
  assert.equal(result.heldOut2024_25Used,false);
  assert.equal(result.semanticsHarmonized,false);
  assert.equal(result.metrics.goals.relativeDeltaPct,-50);
  assert.equal(result.metrics.shots.observedMean,500);
  assert.equal(result.metrics.goals.comparable,false);
  assert.equal(result.metrics.goals.withinPredeclaredTolerance,null);
  assert.equal(result.metrics.shots.comparable,false);
  assert.deepEqual(result.metrics.goals.observedSeedMean95Interval,[100,100]);
  assert.match(result.seedMean95Method,/Student t/);
  assert.deepEqual(result.metrics.dismissals.observedTotals,[8,8,8,8]);
  assert.equal(JSON.stringify(src),before,'comparison must be read-only');
});
test('forged/missing source arithmetic, seed/revision, or ref fails closed',()=>{
  const a=input();
  assert.throws(()=>compare({...a,seeds:[11,11,71,101]},ref()),
    /INVALID_CALIBRATION_EVIDENCE/);
  const b=input();b.results[0].eventTotals.goals=101;
  assert.throws(()=>compare(b,ref()),/INVALID_CALIBRATION_EVIDENCE/);
  const c=input();c.results[2].fixtureCount=239;
  assert.throws(()=>compare(c,ref()),/INVALID_CALIBRATION_EVIDENCE/);
  const d=input();d.results[0].eventTotals.penaltyGoals=1;
  assert.throws(()=>compare(d,ref()),/INVALID_CALIBRATION_EVIDENCE/);
  const e=ref();e.sourceByMetric.goals='javascript:alert(1)';
  assert.throws(()=>compare(input(),e),/INVALID_CALIBRATION_EVIDENCE/);
  const f=input();f.refereeEventAuthorityAuthenticated=true;
  assert.throws(()=>compare(f,ref()),/INVALID_CALIBRATION_EVIDENCE/);
});

test('frozen v191 all-type goals compare; excluded categories cannot pass',()=>{
  const source={...input(),specialGoalSourceVersion:2};
  const reference=ref();
  const out=compare(source,reference);
  assert.equal(out.metrics.goals.comparable,true);
  assert.equal(out.metrics.goals.withinPredeclaredTolerance,false);
  assert.equal(out.metrics.shots.comparable,false);
  assert.equal(out.metrics.shots.withinPredeclaredTolerance,null);
  assert.equal(out.metrics.cautions.comparable,false);
  assert.equal(out.releaseAccepted,false);
  const fabricated=ref();
  fabricated.taxonomy.metrics.shots.status='COMPARABLE';
  assert.throws(()=>compare(source,fabricated),
    /INVALID_CALIBRATION_EVIDENCE/);
  const unbounded=ref();
  unbounded.taxonomy.metrics.goals.maxRelativeDeviation=1;
  assert.throws(()=>compare(source,unbounded),
    /INVALID_CALIBRATION_EVIDENCE/);
  const opened=ref();opened.taxonomy.holdout2024_25Used=true;
  assert.throws(()=>compare(source,opened),
    /INVALID_CALIBRATION_EVIDENCE/);
});

test('95% seeded-season interval reflects between-seed variability',()=>{
  const src=input();
  src.results[0].totalGoals=110;
  src.results[0].eventTotals.goals=110;
  src.results[0].eventTotals.openPlayGoals=110;
  src.results[1].totalGoals=90;
  src.results[1].eventTotals.goals=90;
  src.results[1].eventTotals.openPlayGoals=90;
  const result=compare(src,ref());
  assert.equal(result.metrics.goals.observedMean,100);
  assert.deepEqual(result.metrics.goals.observedSeedMean95Interval,
    [87.01,112.99]);
  assert.deepEqual(result.metrics.shots.observedSeedMean95Interval,[500,500]);
});

const observed=JSON.parse(readFileSync(
  new URL('../data/research/m1-p5-v190-v191-paired-cohorts.json',
    import.meta.url),'utf8'));
test('source-1/source-2 archived observation is paired and conservation-safe',()=>{
  const prior=JSON.stringify(observed);
  const result=paired(observed);
  assert.equal(result.sampleSize,4);
  assert.equal(result.releaseAccepted,false);
  assert.equal(result.heldOut2024_25Used,false);
  assert.equal(result.metrics.goals.source1Mean,958.25);
  assert.equal(result.metrics.goals.source2Mean,635);
  assert.deepEqual(result.metrics.goals.pairedDifferences,
    [-328,-308,-336,-321]);
  assert.equal(result.metrics.goals.pairedMeanDifference,-323.25);
  assert.deepEqual(result.metrics.goals.pairedMean95Interval,
    [-342.14,-304.36]);
  assert.equal(result.metrics.shots.pairedMeanDifference,408.25);
  assert.deepEqual(result.metrics.shots.pairedMean95Interval,
    [372.52,443.98]);
  assert.deepEqual(result.metrics.penaltiesTaken.pairedMean95Interval,[0,0]);
  assert.equal(JSON.stringify(observed),prior,'comparison must be read only');
});
test('paired census refuses forged goal, source version or seed metadata',()=>{
  for(const attack of [
    x=>{x.source2.results[0].eventTotals.goals++;},
    x=>{x.source2.specialGoalSourceVersion=1;},
    x=>{x.source2.seeds[0]=x.source2.seeds[1];},
    x=>{x.source1.results[1].fixtureCount=239;},
    x=>{x.source1.results[2].finalTableHash='a'.repeat(63);},
    x=>{x.source2.results[0].eventTotals.penaltyGoals=999;},
  ]){
    const candidate=structuredClone(observed);attack(candidate);
    assert.throws(()=>paired(candidate),/INVALID_CALIBRATION_EVIDENCE/);
  }
});
