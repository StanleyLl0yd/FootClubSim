import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeM1P5ScorelineOutcomes as count}
  from '../scripts/m1-p5-scoreline-outcomes.mjs';

test('fixture outcomes distinguish home, draw, away and nil-nil',()=>{
  const rows=[['a',0,0],['b',2,1],['c',0,1],['d',3,3],['e',0,2]];
  const before=JSON.stringify(rows),r=count(rows);
  assert.deepEqual(r,{matches:5,homeWins:1,draws:2,awayWins:2,
    scorelessDraws:1,homeGoals:5,awayGoals:7});
  assert.equal(r.homeWins+r.draws+r.awayWins,r.matches);
  assert.equal(JSON.stringify(rows),before);
});
test('outcomes reject duplicate fixtures and forged score formats',()=>{
  for(const rows of [
    [],[['a',0,0],['a',2,1]],[['a',-1,0]],
    [['a',NaN,0]],[['a',Infinity,0]],
    [['a',1.5,0]],[['a',0,0,0]],[['',0,0]],
    [['a',0,'0']],[[null,0,0]]
  ])assert.throws(()=>count(rows),/INVALID_MATCH_OUTCOME_ROWS/);
});
test('outcome totals reject safe-integer overflow across fixtures and sides',()=>{
  const big=Number.MAX_SAFE_INTEGER;
  for(const rows of [
    [['a',big,0],['b',1,0]],
    [['a',0,big],['b',0,1]],
    [['a',big,0],['b',0,1]],
  ])assert.throws(()=>count(rows),/INVALID_MATCH_OUTCOME_ROWS/);
});
