import {createHash} from 'node:crypto';
import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
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

const allowed = new Set(['firstfixture','fixtures','start','count']);
const positive = x => Number.isSafeInteger(x) && x > 0;
export function measureM1V29SourceXgCohort(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(k => !allowed.has(k))) {
    throw Error('INVALID_XG_CORPUS_OPTIONS');
  }
  const firstFixture=options.firstfixture ?? 1;
  const fixtureCount=options.fixtures ?? 1;
  const start=options.start ?? 1;
  const count=options.count ?? 4;
  if (![firstFixture,fixtureCount,start,count].every(positive) ||
      firstFixture>240 || fixtureCount>32 ||
      firstFixture+fixtureCount-1>240 || count>128 ||
      start+count-1>0xffffffff) {
    throw Error('BOUNDED_XG_CORPUS_REQUIRED');
  }
  const catalog=createSyntheticRplScaleCatalog(77);
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures).slice(firstFixture-1,firstFixture-1+fixtureCount);
  if (fixtures.length!==fixtureCount)throw Error('INVALID_FIXTURE_COVERAGE');
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
  const digest=createHash('sha256');
  const rejectionReasons={};
  const fixtureSummaries=[];
  let accepted=0,rejected=0,shots=0,goals=0,xgMilli=0;
  let scorelessShotMatches=0,shotlessMatches=0;
  for(const fixture of fixtures){
    const prematch={
      schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
      rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
      fixture,catalog,
      homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
      awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION,
    };
    let acceptedHere=0,rejectedHere=0;
    for(let seed=start;seed<start+count;seed++){
      const observed=inspect({...prematch,rngSeed:seed},policy);
      if(!observed.ok){
        if(!['SOURCE_MATCH_REJECTED','REFEREE_REPLAY_MISMATCH'].includes(observed.error)){
          throw Error('UNEXPECTED_SOURCE_REJECTION:'+fixture.id+':'+seed+':'+observed.error);
        }
        rejected++;rejectedHere++;
        rejectionReasons[observed.error]=(rejectionReasons[observed.error]??0)+1;
        digest.update(JSON.stringify({fixtureId:fixture.id,seed,error:observed.error})+'\n');
        continue;
      }
      if(observed.fixtureId!==fixture.id || observed.fullSourceReplayVerified!==true ||
          observed.independentRealXgReferenceAvailable!==false ||
          observed.modelNotTuned!==true ||
          observed.status!=='INTERNAL_V8_OPEN_PLAY_XG_NOT_CALIBRATED' ||
          ![observed.sourceShots,observed.sourceOpenPlayGoals,
            observed.sourceOpenPlayXgMilli].every(Number.isSafeInteger) ||
          observed.sourceShots<0 || observed.sourceShots>18 ||
          observed.sourceOpenPlayGoals<0 ||
          observed.sourceOpenPlayGoals>observed.sourceShots ||
          observed.sourceOpenPlayXgMilli<20*observed.sourceShots ||
          observed.sourceOpenPlayXgMilli>600*observed.sourceShots){
        throw Error('SOURCE_XG_CONSERVATION_FAILED:'+fixture.id+':'+seed);
      }
      accepted++;acceptedHere++;
      shots+=observed.sourceShots;
      goals+=observed.sourceOpenPlayGoals;
      xgMilli+=observed.sourceOpenPlayXgMilli;
      scorelessShotMatches+=Number(observed.sourceShots>0 &&
        observed.sourceOpenPlayGoals===0);
      shotlessMatches+=Number(observed.sourceShots===0);
      digest.update(JSON.stringify({fixtureId:fixture.id,seed,
        sourceShots:observed.sourceShots,
        sourceOpenPlayGoals:observed.sourceOpenPlayGoals,
        sourceOpenPlayXgMilli:observed.sourceOpenPlayXgMilli})+'\n');
    }
    if(acceptedHere+rejectedHere!==count){
      throw Error('INVALID_FIXTURE_COVERAGE');
    }
    fixtureSummaries.push({fixtureId:fixture.id,accepted:acceptedHere,
      rejected:rejectedHere});
  }
  if(accepted+rejected!==fixtureCount*count ||
      accepted===0 || goals>shots || !Number.isSafeInteger(xgMilli)){
    throw Error('SOURCE_XG_AGGREGATE_FAILED');
  }
  return {
    schemaVersion:1,status:'INTERNAL_V8_XG_CORPUS_NOT_CALIBRATED',
    firstFixture,fixtureCount,start,count,
    attempted:fixtureCount*count,accepted,rejected,rejectionReasons,
    fixtureSummaries,sourceShots:shots,sourceOpenPlayGoals:goals,
    sourceOpenPlayXgMilli:xgMilli,
    modelXgPerAcceptedMatch:xgMilli/(1000*accepted),
    sourceShotsPerAcceptedMatch:shots/accepted,
    sourceGoalsPerAcceptedMatch:goals/accepted,
    sourceGoalsPerShot:shots===0?null:goals/shots,
    modelXgPerShot:shots===0?null:xgMilli/(1000*shots),
    shotlessMatches,scorelessMatchesWithShots:scorelessShotMatches,
    deterministicSha256:digest.digest('hex'),
    independentRealXgReferenceAvailable:false,
    holdout2024_25Used:false,modelNotTuned:true,
    refereeMedicalAuthorityAuthenticated:false,
  };
}
function parseCli(args){
  const options={};
  for(const arg of args){
    const match=/^--(firstfixture|fixtures|start|count)=([1-9][0-9]*)$/.exec(arg);
    if(!match||Object.hasOwn(options,match[1]))throw Error('INVALID_XG_CLI_OPTION');
    const number=Number(match[2]);
    if(!Number.isSafeInteger(number))throw Error('INVALID_XG_CLI_OPTION');
    options[match[1]]=number;
  }
  return options;
}
if(argv[1] && resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    process.stdout.write(JSON.stringify(measureM1V29SourceXgCohort(
      parseCli(argv.slice(2))))+'\n');
  }catch(error){
    process.stderr.write('M1_V70_SOURCE_XG_ERROR:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
