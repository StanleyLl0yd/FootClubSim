import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveM1V55CautionReview as derive,
  verifyM1V55CautionReview as verify}
  from '../dist/core/m1-v55-caution-review.js';
import {startM1V32ExposureJournal as start,
  applyM1V32ExposureBatch as apply}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {deriveM1V31CausalPhysicalExposure as simulate}
  from '../dist/core/m1-v24-physical-exposure.js';
import {createInitialCareer} from '../dist/core/save.js';
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
const career=createInitialCareer(catalog,catalog.clubs[0].id,
  42,'m1-v55-caution-review-career');
const clubs=new Map(catalog.clubs.map(x=>[x.id,x]));
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const teamId=fixtures[0].homeClubId;
const schedule=fixtures.filter(f=>f.homeClubId===teamId ||
  f.awayClubId===teamId).sort((a,b)=>a.round-b.round);
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
function prematch(fixture,seed){
  return {
    schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,
    homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
  };
}
const accepted=x=>{
  assert.equal(x.ok,true,JSON.stringify(x).slice(0,450));
  return x.journal??x;
};
let cached;
function fourMatchJournal(){
  if(cached)return structuredClone(cached);
  const scored=[];
  let target=null;
  for(let i=0;i<4;i++){
    const fixture=schedule[i];
    assert.ok(fixture);
    let winner=null;
    for(let seed=1;seed<=128;seed++){
      const input=prematch(fixture,seed);
      const result=simulate(input,policy);
      if(!result.ok)continue;
      const matches=result.physical.playerRows.filter(row=>
        row.teamId===teamId && row.firstYellowCards===1 &&
        row.secondYellowDismissals===0 &&
        row.straightRedDismissals===0 &&
        (target===null || row.playerId===target));
      if(matches.length===0)continue;
      winner={input,result,playerId:matches[0].playerId};
      break;
    }
    assert.ok(winner,'no replayed caution for '+fixture.id);
    if(target===null)target=winner.playerId;
    scored.push(winner);
  }
  // Post out of fixture order, preserving the journal's CAS revision contract.
  const post=[scored[3],scored[0],scored[2],scored[1]];
  const commands=post.map((item,revision)=>({
    schemaVersion:6,commandId:'caution-apply-'+revision,
    careerId:career.careerId,expectedRevision:revision,
    prematch:item.input,policy,halfTimeCommands:[],inPlayCommands:[],
    result:item.result,
  }));
  const journal=accepted(apply(career,accepted(start(career)),
    commands,0));
  cached={journal,target,scored};
  return structuredClone(cached);
}

test('empty replayed career contains no hypothetical card or suspension',()=>{
  const journal=accepted(start(career));
  const result=accepted(derive(career,journal));
  assert.deepEqual(result.signals,[]);
  assert.deepEqual(result.laterMatchdayListings,[]);
  assert.equal(result.fullSourceReplayVerified,true);
  assert.equal(result.automaticEligibilityAllowed,false);
  assert.equal(result.externallyAuthenticatedRplDiscipline,false);
  assert.equal(verify(career,journal,result),true);
});

test('four distinct match cautions follow round, not insertion order',()=>{
  const {journal,target,scored}=fourMatchJournal();
  const result=accepted(derive(career,journal));
  assert.equal(result.fixtureCount,4);
  assert.equal(result.revision,4);
  assert.equal(result.countedBySyntheticRoundNotCommitOrder,true);
  const player=result.signals.filter(x=>x.playerId===target &&
    x.teamId===teamId);
  assert.equal(player.length,4);
  assert.deepEqual(player.map(x=>x.cumulativeDistinctCautionMatches),
    [1,2,3,4]);
  assert.deepEqual(player.map(x=>x.round),
    scored.map(x=>x.input.fixture.round));
  assert.deepEqual(player.map(x=>x.postedRevision),[2,4,3,1]);
  assert.deepEqual(player.map(x=>x.fourthDistinctCautionReviewSignal),
    [false,false,false,true]);
  assert.ok(player.every(x=>x.excludedFromSimpleCautionThreshold===false));
  assert.equal(player[3].nextSyntheticRoundFixtureId,schedule[4].id);
  assert.equal(result.automaticEligibilityAllowed,false);
  assert.equal(result.servedMatchOrAppealStatusKnown,false);
  assert.equal(result.externallyAuthenticatedRplDiscipline,false);
  assert.equal(verify(career,journal,result),true);
  assert.deepEqual(derive(career,journal),result);
});

test('later named starter generates review listing without implied legal ban',()=>{
  const {journal,target,scored}=fourMatchJournal();
  const fifth=schedule[4],input=prematch(fifth,1);
  let result=null;
  for(let seed=1;seed<=40;seed++){
    input.rngSeed=seed;
    const trial=simulate(input,policy);
    if(trial.ok){result=trial;break;}
  }
  assert.ok(result);
  const cmd={schemaVersion:6,commandId:'caution-later-fixture',
    careerId:career.careerId,expectedRevision:4,
    prematch:input,policy,halfTimeCommands:[],inPlayCommands:[],
    result};
  const expanded=accepted(apply(career,journal,[cmd],4));
  const review=accepted(derive(career,expanded));
  const later=review.laterMatchdayListings.find(x=>
    x.playerId===target&&x.teamId===teamId&&x.fixtureId===fifth.id);
  assert.ok(later);
  assert.equal(later.listedInStartingXI,true);
  assert.equal(later.listedInNamedBench,false);
  assert.equal(later.observedFourthCautionFixtureId,
    scored[3].input.fixture.id);
  assert.equal(later.round,fifth.round);
  assert.equal(later.postedRevision,5);
  assert.equal(review.automaticEligibilityAllowed,false);
  assert.equal(verify(career,expanded,review),true);
});

test('tampered caution facts, forged authority and untrusted history fail',()=>{
  const {journal}=fourMatchJournal();
  const source=accepted(derive(career,journal));
  const forged={...source,automaticEligibilityAllowed:true};
  assert.equal(verify(career,journal,forged),false);
  const forgedCount=structuredClone(source);
  forgedCount.signals.at(-1).cumulativeDistinctCautionMatches++;
  assert.equal(verify(career,journal,forgedCount),false);
  const tampered=structuredClone(journal);
  tampered.results[0].facts.playerRows[0].firstYellowCards++;
  assert.deepEqual(derive(career,tampered),
    {ok:false,error:'INVALID_JOURNAL'});
  const previous={...journal,schemaVersion:5};
  assert.deepEqual(derive(career,previous),
    {ok:false,error:'INVALID_JOURNAL'});
  let accessed=0;
  const getter=structuredClone(journal);
  Object.defineProperty(getter.results[0].source.prematch,'fixture',{
    enumerable:true,get(){accessed++;return null;},
  });
  assert.deepEqual(derive(career,getter),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.equal(accessed,0);
});
