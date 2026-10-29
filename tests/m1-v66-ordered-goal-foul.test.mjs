import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V29CausalMedical as simulate,
  verifyM1V29CausalMedical as verify}
  from '../dist/core/m1-v29-causal-medical.js';
import {diagnoseM1V29SourceFailure as diagnose}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const byClub=new Map(catalog.clubs.map(x=>[x.id,x]));
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(x=>x.id))
  .flatMap(x=>x.fixtures).slice(0,8);
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
function prematch(fixture,seed){
  return {
    schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,
    homeLineup:defaultSyntheticLineup(byClub.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(byClub.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
  };
}
const pairs=events=>{
  const kickoffs=new Map(events.filter(e=>e.kind==='restart-kickoff')
    .map(e=>[e.runningSeconds,e]));
  return events.filter(e=>e.kind==='synthetic-foul-whistle')
    .flatMap(foul=>{
      const kickoff=kickoffs.get(foul.runningSeconds);
      return kickoff?[{kickoff,foul}]:[];
    });
};

test('replayed goal kick-off precedes next generated foul in one coarse clock bucket',()=>{
  let found=null,attempted=0;
  outer: for(const fixture of fixtures){
    for(let seed=1;seed<=32;seed++){
      attempted++;
      const input=prematch(fixture,seed);
      const result=simulate(input,policy);
      if(!result.ok)continue;
      const overlap=pairs(result.source.match.events);
      if(!overlap.length)continue;
      found={input,result,overlap};
      break outer;
    }
  }
  assert.ok(found,'No source-bound goal/foul overlap in 256 deterministic cases');
  assert.ok(attempted<=256);
  const events=found.result.source.match.events;
  for(const {kickoff,foul} of found.overlap){
    assert.equal(kickoff.runningSeconds,foul.runningSeconds);
    assert.ok(kickoff.sequence<foul.sequence);
    const goal=events.find(e=>e.kind==='goal-whistle'&&
      e.sourceEventId===kickoff.sourceEventId);
    assert.ok(goal);
    assert.ok(goal.sequence<kickoff.sequence);
    assert.equal(goal.runningSeconds+1,kickoff.runningSeconds);
    const restart=events.find(e=>e.kind==='synthetic-foul-restart'&&
      e.sourceEventId===foul.sourceEventId);
    assert.ok(restart);
    assert.ok(foul.sequence<restart.sequence);
  }
  assert.equal(verify(found.input,policy,[],[],found.result),true);
  assert.deepEqual(simulate(found.input,policy),found.result);
  assert.deepEqual(diagnose(found.input,policy),{
    ok:true,error:null,sourceError:null,sourceSubreason:null,
  });
  const forged=structuredClone(found.result);
  forged.source.match.events[0].kind='full-time';
  assert.equal(verify(found.input,policy,[],[],forged),false);
});
