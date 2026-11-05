import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch}
  from '../dist/core/m1-v188-league-source-journal.js';
import {planM1V188NextOwnMatch}
  from '../dist/core/m1-v188-season-navigation.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const career=createInitialCareer(catalog,catalog.clubs[1].id,42,
  'next-own-fixture-control');
const start=startM1V188LeagueJournal(career);
if(!start.ok)throw Error(start.error);

test('navigation never simulates the next managed fixture',()=>{
  const plan=planM1V188NextOwnMatch(career,start.journal);
  assert.ok(plan);
  assert.equal(plan.targetRevision,1);
  assert.equal(plan.automaticMatches,1);
  let current=start.journal;
  for(let i=0;i<plan.automaticMatches;i++){
    const ready=prepareM1V188LeagueMatch(career,current);
    assert.equal(ready?.ok,true);
    assert.equal(ready.selectedClubFixture,false);
    const saved=applyM1V188LeagueMatch(career,current,ready.request);
    assert.equal(saved.ok,true);
    current=saved.journal;
  }
  assert.equal(current.revision,plan.targetRevision);
  const waiting=planM1V188NextOwnMatch(career,current);
  assert.equal(waiting.automaticMatches,0);
  assert.equal(waiting.fixtureId,plan.fixtureId);
  const next=prepareM1V188LeagueMatch(career,current);
  assert.equal(next?.ok,true);
  assert.equal(next.selectedClubFixture,true);
});

test('navigation rejects mismatched career and invalid revision',()=>{
  assert.equal(planM1V188NextOwnMatch(
    {...career,careerId:'alien'},start.journal),null);
  assert.equal(planM1V188NextOwnMatch(
    {...career,selectedClubId:'alien'},start.journal),null);
  assert.equal(planM1V188NextOwnMatch(
    career,{...start.journal,revision:1}),null);
});
