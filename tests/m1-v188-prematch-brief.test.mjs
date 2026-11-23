import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveM1V188PrematchBrief}
  from '../dist/core/m1-v188-prematch-brief.js';

const fixture=(id,round,homeClubId,awayClubId)=>
  ({id,round,homeClubId,awayClubId});
const played=(fixtureId,home,away)=>({
  fixtureId,result:{report:{home:{goals:home},away:{goals:away}}},
});
const schedule=[
  fixture('f0',1,'a','b'),
  fixture('f1',1,'c','b'),
  fixture('f2',2,'b','a'),
  fixture('f3',3,'a','b'),
];

test('prematch brief is empty before kickoff and reveals no future score',()=>{
  const empty=deriveM1V188PrematchBrief(schedule,[],'a','b');
  assert.deepEqual(empty,{
    ownForm:[],opponentForm:[],
    headToHead:{played:0,won:0,drawn:0,lost:0},
  });
  const committed=[
    played('f0',2,1),played('f1',1,1),played('f2',0,3),
  ];
  const before=JSON.stringify(committed);
  const brief=deriveM1V188PrematchBrief(schedule,committed,'a','b');
  assert.ok(brief);
  assert.deepEqual(brief.ownForm.map(r=>r.outcome),['win','win']);
  assert.deepEqual(brief.opponentForm.map(r=>r.outcome),
    ['loss','draw','loss']);
  assert.deepEqual(brief.ownForm.map(r=>[r.home,r.goalsFor,r.goalsAgainst]),
    [[true,2,1],[false,3,0]]);
  assert.deepEqual(brief.headToHead,{played:2,won:2,drawn:0,lost:0});
  assert.equal(JSON.stringify(committed),before);
});

test('form is bounded to last five played games, oldest first',()=>{
  const fixtures=Array.from({length:7},(_,i)=>
    fixture('m'+i,i+1,i%2?'b':'a',i%2?'a':'b'));
  const entries=fixtures.map((f,i)=>played(f.id,i%2,1));
  const brief=deriveM1V188PrematchBrief(fixtures,entries,'a','b');
  assert.ok(brief);
  assert.deepEqual(brief.ownForm.map(r=>r.round),[3,4,5,6,7]);
  assert.deepEqual(brief.opponentForm.map(r=>r.round),[3,4,5,6,7]);
  assert.equal(brief.headToHead.played,7);
  assert.equal(brief.headToHead.won+brief.headToHead.drawn+
    brief.headToHead.lost,7);
});

test('mismatched calendar, impossible scores and duplicate club are refused',()=>{
  assert.equal(deriveM1V188PrematchBrief(
    schedule,[played('missing',1,0)],'a','b'),null);
  assert.equal(deriveM1V188PrematchBrief(
    schedule,[played('f0',-1,0)],'a','b'),null);
  assert.equal(deriveM1V188PrematchBrief(
    schedule,[played('f0',Number.NaN,0)],'a','b'),null);
  assert.equal(deriveM1V188PrematchBrief(
    schedule,[],'a','a'),null);
  assert.equal(deriveM1V188PrematchBrief(
    [],[played('f0',0,0)],'a','b'),null);
});
