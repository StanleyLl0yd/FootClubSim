import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V8WithTimedSubstitutionCoverage }
  from '../dist/core/m1-v8-timed-substitution-coverage.js';
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

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.awayClubId));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const outgoing = home.starters.filter(id => positions.get(id) !== 'GK');
const incoming = home.bench.filter(id => positions.get(id) !== 'GK');
const original = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function command(i, changes = {}) {
  return { schemaVersion: 1, kind: 'substitute-normal',
    fixtureId: fixture.id, commandId: 'in-play-sub-' + (i + 1),
    teamId: fixture.homeClubId, elapsedSeconds: 300,
    actor: {kind: 'player'}, stoppage: 'referee-authorized',
    outPlayerId: outgoing[i], inPlayerId: incoming[i], ...changes };
}
function single() {
  return {schemaVersion: 1, fixtureId: fixture.id,
    teamId: fixture.homeClubId, outPlayerId: outgoing[0],
    inPlayerId: incoming[0], refereeSignalId: 'virtual-board-1',
    groupSize: 1, signalWallSeconds: 100, exitWallSeconds: 110,
    restartRunningSeconds: 300};
}
function group() {
  return {schemaVersion: 2, kind: 'group-normal-departures',
    fixtureId: fixture.id, teamId: fixture.homeClubId,
    stoppageId: 'virtual-group-1', finalSignalWallSeconds: 103,
    restartRunningSeconds: 300,
    departures: [
      {outPlayerId: outgoing[0], inPlayerId: incoming[0],
        refereeSignalId:'signal-1', signalWallSeconds:100,exitWallSeconds:110},
      {outPlayerId: outgoing[1], inPlayerId: incoming[1],
        refereeSignalId:'signal-2', signalWallSeconds:103,exitWallSeconds:113},
    ]};
}
const dossier = (claim) => [{checkpointSeconds:300,evidence:claim}];
const run = (commands, claims) => simulateM1V8WithTimedSubstitutionCoverage(
  original, policy, commands, [], [], claims);
const rejection = (commands, claims, error) => {
  const result = run(commands, claims);
  assert.equal(result.ok, false);
  assert.equal(result.error, error);
};
test('timely one-player evidence is complete and does not alter v8 RNG or goals', () => {
  const commands=[command(0)], raw=simulateM1V8MedicalPhases(
    original, policy, commands, [], []);
  assert.equal(raw.ok, true, JSON.stringify(raw));
  const result=run(commands, dossier(single()));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.normalSubstitutionCount,1);
  assert.equal(result.evidenceGroupCount,1);
  assert.equal(result.refereeAuthorityAuthenticated,false);
  assert.equal(result.physicalStoppageAuthenticated,false);
  assert.deepEqual(result.result, raw);
});
test('two normal changes at a single checkpoint require grouped last-board evidence', () => {
  const commands=[command(0),command(1)];
  const before=structuredClone(commands);
  const result=run(commands,dossier(group()));
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.normalSubstitutionCount,2);
  assert.equal(result.evidenceGroupCount,1);
  assert.deepEqual(commands,before);
  rejection(commands,dossier(single()),'MISMATCHED_PARTICIPANTS');
  rejection(commands,[],'NO_EVIDENCE');
  const repeated=[...dossier(group()),...dossier(group())];
  rejection(commands,repeated,'NO_EVIDENCE');
});
test('late departure cannot turn into a completed replacement without referee review',()=>{
  const delayed=group();
  delayed.departures[1].exitWallSeconds=114;
  rejection([command(0),command(1)],dossier(delayed),
    'LATE_REQUIRES_REFEREE_RULING');
});
test('reject misbound player, restart minute, fixture and unsupported half-time',()=>{
  const mismatched=group();
  mismatched.departures[0].inPlayerId=incoming[2];
  rejection([command(0),command(1)],dossier(mismatched),
    'MISMATCHED_PARTICIPANTS');
  rejection([command(0)], [{checkpointSeconds:300,
    evidence:{...single(),restartRunningSeconds:301}}],
    'WRONG_CHECKPOINT');
  rejection([command(0)],dossier({...single(),fixtureId:'not-fixture'}),
    'INVALID_DOSSIER');
  rejection([command(0,{elapsedSeconds:2700,stoppage:'half-time'})],
    dossier(single()),'UNSUPPORTED_HALF_TIME');
  rejection([command(0)],dossier({...single(),groupSize:2}),
    'INVALID_DOSSIER');
});
test('preflight rejects malicious getters, cycles, missing and forged dossier',()=>{
  const getter=dossier(single());let visits=0;
  Object.defineProperty(getter[0].evidence,'outPlayerId',{
    enumerable:true,get(){visits++;return outgoing[0];}
  });
  rejection([command(0)],getter,'INVALID_DOSSIER');
  assert.equal(visits,0);
  const cycle=dossier(single());cycle[0].cycle=cycle;
  rejection([command(0)],cycle,'INVALID_DOSSIER');
  rejection([command(0)],dossier({...single(),extra:'waiver'}),
    'INVALID_DOSSIER');
  rejection([command(0)],dossier({...single(),teamId:'other'}),
    'MISMATCHED_PARTICIPANTS');
  rejection([command(0)],dossier(group()),'MISMATCHED_PARTICIPANTS');
});
test('unchanged v8 execution with no substitutions needs no external timing claims',()=>{
  const result=run([],[]);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.evidenceGroupCount,0);
  assert.deepEqual(result.result,simulateM1V8MedicalPhases(original,policy,[],[],[]));
});
