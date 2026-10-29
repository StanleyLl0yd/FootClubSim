import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V23TemporaryTreatment as simulate,
  verifyM1V23TemporaryTreatment as verify,
  M1_V23_TREATMENT_DOMAIN_SALT }
  from '../dist/core/m1-v23-temporary-treatment.js';
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
const homeOut = home.starters.filter(id => positions.get(id) !== 'GK');
const awayOut = away.starters.filter(id => positions.get(id) !== 'GK');
const homeBench = home.bench.filter(id => positions.get(id) !== 'GK');
const prematch = (seed = 645) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const sub = (outPlayerId, inPlayerId, second = 2700) => ({
  schemaVersion: 1, kind: 'substitute-normal', fixtureId: fixture.id,
  commandId: 'v16-sub-' + second + '-' + outPlayerId,
  teamId: fixture.homeClubId, elapsedSeconds: second, actor: { kind: 'player' },
  stoppage: second === 2700 ? 'half-time' : 'referee-authorized',
  outPlayerId, inPlayerId,
});
const departure = (playerId, side = 'home', second = 0, id = 'v16-exit') => ({
  schemaVersion: 1, id, fixtureId: fixture.id,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  playerId, elapsedSeconds: second, kind: 'treatment-exit',
  reason: 'medical-staff-entered', restartAtRunningSeconds: second + 15,
});
const returning = (playerId, side = 'home', second = 300, id = 'v16-return') => ({
  schemaVersion: 1, id, fixtureId: fixture.id,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  playerId, elapsedSeconds: second, kind: 'treatment-return',
  returnContext: 'running-clock', ballInPlay: true, entryBoundary: 'touchline',
  refereeSignalId: 'claimed-v16-referee-signal',
});
const ok = r => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 450)); return r; };
const bad = (r, error) => assert.equal(r.error, error, JSON.stringify(r));


const run = (seed = 645, half = [], inPlay = []) =>
  simulate(prematch(seed), policy, half, inPlay);
let selected = null;
function withTreatment() {
  if (selected) return selected;
  let matches = 0;
  for (let seed = 1; seed <= 128; seed++) {
    const result = run(seed);
    if (!result.ok) continue; // Unsupported goal/foul overlap fails closed.
    matches++;
    if (result.syntheticTemporaryExitCount > 0 &&
        result.syntheticTemporaryExitCount ===
          result.syntheticTemporaryReturnCount) {
      selected = {seed, result};
      return selected;
    }
  }
  assert.fail('no qualifying seeded ordinary treatment in 128 seeds; valid matches ' +
    matches);
}

test('internally seeded temporary assessment and return exclude unavailable shooter', () => {
  const {seed, result} = withTreatment();
  assert.equal(result.syntheticTemporaryTreatmentSupported, true);
  assert.equal(result.externalMedicalAuthorityAuthenticated, false);
  assert.equal(result.match.medicalAuthorityAuthenticated, false);
  assert.equal(result.halfTimeMedicalExceptionSupported, false);
  assert.equal(result.treatmentRngDraws, 54);
  assert.equal(result.treatmentRngSeed,
    ((seed ^ M1_V23_TREATMENT_DOMAIN_SALT) >>> 0));
  assert.ok(result.syntheticTemporaryExitCount > 0);
  assert.equal(result.syntheticTreatmentActions.length,
    result.syntheticTemporaryExitCount * 2);
  assert.equal(result.match.medicalActionCount,
    result.syntheticTreatmentActions.length);
  const actions = result.syntheticTreatmentActions;
  for (let i = 0; i < actions.length; i += 2) {
    const exit = actions[i];
    const returnAction = actions[i + 1];
    assert.equal(exit.kind, 'treatment-exit');
    assert.equal(returnAction.kind, 'treatment-return');
    assert.equal(exit.playerId, returnAction.playerId);
    assert.equal(exit.teamId, returnAction.teamId);
    assert.equal(returnAction.elapsedSeconds - exit.elapsedSeconds, 300);
    assert.equal(exit.restartAtRunningSeconds, exit.elapsedSeconds);
    assert.notEqual(exit.elapsedSeconds, 2400);
    assert.ok(exit.elapsedSeconds < 5100);
    assert.equal(returnAction.ballInPlay, true);
    assert.equal(returnAction.entryBoundary, 'touchline');
    const departureEvent = result.match.events.find(e =>
      e.kind === 'treatment-exit' &&
      e.runningSeconds === exit.elapsedSeconds &&
      e.playerId === exit.playerId);
    const restartEvent = result.match.events.find(e =>
      e.kind === 'synthetic-foul-restart' &&
      e.runningSeconds === exit.elapsedSeconds);
    const returnedEvent = result.match.events.find(e =>
      e.kind === 'treatment-return' &&
      e.runningSeconds === returnAction.elapsedSeconds &&
      e.playerId === exit.playerId);
    assert.ok(departureEvent);
    assert.ok(restartEvent);
    assert.ok(returnedEvent);
    assert.ok(departureEvent.sequence < restartEvent.sequence);
    assert.ok(restartEvent.wallSeconds >= departureEvent.wallSeconds);
    const side = exit.teamId === fixture.homeClubId ? 'home' : 'away';
    assert.ok(!departureEvent.onField[side].includes(exit.playerId));
    assert.ok(returnedEvent.onField[side].includes(exit.playerId));
    for (const shot of result.match.events.filter(e =>
      e.kind === 'shot' && e.playerId === exit.playerId &&
      e.runningSeconds >= exit.elapsedSeconds &&
      e.runningSeconds < returnAction.elapsedSeconds)) {
      assert.fail('temporarily absent player shot at ' + shot.runningSeconds);
    }
  }
  for (const shot of result.match.events.filter(e => e.kind === 'shot')) {
    const side = shot.teamId === fixture.homeClubId ? 'home' : 'away';
    assert.ok(shot.onField[side].includes(shot.playerId));
  }
  assert.deepEqual(run(seed), result);
  assert.equal(verify(prematch(seed), policy, [], [], result), true);
});

test('recomputed scores and referee RNG remain generated from one source', async () => {
  const { simulateM1V22FoulStoppageCoaching: oldRun } =
    await import('../dist/core/m1-v22-inplay-foul-coaching.js');
  let successful = 0, withAbsences = 0, legacyRejected = 0;
  let bothAccepted = 0;
  for (let seed = 1; seed <= 32; seed++) {
    const newer = run(seed);
    const older = oldRun(prematch(seed), policy);
    if (!newer.ok) {
      assert.equal(newer.error, 'SOURCE_MATCH_REJECTED');
      continue;
    }
    successful++;
    if(!older.ok){
      // The old v22 prototype still rejects some same-second
      // post-goal fouls which the replay-ordered v23 now admits.
      assert.equal(older.error,'SOURCE_MATCH_REJECTED');
      legacyRejected++;
      assert.equal(newer.refereeRngDraws,90);
      assert.equal(newer.match.rngDraws,90);
      assert.equal(newer.treatmentRngDraws,54);
      assert.equal(verify(prematch(seed),policy,[],[],newer),true);
      continue;
    }
    bothAccepted++;
    assert.equal(newer.refereeRngState, older.refereeRngState);
    assert.equal(newer.refereeRngDraws, 90);
    assert.equal(newer.match.rngDraws, 90);
    assert.equal(newer.treatmentRngDraws, 54);
    assert.equal(newer.match.generatedFoulStoppages,
      newer.generatedIncidents.filter(i =>
        i.sanction !== 'injury-withdrawal').length);
    if (newer.syntheticTemporaryExitCount > 0) withAbsences++;
    else {
      assert.deepEqual(newer.match.finalScore, older.match.finalScore);
      assert.deepEqual(newer.match.finalOnField, older.match.finalOnField);
      assert.equal(newer.match.rngState, older.match.rngState);
    }
    assert.equal(verify(prematch(seed), policy, [], [], newer), true);
  }
  assert.ok(legacyRejected>0,
    'the old v22 rejection path was not exercised');
  assert.ok(bothAccepted>0,
    'no common accepted source for parity comparison');
  assert.ok(successful >= 8, 'excessive rejection of seeded baseline');
  assert.ok(withAbsences > 0, 'synthetic path never exercised');
});

test('coach commands and treatment share a single replay or fail closed', () => {
  const {seed, result:baseline} = withTreatment();
  const moment = baseline.generatedIncidents.find(e =>
    e.sanction !== 'injury-withdrawal');
  assert.ok(moment);
  const time = moment.elapsedSeconds;
  const before = baseline.match.events.find(e =>
    e.id === moment.sourceEventId);
  const eligible = homeOut.find(id =>
    before.onField.home.includes(id) &&
    !baseline.syntheticTreatmentActions.some(t =>
      t.kind === 'treatment-exit' && t.elapsedSeconds === time &&
      t.playerId === id));
  assert.ok(eligible);
  const manager = sub(eligible, homeBench[0], time);
  const withCoach = run(seed, [], [manager]);
  if (withCoach.ok) {
    assert.equal(withCoach.acceptedInPlayCommands, 1);
    assert.ok(withCoach.match.events.some(e =>
      e.kind === 'substitution-applied' &&
      e.runningSeconds === time && e.playerId === eligible));
    assert.equal(verify(prematch(seed), policy, [], [manager], withCoach), true);
  } else {
    assert.ok(['SOURCE_MATCH_REJECTED','INVALID_INPLAY_COMMANDS'].includes(
      withCoach.error));
  }
});

test('tampered treatment, return time and forged medical confidence fail replay', () => {
  const {seed, result} = withTreatment();
  for (const modify of [
    x => { x.syntheticTreatmentActions[0].playerId = 'forged'; },
    x => { x.syntheticTreatmentActions[1].elapsedSeconds -= 60; },
    x => { x.treatmentRngState ^= 1; },
    x => { x.syntheticTemporaryExitCount++; },
    x => { x.externalMedicalAuthorityAuthenticated = true; },
    x => { x.match.medicalAuthorityAuthenticated = true; },
    x => { x.match.events.find(e => e.kind === 'treatment-exit')
      .onField.home.push('ghost'); },
  ]) {
    const changed = structuredClone(result);
    modify(changed);
    assert.equal(verify(prematch(seed), policy, [], [], changed), false);
  }
});

test('invalid inputs and getter-backed objects fail closed', () => {
  bad(simulate({...prematch(),rngSeed:0},policy), 'INVALID_SOURCE');
  let calls = 0;
  const poisoned = structuredClone(prematch());
  Object.defineProperty(poisoned.fixture, 'id', {
    enumerable:true, get() {calls++;return fixture.id;},
  });
  bad(simulate(poisoned,policy),'INVALID_SOURCE');
  assert.equal(calls,0);
  const cyclic = structuredClone(prematch());
  cyclic.cycle = cyclic;
  bad(simulate(cyclic,policy),'INVALID_SOURCE');
});
