import test from 'node:test';
import assert from 'node:assert/strict';
import {runM1V131FictionalIncidentCohort}
  from '../scripts/m1-p5-v131-incident-cohort.mjs';

test('v131 independently replays actual virtual incidents with exact denominators',()=>{
  const options={firstSeed:1,seedCount:1,fixturesPerCareer:2};
  const first=runM1V131FictionalIncidentCohort(options);
  const second=runM1V131FictionalIncidentCohort(options);
  assert.deepEqual(first,second);
  assert.equal(first.schemaVersion,131);
  assert.equal(first.replayedJournals,1);
  assert.equal(first.accepted+first.rejected,first.attempted);
  assert.equal(first.verifiedVirtualSources,first.accepted);
  assert.equal(first.totals.homeWins+first.totals.draws+
    first.totals.awayWins,first.accepted);
  assert.ok(first.totals.secondYellowDismissals<=
    first.totals.cautions/2);
  assert.equal(first.syntheticEventAuthorityOnly,true);
  assert.equal(first.completeOpponentHistory,false);
  assert.equal(first.independentRealInjuriesDefinitionAligned,false);
  assert.equal(first.independentRealCardsDefinitionAligned,false);
  assert.equal(first.holdout2024_25Used,false);
  assert.equal(first.releaseP5Accepted,false);
});
test('v131 rejects invalid seed and fixture cohort options',()=>{
  for(const invalid of [
    {firstSeed:0},{seedCount:0},{seedCount:17},
    {firstSeed:0xffffffff,seedCount:2},{fixturesPerCareer:0},
    {fixturesPerCareer:7},{seedCount:1.5},
  ]){
    assert.throws(()=>runM1V131FictionalIncidentCohort(invalid),
      /V131_INVALID_OPTIONS/);
  }
});
