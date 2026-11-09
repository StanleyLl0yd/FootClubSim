import test from 'node:test';
import assert from 'node:assert/strict';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {deriveM2Rpl2026ResearchStandings as rank}
  from '../dist/core/m2-rpl-2026-standings.js';

const ids=Array.from({length:16},(_,i)=>'club-'+String(i+1).padStart(2,'0'));
const [A,B,C,D,E]=ids;
const fixture=(id,home,away,hg,ag)=>({
  fixtureId:id,homeClubId:home,awayClubId:away,homeGoals:hg,awayGoals:ag,
});
const blankCards=()=>Object.fromEntries(ids.map(id=>[id,0]));

test('empty current table keeps unknown rank unresolved, never ID tie-break',()=>{
  const got=rank({phase:'current',clubIds:ids,played:[]});
  assert.equal(got.ok,true);
  if(!got.ok)return;
  assert.equal(got.resolved,false);
  assert.deepEqual(got.tiers,[{
    position:1,clubIds:[...ids],unresolved:'MISSING_DISCIPLINE',
  }]);
  assert.equal(got.status,'ARTICLE_18_RESEARCH_ONLY_NOT_OFFICIAL');
});

test('Article 18 head-to-head beats better overall goal difference',()=>{
  const played=[
    fixture('a',A,B,1,0), // A and B have 3 points each, A wins H2H
    fixture('b',B,C,4,0), // B has a far better overall GD
    fixture('c',D,A,1,0),
    fixture('d',D,E,1,0), // D is alone above A/B
  ];
  const got=rank({phase:'current',clubIds:ids,played});
  assert.equal(got.ok,true);
  if(!got.ok)return;
  const tierA=got.tiers.find(t=>t.clubIds.includes(A));
  const tierB=got.tiers.find(t=>t.clubIds.includes(B));
  assert.equal(tierA?.position,2);
  assert.equal(tierB?.position,3);
  assert.equal(tierA?.unresolved,null);
  assert.equal(tierB?.unresolved,null);
  const rowA=got.rows.find(r=>r.clubId===A);
  const rowB=got.rows.find(r=>r.clubId===B);
  assert.equal(rowA?.points,rowB?.points);
  assert.ok(rowB.goalDifference>rowA.goalDifference);
});

test('Article 18 current table uses prior season only after discipline',()=>{
  const prior=Object.fromEntries(ids.map((id,i)=>[id,16-i]));
  const got=rank({phase:'current',clubIds:ids,played:[],
    disciplinaryPoints:blankCards(),previousSeasonPositions:prior});
  assert.equal(got.ok,true);
  if(!got.ok)return;
  assert.equal(got.resolved,true);
  assert.equal(got.tiers.length,16);
  assert.deepEqual(got.tiers[0],{position:1,clubIds:[ids[15]],
    unresolved:null});
});

test('final table requires full 240 ordered home/away fixtures',()=>{
  const fixtures=generateDoubleRoundRobin(ids).flatMap(r=>r.fixtures);
  const played=fixtures.map(f=>fixture(f.id,f.homeClubId,f.awayClubId,0,0));
  const incomplete=rank({phase:'final',clubIds:ids,played:played.slice(1)});
  assert.deepEqual(incomplete,{ok:false,error:'INCOMPLETE_FINAL_CALENDAR'});
  const got=rank({phase:'final',clubIds:ids,played,
    disciplinaryPoints:blankCards()});
  assert.equal(got.ok,true);
  if(!got.ok)return;
  assert.equal(got.resolved,false);
  assert.deepEqual(got.tiers,[{position:1,clubIds:[...ids],
    unresolved:'EXTRA_MATCH_REQUIRED'}]);
  assert.ok(got.rows.every(r=>r.played===30&&r.points===30));
});

test('missing discipline never promoted to zero and input stays immutable',()=>{
  const played=[fixture('x',A,B,0,0)];
  const snapshot=JSON.stringify(played);
  const got=rank({phase:'current',clubIds:ids,played,
    previousSeasonPositions:Object.fromEntries(ids.map((id,i)=>[id,i+1]))});
  assert.equal(got.ok,true);
  if(got.ok)assert.equal(got.tiers.find(t=>t.clubIds.includes(A))?.unresolved,
    'MISSING_DISCIPLINE');
  assert.equal(JSON.stringify(played),snapshot);
  assert.deepEqual(rank({phase:'current',clubIds:ids,played:[...played,...played]}),
    {ok:false,error:'DUPLICATE_FIXTURE'});
  assert.deepEqual(rank({phase:'current',clubIds:ids,played:[
    fixture('bad',A,'not-in-league',0,0)]}),
    {ok:false,error:'INVALID_INPUT'});
  assert.deepEqual(rank({phase:'current',clubIds:ids,played,
    disciplinaryPoints:{[A]:0}}),
    {ok:false,error:'INVALID_INPUT'});
});
