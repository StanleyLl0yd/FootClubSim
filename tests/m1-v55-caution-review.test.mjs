import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveM1V55CautionReview as derive,
  verifyM1V55CautionReview as verify}
  from '../dist/core/m1-v55-caution-review.js';
import {admitM1V56ModelledAutomaticDiscipline as admit}
  from '../dist/core/m1-v56-automatic-discipline.js';
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
      // Ensure the tested completed history has no OTHER unresolved KDK
      // straight-red cases or auto one-game double-yellow sanctions.
      if(result.physical.playerRows.some(row=>row.teamId===teamId &&
          (row.straightRedDismissals>0 ||
            row.secondYellowDismissals>0)))continue;
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

test('later named but unused bench player still triggers independent review',()=>{
  const {journal,target,scored}=fourMatchJournal();
  const fifth=schedule[4],base=prematch(fifth,1);
  const side=fifth.homeClubId===teamId?'homeLineup':'awayLineup';
  const team=base[side];
  assert.ok(team.starters.includes(target));
  const entrant=team.bench[0];
  assert.ok(entrant);
  const input={
    ...base,
    [side]:{
      ...team,
      starters:team.starters.map(id=>id===target?entrant:id),
      bench:team.bench.map(id=>id===entrant?target:id),
    },
  };
  let found=null;
  for(let seed=1;seed<=40;seed++){
    input.rngSeed=seed;
    const candidate=simulate(input,policy);
    if(candidate.ok){found=candidate;break;}
  }
  assert.ok(found,'bench-only source fixture cannot be replayed');
  const cmd={schemaVersion:6,commandId:'caution-unused-bench',
    careerId:career.careerId,expectedRevision:4,
    prematch:input,policy,halfTimeCommands:[],inPlayCommands:[],
    result:found};
  const expanded=accepted(apply(career,journal,[cmd],4));
  const reviewed=accepted(derive(career,expanded));
  const row=reviewed.laterMatchdayListings.find(x=>
    x.playerId===target&&x.fixtureId===fifth.id);
  assert.ok(row);
  assert.equal(row.listedInStartingXI,false);
  assert.equal(row.listedInNamedBench,true);
  assert.equal(row.physicalSeconds,0);
  assert.equal(row.observedFourthCautionFixtureId,
    scored[3].input.fixture.id);
  assert.equal(verify(career,expanded,reviewed),true);
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

test('v56 first synthetic fixture is safe under empty replayed career',()=>{
  const journal=accepted(start(career));
  const fixture=schedule[0];
  const p=prematch(fixture,1);
  const review=admit(career,journal,p,teamId);
  assert.equal(review.ok,true,JSON.stringify(review).slice(0,400));
  assert.equal(review.status,'MODELLED_AUTOMATIC_BANS_CONTROLLED_CLUB_ONLY');
  assert.equal(review.verifiedPriorClubFixtures,0);
  assert.deepEqual(review.automaticBans,[]);
  assert.equal(review.opponentEligibilityChecked,false);
  assert.equal(review.realRplSanctionOrKdkAuthorityAuthenticated,false);
});

test('v56 automatically denies next match XI and bench after fourth simple modelled caution',()=>{
  const {journal,target}=fourMatchJournal();
  const fifth=schedule[4];
  const unmodified=prematch(fifth,1);
  const rejected=admit(career,journal,unmodified,teamId);
  assert.equal(rejected.ok,false);
  assert.equal(rejected.error,'CURRENT_LINEUP_BLOCKED');
  assert.equal(rejected.affectedFixtureId,fifth.id);
  assert.ok(rejected.affectedPlayerIds.includes(target));
  // Removing the player entirely from XI and matchday bench restores
  // this club's narrow automatic-ban admission (not medical/KDK clearance).
  const side=fifth.homeClubId===teamId?'homeLineup':'awayLineup';
  const starting=unmodified[side];
  const entrant=starting.bench[0];
  const clear={
    ...unmodified,
    [side]:{
      ...starting,
      starters:starting.starters.map(id=>id===target?entrant:id),
      bench:starting.bench.filter(id=>id!==entrant),
    },
  };
  const admitted=admit(career,journal,clear,teamId);
  assert.equal(admitted.ok,true,JSON.stringify(admitted).slice(0,500));
  assert.equal(admitted.automaticBans.some(x=>x.playerId===target &&
    x.reason==='four-distinct-simple-cautions'),true);
  assert.equal(admitted.verifiedPriorClubFixtures,4);
  assert.equal(admitted.currentNamedLineupClearOfAutomaticBans,true);
  assert.equal(admitted.resolvedStraightRedOrAppealAuthority,false);
  assert.equal(admitted.medicalFitnessVerified,false);
});

test('v56 incomplete club history never treats unknown games as zero cautions',()=>{
  const early=accepted(start(career));
  const fifth=schedule[4];
  const response=admit(career,early,prematch(fifth,1),teamId);
  assert.equal(response.ok,false);
  assert.equal(response.error,'PRIOR_CLUB_MATCHES_MISSING');
  assert.deepEqual(response.missingFixtureIds,
    schedule.slice(0,4).map(x=>x.id));
  const {journal}=fourMatchJournal();
  assert.deepEqual(admit(career,journal,prematch(schedule[0],1),teamId),
    {ok:false,error:'ALREADY_COMMITTED_FIXTURE'});
  assert.deepEqual(admit(career,journal,prematch(fifth,1),'not-a-team'),
    {ok:false,error:'UNRELATED_CLUB'});
});

test('v56 old matchday ban violation remains visible as historical conflict',()=>{
  const {journal,target}=fourMatchJournal();
  const fifth=schedule[4];
  let p=prematch(fifth,1),source=null;
  for(let seed=1;seed<=32;seed++){
    p.rngSeed=seed;
    const trial=simulate(p,policy);
    if(trial.ok){source=trial;break;}
  }
  assert.ok(source);
  const cmd={schemaVersion:6,commandId:'v56-invalid-model-matchday',
    careerId:career.careerId,expectedRevision:4,
    prematch:p,policy,halfTimeCommands:[],inPlayCommands:[],result:source};
  const later=accepted(apply(career,journal,[cmd],4));
  const response=admit(career,later,prematch(schedule[5],1),teamId);
  assert.equal(response.ok,false);
  assert.equal(response.error,'HISTORICAL_AUTO_BAN_CONFLICT');
  assert.equal(response.affectedFixtureId,fifth.id);
  assert.ok(response.affectedPlayerIds.includes(target));
});

test('v56 forged journal and invalid prematch fail before any eligibility claim',()=>{
  const {journal}=fourMatchJournal();
  const p=prematch(schedule[4],1);
  const corrupt=structuredClone(journal);
  corrupt.results[0].facts.playerRows[0].physicalSeconds++;
  assert.deepEqual(admit(career,corrupt,p,teamId),
    {ok:false,error:'INVALID_INITIAL_OR_JOURNAL'});
  assert.deepEqual(admit(career,journal,{...p,rngSeed:0},teamId),
    {ok:false,error:'INVALID_PREMATCH'});
  assert.deepEqual(admit(career,journal,null,teamId),
    {ok:false,error:'INVALID_PREMATCH'});
  let reads=0;
  const evil=structuredClone(journal);
  Object.defineProperty(evil.results[0].source.prematch,'rngSeed',{
    enumerable:true,get(){reads++;return 3;},
  });
  assert.deepEqual(admit(career,evil,p,teamId),
    {ok:false,error:'INVALID_INITIAL_OR_JOURNAL'});
  assert.equal(reads,0);
});
