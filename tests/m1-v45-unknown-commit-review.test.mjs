import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewM1V45PotentialCAS }
  from '../dist/core/m1-v45-unknown-commit-review.js';
import {
  startM1V32ExposureJournal,applyM1V32ExposureBatch,
} from '../dist/core/m1-v32-causal-medical-journal.js';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog,defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { deriveM1V31CausalPhysicalExposure }
  from '../dist/core/m1-v24-physical-exposure.js';

const catalog=createSyntheticRplScaleCatalog(77);
const career=createInitialCareer(
  catalog,catalog.clubs[0].id,42,'m1-v45-review-test');
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(round=>round.fixtures).slice(0,3);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
function source(index,revision=index){
  const fixture=fixtures[index];
  const prematch={
    schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,
    homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:1,
  };
  for(let seed=1;seed<=128;seed++){
    prematch.rngSeed=seed;
    const result=deriveM1V31CausalPhysicalExposure(
      prematch,policy,[],[]);
    if(!result.ok)continue;
    return JSON.parse(JSON.stringify({
      schemaVersion:6,commandId:'v45-fixture-'+index,
      careerId:career.careerId,expectedRevision:revision,
      prematch:{...prematch},policy,
      halfTimeCommands:[],inPlayCommands:[],result,
    }));
  }
  throw Error('no admissible source');
}
const start=startM1V32ExposureJournal(career);
assert.equal(start.ok,true);
const firstSource=source(0,0),secondSource=source(1,1),
  alternativeSource=source(2,0);
const first=applyM1V32ExposureBatch(career,start.journal,[firstSource],0);
assert.equal(first.ok,true);
const second=applyM1V32ExposureBatch(
  career,first.journal,[secondSource],1);
assert.equal(second.ok,true);
const alternative=applyM1V32ExposureBatch(
  career,start.journal,[alternativeSource],0);
assert.equal(alternative.ok,true);
const claim=(requests,expectedRevision=0)=>({
  schemaVersion:1,careerId:career.careerId,expectedRevision,requests,
});

test('v45 distinguishes observed commit from not-yet-observed read',()=>{
  const before=reviewM1V45PotentialCAS(
    career,start.journal,claim([firstSource]));
  assert.deepEqual({
    ok:before.ok,status:before.status,automaticRetryAllowed:before.automaticRetryAllowed,
  },{ok:true,status:'NOT_OBSERVED_AT_READ',automaticRetryAllowed:false});
  const observed=reviewM1V45PotentialCAS(
    career,first.journal,claim([firstSource]));
  assert.equal(observed.status,'OBSERVED_COMMITTED');
  assert.equal(observed.fullSourceReplayVerified,true);
  const later=reviewM1V45PotentialCAS(
    career,second.journal,claim([firstSource]));
  assert.equal(later.status,'OBSERVED_COMMITTED');
  assert.equal(later.journalRevision,2);
  assert.equal(later.automaticRetryAllowed,false);
});

test('v45 refuses to mislabel other valid winning commands as committed',()=>{
  const wrong=reviewM1V45PotentialCAS(
    career,alternative.journal,claim([firstSource]));
  assert.equal(wrong.status,'DIVERGENT_HISTORY');
  assert.equal(wrong.automaticRetryAllowed,false);
  const ahead=reviewM1V45PotentialCAS(
    career,start.journal,claim([secondSource],1));
  assert.equal(ahead.status,'DIVERGENT_HISTORY');
});

test('v45 rejects forged history, malformed claim and invalid sources',()=>{
  const corrupt=structuredClone(first.journal);
  corrupt.results[0].facts.refereeRngState^=1;
  assert.deepEqual(reviewM1V45PotentialCAS(
    career,corrupt,claim([firstSource])),
    {ok:false,error:'CORRUPTED_HISTORY',automaticRetryAllowed:false});
  const wrong={...claim([firstSource]),careerId:'another'};
  assert.equal(reviewM1V45PotentialCAS(
    career,first.journal,wrong).error,'INVALID_CLAIM');
  const invalid={...claim([firstSource]),expectedRevision:241};
  assert.equal(reviewM1V45PotentialCAS(
    career,first.journal,invalid).error,'INVALID_CLAIM');
  const forged=structuredClone(firstSource);
  forged.result.source.source.refereeRngState^=1;
  assert.equal(reviewM1V45PotentialCAS(
    career,start.journal,claim([forged])).error,'INVALID_SOURCE');
});

test('v45 detects exact multi-command atomic batch without unsafe retry',()=>{
  const pair=applyM1V32ExposureBatch(
    career,start.journal,[firstSource,secondSource],0);
  assert.equal(pair.ok,true);
  const found=reviewM1V45PotentialCAS(
    career,pair.journal,claim([firstSource,secondSource],0));
  assert.equal(found.status,'OBSERVED_COMMITTED');
  assert.equal(found.commandCount,2);
  assert.equal(found.automaticRetryAllowed,false);
});
