#!/usr/bin/env node
/**
 * Bounded schema-6 replay cost measurement on one Node process.
 * No production latency SLA, IndexedDB throughput or medical calibration.
 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { argv } from 'node:process';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { deriveM1V31CausalPhysicalExposure }
  from '../dist/core/m1-v24-physical-exposure.js';
import { startM1V32ExposureJournal, applyM1V32ExposureBatch,
  validateM1V32ExposureJournal }
  from '../dist/core/m1-v32-causal-medical-journal.js';

function readOptions() {
  const allowed = new Set(['fixtures','firstseed']);
  for (const input of argv.slice(2)) {
    if (!/^--[a-z]+=[0-9]+$/.test(input) ||
        !allowed.has(input.slice(2).split('=')[0])) {
      throw Error('INVALID_OPTION');
    }
  }
  function number(name, fallback, limit) {
    const found = argv.slice(2).filter(x => x.startsWith('--'+name+'='));
    if (found.length > 1) throw Error('DUPLICATE_OPTION:'+name);
    if (!found.length) return fallback;
    const raw = found[0].slice(name.length+3);
    if (!/^[1-9][0-9]*$/.test(raw)) throw Error('INVALID_OPTION:'+name);
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 1 || n > limit) {
      throw Error('INVALID_OPTION:'+name);
    }
    return n;
  }
  const fixtures = number('fixtures',2,32);
  const firstSeed = number('firstseed',1,0xffffffff);
  if (firstSeed+127>0xffffffff) throw Error('SEED_RANGE_OVERFLOW');
  return {fixtures,firstSeed};
}
const valid = (outcome, context) => {
  if (!outcome.ok) throw Error(context+':'+outcome.error);
  return outcome.journal;
};
function main() {
  const {fixtures: count, firstSeed} = readOptions();
  const catalog=createSyntheticRplScaleCatalog(77);
  const career=createInitialCareer(catalog,catalog.clubs[0].id,42,
    'm1-v32-history-bench-'+firstSeed);
  const all=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(round=>round.fixtures).slice(0,count);
  if (all.length !== count) throw Error('MISSING_FIXTURES');
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const policy={
    home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]},
  };
  let journal=valid(startM1V32ExposureJournal(career),'start');
  const digest=createHash('sha256'), checkpoints=[];
  let generationMs=0,applyMs=0,attempts=0;
  const started=performance.now();
  for (let index=0;index<count;index++) {
    const fixture=all[index];
    const prematch={
      schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
      rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
      fixture,catalog,
      homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
      awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION,rngSeed:firstSeed,
    };
    const before=performance.now();
    let result, chosenSeed=null;
    for(let offset=0;offset<128;offset++){
      prematch.rngSeed=firstSeed+offset;
      attempts++;
      result=deriveM1V31CausalPhysicalExposure(prematch,policy,[],[]);
      if(result.ok){chosenSeed=prematch.rngSeed;break;}
      if (!['SOURCE_MATCH_REJECTED','REFEREE_REPLAY_MISMATCH']
        .includes(result.error))throw Error('UNEXPECTED_SOURCE_REJECTION:'+
          fixture.id+':'+result.error);
    }
    generationMs+=performance.now()-before;
    if(chosenSeed===null)throw Error('NO_ACCEPTED_SOURCE:'+fixture.id);
    const request={
      schemaVersion:6,commandId:'v32-benchmark-'+index,
      careerId:career.careerId,expectedRevision:index,
      prematch:{...prematch},policy,halfTimeCommands:[],
      inPlayCommands:[],result,
    };
    const applyStart=performance.now();
    journal=valid(applyM1V32ExposureBatch(career,journal,[request],index),
      'apply-'+index);
    const commitMs=performance.now()-applyStart;
    applyMs+=commitMs;
    if(journal.revision!==index+1)throw Error('REVISION_MISMATCH');
    const facts=journal.results[index].facts;
    if(facts.syntheticMedicalDecisionCount !== facts.causalAssessments.length ||
        facts.medicalNeedAuthenticated !== false ||
        facts.refereeRngDraws !== 90 || facts.treatmentRngDraws !== 54) {
      throw Error('SOURCE_REPLAY_DRIFT');
    }
    digest.update(JSON.stringify({fixtureId:fixture.id,seed:chosenSeed,
      score:facts.score,medical:facts.syntheticMedicalDecisionCount,
      sourceRefs:facts.causalAssessments.map(x=>x.incidentId),
      physical:facts.teamPhysicalPlayerSeconds})+'\n');
    if(index===0 || ((index+1)&index)===0 || index+1===count) {
      checkpoints.push({
        revision:index+1,appendAndReplayMs:commitMs,
        journalBytes:Buffer.byteLength(JSON.stringify(journal),'utf8'),
      });
    }
  }
  const validationStart=performance.now();
  const copied=JSON.parse(JSON.stringify(journal));
  const restored=valid(validateM1V32ExposureJournal(career,copied),'reload');
  const validationMs=performance.now()-validationStart;
  if(restored.revision!==count)throw Error('RESTORE_REVISION_DRIFT');
  const totalMs=performance.now()-started;
  return {
    schemaVersion:1,
    status:'SYNTHETIC_SCHEMA6_REPLAY_COST_NOT_A_RELEASE_PERFORMANCE_GATE',
    fixtureCount:count,firstSeed,
    schema:6,
    source:'v29-causal-referee-v31-physical-v32-journal',
    sourceAttempts:attempts,
    deterministicSha256:digest.digest('hex'),
    measurements:{
      totalMs,generationMs,incrementalReplayApplyMs:applyMs,
      finalFullHistoryValidationMs:validationMs,
      journalBytes:Buffer.byteLength(JSON.stringify(journal),'utf8'),
      rssBytes:process.memoryUsage().rss,checkpoints,
    },
    environment:{node:process.version,platform:process.platform,
      arch:process.arch,commitSha:process.env.GITHUB_SHA??null},
    limitations:[
      'single-process Node measurement, not native IndexedDB wall time',
      'no accepted production latency or historical transaction lifetime SLA',
      'synthetic source and uncalibrated medical/rule parameters',
      'no clinical/referee authentication or real RPL statistical calibration',
      'no OS crash, eviction, quota persistence or backup/restore guarantee',
    ],
  };
}
try { process.stdout.write(JSON.stringify(main())+'\n'); }
catch(e){
  process.stderr.write('M1_V32_WORKLOAD_ERROR:'+
    (e instanceof Error?e.message:'UNKNOWN')+'\n');
  process.exitCode=1;
}
