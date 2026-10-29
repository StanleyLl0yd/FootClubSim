import test from 'node:test';
import assert from 'node:assert/strict';
import {v79Plans,runM1V79FinalScoreShard}
  from '../scripts/m1-p5-v79-final-score-shard.mjs';

test('v79 full 16-shard mapping covers each original 32x128 index exactly once',()=>{
  const plans=v79Plans(),pairs=new Set();
  assert.equal(plans.length,16);
  for(const p of plans){
    for(let f=p.firstfixture;f<p.firstfixture+p.fixtures;f++){
      for(let i=p.start;i<p.start+p.count;i++){
        const pair=f+':'+i;
        assert.ok(!pairs.has(pair),pair);
        pairs.add(pair);
      }
    }
  }
  assert.equal(pairs.size,4096);
  assert.ok(pairs.has('9:1')&&pairs.has('40:128'));
  assert.ok(!pairs.has('1:1')&&!pairs.has('41:1'));
  for(const args of [[-1,0],[0,-1],[0,4],[4,0],
    [0,0.1],['0',0],[null,0]]){
    assert.throws(()=>runM1V79FinalScoreShard(...args),
      /INVALID_P5_V74_SHARD/);
  }
});

test('v79 first source-replayed final-score shard yields typed conservative rows',()=>{
  const x=runM1V79FinalScoreShard(0,0);
  assert.equal(x.synthetic.attempted,256);
  assert.equal(x.synthetic.accepted+x.synthetic.rejected,256);
  assert.equal(x.synthetic.draws+x.synthetic.homeWins+
    x.synthetic.awayWins,x.synthetic.accepted);
  assert.equal(x.synthetic.finalScoreless<=x.synthetic.draws,true);
  assert.equal(x.reference.totalScoreGoals,609);
  assert.equal(x.reference.fullTimeZeroZero,15);
  assert.equal(x.perFixture.length,8);
  assert.equal(x.sourceReplayBound,true);
  assert.equal(x.formalReleaseCalibrationAccepted,false);
  assert.equal(x.holdout2024_25Used,false);
  assert.match(x.deterministicSha256,/^[a-f0-9]{64}$/);
});
