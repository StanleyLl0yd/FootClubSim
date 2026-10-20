import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V19InternalReferee as simulate,
  verifyM1V19InternalReferee as verify,
  M1_V18_REFEREE_DOMAIN_SALT }
  from '../dist/core/m1-v19-internal-foul-injury.js';
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
const run = (seed = 645) => simulate(prematch(seed), policy);
const ok = r => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 450)); return r; };
const bad = (r, error) => assert.equal(r.error, error, JSON.stringify(r));


test('internal injury can reduce XI without creating a false referee caution', () => {
  const result = ok(run(8));
  assert.equal(result.generatedIncidents.length, 1);
  const injury = result.generatedIncidents[0];
  assert.equal(injury.sanction, 'injury-withdrawal');
  assert.equal(injury.offence, 'suspected-noncontact-injury');
  assert.equal(result.match.sourceRefereeEffects.injuryWithdrawn, 1);
  assert.equal(result.refereeRngDraws, 90);
  assert.equal(result.injuryDiagnosisAndRecoverySupported, false);
  assert.equal(result.syntheticInjuryWithdrawalsGenerated, true);
  assert.equal(result.externalRefereeAuthorityAuthenticated, false);
  assert.equal(result.syntheticFoulRatesCalibrated, false);
  const event = result.match.events.find(e => e.id === injury.sourceEventId);
  assert.equal(event?.kind, 'injury-withdrawal');
  assert.equal(event.playerId, injury.playerId);
  const side = injury.teamId === fixture.homeClubId ? 'home' : 'away';
  assert.equal(event.onField[side].includes(injury.playerId), false);
  assert.equal(result.match.finalOnField[side].includes(injury.playerId), false);
  assert.equal(verify(prematch(8), policy, result), true);
});

test('injury, card and later shooter eligibility come from one source result', () => {
  for (const seed of [1, 6, 7, 8, 9, 10, 645, 0xffffffff]) {
    const result = ok(run(seed));
    assert.equal(result.refereeRngDraws, 90);
    const events = result.match.events;
    const sanctions = events.filter(e => e.kind === 'caution' ||
      e.kind === 'second-yellow-dismissal' ||
      e.kind === 'straight-red-dismissal' ||
      e.kind === 'injury-withdrawal');
    assert.equal(result.generatedIncidents.length, sanctions.length);
    for (const incident of result.generatedIncidents) {
      const event = sanctions.find(e => e.id === incident.sourceEventId);
      assert.ok(event, incident.id);
      assert.equal(event.teamId, incident.teamId);
      assert.equal(event.playerId, incident.playerId);
      assert.equal(event.runningSeconds, incident.elapsedSeconds);
      assert.equal(event.kind === 'injury-withdrawal',
        incident.sanction === 'injury-withdrawal');
      assert.equal(event.kind === 'straight-red-dismissal',
        incident.sanction === 'direct-red');
      assert.ok(incident.elapsedSeconds > 0 &&
        incident.elapsedSeconds !== 2700 && incident.elapsedSeconds < 5400);
      if (incident.sanction === 'injury-withdrawal') {
        assert.equal(incident.offence, 'suspected-noncontact-injury');
        const side = incident.teamId === fixture.homeClubId ? 'home' : 'away';
        assert.ok(event.onField[side].length >= 7);
        assert.equal(event.onField[side].includes(incident.playerId), false);
      }
    }
    for (const event of events.filter(e => e.kind === 'shot')) {
      const side = event.teamId === fixture.homeClubId ? 'home' : 'away';
      assert.ok(event.onField[side].includes(event.playerId));
    }
    assert.equal(verify(prematch(seed), policy, result), true);
  }
});

test('same seed/inputs stable; changed seed changes generated history', () => {
  const first = ok(run(9));
  assert.deepEqual(first, ok(run(9)));
  assert.notDeepEqual(first.generatedIncidents, ok(run(10)).generatedIncidents);
  assert.equal(first.refereeRngSeed, ((9 ^ M1_V19_REFEREE_DOMAIN_SALT) >>> 0));
  assert.equal(verify(prematch(10), policy, first), false);
  assert.equal(first.match.refereeAuthorityAuthenticated, false);
});

test('replay refuses altered medical links, injury status and physical lineup', () => {
  const first = ok(run(8));
  for (const edit of [
    x => { x.generatedIncidents[0].decisionId = 'forged'; },
    x => { x.generatedIncidents[0].offence = 'wrong'; },
    x => { x.generatedIncidents[0].sourceEventId = 'fake'; },
    x => { x.match.sourceRefereeEffects.injuryWithdrawn = 0; },
    x => { x.match.finalOnField.home.push('ghost'); },
    x => { x.refereeRngDraws--; },
    x => { x.injuryDiagnosisAndRecoverySupported = true; },
  ]) {
    const candidate = structuredClone(first);
    edit(candidate);
    assert.equal(verify(prematch(8), policy, candidate), false);
  }
});

test('malformed prematch and getter-bearing objects fail without side effects', () => {
  bad(simulate({ ...prematch(), rngSeed: 0 }, policy), 'INVALID_SOURCE');
  const cyclic = structuredClone(prematch());
  cyclic.cycle = cyclic;
  bad(simulate(cyclic, policy), 'INVALID_SOURCE');
  let calls = 0;
  const forged = structuredClone(prematch());
  Object.defineProperty(forged.fixture, 'id', {
    enumerable: true, get() { calls++; return fixture.id; },
  });
  bad(simulate(forged, policy), 'INVALID_SOURCE');
  assert.equal(calls, 0);
  const candidate = structuredClone(ok(run(8)));
  Object.defineProperty(candidate.generatedIncidents[0], 'playerId', {
    enumerable: true, get() { calls++; return 'fake'; },
  });
  assert.equal(verify(prematch(8), policy, candidate), false);
  assert.equal(calls, 0);
});
