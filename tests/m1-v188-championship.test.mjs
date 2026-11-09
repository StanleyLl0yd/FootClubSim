import test from 'node:test';
import assert from 'node:assert/strict';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188Champion}
  from '../dist/core/m1-v188-championship.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const career=createInitialCareer(
  catalog,catalog.clubs[0].id,42,'v188-champion-test');
const zero=startM1V188LeagueJournal(career);
if(!zero.ok)throw Error(zero.error);
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(round=>round.fixtures);
const entries=fixtures.map(fixture=>{
  const selected=career.selectedClubId;
  const hg=fixture.homeClubId===selected?2:
    fixture.awayClubId===selected?0:1;
  const ag=fixture.awayClubId===selected?2:
    fixture.homeClubId===selected?0:1;
  return{fixtureId:fixture.id,
    round:fixture.round,result:{report:{home:{goals:hg},away:{goals:ag}}}};
});
const at=n=>({...zero.journal,revision:n,entries:entries.slice(0,n)});

test('title is never awarded until every rival maximum is strictly lower',()=>{
  assert.equal(deriveM1V188Champion(career,at(0)),null);
  assert.equal(deriveM1V188Champion(career,at(8)),null);
  const first=Array.from({length:240},(_,index)=>
    deriveM1V188Champion(career,at(index+1))).find(Boolean);
  assert.ok(first,'No mathematically clinched title');
  assert.equal(first.clubId,career.selectedClubId);
  assert.ok(first.clinchedRound<30);
  assert.ok(first.remainingRounds>0);
  const full=deriveM1V188Champion(career,at(240));
  assert.equal(full?.clubId,career.selectedClubId);
  assert.equal(full?.seasonComplete,true);
  assert.equal(full?.points,90);
  assert.equal(full?.clinchedRound,first.clinchedRound);
});

test('tampered source fixture order cannot award a title',()=>{
  const wrong=at(240);
  wrong.entries[0]={...wrong.entries[0],fixtureId:'wrong'};
  assert.equal(deriveM1V188Champion(career,wrong),null);
});
