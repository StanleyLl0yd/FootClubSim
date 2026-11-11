import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch} from '../dist/core/m1-v188-league-source-journal.js';
import {createM1V188PauseDraft,parseM1V188PauseDraft,
  recoverM1V188PauseDraft} from '../dist/core/m1-v188-pause-draft.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const selected=catalog.clubs[0].id;
const initial=createInitialCareer(catalog,selected,7070,'pause-draft');
const started=startM1V188LeagueJournal(initial);
assert.ok(started.ok);
const journal=started.journal;
test('restore exact 45-minute source and no future result after reload',()=>{
  const p=prepareM1V188LeagueMatch(initial,journal,
    [],undefined,undefined,undefined,2);
  assert.ok(p?.ok);
  const draft=createM1V188PauseDraft(p,45);
  assert.ok(draft&&draft.playedPrefix.length>0);
  assert.ok(draft.playedPrefix.every(e=>e.elapsedSeconds<2700));
  const saved=structuredClone(draft);
  const restored=recoverM1V188PauseDraft(initial,journal,saved);
  assert.ok(restored);
  assert.deepEqual(restored.draft,draft);
  assert.deepEqual(restored.proposal.request.result,p.request.result);
});
test('forged, malformed, cross-career, stale and backdated drafts fail closed',()=>{
  const p=prepareM1V188LeagueMatch(initial,journal,
    [],undefined,undefined,undefined,2);
  assert.ok(p?.ok);
  const draft=createM1V188PauseDraft(p,45);
  assert.ok(draft);
  const tamper=fn=>{
    const clone=structuredClone(draft);fn(clone);
    assert.equal(recoverM1V188PauseDraft(initial,journal,clone),null);
  };
  tamper(x=>{x.fixtureId='fake';});
  tamper(x=>{x.careerId='fake';});
  tamper(x=>{x.playedPrefix[0].sequence=999;});
  tamper(x=>{x.prematchWitness.rngSeed=999;});
  tamper(x=>{x.commandPrefix=[{kind:'forged',elapsedSeconds:300}];});
  tamper(x=>{x.pauseMinute=50;});
  tamper(x=>{x.expectedRevision=1;});
  tamper(x=>{x.coachingChoices=[{
    kind:'team-tactics',elapsedSeconds:3000,plan:{},
  }];});
  tamper(x=>{x.forged=true;});
  assert.equal(parseM1V188PauseDraft({
    ...draft,playedPrefix:Array(1501).fill({}),
  }),null);
  const committed=applyM1V188LeagueMatch(initial,journal,p.request);
  assert.ok(committed.ok);
  assert.equal(recoverM1V188PauseDraft(
    initial,committed.journal,draft),null);
  assert.equal(journal.revision,0);
});
test('previous coaching changes are preserved but cannot be retroedited',()=>{
  const original=prepareM1V188LeagueMatch(initial,journal,
    [],undefined,undefined,undefined,2);
  assert.ok(original?.ok);
  const tactics=original.request.prematch.fixture.homeClubId===selected?
    original.request.prematch.homeTactics:
    original.request.prematch.awayTactics;
  const orders=[{kind:'team-tactics',elapsedSeconds:900,
    plan:{...tactics,schemaVersion:2,formation:'3-4-3',
      mentality:2,pressing:100,tempo:100}}];
  const p=prepareM1V188LeagueMatch(initial,journal,
    [],undefined,undefined,undefined,2,orders);
  assert.ok(p?.ok);
  const draft=createM1V188PauseDraft(p,45,[],orders);
  assert.ok(draft);
  assert.equal(recoverM1V188PauseDraft(
    initial,journal,draft)?.proposal.request.inMatchOrdersVersion,1);
  const forged=structuredClone(draft);
  forged.coachingChoices[0].plan.mentality=-2;
  assert.equal(recoverM1V188PauseDraft(initial,journal,forged),null,
    'historical coaching commands must match the witnessed source '+
    'even if past event outcomes happen to be numerically identical');
  const forgedCommand=structuredClone(draft);
  assert.ok(forgedCommand.commandPrefix.some(c=>c.kind==='set-tactics'));
  forgedCommand.commandPrefix.find(c=>c.kind==='set-tactics')
    .plan.mentality=-2;
  assert.equal(recoverM1V188PauseDraft(
    initial,journal,forgedCommand),null);
});
