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


function simulatedAt(n,goals) {
  return{...zero.journal,revision:n,entries:fixtures.slice(0,n).map(
    fixture=>{
      const [hg,ag]=goals(fixture);
      return{fixtureId:fixture.id,round:fixture.round,
        result:{report:{home:{goals:hg},away:{goals:ag}}}};
    })};
}

test('title won on the final fixture is celebrated, not only early clinches',()=>{
  const last=fixtures.at(-1);
  const result=fixture=>fixture.id===last.id?[1,0]:[0,0];
  assert.equal(deriveM1V188Champion(career,simulatedAt(239,result)),null);
  const champion=deriveM1V188Champion(career,simulatedAt(240,result));
  assert.equal(champion?.clubId,last.homeClubId);
  assert.equal(champion?.clinchedRound,30);
  assert.equal(champion?.remainingRounds,0);
  assert.equal(champion?.seasonComplete,true);
  assert.equal(champion?.provisionalTieBreak,undefined);
});

test('equal final points with a higher goal difference wins the provisional table',()=>{
  const first=catalog.clubs[0].id;
  const outcomes=fixture=>{
    const a=first,b=catalog.clubs[1].id;
    if(fixture.homeClubId===a&&fixture.awayClubId===b)return[3,0];
    if(fixture.homeClubId===b&&fixture.awayClubId===a)return[1,0];
    if(fixture.homeClubId===a)return[2,0];
    if(fixture.awayClubId===a)return[0,2];
    if(fixture.homeClubId===b)return[1,0];
    if(fixture.awayClubId===b)return[0,1];
    return[0,0];
  };
  const winner=deriveM1V188Champion(career,simulatedAt(240,outcomes));
  assert.equal(winner?.clubId,first);
  assert.equal(winner?.points,87);
  assert.equal(winner?.clinchedRound,30);
  assert.equal(winner?.provisionalTieBreak,'goal-difference');
  assert.equal(deriveM1V188Champion(career,simulatedAt(239,outcomes)),null);
});

test('goals scored distinguish teams with tied points and goal difference',()=>{
  const a=catalog.clubs[0].id,b=catalog.clubs[1].id;
  const outcomes=fixture=>{
    const {homeClubId:h,awayClubId:v}=fixture;
    if((h===a&&v===b)||(h===b&&v===a))return[1,0];
    if(h===a)return[2,1];
    if(v===a)return[1,2];
    if(h===b)return[1,0];
    if(v===b)return[0,1];
    return[0,0];
  };
  const champion=deriveM1V188Champion(career,simulatedAt(240,outcomes));
  assert.equal(champion?.clubId,a);
  assert.equal(champion?.provisionalTieBreak,'goals-scored');
  assert.equal(champion?.seasonComplete,true);
});

test('club-id sorting alone never certifies an unresolved tied title',()=>{
  const allDraws=()=>[0,0];
  assert.equal(deriveM1V188Champion(career,simulatedAt(240,allDraws)),null);
});
