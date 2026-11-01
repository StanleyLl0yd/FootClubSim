#!/usr/bin/env node
import {argv} from 'node:process';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {simulateM1V19InternalReferee}
  from '../dist/core/m1-v19-internal-foul-injury.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V124DenseVirtualRefereeMatch,
  verifyM1V124DenseVirtualRefereeSource}
  from '../dist/core/m1-v124-dense-internal-referee.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {prepareM1V130ManualVirtualRefereeContinuation}
  from '../dist/core/m1-v130-manual-virtual-referee.js';

const fail=code=>{throw Error('V131_'+code);};
const bounded=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=()=>({goals:0,shots:0,onTarget:0,openPlayXgMilli:0,
  homeWins:0,draws:0,awayWins:0,
  cautions:0,straightReds:0,fictionalInjuryWithdrawals:0,
  secondYellowDismissals:0,fixturesWithEvents:0});
function addFixture(t,report,incidents) {
  const home=report.home,away=report.away;
  t.goals+=home.goals+away.goals;
  t.shots+=home.shots+away.shots;
  t.onTarget+=home.shotsOnTarget+away.shotsOnTarget;
  t.openPlayXgMilli+=home.xgMilli+away.xgMilli;
  t.homeWins+=Number(home.goals>away.goals);
  t.draws+=Number(home.goals===away.goals);
  t.awayWins+=Number(home.goals<away.goals);
  t.fixturesWithEvents+=Number(incidents.length>0);
  const cautions=new Map();
  for(const item of incidents) {
    if(item.sanction==='caution'){
      t.cautions++;
      const key=item.teamId+'\u0000'+item.playerId;
      const count=(cautions.get(key)??0)+1;
      cautions.set(key,count);
      if(count===2)t.secondYellowDismissals++;
    }else if(item.sanction==='direct-red')t.straightReds++;
    else if(item.sanction==='injury-withdrawal')
      t.fictionalInjuryWithdrawals++;
    else fail('UNKNOWN_INCIDENT');
  }
}
/** Genuine source-replayed fictional dense v120/v124/v130 careers.
 * This is not independent official card/clinical data or calibration.
 */
export function runM1V131FictionalIncidentCohort({
  firstSeed=1,seedCount=1,fixturesPerCareer=4,
}={}) {
  if(!bounded(firstSeed,1,0xffffffff)||
     !bounded(seedCount,1,16)||firstSeed+seedCount-1>0xffffffff||
     !bounded(fixturesPerCareer,1,6))fail('INVALID_OPTIONS');
  const catalog=createSyntheticRplScaleCatalog(2026);
  const selected=catalog.clubs[0].id;
  const totals=data(),errors={},seeds=[];
  let attempted=0,accepted=0,replayedJournals=0,verifiedVirtualSources=0;
  for(let seed=firstSeed;seed<firstSeed+seedCount;seed++){
    const career=createInitialCareer(catalog,selected,seed,
      'm1-v131-fictional-incident-'+seed);
    const start=startM1V120Journal(career);
    if(!start.ok)fail('START_REJECTED');
    let journal=start.journal,seedAccepted=0,failed=null;
    for(let slot=0;slot<fixturesPerCareer;slot++){
      attempted++;
      const proposal=slot===0?
        prepareM1V124DenseVirtualRefereeMatch(career,journal):
        prepareM1V130ManualVirtualRefereeContinuation(career,journal);
      if(!proposal?.ok){
        failed=proposal===null?'PREMATURE_SEASON_END':proposal.error;
        errors[failed]=(errors[failed]??0)+1;
        break;
      }
      const replay=simulateM1V19InternalReferee(
        proposal.request.prematch,proposal.request.policy);
      if(!replay.ok||replay.generatedIncidents.length!==proposal.incidents)
        fail('REFEREE_GENERATOR_DRIFT');
      const applied=applyM1V120Source(career,journal,proposal.request);
      if(!applied.ok){
        failed=applied.error;
        errors[failed]=(errors[failed]??0)+1;break;
      }
      journal=applied.journal;
      if(!verifyM1V124DenseVirtualRefereeSource(
          career,journal,proposal.fixtureId??proposal.fixture.id))
        fail('SOURCE_REGENERATION_MISMATCH');
      const reviewed=reviewM1V126DenseSourceHolds(career,journal);
      if(!reviewed.ok)fail('HISTORICAL_HOLD_REPLAY_MISMATCH');
      verifiedVirtualSources++;
      const entry=journal.entries.at(-1);
      if(!entry)fail('ENTRY_MISSING');
      addFixture(totals,entry.result.report,replay.generatedIncidents);
      accepted++;seedAccepted++;
    }
    const final=validateM1V120Journal(career,journal);
    if(!final.ok||final.journal.revision!==seedAccepted)
      fail('FINAL_REPLAY_MISMATCH');
    replayedJournals++;
    seeds.push({seed,accepted:seedAccepted,failed});
  }
  const rejected=attempted-accepted;
  if(accepted+rejected!==attempted||
      rejected!==Object.values(errors).reduce((a,b)=>a+b,0)||
      totals.homeWins+totals.draws+totals.awayWins!==accepted||
      totals.onTarget>totals.shots||
      totals.fixturesWithEvents>accepted||
      totals.secondYellowDismissals>Math.floor(totals.cautions/2)||
      verifiedVirtualSources!==accepted||
      replayedJournals!==seedCount)
    fail('COUNT_CONSERVATION');
  const perMatch=accepted?{
    goals:totals.goals/accepted,shots:totals.shots/accepted,
    onTarget:totals.onTarget/accepted,
    openPlayXg:totals.openPlayXgMilli/(1000*accepted),
    cautions:totals.cautions/accepted,
    directReds:totals.straightReds/accepted,
    fictionalInjuryWithdrawals:totals.fictionalInjuryWithdrawals/accepted,
  }:null;
  return {schemaVersion:131,
    status:'SOURCE_REPLAYED_FICTIONAL_INCIDENT_COHORT_NOT_CALIBRATED',
    source:'v19-deterministic-virtual-referee-v124-v130-dense-v120',
    firstSeed,seedCount,fixturesPerCareer,attempted,accepted,rejected,
    failures:errors,verifiedVirtualSources,replayedJournals,seeds,
    totals,perMatch,
    syntheticEventAuthorityOnly:true,
    independentRealCardsDefinitionAligned:false,
    independentRealInjuriesDefinitionAligned:false,
    providerShotsDefinitionAligned:false,
    allTypeGoalsDefinitionAligned:false,
    completeOpponentHistory:false,
    releasePerformanceAccepted:false,
    holdout2024_25Used:false,releaseP5Accepted:false};
}
function parse(args){
  const valid=['first-seed','seed-count','fixtures'],values={};
  for(const arg of args){
    const m=/^--([a-z-]+)=([0-9]{1,10})$/.exec(arg);
    if(!m||!valid.includes(m[1])||Object.hasOwn(values,m[1]))
      fail('CLI_ARGS');
    values[m[1]]=Number(m[2]);
  }
  return {firstSeed:values['first-seed']??1,
    seedCount:values['seed-count']??1,
    fixturesPerCareer:values.fixtures??4};
}
if(argv[1]?.endsWith('m1-p5-v131-incident-cohort.mjs')){
  try{
    process.stdout.write('V131_FICTIONAL_INCIDENTS='+
      JSON.stringify(runM1V131FictionalIncidentCohort(parse(argv.slice(2))))+'\n');
  }catch(e){
    process.stderr.write('V131_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
