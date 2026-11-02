#!/usr/bin/env node
import {argv} from 'node:process';
import {createHash} from 'node:crypto';
import {simulateM1V104JointCandidate as simulate,
  verifyM1V104JointCandidate as verify}
  from '../dist/core/m1-v104-joint-candidate.js';
import {P5_V104_CANDIDATES}
  from './m1-p5-v104-joint-candidate-shard.mjs';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin}
  from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';

const schemaVersion=154;
const catalog=createSyntheticRplScaleCatalog(77);
const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
  .flatMap(round=>round.fixtures);
const names=['baseline','candidateA','candidateB'];
const policy={home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const fail=code=>{throw Error('V154_'+code);};
function seedFor(fixtureId,index){
  const digest=createHash('sha256').update(
    JSON.stringify(['footclubsim-v154-full-calendar-v1',fixtureId,index]))
    .digest();
  return digest.readUInt32BE(0)||1;
}
function inputFor(fixture,seed){
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
function checkEvents(run,fixture){
  const totals={
    home:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0},
    away:{goals:0,shots:0,shotsOnTarget:0,xgMilli:0},
  };
  let seconds=-1,sequence=0,shots=0;
  for(const event of run.events){
    if(event.sequence!==++sequence||event.elapsedSeconds<seconds)
      fail('EVENT_ORDER');
    seconds=event.elapsedSeconds;
    if(event.type!=='shot')continue;
    shots++;
    const side=event.teamId===fixture.homeClubId?'home':
      event.teamId===fixture.awayClubId?'away':null;
    if(!side)fail('EVENT_TEAM');
    const row=totals[side];
    row.shots++;
    row.xgMilli+=event.xgMilli;
    if(event.outcome==='goal'||event.outcome==='saved')
      row.shotsOnTarget++;
    if(event.outcome==='goal')row.goals++;
  }
  if(seconds!==5400||run.events.at(-1)?.type!=='full-time'||
      shots>54||run.rngDraws!==270)fail('SOURCE_CLOCK');
  for(const side of ['home','away']){
    for(const field of ['goals','shots','shotsOnTarget','xgMilli'])
      if(totals[side][field]!==run.report[side][field])
        fail('EVENT_ACCOUNTING');
    if(totals[side].goals>totals[side].shotsOnTarget||
       totals[side].shotsOnTarget>totals[side].shots)
      fail('EVENT_CONSERVATION');
  }
  return totals;
}
export function runM1P5V154FullCalendarShard(group,{
  seeds=48,maxElapsedMs=300000,maxRssMiB=1024}={}){
  if(!Number.isSafeInteger(group)||group<0||group>15||
      !Number.isSafeInteger(seeds)||seeds<1||seeds>48||
      !Number.isFinite(maxElapsedMs)||maxElapsedMs<=0||
      !Number.isFinite(maxRssMiB)||maxRssMiB<=0)
    fail('INVALID_ARGUMENTS');
  if(catalog.clubs.length!==16||fixtures.length!==240)
    fail('CATALOG_OR_CALENDAR_DRIFT');
  const start=performance.now();
  const hash=createHash('sha256');
  const rows=Object.fromEntries(names.map(k=>[k,{
    attempted:0,accepted:0,rejected:0,
    shots:0,onTarget:0,goals:0,xgMilli:0,rejectionCodes:{},
  }]));
  let negativeChecks=0,peakRss=process.memoryUsage().rss;
  for(let index=group*15;index<(group+1)*15;index++){
    const fixture=fixtures[index];
    for(let attempt=1;attempt<=seeds;attempt++){
      const seed=seedFor(fixture.id,attempt),input=inputFor(fixture,seed);
      for(const name of names){
        const row=rows[name],parameters=P5_V104_CANDIDATES[name];
        const outcome=simulate(input,policy,parameters);
        row.attempted++;
        if(!outcome?.ok){
          row.rejected++;
          const code=String(outcome?.error??'UNKNOWN');
          row.rejectionCodes[code]=(row.rejectionCodes[code]||0)+1;
          hash.update(JSON.stringify([fixture.id,attempt,seed,name,
            'REJECTED',code])+'\n');
          continue;
        }
        if(!verify(input,policy,parameters,outcome))
          fail('REPLAY_MISMATCH');
        if(outcome.releaseCalibrationAccepted!==false||
           outcome.holdout2024_25Used!==false||
           outcome.careerCasAdmissionSupported!==false)
          fail('RESEARCH_BOUNDARY');
        const totals=checkEvents(outcome,fixture);
        row.accepted++;
        for(const side of ['home','away']){
          row.shots+=totals[side].shots;
          row.onTarget+=totals[side].shotsOnTarget;
          row.goals+=totals[side].goals;
          row.xgMilli+=totals[side].xgMilli;
        }
        hash.update(JSON.stringify([fixture.id,attempt,seed,name,
          outcome.rngState,outcome.report,outcome.events])+'\n');
        if(attempt===1&&name==='candidateB'){
          const bad=structuredClone(outcome);
          bad.events[0].sequence++;
          if(verify(input,policy,parameters,bad))
            fail('FORGED_EVENT_ACCEPTED');
          negativeChecks++;
        }
      }
      peakRss=Math.max(peakRss,process.memoryUsage().rss);
      if(performance.now()-start>maxElapsedMs)
        fail('OPERATIONAL_TIME_BUDGET');
      if(peakRss>maxRssMiB*1024*1024)
        fail('OPERATIONAL_RSS_BUDGET');
    }
  }
  for(const row of Object.values(rows)){
    if(row.attempted!==15*seeds||
      row.accepted+row.rejected!==row.attempted||
      row.goals>row.onTarget||row.onTarget>row.shots)
      fail('FINAL_ACCOUNTING');
  }
  return {
    schemaVersion,
    status:'FULL_SYNTHETIC_CALENDAR_REPLAY_RESEARCH_NOT_CALIBRATED',
    source:{seedDomain:'footclubsim-v154-full-calendar-v1',
      catalogSeed:77,fixtureCount:240,fixturesPerShard:15,
      requestedSeedsPerFixture:seeds,engine:104},
    group,uniqueFixtureSeedPairs:15*seeds,
    modelAttempts:45*seeds,negativeChecks,rows,
    resultSha256:hash.digest('hex'),
    timing:{observedWallMs:performance.now()-start,
      observedPeakRssMiB:peakRss/(1024*1024),
      operationalBudgetMs:maxElapsedMs,
      operationalBudgetRssMiB:maxRssMiB,
      releasePerformanceAccepted:false},
    sourceReplayVerified:true,referenceMetricTaxonomyAligned:false,
    holdout2024_25Used:false,releaseP5Accepted:false,
  };
}
if(argv[1]?.endsWith('m1-p5-v154-full-calendar-replay-fuzz.mjs')){
  try{
    if(argv.length!==3||!/^(?:[0-9]|1[0-5])$/.test(argv[2]))
      fail('EXPECTED_GROUP_0_TO_15');
    process.stdout.write('V154_FULL_CALENDAR='+JSON.stringify(
      runM1P5V154FullCalendarShard(Number(argv[2])))+'\n');
  }catch(error){
    process.stderr.write('V154_FAILED:'+
      (error instanceof Error?error.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
