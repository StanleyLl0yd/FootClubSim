import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch}
  from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188HalfTimeScore,sameM1V188FirstHalfSource,
  deriveM1V188CheckpointScore,sameM1V188CheckpointPrefix}
  from '../dist/core/m1-v188-half-time.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const chosen=catalog.clubs[0].id;
function plan(input){
  const tactics=input.fixture.homeClubId===chosen?
    input.homeTactics:input.awayTactics;
  return{...tactics,schemaVersion:2,formation:'3-4-3',
    mentality:2,pressing:100,tempo:100};
}

test('half-time score is exactly the past source, not final match',()=>{
  const career=createInitialCareer(catalog,chosen,128,'half-time-score');
  const zero=startM1V188LeagueJournal(career);
  assert.ok(zero.ok);
  const calculated=prepareM1V188LeagueMatch(career,zero.journal);
  assert.ok(calculated?.ok);
  const score=deriveM1V188HalfTimeScore(
    calculated.request.prematch,calculated.request.result);
  assert.ok(score);
  assert.equal(score.elapsedSeconds,2700);
  assert.equal(score.fixtureId,calculated.fixture.id);
  assert.ok(score.homeGoals<=calculated.request.result.report.home.goals);
  assert.ok(score.awayGoals<=calculated.request.result.report.away.goals);
  assert.ok(score.homeShots<=calculated.request.result.report.home.shots);
  assert.ok(score.awayShots<=calculated.request.result.report.away.shots);
  assert.equal(score.sourceEventCount,calculated.request.result.events.filter(
    e=>e.elapsedSeconds<2700).length);
});

test('half-time coaching can continue without rewriting a single played event',()=>{
  let anyDifferent=false;
  for(const seed of [11,22,33,44,55]){
    const career=createInitialCareer(catalog,chosen,seed,
      'half-time-continue-'+seed);
    const start=startM1V188LeagueJournal(career);
    assert.ok(start.ok);
    const prior=prepareM1V188LeagueMatch(career,start.journal);
    assert.ok(prior?.ok);
    const resumed=prepareM1V188LeagueMatch(career,start.journal,
      [],undefined,undefined,undefined,undefined,[{
        kind:'team-tactics',elapsedSeconds:2700,
        plan:plan(prior.request.prematch),
      }]);
    assert.ok(resumed?.ok);
    assert.equal(sameM1V188FirstHalfSource(
      prior.request.result,resumed.request.result),true);
    assert.deepEqual(deriveM1V188HalfTimeScore(
      prior.request.prematch,prior.request.result),
      deriveM1V188HalfTimeScore(
        resumed.request.prematch,resumed.request.result));
    const checked=applyM1V188LeagueMatch(career,start.journal,
      resumed.request);
    assert.ok(checked.ok);
    const oldSecond=prior.request.result.events.filter(
      event=>event.elapsedSeconds>2700);
    const newSecond=resumed.request.result.events.filter(
      event=>event.elapsedSeconds>2700);
    anyDifferent ||= JSON.stringify(oldSecond)!==
      JSON.stringify(newSecond);
  }
  assert.ok(anyDifferent,'at least one future phase responds to changes');
});

test('prefix witness detects rewritten past or changed fixture',()=>{
  const career=createInitialCareer(catalog,chosen,909,'half-time-replay');
  const zero=startM1V188LeagueJournal(career);
  assert.ok(zero.ok);
  const first=prepareM1V188LeagueMatch(career,zero.journal);
  assert.ok(first?.ok);
  assert.equal(sameM1V188FirstHalfSource(
    first.request.result,first.request.result),true);
  const changed=structuredClone(first.request.result);
  const past=changed.events.find(e=>e.elapsedSeconds<2700);
  assert.ok(past);
  past.sequence=999;
  assert.equal(sameM1V188FirstHalfSource(
    first.request.result,changed),false);
  const other=structuredClone(first.request.result);
  other.fixtureId='wrong-fixture';
  assert.equal(sameM1V188FirstHalfSource(
    first.request.result,other),false);
  assert.equal(JSON.stringify(first.request.result),
    JSON.stringify(prepareM1V188LeagueMatch(career,zero.journal)
      .request.result));
});

test('15/30/60/75-minute interactive pauses preserve prior source',()=>{
  for(const minute of [15,30,60,75]){
    const career=createInitialCareer(catalog,chosen,minute+4096,
      'checkpoint-'+minute);
    const begin=startM1V188LeagueJournal(career);
    assert.ok(begin.ok);
    const previous=prepareM1V188LeagueMatch(career,begin.journal);
    assert.ok(previous?.ok);
    const updated=prepareM1V188LeagueMatch(career,begin.journal,
      [],undefined,undefined,undefined,undefined,[{
        kind:'team-tactics',elapsedSeconds:minute*60,
        plan:plan(previous.request.prematch),
      }]);
    assert.ok(updated?.ok);
    assert.equal(sameM1V188CheckpointPrefix(
      previous.request.result,updated.request.result,minute*60),true);
    const at=deriveM1V188CheckpointScore(previous.request.prematch,
      previous.request.result,minute*60);
    assert.ok(at);
    assert.equal(at.elapsedSeconds,minute*60);
    assert.deepEqual(at,deriveM1V188CheckpointScore(
      updated.request.prematch,updated.request.result,minute*60));
    assert.ok(applyM1V188LeagueMatch(career,begin.journal,
      updated.request).ok);
  }
  const career=createInitialCareer(catalog,chosen,9876,'invalid-checkpoint');
  const begin=startM1V188LeagueJournal(career);
  assert.ok(begin.ok);
  const previous=prepareM1V188LeagueMatch(career,begin.journal);
  assert.ok(previous?.ok);
  assert.equal(deriveM1V188CheckpointScore(
    previous.request.prematch,previous.request.result,123),null);
  assert.equal(sameM1V188CheckpointPrefix(
    previous.request.result,previous.request.result,123),false);
});
