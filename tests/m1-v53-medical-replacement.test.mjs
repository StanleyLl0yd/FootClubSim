import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V53MedicalReplacement as simulate,
  verifyM1V53MedicalReplacement as verify }
  from '../dist/core/m1-v53-medical-replacement.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog=createSyntheticRplScaleCatalog(77);
const fixture=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))[0].fixtures[0];
const home=defaultSyntheticLineup(
  catalog.clubs.find(c=>c.id===fixture.homeClubId));
const away=defaultSyntheticLineup(
  catalog.clubs.find(c=>c.id===fixture.awayClubId));
const position=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
const player=home.starters.find(id=>position.get(id)!=='GK');
const replacement=home.bench.find(id=>position.get(id)!=='GK');
const awayPlayer=away.starters.find(id=>position.get(id)!=='GK');
const awayReplacement=away.bench.find(id=>position.get(id)!=='GK');
const input={
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:home,awayLineup:away,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed:42,
};
const policy={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]},
};
const exit=(clubId,patient,id)=>({
  schemaVersion:1,id,fixtureId:fixture.id,
  teamId:clubId,playerId:patient,elapsedSeconds:0,
  kind:'treatment-exit',reason:'medical-staff-entered',
  restartAtRunningSeconds:15,
});
const sub=(clubId,patient,entrant,id)=>({
  schemaVersion:1,kind:'substitute-normal',fixtureId:fixture.id,
  commandId:id,teamId:clubId,elapsedSeconds:2700,
  actor:{kind:'player'},stoppage:'half-time',
  outPlayerId:patient,inPlayerId:entrant,
});
const firstExit=exit(fixture.homeClubId,player,'injured-exit-1');
const firstSub=sub(fixture.homeClubId,player,replacement,'med-sub-1');
const evaluate=(commands=[firstSub],medical=[firstExit])=>
  simulate(input,policy,commands,[],medical);

test('v53 admits replacement for physically absent patient without requiring return',()=>{
  const legacy=simulateM1V8MedicalPhases(
    input,policy,[firstSub],[],[firstExit]);
  assert.deepEqual(legacy,{ok:false,error:'EXCEPTION_RULING_REQUIRED'});
  const next=evaluate();
  assert.equal(next.ok,true,JSON.stringify(next).slice(0,500));
  assert.equal(next.schemaVersion,1);
  assert.equal(next.replacements.length,1);
  assert.deepEqual(next.replacements[0],{
    teamId:fixture.homeClubId,patientPlayerId:player,
    enteringPlayerId:replacement,
    medicalExitEventId:'m1-v8-med-injured-exit-1',
    substitutionEventId:next.replacements[0].substitutionEventId,
    departureRunningSeconds:0,substitutionRunningSeconds:2700,
  });
  const receipt=next.replacements[0];
  const exitEvent=next.source.events.find(e=>e.id===receipt.medicalExitEventId);
  const subEvent=next.source.events.find(e=>e.id===receipt.substitutionEventId);
  assert.equal(exitEvent.type,'medical');
  assert.equal(subEvent.type,'availability');
  assert.ok(exitEvent.sequence<subEvent.sequence);
  assert.deepEqual(next.source.offFieldAtFullTime,[]);
  assert.ok(!next.source.onFieldAtFullTime.home.includes(player));
  assert.ok(next.source.onFieldAtFullTime.home.includes(replacement));
  assert.equal(next.source.onFieldAtFullTime.home.length,11);
  assert.equal(next.source.rngDraws,90);
  assert.equal(next.realWorldMedicalAuthorityAuthenticated,false);
  assert.equal(next.externalRefereeAuthorityAuthenticated,false);
  assert.equal(verify(input,policy,[firstSub],[],[firstExit],next),true);
  assert.deepEqual(evaluate(),next);
  // Existing legacy call stays rejected after using the opt-in entry point.
  assert.deepEqual(simulateM1V8MedicalPhases(
    input,policy,[firstSub],[],[firstExit]),legacy);
});

test('two clubs can independently substitute out their absent patients',()=>{
  const otherExit=exit(fixture.awayClubId,awayPlayer,'injured-exit-2');
  const otherSub=sub(
    fixture.awayClubId,awayPlayer,awayReplacement,'med-sub-2');
  const run=evaluate([firstSub,otherSub],[firstExit,otherExit]);
  assert.equal(run.ok,true,JSON.stringify(run).slice(0,500));
  assert.equal(run.replacements.length,2);
  assert.equal(new Set(run.replacements.map(x=>x.teamId)).size,2);
  assert.equal(run.source.onFieldAtFullTime.home.length,11);
  assert.equal(run.source.onFieldAtFullTime.away.length,11);
  assert.deepEqual(run.source.offFieldAtFullTime,[]);
  assert.equal(verify(input,policy,[firstSub,otherSub],[],
    [firstExit,otherExit],run),true);
});

test('an ordinary substitution is not misreported as medical replacement',()=>{
  const ordinary=evaluate([firstSub],[]);
  assert.deepEqual(ordinary,{ok:false,error:'NO_OFF_FIELD_REPLACEMENT'});
});

test('v53 rejects post-substitution medical return and false or malformed evidence',()=>{
  const prematureReturn={
    schemaVersion:1,id:'old-patient-return',fixtureId:fixture.id,
    teamId:fixture.homeClubId,playerId:player,elapsedSeconds:3000,
    kind:'treatment-return',returnContext:'running-clock',
    ballInPlay:true,entryBoundary:'touchline',
    refereeSignalId:'unverified-signal',
  };
  const wrong=evaluate([firstSub],[firstExit,prematureReturn]);
  assert.equal(wrong.ok,false);
  assert.equal(wrong.error,'SOURCE_MATCH_REJECTED');
  assert.equal(wrong.sourceError,'NOT_ON_FIELD');
  const run=evaluate();
  assert.equal(run.ok,true);
  assert.equal(verify(input,policy,[firstSub],[],[firstExit],
    {...run,replacements:[]}),false);
  assert.equal(verify(input,policy,[firstSub],[],[firstExit],
    {...run,realWorldMedicalAuthorityAuthenticated:true}),false);
  assert.equal(verify(input,policy,[],[],[firstExit],run),false);
  assert.equal(evaluate([firstSub],[{...firstExit,playerId:'not-player'}]).ok,
    false);
  assert.deepEqual(simulate(null,policy,[firstSub],[],[firstExit]),
    {ok:false,error:'INVALID_INPUT'});
  const hostile={...firstSub};
  Object.defineProperty(hostile,'outPlayerId',{enumerable:true,get(){
    throw Error('untrusted getter');
  }});
  // JSON preflight in the source engine rejects accessor-driven input;
  // callers see a typed rejection, never an attacker-defined value.
  assert.deepEqual(evaluate([hostile]),{ok:false,
    error:'SOURCE_MATCH_REJECTED',sourceError:'INVALID_MATCH_SOURCE'});
});
