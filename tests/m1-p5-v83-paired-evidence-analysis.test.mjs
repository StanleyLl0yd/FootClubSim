import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyM1V83PairedEvidence,analyzeM1V83Evidence,
  PROVISIONAL_TARGET_WINDOWS}
  from '../scripts/m1-p5-v83-paired-evidence-analysis.mjs';

test('v83 pinned GitHub source run reconciles all 240 real source-replayed fixture strata',()=>{
  const verified=verifyM1V83PairedEvidence();
  assert.equal(verified.pairs.length,120);
  assert.ok(verified.pairs.every(x=>x.rows.length===2));
  assert.deepEqual(verified.total,{
    attempted:3840,accepted:3840,rejected:0,
    homeWins:1088,draws:1704,awayWins:1048,zeroZero:774,
    goals:4899,homeGoals:2440,awayGoals:2459,shots:24511,
    medicalWithdrawals:720,
  });
});

test('v83 120-pair clustered bootstrap is fixed-seed reproducible and clearly non-release',()=>{
  const first=analyzeM1V83Evidence(120);
  const repeated=analyzeM1V83Evidence(120);
  assert.deepEqual(first,repeated);
  assert.equal(first.twoLegClubPairs,120);
  assert.equal(first.sourceReplayedFixtures,240);
  assert.equal(first.syntheticOutcomes,3840);
  assert.equal(first.formalCalibrationAccepted,false);
  assert.equal(first.preliminaryThresholdsAreReleaseAcceptance,false);
  assert.equal(first.actualRealShotOrXgReferenceAvailable,false);
  assert.equal(first.holdout2024_25Used,false);
  assert.equal(first.allProductionRngAndSavesUnmodified,true);
  assert.equal(first.bootstrap.unit,
    'two-leg club pair, 32 matches (same 16 seeds)');
  const m=first.comparisons;
  assert.ok(m.finalGoalsPerMatch.synthetic<1.3);
  assert.equal(m.finalGoalsPerMatch.reference,609/240);
  assert.equal(m.homeWinPercent.reference,100*109/240);
  assert.equal(m.drawPercent.reference,100*67/240);
  assert.equal(m.awayWinPercent.reference,100*64/240);
  assert.equal(m.finalZeroZeroPercent.reference,6.25);
  assert.equal(m.finalGoalsPerMatch.withinProvisionalWindow,false);
  assert.equal(m.homeWinPercent.withinProvisionalWindow,false);
  assert.equal(m.drawPercent.withinProvisionalWindow,false);
  assert.equal(m.finalZeroZeroPercent.withinProvisionalWindow,false);
  assert.equal(m.awayWinPercent.withinProvisionalWindow,true);
  assert.equal(m.finalGoalsPerMatch.provisionalAbsoluteTolerance,
    PROVISIONAL_TARGET_WINDOWS.finalGoalsPerMatch);
  for(const v of Object.values(m)){
    assert.ok(Number.isFinite(v.illustrativePairedBootstrap95.low));
    assert.ok(v.illustrativePairedBootstrap95.low<=
      v.illustrativePairedBootstrap95.high);
  }
});

test('v83 refuses uncontrolled/huge bootstrap requests',()=>{
  for(const bad of [0,99,10001,3.5,NaN,Infinity,'100',null])
    assert.throws(()=>analyzeM1V83Evidence(bad),/INVALID_V83_REPETITIONS/);
});
