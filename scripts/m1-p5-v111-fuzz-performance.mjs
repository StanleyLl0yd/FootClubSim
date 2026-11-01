import {argv} from 'node:process';
import {createHash} from 'node:crypto';
import {simulateM1V104JointCandidate as simulate,
  verifyM1V104JointCandidate as verify}
  from '../dist/core/m1-v104-joint-candidate.js';
import {P5_V104_CANDIDATES}
  from './m1-p5-v104-joint-candidate-shard.mjs';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(r=>r.fixtures);
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const names=['baseline','candidateA','candidateB'];
const fail=code=>{throw Error('V111_'+code)};
function seeded(fixtureId,index){
  const hash=createHash('sha256').update(
    JSON.stringify(['footclubsim-v111-fuzz-v1',fixtureId,index])).digest();
  const seed=hash.readUInt32BE(0);
  return seed||1;
}
const fixtureInput=(fixture,seed)=>({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,
  homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:seed,
});
function independentCounters(run){
  const totals={home:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0},
    away:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0}};
  const fixture=run.fixtureId;
  const first=fixtures.find(f=>f.id===fixture);
  if(!first)fail('UNKNOWN_FIXTURE');
  let second=-1,shots=0,events=0;
  for(const entry of run.events){
    if(entry.sequence!==++events||entry.elapsedSeconds<second)
      fail('BAD_SEQUENCE');
    second=entry.elapsedSeconds;
    if(entry.type!=='shot')continue;
    shots++;
    const side=entry.teamId===first.homeClubId?'home':
      entry.teamId===first.awayClubId?'away':null;
    if(!side)fail('UNKNOWN_TEAM');
    const row=totals[side];
    row.shots++;
    row.xgMilli+=entry.xgMilli;
    if(entry.outcome==='goal'||entry.outcome==='saved')row.shotsOnTarget++;
    if(entry.outcome==='goal')row.goals++;
  }
  if(second!==5400||shots>54||run.rngDraws!==270||
      run.events.at(-1)?.type!=='full-time')fail('CLOCK_OR_RNG');
  for(const side of ['home','away']){
    for(const field of ['shots','shotsOnTarget','goals','xgMilli']){
      if(totals[side][field]!==run.report[side][field])
        fail('EVENT_ACCOUNTING');
    }
    if(totals[side].goals>totals[side].shotsOnTarget||
        totals[side].shotsOnTarget>totals[side].shots)
      fail('COUNT_CONSERVATION');
  }
  return totals;
}
export function runM1V111FuzzShard(group,{seeds=16,
  maxElapsedMs=300000,maxRssMiB=1024}={}){
  if(!Number.isSafeInteger(group)||group<0||group>3||
      !Number.isSafeInteger(seeds)||seeds<1||seeds>16||
      !Number.isFinite(maxElapsedMs)||maxElapsedMs<=0||
      !Number.isFinite(maxRssMiB)||maxRssMiB<=0)
    fail('INVALID_ARGUMENTS');
  const started=performance.now();
  const hash=createHash('sha256');
  const seen=new Set(),totals=Object.fromEntries(names.map(k=>[k,{
    matches:0,shots:0,onTarget:0,goals:0,xgMilli:0}]));
  let peakRss=process.memoryUsage().rss,negativeChecks=0;
  for(let offset=0;offset<4;offset++){
    const fixture=fixtures[(group*4+offset)*15];
    if(!fixture)fail('FIXTURE_SCOPE');
    for(let i=1;i<=seeds;i++){
      const seed=seeded(fixture.id,i);
      if(seen.has(seed))fail('SEED_COLLISION');
      seen.add(seed);
      const input=fixtureInput(fixture,seed);
      for(const name of names){
        const p=P5_V104_CANDIDATES[name];
        const run=simulate(input,policy,p);
        if(!run.ok||!verify(input,policy,p,run))fail('REPLAY_FAILURE');
        if(run.releaseCalibrationAccepted!==false||
            run.holdout2024_25Used!==false||
            run.careerCasAdmissionSupported!==false)
          fail('RESEARCH_BOUNDARY');
        const independent=independentCounters(run);
        const row=totals[name];
        row.matches++;
        for(const side of ['home','away']){
          row.shots+=independent[side].shots;
          row.onTarget+=independent[side].shotsOnTarget;
          row.goals+=independent[side].goals;
          row.xgMilli+=independent[side].xgMilli;
        }
        hash.update(JSON.stringify([fixture.id,i,seed,name,
          run.rngState,run.report,run.events.length])+'\n');
        if(i===1&&name==='candidateB'){
          const altered=structuredClone(run);
          altered.events[0].sequence++;
          if(verify(input,policy,p,altered))fail('FORGED_EVENT_ACCEPTED');
          negativeChecks++;
        }
      }
      peakRss=Math.max(peakRss,process.memoryUsage().rss);
    }
  }
  const elapsedMs=performance.now()-started;
  const rssMiB=peakRss/(1024*1024);
  if(elapsedMs>maxElapsedMs||rssMiB>maxRssMiB)
    fail('RESEARCH_RUNNER_RESOURCE_BUDGET');
  return {schemaVersion:111,
    status:'INDEPENDENT_BOUNDED_RESEARCH_FUZZ_NOT_RELEASE_CALIBRATION',
    source:{v104:104,seedDomain:'footclubsim-v111-fuzz-v1',
      syntheticCatalogSeed:77,fixtures:4,seedsPerFixture:seeds},
    group,distinctSeeds:seen.size,negativeChecks,totals,
    resultSha256:hash.digest('hex'),
    timing:{observedWallMs:elapsedMs,observedPeakRssMiB:rssMiB,
      operationalBudgetMs:maxElapsedMs,operationalBudgetRssMiB:maxRssMiB,
      modelPerformanceAcceptance:false},
    holdout2024_25Used:false,
    externalMetricDefinitionsAligned:false,
    releaseCalibrationAccepted:false};
}
if(argv[1]?.endsWith('m1-p5-v111-fuzz-performance.mjs')){
  try{
    if(argv.length!==3||!/^[0-3]$/.test(argv[2]))
      fail('EXPECTED_GROUP_0_TO_3');
    process.stdout.write('V111_FUZZ='+JSON.stringify(
      runM1V111FuzzShard(Number(argv[2])))+'\n');
  }catch(error){
    process.stderr.write('V111_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
