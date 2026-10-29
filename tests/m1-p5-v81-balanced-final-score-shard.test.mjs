import test from 'node:test';
import assert from 'node:assert/strict';
import {v81BalancedPlans,runM1V81BalancedScoreShard}
  from '../scripts/m1-p5-v81-balanced-final-score-shard.mjs';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';

test('v81 covers all 240 regular fixtures with balanced mirrored legs',()=>{
  const plans=v81BalancedPlans();
  assert.equal(plans.length,16);
  const index=new Set();
  for(const p of plans){
    assert.equal(p.fixtureCount,15);
    assert.equal(p.seedCount,16);
    for(let i=p.firstFixture;i<p.firstFixture+p.fixtureCount;i++){
      assert.ok(!index.has(i),'duplicate fixture '+i);
      index.add(i);
    }
  }
  assert.equal(index.size,240);
  assert.equal(Math.min(...index),1);
  assert.equal(Math.max(...index),240);
  const catalog=createSyntheticRplScaleCatalog(77);
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures);
  assert.equal(fixtures.length,240);
  const games=new Map(),ordered=new Map();
  for(const f of fixtures){
    assert.ok(!games.has(f.id));
    games.set(f.id,f);
    const key=[f.homeClubId,f.awayClubId].sort().join(':');
    const entry=ordered.get(key)??[];
    entry.push(f);
    ordered.set(key,entry);
  }
  assert.equal(ordered.size,120);
  for(const pair of ordered.values()){
    assert.equal(pair.length,2);
    assert.equal(pair[0].homeClubId,pair[1].awayClubId);
    assert.equal(pair[0].awayClubId,pair[1].homeClubId);
  }
  for(const club of catalog.clubs){
    assert.equal(fixtures.filter(f=>f.homeClubId===club.id).length,15);
    assert.equal(fixtures.filter(f=>f.awayClubId===club.id).length,15);
  }
});

test('v81 first shard exposes final-score conservation and fixed source provenance',()=>{
  const row=runM1V81BalancedScoreShard(0);
  assert.equal(row.synthetic.attempted,240);
  assert.equal(row.synthetic.accepted+row.synthetic.rejected,240);
  assert.equal(row.synthetic.homeWins+row.synthetic.awayWins+
    row.synthetic.draws,row.synthetic.accepted);
  assert.equal(row.synthetic.homeGoals+row.synthetic.awayGoals,
    row.synthetic.goals);
  assert.ok(row.synthetic.zeroZero<=row.synthetic.draws);
  assert.equal(row.perFixture.length,15);
  assert.ok(row.perFixture.every(x=>x.attempted===16));
  assert.match(row.deterministicSha256,/^[a-f0-9]{64}$/);
  assert.equal(row.sourceReplayBound,true);
  assert.equal(row.balancedDoubleRoundRobinFullCalendar,true);
  assert.equal(row.originalProductionRngUnmodified,true);
  assert.equal(row.formalCalibrationAccepted,false);
  assert.equal(row.holdout2024_25Used,false);
});

test('v81 invalid out-of-bounds group is rejected',()=>{
  for(const g of [-1,16,17,0.5,NaN,Infinity,null,'0']){
    assert.throws(()=>runM1V81BalancedScoreShard(g),
      /INVALID_V81_FIXTURE_GROUP/);
  }
});
