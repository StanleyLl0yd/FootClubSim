import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectM1V29SourceOpenPlayXg as inspect,
  diagnoseM1V29SourceFailure as diagnose}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {simulateM1V29CausalMedical as simulate,
  verifyM1V29CausalMedical as verify}
  from '../dist/core/m1-v29-causal-medical.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION}
  from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan}
  from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const byClub=new Map(catalog.clubs.map(c=>[c.id,c]));
const fixture=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
function input(seed){
  return {
    schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,homeLineup:defaultSyntheticLineup(byClub.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(byClub.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
  };
}
test('opt-in v69 xG is exact v8 source, never a made-up real-RPL statistic',()=>{
  let totalShots=0,totalXg=0,totalGoals=0,observed=0;
  for(let seed=1;seed<=12;seed++){
    const pre=input(seed),original=simulate(pre,policy);
    const x=inspect(pre,policy);
    assert.equal(x.ok,original.ok);
    if(!x.ok)continue;
    assert.equal(x.status,'INTERNAL_V8_OPEN_PLAY_XG_NOT_CALIBRATED');
    assert.equal(x.schemaVersion,1);
    assert.equal(x.sourceOpenPlayGoals,
      original.source.match.finalScore.home+
      original.source.match.finalScore.away);
    assert.equal(x.sourceShots,original.source.match.events.filter(e=>
      e.kind==='shot').length);
    assert.ok(Number.isSafeInteger(x.sourceOpenPlayXgMilli));
    assert.ok(x.sourceOpenPlayXgMilli>=20*x.sourceShots);
    assert.ok(x.sourceOpenPlayXgMilli<=600*x.sourceShots);
    assert.equal(x.fullSourceReplayVerified,true);
    assert.equal(x.independentRealXgReferenceAvailable,false);
    assert.equal(x.modelNotTuned,true);
    assert.deepEqual(inspect(pre,policy),x);
    assert.equal(verify(pre,policy,[],[],original),true);
    assert.equal(diagnose(pre,policy).ok,true);
    assert.equal(Object.hasOwn(original,'sourceOpenPlayXgMilli'),false);
    totalShots+=x.sourceShots;
    totalXg+=x.sourceOpenPlayXgMilli;
    totalGoals+=x.sourceOpenPlayGoals;
    observed++;
  }
  assert.ok(observed>=9);
  assert.ok(totalShots>=totalGoals);
  assert.ok(totalXg>0);
});
test('invalid caller and malformed source fail closed without fabricated xG',()=>{
  const missing=inspect(null,policy);
  assert.equal(missing.ok,false);
  assert.equal(Object.hasOwn(missing,'sourceOpenPlayXgMilli'),false);
  const wrong=structuredClone(input(1));
  wrong.fixture.id=''; // Invalid stable ID, not merely an unofficial fixture.
  const result=inspect(wrong,policy);
  assert.equal(result.ok,false);
  assert.equal(Object.hasOwn(result,'sourceOpenPlayXgMilli'),false);
});
