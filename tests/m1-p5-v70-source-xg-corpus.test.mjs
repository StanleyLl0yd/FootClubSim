import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {measureM1V29SourceXgCohort as measure}
  from '../scripts/m1-p5-v70-source-xg-corpus.mjs';
import {inspectM1V29SourceOpenPlayXg as inspect}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

function firstInput(seed){
  const catalog=createSyntheticRplScaleCatalog(77);
  const byClub=new Map(catalog.clubs.map(c=>[c.id,c]));
  const fixture=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures)[0];
  return {schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,homeLineup:defaultSyntheticLineup(byClub.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(byClub.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:seed};
}
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
test('v70 conserves exact v69 source xG with one identical seeded fixture',()=>{
  const out=measure({firstfixture:1,fixtures:1,start:1,count:3});
  const singles=[1,2,3].map(seed=>inspect(firstInput(seed),policy));
  assert.equal(out.schemaVersion,1);
  assert.equal(out.status,'INTERNAL_V8_XG_CORPUS_NOT_CALIBRATED');
  assert.equal(out.attempted,3);
  assert.equal(out.accepted,3);
  assert.equal(out.rejected,0);
  assert.equal(out.sourceShots,singles.reduce((sum,x)=>sum+x.sourceShots,0));
  assert.equal(out.sourceOpenPlayGoals,
    singles.reduce((sum,x)=>sum+x.sourceOpenPlayGoals,0));
  assert.equal(out.sourceOpenPlayXgMilli,
    singles.reduce((sum,x)=>sum+x.sourceOpenPlayXgMilli,0));
  assert.equal(out.sourceGoalsPerShot,
    out.sourceOpenPlayGoals/out.sourceShots);
  assert.equal(out.modelXgPerShot,
    out.sourceOpenPlayXgMilli/(1000*out.sourceShots));
  assert.equal(out.holdout2024_25Used,false);
  assert.equal(out.independentRealXgReferenceAvailable,false);
  assert.equal(out.refereeMedicalAuthorityAuthenticated,false);
  assert.deepEqual(measure({firstfixture:1,fixtures:1,start:1,count:3}),out);
});
test('bounded disjoint fixture shards preserve attempted and acceptance counts',()=>{
  const a=measure({firstfixture:1,fixtures:2,start:1,count:2});
  const b=measure({firstfixture:3,fixtures:2,start:1,count:2});
  assert.equal(a.attempted,4);
  assert.equal(b.attempted,4);
  assert.equal(a.accepted+a.rejected,a.attempted);
  assert.equal(b.accepted+b.rejected,b.attempted);
  assert.notEqual(a.deterministicSha256,b.deterministicSha256);
  assert.equal(new Set([...a.fixtureSummaries,...b.fixtureSummaries]
    .map(x=>x.fixtureId)).size,4);
});
test('invalid ranges and forged options fail closed',()=>{
  for(const options of [null,[],{fixtures:33},{firstfixture:241},
    {firstfixture:239,fixtures:3},{count:129},{start:0},
    {start:0xffffffff,count:2},{count:1.3},{count:'4'},
    {unknown:true},{__proto__:null,firstfixture:Infinity}]){
    assert.throws(()=>measure(options),/INVALID_XG_CORPUS_OPTIONS|BOUNDED_XG_CORPUS_REQUIRED/);
  }
});
test('direct CLI emits one parseable v70 observation and rejects unsafe args',()=>{
  const script='scripts/m1-p5-v70-source-xg-corpus.mjs';
  const cmd=(args)=>execFileSync(process.execPath,[script,...args],
    {cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const out=JSON.parse(cmd(['--count=1','--fixtures=1']));
  assert.equal(out.attempted,1);
  assert.equal(out.holdout2024_25Used,false);
  assert.throws(()=>cmd(['--count=0']),/M1_V70_SOURCE_XG_ERROR/);
  assert.throws(()=>cmd(['--fixtures=1','--fixtures=2']),
    /M1_V70_SOURCE_XG_ERROR/);
});
