import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';
import {advanceM1V188Condition,deriveM1V188Condition,
  inspectM1V188ClubCondition,recoverM1V188Condition,
  selectM1V188ConditionLineup,startM1V188Condition}
  from '../dist/core/m1-v188-condition.js';
import {selectM1V96EligibleRegisteredLineup}
  from '../dist/core/m1-v96-cap-safe-lineup.js';
import {deriveM1V188ConditionedMatchInput}
  from '../dist/core/m1-v188-conditioned-source.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const initial=createInitialCareer(catalog,catalog.clubs[0].id,
  77,'v188-condition-test');
const empty=startM1V188LeagueJournal(initial);
if(!empty.ok)throw Error(empty.error);
const rules={starterCount:11,maxBench:12,maxForeignersOnField:7};
const players=new Map(catalog.players.map(p=>[p.id,p]));

test('fixture recovery, exact minutes workload, and bounded condition',()=>{
  const proposal=prepareM1V188LeagueMatch(initial,empty.journal);
  assert.ok(proposal?.ok);
  assert.equal(proposal.request.conditionPolicyVersion,2);
  const stored=applyM1V188LeagueMatch(initial,empty.journal,proposal.request);
  assert.equal(stored.ok,true);
  if(!stored.ok)return;
  const entry=stored.journal.entries[0];
  assert.equal(entry.source.conditionPolicyVersion,2);
  const start=startM1V188Condition(initial);
  const after=advanceM1V188Condition(initial,start,entry);
  assert.ok(after);
  const prematch=proposal.request.prematch;
  const club=catalog.clubs.find(c=>c.id===prematch.fixture.homeClubId);
  assert.ok(club);
  const before=recoverM1V188Condition(start,club,players);
  const recovered=recoverM1V188Condition(after,club,players);
  assert.ok(before&&recovered);
  const starters=prematch.homeLineup.starters;
  const substitutes=prematch.homeLineup.bench;
  assert.ok(starters.some(id=>after.get(id)<100),
    'actual participating players have finite post-match load');
  assert.ok(substitutes.some(id=>after.get(id)===100),
    'an unused substitute must not acquire playing-time load');
  assert.ok(recovered.get(starters[1])>after.get(starters[1]),
    'fictional recovery occurs before next own fixture');
  assert.ok([...after.values()].every(n=>Number.isSafeInteger(n)&&
    n>=35&&n<=100));
  assert.deepEqual(deriveM1V188Condition(initial,stored.journal.entries),
    after);
  assert.equal([...start.values()].every(n=>n===100),true,
    'caller state and immutable source remain unchanged');
  assert.equal(validateM1V188LeagueJournal(initial,stored.journal).ok,true);
});

test('cross-round automatic XI rotates by source minutes; full replay holds',()=>{
  let journal=empty.journal;
  const snapshots=new Map();
  const source=JSON.stringify(journal);
  let rotated=0;
  for(let index=0;index<10;index++){
    const proposal=prepareM1V188LeagueMatch(initial,journal);
    assert.ok(proposal?.ok,'fixture '+index);
    assert.equal(proposal.request.conditionPolicyVersion,2);
    assert.equal(proposal.request.expectedRevision,index);
    const verified=applyM1V188LeagueMatch(initial,journal,proposal.request);
    assert.equal(verified.ok,true,'fixture '+index);
    if(!verified.ok)return;
    const clubs=[proposal.fixture.homeClubId,proposal.fixture.awayClubId];
    const lineups=[proposal.request.prematch.homeLineup,
      proposal.request.prematch.awayLineup];
    for(let side=0;side<2;side++){
      const clubId=clubs[side];
      const previous=snapshots.get(clubId);
      if(previous&&previous.join(',')!==lineups[side].starters.join(','))
        rotated++;
      snapshots.set(clubId,lineups[side].starters);
    }
    journal=verified.journal;
    assert.equal(validateM1V188LeagueJournal(initial,journal).ok,true);
  }
  assert.ok(rotated>0,'previous source workload must rotate at least one XI');
  assert.equal(JSON.stringify(empty.journal),source);
  const condition=deriveM1V188Condition(initial,journal.entries);
  assert.ok(condition);
  assert.equal(deriveM1V188Condition(initial,journal.entries).size,
    condition.size);
  const club=catalog.clubs[0];
  const observed=inspectM1V188ClubCondition(initial,journal.entries,club.id);
  assert.ok(observed);
  assert.equal(observed.players.length,club.registeredPlayerIds.length);
  assert.ok(observed.players.every(p=>p.condition>=35&&p.condition<=100));

  const candidate=selectM1V188ConditionLineup(club,players,new Set(),
    rules,condition);
  assert.ok(candidate);
  const legacy=selectM1V96EligibleRegisteredLineup(club,players,new Set(),
    rules);
  assert.ok(legacy);
  assert.equal(candidate.starters.length,11);
  assert.ok(candidate.starters.every(id=>club.registeredPlayerIds.includes(id)));
});

test('versioned condition cannot be downgraded after a committed fixture',()=>{
  const proposal=prepareM1V188LeagueMatch(initial,empty.journal);
  assert.ok(proposal?.ok);
  const first=applyM1V188LeagueMatch(initial,empty.journal,proposal.request);
  assert.ok(first.ok);
  const next=prepareM1V188LeagueMatch(initial,first.journal);
  assert.ok(next?.ok);
  const removed=structuredClone(next.request);
  delete removed.conditionPolicyVersion;
  const rejected=applyM1V188LeagueMatch(initial,first.journal,removed);
  assert.equal(rejected.ok,false);
  assert.equal(rejected.error,'SOURCE_MISMATCH');
  const malformed=structuredClone(next.request);
  malformed.conditionPolicyVersion=2;
  assert.equal(applyM1V188LeagueMatch(initial,first.journal,malformed).ok,
    false);
});

test('historical prefix without a condition flag still replays as legacy',()=>{
  const proposed=prepareM1V188LeagueMatch(initial,empty.journal);
  assert.ok(proposed?.ok);
  const applied=applyM1V188LeagueMatch(initial,empty.journal,proposed.request);
  assert.ok(applied.ok);
  const legacy=structuredClone(applied.journal);
  delete legacy.entries[0].source.conditionPolicyVersion;
  assert.equal(validateM1V188LeagueJournal(initial,legacy).ok,true);
  const continued=prepareM1V188LeagueMatch(initial,legacy);
  assert.ok(continued?.ok);
  assert.equal(continued.request.conditionPolicyVersion,2);
});

test('conditioned source lowers effective ability without mutating catalog',()=>{
  const proposal=prepareM1V188LeagueMatch(initial,empty.journal);
  assert.ok(proposal?.ok);
  const prematch=proposal.request.prematch;
  const before=JSON.stringify(prematch);
  const state=startM1V188Condition(initial);
  const first=prematch.homeLineup.starters[1];
  state.set(first,35);
  const adjusted=deriveM1V188ConditionedMatchInput(prematch,state);
  assert.ok(adjusted);
  const original=players.get(first);
  const effective=adjusted.catalog.players.find(p=>p.id===first);
  assert.ok(original&&effective);
  assert.ok(effective.attributes.finishing<=original.attributes.finishing);
  assert.ok(Object.keys(original.attributes).some(key=>
    !['naturalFitness','leadership','teamwork','aggression'].includes(key)&&
    effective.attributes[key]<original.attributes[key]),
  'lower condition must reduce at least one effective skill');
  assert.equal(effective.attributes.naturalFitness,
    original.attributes.naturalFitness);
  assert.equal(adjusted.catalog.packId,prematch.catalog.packId);
  assert.equal(JSON.stringify(prematch),before);
  assert.equal(JSON.stringify(initial.catalog),JSON.stringify(catalog));
  assert.deepEqual(deriveM1V188ConditionedMatchInput(prematch,state),
    adjusted);
  const illegal=new Map(state);
  illegal.set(first,-1);
  assert.equal(deriveM1V188ConditionedMatchInput(prematch,illegal),null);
});
