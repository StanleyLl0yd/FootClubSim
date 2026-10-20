import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V21FoulStoppageChronology as simulate,
  verifyM1V21FoulStoppageChronology as verify }
  from '../dist/core/m1-v21-foul-stoppage-chronology.js';
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
const run = (seed = 645, commands = [], pause = 20) =>
  simulate(prematch(seed), policy, commands, pause);
const ok = r => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 450)); return r; };
const bad = (r, error) => assert.equal(r.error, error, JSON.stringify(r));


test('each generated foul has a whistle, disciplinary outcome and provisional restart', () => {
  const result = ok(run());
  const fouls = result.source.generatedIncidents.filter(i =>
    i.sanction !== 'injury-withdrawal');
  assert.ok(fouls.length > 0, 'pinned seed should exercise stoppages');
  assert.equal(result.generatedFoulStoppages, fouls.length);
  assert.equal(result.totalFoulStoppedWallSeconds, 20 * fouls.length);
  assert.equal(result.totalRunningSeconds, 5400);
  assert.equal(result.source.match.events.at(-1).kind, 'full-time');
  assert.equal(result.events.at(-1).kind, 'full-time');
  assert.equal(result.events.at(-1).wallSeconds, result.totalWallSeconds);
  assert.equal(result.events.length,
    result.source.match.events.length + 2 * fouls.length);
  for (const incident of fouls) {
    const position = result.events.findIndex(e =>
      e.kind === 'synthetic-foul-whistle' &&
      e.generatedFoulId === incident.id);
    assert.ok(position > 0, 'missing whistle ' + incident.id);
    const whistle = result.events[position];
    const decision = result.events[position + 1];
    const restart = result.events[position + 2];
    assert.equal(whistle.runningSeconds, incident.elapsedSeconds);
    assert.equal(decision.runningSeconds, whistle.runningSeconds);
    assert.equal(restart.runningSeconds, whistle.runningSeconds);
    assert.equal(decision.wallSeconds, whistle.wallSeconds);
    assert.equal(restart.wallSeconds - whistle.wallSeconds, 20);
    assert.ok(['caution', 'second-yellow-dismissal',
      'straight-red-dismissal'].includes(decision.kind));
    assert.equal(restart.kind, 'synthetic-foul-restart');
    assert.equal(decision.sourceV17EventId, incident.sourceEventId);
    assert.equal(whistle.sourceV17EventId, incident.sourceEventId);
    assert.equal(restart.sourceV17EventId, incident.sourceEventId);
    const awarded = incident.teamId === fixture.homeClubId ?
      fixture.awayClubId : fixture.homeClubId;
    assert.equal(restart.candidateRestartTeamId, awarded);
    assert.equal(whistle.candidateRestartTeamId, awarded);
    assert.ok(whistle.onField[incident.teamId === fixture.homeClubId ?
      'home' : 'away'].includes(incident.playerId));
    if (decision.kind !== 'caution')
      assert.ok(!decision.onField[incident.teamId === fixture.homeClubId ?
        'home' : 'away'].includes(incident.playerId));
    assert.equal(restart.candidateRestartTeamId, awarded);
    assert.equal(restart.replacedByPlayerId, null);
  }
  assert.equal(result.restartLocationAndPenaltyAdjudicated, false);
  assert.equal(result.inPlayCoachSubstitutionSupported, false);
  assert.equal(result.refereeSimulationCalibrated, false);
  assert.equal(verify(prematch(), policy, [], 20, result), true);
});

test('the added stopped-wall time preserves causal running time and source scores', async () => {
  const { simulateM1V20InternalReferee } =
    await import('../dist/core/m1-v20-referee-halftime-coaching.js');
  for (const seed of [1, 2, 8, 9, 42, 645, 777, 0xffffffff]) {
    const result = ok(run(seed));
    const source = simulateM1V20InternalReferee(prematch(seed), policy, []);
    assert.equal(source.ok, true);
    assert.deepEqual(result.source, source);
    assert.deepEqual(result.source.match.finalOnField,
      source.match.finalOnField);
    assert.deepEqual(result.source.match.finalScore,
      source.match.finalScore);
    assert.equal(result.source.match.rngState, source.match.rngState);
    assert.equal(result.source.refereeRngState, source.refereeRngState);
    assert.equal(result.totalWallSeconds,
      source.match.events.at(-1).wallSeconds +
      result.totalFoulStoppedWallSeconds);
    for (let i = 1; i < result.events.length; i++) {
      assert.ok(result.events[i].wallSeconds >=
        result.events[i - 1].wallSeconds);
      assert.ok(result.events[i].runningSeconds >=
        result.events[i - 1].runningSeconds);
      assert.equal(result.events[i].sequence, i + 1);
    }
  }
});

test('legal half-time replacement stays in causal timeline after first-half fouls', () => {
  const command = sub(homeOut[0], homeBench[0]);
  const output = ok(run(645, [command]));
  assert.equal(output.source.acceptedHalfTimeCommands, 1);
  const half = output.events.find(e => e.kind === 'half-time-substitution');
  assert.ok(half);
  assert.equal(half.runningSeconds, 2700);
  assert.ok(half.onField.home.includes(homeBench[0]));
  assert.ok(!half.onField.home.includes(homeOut[0]));
  for (const e of output.events.filter(e =>
    e.kind === 'shot' && e.runningSeconds > 2700 &&
    e.teamId === fixture.homeClubId)) {
    assert.notEqual(e.playerId, homeOut[0]);
    assert.ok(e.onField.home.includes(e.playerId));
  }
  assert.equal(verify(prematch(), policy, [command], 20, output), true);
});

test('injury withdrawal does not magically produce a penalty or free kick', () => {
  const output = ok(run(8));
  const medical = output.source.generatedIncidents.filter(i =>
    i.sanction === 'injury-withdrawal');
  assert.ok(medical.length > 0);
  for (const incident of medical) {
    assert.equal(output.events.filter(e =>
      e.generatedFoulId === incident.id).length, 0);
    assert.ok(output.events.some(e => e.sourceV17EventId ===
      incident.sourceEventId && e.kind === 'injury-withdrawal'));
  }
  assert.equal(output.restartLocationAndPenaltyAdjudicated, false);
  assert.equal(output.source.syntheticFoulRatesCalibrated, false);
});

test('valid 1-120 stopped-wall seconds change only the display chronology', () => {
  const short = ok(run(645, [], 1));
  const long = ok(run(645, [], 120));
  assert.deepEqual(short.source, long.source);
  assert.equal(short.generatedFoulStoppages, long.generatedFoulStoppages);
  assert.equal(long.totalWallSeconds - short.totalWallSeconds,
    short.generatedFoulStoppages * 119);
  assert.equal(verify(prematch(), policy, [], 120, long), true);
  assert.equal(verify(prematch(), policy, [], 1, long), false);
});

test('invalid stopped-wall limits, coaching command and source fail closed', () => {
  for (const pause of [-1, 0, 1.5, NaN, Infinity, 121,
    '20', null]) bad(run(645, [], pause), 'INVALID_STOPPAGE_INTERVAL');
  bad(run(645, [{...sub(homeOut[0],homeBench[0]),elapsedSeconds:300}]),
    'SOURCE_MATCH_REJECTED');
  bad(simulate({ ...prematch(), rngSeed: 0 }, policy),
    'SOURCE_MATCH_REJECTED');
  let getters = 0;
  const malicious = structuredClone(prematch());
  Object.defineProperty(malicious.fixture, 'homeClubId', {
    enumerable: true, get() { getters++; return fixture.homeClubId; },
  });
  bad(simulate(malicious, policy), 'INVALID_SOURCE');
  assert.equal(getters, 0);
});

test('tampered whistle, wall clock, XI, alleged restart approval fail replay', () => {
  const output = ok(run());
  for (const edit of [
    x => { x.events.find(e => e.kind === 'synthetic-foul-whistle')
      .playerId = 'intruder'; },
    x => { x.events.at(-1).wallSeconds++; },
    x => { x.events[2].onField.home.push('ghost'); },
    x => { x.totalFoulStoppedWallSeconds = 0; },
    x => { x.restartLocationAndPenaltyAdjudicated = true; },
    x => { x.source.match.finalScore.home++; },
    x => { x.events.find(e => e.kind === 'synthetic-foul-restart')
      .candidateRestartTeamId = fixture.homeClubId; },
  ]) {
    const tampered = structuredClone(output);
    edit(tampered);
    assert.equal(verify(prematch(), policy, [], 20, tampered), false);
  }
  assert.equal(verify(prematch(99), policy, [], 20, output), false);
});
