#!/usr/bin/env node
/**
 * Bounded exploratory taxonomy of rejected synthetic v29 source cases.
 * Never turns rejected fixtures into zero-goal games or infers clinical truth.
 */
import {createHash} from 'node:crypto';
import {argv} from 'node:process';
import {diagnoseM1V29SourceFailure}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {simulateM1V29CausalMedical}
  from '../dist/core/m1-v29-causal-medical.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {RNG_VERSION} from '../dist/core/rng.js';

function arg(name,fallback,max){
  const vals=argv.slice(2).filter(x=>x.startsWith('--'+name+'='));
  if(vals.length>1)throw Error('DUPLICATE_OPTION:'+name);
  if(!vals.length)return fallback;
  const value=vals[0].slice(name.length+3);
  if(!/^[1-9][0-9]*$/.test(value)||!Number.isSafeInteger(+value)||
      +value>max)throw Error('INVALID_OPTION:'+name);
  return +value;
}
export function diagnoseBoundedRejects(){
  if(argv.slice(2).some(x=>
    !/^--(fixtures|count|start)=[0-9]+$/.test(x))){
    throw Error('UNKNOWN_OPTION');
  }
  const fixtureCount=arg('fixtures',4,8);
  const count=arg('count',16,64);
  const start=arg('start',1,0xffffffff);
  if(start+count-1>0xffffffff)throw Error('RNG_SEED_OVERFLOW');
  const catalog=createSyntheticRplScaleCatalog(77);
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(r=>r.fixtures).slice(0,fixtureCount);
  const club=new Map(catalog.clubs.map(c=>[c.id,c]));
  const policy={
    home:{assignedActor:{kind:'player'},availableStaffIds:[]},
    away:{assignedActor:{kind:'player'},availableStaffIds:[]},
  };
  const reasonCounts={},subreasonCounts={},hash=createHash('sha256');
  let accepted=0,rejected=0,lowerLevelRooted=0;
  for(const fixture of fixtures){
    const base={
      schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
      rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
      fixture,catalog,
      homeLineup:defaultSyntheticLineup(club.get(fixture.homeClubId)),
      awayLineup:defaultSyntheticLineup(club.get(fixture.awayClubId)),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION,
    };
    for(let seed=start;seed<start+count;seed++){
      const input={...base,rngSeed:seed};
      const match=simulateM1V29CausalMedical(input,policy);
      if(match.ok){
        accepted++;
        hash.update(JSON.stringify([fixture.id,seed,'OK'])+'\n');
        continue;
      }
      rejected++;
      const detail=diagnoseM1V29SourceFailure(input,policy);
      if(detail.ok||detail.error!==match.error) {
        throw Error('DIAGNOSTIC_REPLAY_DISAGREEMENT');
      }
      const reason=detail.sourceError===null?
        'UNCLASSIFIED:'+detail.error:'REFEREE:'+detail.sourceError;
      if(detail.sourceError!==null)lowerLevelRooted++;
      reasonCounts[reason]=(reasonCounts[reason]??0)+1;
      const sub=detail.sourceSubreason??'NO_UNDERLYING_SUBREASON';
      subreasonCounts[sub]=(subreasonCounts[sub]??0)+1;
      hash.update(JSON.stringify([fixture.id,seed,detail.error,reason])+'\n');
    }
  }
  const attempted=count*fixtureCount;
  if(accepted+rejected!==attempted||
      Object.values(reasonCounts).reduce((n,x)=>n+x,0)!==rejected||
      Object.values(subreasonCounts).reduce((n,x)=>n+x,0)!==rejected) {
    throw Error('INVALID_TAXONOMY_TOTALS');
  }
  return {
    schemaVersion:1,
    status:'BOUNDED_V29_REJECTION_TAXONOMY_NOT_CALIBRATED',
    sourceEngine:'m1-v29-synthetic-medical-source',
    start,count,fixtureCount,attempted,accepted,rejected,
    rejectionFraction:rejected/attempted,
    lowerLevelRefereeFailuresClassified:lowerLevelRooted,
    rejectionSubreasonCounts:Object.fromEntries(
      Object.entries(subreasonCounts).sort(([a],[b])=>a<b?-1:a>b?1:0)),
    rejectionRootCounts:Object.fromEntries(
      Object.entries(reasonCounts).sort(([a],[b])=>a<b?-1:a>b?1:0)),
    deterministicSha256:hash.digest('hex'),
    sourceReplayVerifierUntouched:true,
    simulatorBehaviorChanged:false,
    sampleSelectedByReplays:true,
    upstreamRightsOrClinicalAuthorityAuthenticated:false,
    real2024_25HoldoutUsed:false,calibrationAccepted:false,
  };
}
try{
  process.stdout.write(JSON.stringify(diagnoseBoundedRejects())+'\n');
}catch(e){
  process.stderr.write('M1_V64_DIAG_FAIL:'+
    (e instanceof Error?e.message:'UNKNOWN')+'\n');
  process.exitCode=1;
}
