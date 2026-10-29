import test from 'node:test';
import assert from 'node:assert/strict';
import season from '../data/rpl-2025-26-p5-shot-discipline-reference.json'
  with {type:'json'};
import score from '../data/rpl-2025-26-p5-reference.json'
  with {type:'json'};

test('v85 independent full-season shots match complete 30-round RPL reference scope',()=>{
  assert.equal(season.schemaVersion,1);
  assert.equal(season.season,'2025/26');
  assert.equal(season.regularSeason.rounds*season.regularSeason.matchesPerRound,
    season.regularSeason.matches);
  assert.equal(season.regularSeason.matches,240);
  assert.equal(score.reference.matches,season.regularSeason.matches);
  assert.equal(season.regularSeason.goalsAllTypes,score.reference.goalsAllTypes);
  assert.equal(season.regularSeason.goalsAllTypes,609);
  assert.equal(season.regularSeason.shotsAll,5548);
  assert.equal(season.regularSeason.shotsOnTarget,1879);
  assert.ok(season.regularSeason.shotsOnTarget<=season.regularSeason.shotsAll);
  assert.equal(season.regularSeason.penaltiesRecorded,99);
  assert.equal(season.regularSeason.penaltiesScored,76);
  assert.ok(season.regularSeason.penaltiesScored<=
    season.regularSeason.penaltiesRecorded);
  assert.equal(season.regularSeason.yellowCards,1035);
  assert.equal(season.regularSeason.redCards,26);
  assert.equal(season.regularSeason.fouls,6815);
  assert.equal(season.regularSeason.shotsAll/240,5548/240);
  assert.equal(season.regularSeason.shotsOnTarget/240,1879/240);
});

test('v85 alternate provider shot totals stay distinct, not silently averaged',()=>{
  assert.equal(season.secondarySource.shotsAll,5867);
  assert.equal(season.secondarySource.goalsAllTypes,609);
  assert.notEqual(season.secondarySource.shotsAll,
    season.regularSeason.shotsAll);
  assert.equal(season.metricLimits.realXg,null);
  assert.equal(season.metricLimits.realModelledMedicalWithdrawals,null);
  assert.equal(season.metricLimits.realShotEventTaxonomyMapped,false);
  assert.equal(season.metricLimits.simulatorPenaltyGoalSemanticsAligned,false);
  assert.equal(season.holdout2024_25Used,false);
  assert.equal(season.referenceOnly,true);
  for(const value of Object.values(season.regularSeason))
    assert.ok(Number.isSafeInteger(value)&&value>=0);
});
