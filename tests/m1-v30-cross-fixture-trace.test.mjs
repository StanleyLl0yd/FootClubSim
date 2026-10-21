import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1V30CareerTrace as derive,
  verifyM1V30CareerTrace as verify }
  from '../dist/core/m1-v30-cross-fixture-trace.js';
import { startM1V26ExposureJournal as start,
  applyM1V26ExposureBatch as apply }
  from '../dist/core/m1-v26-exposure-journal.js';
import { deriveM1V24PhysicalExposure }
  from '../dist/core/m1-v24-physical-exposure.js';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const career = createInitialCareer(catalog, catalog.clubs[0].id,
  42, 'm1-v30-posted-trace');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const firstFixture = fixtures[0];
const secondFixture = fixtures.find((f, i) => i > 0 &&
  [f.homeClubId, f.awayClubId].includes(firstFixture.homeClubId));
assert.ok(secondFixture, 'no repeat-team fixture');
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const policy = {
  home: {assignedActor: {kind: 'player'}, availableStaffIds: []},
  away: {assignedActor: {kind: 'player'}, availableStaffIds: []},
};
const ok = r => {
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 360));
  return r.journal ?? r;
};
function request(fixture, revision, commandId) {
  const prematch = {
    schemaVersion:MATCH_LEDGER_VERSION, engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID, rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture, catalog,
    homeLineup:defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup:defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
    rngAlgorithmVersion:RNG_VERSION,rngSeed:1,
  };
  for(let seed=1;seed<=32;seed++){
    prematch.rngSeed=seed;
    const result=deriveM1V24PhysicalExposure(prematch,policy);
    if(!result.ok)continue;
    return {
      schemaVersion:5,commandId,careerId:career.careerId,
      expectedRevision:revision,prematch:{...prematch},policy,
      halfTimeCommands:[],inPlayCommands:[],result,
    };
  }
  throw new Error('no source-accepted fixture/seed in fixed sample');
}
function journalTwo() {
  const initial=ok(start(career));
  const requests=[
    request(firstFixture,0,'v30-match-1'),
    request(secondFixture,1,'v30-match-2'),
  ];
  return {initial,requests,
    complete:ok(apply(career,initial,requests,0))};
}

test('empty journal produces no fabricated player, fatigue or authority',()=>{
  const initial=ok(start(career));
  const view=ok(derive(career,initial));
  assert.equal(view.fixtureCount,0);
  assert.equal(view.sourcePlayerFixtureRows,0);
  assert.deepEqual(view.players,[]);
  assert.equal(view.disciplinaryCarryoverAuthenticated,false);
  assert.equal(view.medicalDiagnosisAuthenticated,false);
  assert.equal(view.calendarChronologyAuthenticated,false);
  assert.equal(view.fatigueDeltasCalibrated,false);
  assert.equal(verify(career,initial,view),true);
});

test('two posted source matches reconcile each player’s physical and event totals',()=>{
  const {complete,requests}=journalTwo();
  const snapshot=structuredClone(complete);
  const view=ok(derive(career,complete));
  assert.equal(view.revision,2);
  assert.equal(view.fixtureCount,2);
  assert.equal(view.careerId,career.careerId);
  assert.equal(view.fullJournalSourceReplayVerified,true);
  assert.equal(view.sourcePlayerFixtureRows,
    complete.results.reduce((n,r)=>n+r.facts.playerRows.length,0));
  const counts=[
    'physicalSeconds','shots','goals','firstYellowCards',
    'secondYellowDismissals','straightRedDismissals',
    'permanentInjuryWithdrawals','temporaryTreatmentExits',
    'temporaryTreatmentReturns','substitutionsIn','substitutionsOut',
  ];
  const ids=new Set();
  for(const x of view.players) {
    const key=x.teamId+':'+x.playerId;
    assert.equal(ids.has(key),false);
    ids.add(key);
    const sources=complete.results.flatMap(r=>
      r.facts.playerRows.filter(row=>
        row.teamId===x.teamId&&row.playerId===x.playerId)
        .map(row=>({fixtureId:r.fixtureId,row})));
    assert.equal(x.fixtureRecords,sources.length);
    assert.equal(x.lastPostedFixtureId,sources.at(-1).fixtureId);
    assert.equal(x.onFieldAtLastPostedFixture,
      sources.at(-1).row.onFieldAtFullTime);
    for(const field of counts)assert.equal(x[field],
      sources.reduce((n,z)=>n+z.row[field],0));
  }
  assert.ok(view.players.some(row=>row.fixtureRecords===2),
    'no repeat-team player was linked across matches');
  assert.equal(view.players.reduce((n,r)=>n+r.fixtureRecords,0),
    view.sourcePlayerFixtureRows);
  assert.equal(verify(career,complete,view),true);
  assert.deepEqual(derive(career,complete),view);
  assert.deepEqual(complete,snapshot);
  assert.equal(requests[0].result.fatigueDeltasCalibrated,false);
  assert.equal(view.officialLeaguePointsAwarded,false);
});

test('forged projection and poisoned source history fail closed',()=>{
  const {complete}=journalTwo();
  const view=ok(derive(career,complete));
  const forged=structuredClone(view);
  forged.players[0].physicalSeconds++;
  assert.equal(verify(career,complete,forged),false);
  assert.equal(verify(career,complete,{...view,
    medicalDiagnosisAuthenticated:true}),false);
  assert.equal(verify(career,complete,{...view,
    officialLeaguePointsAwarded:true}),false);
  assert.equal(verify(career,complete,{...view,
    players:[...view.players].reverse()}),false);
  const damaged=structuredClone(complete);
  damaged.results[0].facts.playerRows[0].physicalSeconds++;
  assert.deepEqual(derive(career,damaged),
    {ok:false,error:'INVALID_JOURNAL'});
  const foreign={...complete,careerId:'another-career'};
  assert.deepEqual(derive(career,foreign),
    {ok:false,error:'INVALID_JOURNAL'});
  let getterReads=0;
  const getter=structuredClone(complete);
  Object.defineProperty(getter.results[0].facts,'playerRows',{
    enumerable:true,get(){getterReads++;return []},
  });
  assert.deepEqual(derive(career,getter),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.equal(getterReads,0);
});
