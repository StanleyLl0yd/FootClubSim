import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateM1V58TwoClubDisciplineGatedFixture as run,
  verifyM1V58TwoClubDisciplineGatedFixture as verify}
  from '../dist/core/m1-v58-two-club-discipline-fixture.js';
import {startM1V32ExposureJournal as start,
  applyM1V32ExposureBatch as apply}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {deriveM1V31CausalPhysicalExposure as source}
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
  42,'m1-v58-two-club-gate-career');
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const rounds=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id));
const first=rounds[0].fixtures[0],second=rounds[1].fixtures[0];
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
const input=(fixture,seed=42)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});
const ok=result=>{
  assert.equal(result.ok,true,JSON.stringify(result).slice(0,450));
  return result.journal??result;
};
const empty=()=>ok(start(career));
function acceptableMatch(fixture){
  for(let seed=1;seed<=128;seed++){
    const i=input(fixture,seed);
    const result=source(i,policy);
    if(!result.ok)continue;
    const red=result.physical.playerRows.some(row=>
      row.straightRedDismissals||row.secondYellowDismissals);
    if(!red)return {i,result};
  }
  assert.fail('No suitable fully replayed first-round fixture: '+fixture.id);
}
let prior;
function twoPriorMatches(){
  if(prior)return structuredClone(prior);
  const needed=rounds[0].fixtures.filter(f=>
    [second.homeClubId,second.awayClubId].some(club=>
      f.homeClubId===club||f.awayClubId===club));
  assert.ok(needed.length===1||needed.length===2);
  const commands=needed.map((fixture,index)=>{
    const {i,result}=acceptableMatch(fixture);
    return {schemaVersion:6,commandId:'v58-round-one-'+index,
      careerId:career.careerId,expectedRevision:index,
      prematch:i,policy,halfTimeCommands:[],inPlayCommands:[],
      result};
  });
  const journal=ok(apply(career,empty(),commands,0));
  prior={journal,commands};
  return structuredClone(prior);
}

test('two-club admission executes actual replayed first fixture only once both gates pass',()=>{
  const journal=empty(),before=structuredClone(journal);
  let checked;
  for(let seed=1;seed<=32;seed++){
    const i=input(first,seed);
    const result=run(career,journal,i,policy);
    if(result.ok){checked={input:i,run:result};break;}
  }
  assert.ok(checked,'no v29 replayed first fixture');
  const {run:result}=checked;
  assert.equal(result.schemaVersion,1);
  assert.equal(result.home.verifiedPriorClubFixtures,0);
  assert.equal(result.away.verifiedPriorClubFixtures,0);
  assert.deepEqual(result.home.automaticBans,[]);
  assert.deepEqual(result.away.automaticBans,[]);
  assert.equal(result.match.fixtureId,first.id);
  assert.equal(result.match.replayBoundPhysicalTime,true);
  assert.equal(result.fullReplayVerified,true);
  assert.equal(result.realWorldKdkAuthenticated,false);
  assert.equal(result.refereeSourceAuthenticated,false);
  assert.equal(verify(career,journal,checked.input,policy,[],[],result),true);
  assert.equal(verify(career,journal,checked.input,policy,[],[],
    {...result,realWorldKdkAuthenticated:true}),false);
  assert.deepEqual(journal,before);
});

test('an incomplete previous match for even one club blocks a new round',()=>{
  const journal=empty();
  const result=run(career,journal,input(second),policy);
  assert.equal(result.ok,false);
  assert.equal(result.error,'HOME_DISCIPLINE_DENIED');
  assert.equal(result.gateError,'PRIOR_CLUB_MATCHES_MISSING');
  assert.ok(result.missingFixtureIds.length>=1);
  const preceding=twoPriorMatches();
  const one=ok(apply(career,empty(),[preceding.commands[0]],0));
  const incomplete=run(career,one,input(second),policy);
  assert.equal(incomplete.ok,false);
  assert.ok(['HOME_DISCIPLINE_DENIED','AWAY_DISCIPLINE_DENIED']
    .includes(incomplete.error));
  assert.equal(incomplete.gateError,'PRIOR_CLUB_MATCHES_MISSING');
});

test('with source-verified complete history, both club gates admit next seeded fixture',()=>{
  const {journal}=twoPriorMatches();
  let accepted=null;
  for(let seed=1;seed<=32;seed++){
    const i=input(second,seed),candidate=run(career,journal,i,policy);
    if(candidate.ok){accepted={input:i,result:candidate};break;}
  }
  assert.ok(accepted);
  assert.equal(accepted.result.home.verifiedPriorClubFixtures,1);
  assert.equal(accepted.result.away.verifiedPriorClubFixtures,1);
  assert.equal(accepted.result.sameJournalForBothClubs,true);
  assert.equal(verify(career,journal,accepted.input,policy,[],[],
    accepted.result),true);
  assert.deepEqual(run(career,journal,accepted.input,policy),
    accepted.result);
});

test('tampered history, fixture and bad coaching policy cannot bypass game admission',()=>{
  const {journal}=twoPriorMatches();
  const altered=structuredClone(journal);
  altered.results[0].facts.playerRows[0].physicalSeconds++;
  const result=run(career,altered,input(second),policy);
  assert.equal(result.ok,false);
  assert.equal(result.error,'HOME_DISCIPLINE_DENIED');
  assert.equal(result.gateError,'INVALID_INITIAL_OR_JOURNAL');
  assert.deepEqual(run(career,journal,null,policy),
    {ok:false,error:'INVALID_INPUT'});
  const fake={...input(second),fixture:{...second,id:'fake'}};
  assert.equal(run(career,journal,fake,policy).ok,false);
  const invalidPolicy=run(career,journal,input(second),null);
  assert.equal(invalidPolicy.ok,false);
  assert.equal(invalidPolicy.error,'SOURCE_MATCH_REJECTED');
  let reads=0;
  const evil=structuredClone(journal);
  Object.defineProperty(evil.results[0].source.prematch,'fixture',{
    enumerable:true,get(){reads++;throw Error('side effect');},
  });
  assert.equal(run(career,evil,input(second),policy).ok,false);
  assert.equal(reads,0);
});
