import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1V24PhysicalExposure as simulate,
  verifyM1V24PhysicalExposure as verify }
  from '../dist/core/m1-v24-physical-exposure.js';
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
function anyAccepted(requireTreatment = false) {
  for (let seed = 1; seed <= 128; seed++) {
    const r = run(seed);
    if (r.ok && (!requireTreatment ||
      r.match.syntheticTemporaryExitCount > 0)) return {seed, r};
  }
  assert.fail('no accepted seeded source with treatment=' + requireTreatment);
}

test('source-derived physical time reconciles with every exact event interval', () => {
  const {seed, r} = anyAccepted(true);
  assert.equal(r.playingSeconds, 5400);
  assert.equal(r.status, 'SOURCE_DERIVED_EXPOSURE_NOT_FATIGUE_CALIBRATION');
  assert.equal(r.fatigueDeltasCalibrated, false);
  assert.equal(r.crossFixtureSanctionAuthorityAuthenticated, false);
  assert.equal(r.medicalReturnAuthorityAuthenticated, false);
  assert.equal(r.injuryDiagnosisAvailable, false);
  assert.equal(r.match.match.events.at(-1).kind, 'full-time');
  assert.ok(r.match.syntheticTemporaryExitCount > 0);
  assert.equal(r.playerRows.length, 22);
  const seen = new Set();
  for (const x of r.playerRows) {
    assert.ok(!seen.has(x.playerId), 'duplicate player ' + x.playerId);
    seen.add(x.playerId);
    assert.ok(x.physicalSeconds >= 0 && x.physicalSeconds <= 5400);
    assert.equal(x.physicalSeconds % 1, 0);
  }
  for (const side of ['home', 'away']) {
    const rows = r.playerRows.filter(x =>
      x.teamId === (side === 'home' ?
        fixture.homeClubId : fixture.awayClubId));
    assert.equal(rows.reduce((n,x) => n + x.physicalSeconds, 0),
      r.teamPhysicalPlayerSeconds[side]);
    const keeperId = (side === 'home' ? home : away).starters
      .find(id => positions.get(id) === 'GK');
    assert.equal(rows.find(x => x.playerId === keeperId).physicalSeconds,
      5400);
    assert.deepEqual(rows.filter(x => x.onFieldAtFullTime)
      .map(x => x.playerId).sort(), r.match.match.finalOnField[side]);
  }
  assert.equal(r.aggregatedEvents.goals,
    r.match.match.finalScore.home + r.match.match.finalScore.away);
  assert.equal(r.aggregatedEvents.temporaryExits,
    r.match.syntheticTemporaryExitCount);
  assert.equal(r.aggregatedEvents.temporaryReturns,
    r.match.syntheticTemporaryReturnCount);
  assert.equal(verify(prematch(seed), policy, [], [], r), true);
});

test('temporary exit removes exactly 300 physical seconds from participant', () => {
  const {r} = anyAccepted(true);
  for (const medical of r.match.syntheticTreatmentActions.filter(a =>
    a.kind === 'treatment-exit')) {
    const row = r.playerRows.find(x => x.playerId === medical.playerId);
    assert.ok(row);
    assert.ok(row.temporaryTreatmentExits > 0);
    // A later dismissal or withdrawal may also reduce physical time;
    // do not attribute that entire loss to the earlier treatment.
    assert.ok(row.physicalSeconds <=
      5400 - row.temporaryTreatmentExits * 300);
    assert.equal(row.temporaryTreatmentReturns,
      row.temporaryTreatmentExits);
    if (row.secondYellowDismissals === 0 &&
        row.straightRedDismissals === 0 &&
        row.permanentInjuryWithdrawals === 0) {
      assert.equal(row.physicalSeconds,
        5400 - row.temporaryTreatmentExits * 300);
      assert.equal(row.onFieldAtFullTime, true);
    }
  }
});

test('per-event counts reconcile with generated source and one match', () => {
  let valid = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const current = run(seed);
    if (!current.ok) {
      assert.equal(current.error, 'SOURCE_MATCH_REJECTED');
      continue;
    }
    valid++;
    const events = current.match.match.events;
    const count = name => events.filter(x => x.kind === name).length;
    assert.equal(current.aggregatedEvents.shots, count('shot'));
    assert.equal(current.aggregatedEvents.goals, count('goal-whistle'));
    assert.equal(current.aggregatedEvents.firstYellows, count('caution'));
    assert.equal(current.aggregatedEvents.secondYellowDismissals,
      count('second-yellow-dismissal'));
    assert.equal(current.aggregatedEvents.directRedDismissals,
      count('straight-red-dismissal'));
    assert.equal(current.aggregatedEvents.irreversibleWithdrawals,
      count('injury-withdrawal'));
    assert.equal(current.aggregatedEvents.substitutedIn,
      count('substitution-applied') + count('half-time-substitution'));
    assert.equal(current.aggregatedEvents.substitutedOut,
      current.aggregatedEvents.substitutedIn);
    assert.equal(current.aggregatedEvents.temporaryExits,
      count('treatment-exit'));
    assert.equal(current.aggregatedEvents.temporaryReturns,
      count('treatment-return'));
    for (const side of ['home', 'away']) {
      assert.ok(current.teamPhysicalPlayerSeconds[side] >= 7 * 5400);
      assert.ok(current.teamPhysicalPlayerSeconds[side] <= 11 * 5400);
    }
    assert.deepEqual(current, run(seed));
    assert.equal(verify(prematch(seed), policy, [], [], current), true);
  }
  assert.ok(valid >= 8, 'model not generating enough legal test fixtures');
});

test('manager substitution credits only real replacement physical seconds', () => {
  const {seed, r:baseline} = anyAccepted();
  const incident = baseline.match.generatedIncidents.find(x =>
    x.sanction !== 'injury-withdrawal');
  assert.ok(incident);
  const t = incident.elapsedSeconds;
  const oldId = homeOut.find(id =>
    baseline.match.match.events.some(e =>
      e.id === incident.sourceEventId && e.onField.home.includes(id)));
  assert.ok(oldId);
  const action = sub(oldId, homeBench[0], t);
  const result = run(seed, [], [action]);
  if (result.ok) {
    const retired = result.playerRows.find(x => x.playerId === oldId);
    const entered = result.playerRows.find(x => x.playerId === homeBench[0]);
    assert.ok(retired && entered);
    assert.equal(retired.substitutionsOut, 1);
    assert.equal(entered.substitutionsIn, 1);
    assert.ok(retired.physicalSeconds <= t);
    assert.ok(entered.physicalSeconds <= 5400 - t);
    assert.ok(entered.onFieldAtFullTime);
    assert.equal(verify(prematch(seed), policy, [], [action], result), true);
  } else assert.ok(['SOURCE_MATCH_REJECTED',
    'INVALID_INPLAY_COMMANDS'].includes(result.error));
});

test('forged minutes, sanctions, injury and implied fatigue do not verify', () => {
  const {seed, r} = anyAccepted(true);
  for (const edit of [
    x => { x.playerRows[0].physicalSeconds++; },
    x => { x.playerRows[0].firstYellowCards++; },
    x => { x.teamPhysicalPlayerSeconds.home++; },
    x => { x.aggregatedEvents.goals++; },
    x => { x.match.match.finalScore.home++; },
    x => { x.fatigueDeltasCalibrated = true; },
    x => { x.crossFixtureSanctionAuthorityAuthenticated = true; },
    x => { x.playerRows.reverse(); },
  ]) {
    const candidate = structuredClone(r);
    edit(candidate);
    assert.equal(verify(prematch(seed), policy, [], [], candidate), false);
  }
  assert.equal(verify(prematch(seed + 1),policy,[],[],r),false);
});

test('untrusted getter/cycle and bad prematch cannot construct player exposure', () => {
  bad(simulate({...prematch(),rngSeed:0},policy),'SOURCE_MATCH_REJECTED');
  let touched = 0;
  const poisoned = structuredClone(prematch());
  Object.defineProperty(poisoned.fixture,'id',{
    enumerable:true,get(){touched++;return fixture.id;},
  });
  bad(simulate(poisoned,policy),'INVALID_SOURCE');
  assert.equal(touched,0);
  const cyclic = structuredClone(prematch());
  cyclic.own = cyclic;
  bad(simulate(cyclic,policy),'INVALID_SOURCE');
});
