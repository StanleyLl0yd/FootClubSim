import test from 'node:test';
import assert from 'node:assert/strict';
import { replayM1V7TemporaryMedicalPresence,
  verifyM1V7TemporaryMedicalPresence }
  from '../dist/core/m1-v7-temporary-medical.js';
import { simulateM1V7Phases } from '../dist/core/m1-v7-adjudications.js';
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
const position = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const field = home.starters.filter(id => position.get(id) !== 'GK');
const opponent = away.starters.find(id => position.get(id) !== 'GK');
const prematch = {
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
const original = simulateM1V7Phases(prematch, policy);
assert.equal(original.ok, true);
const shooterAtStart = original.events.find(e =>
  e.type === 'v6-event' && e.source.type === 'shot' &&
  e.elapsedSeconds === 299)?.source.playerId;
const safe = field.find(id => id !== shooterAtStart);
assert.ok(safe);
function exit(id = 'exit-1', playerId = safe, elapsedSeconds = 0,
  restartAtRunningSeconds = elapsedSeconds + 15, teamId = fixture.homeClubId) {
  return {
    schemaVersion: 1, id, fixtureId: fixture.id, teamId, playerId,
    elapsedSeconds, kind: 'treatment-exit', reason: 'injury-stopped-play',
    restartAtRunningSeconds,
  };
}
function enter(id = 'return-1', playerId = safe, elapsedSeconds = 300,
  changes = {}) {
  return {
    schemaVersion: 1, id, fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId, elapsedSeconds,
    kind: 'treatment-return', returnContext: 'running-clock',
    ballInPlay: true, entryBoundary: 'touchline',
    refereeSignalId: 'ref-signal-1', ...changes,
  };
}
function check(actions, decisions = [], commands = []) {
  return replayM1V7TemporaryMedicalPresence(prematch, policy, commands,
    decisions, actions);
}
test('temporary exit and permitted re-entry preserve full XI without mutating v7', () => {
  const actions = [exit(), enter()];
  const before = structuredClone(actions);
  const result = check(actions);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.replay.offFieldAtFullTime, []);
  assert.equal(result.replay.onFieldAtFullTime.home.length, 11);
  assert.equal(result.replay.onFieldAtFullTime.away.length, 11);
  assert.ok(verifyM1V7TemporaryMedicalPresence(
    prematch, policy, [], [], actions, result.replay));
  assert.equal(verifyM1V7TemporaryMedicalPresence(
    prematch, policy, [], [], actions,
    { ...result.replay, offFieldAtFullTime: ['forged'] }), false);
  assert.deepEqual(actions, before);
  assert.deepEqual(simulateM1V7Phases(prematch, policy), original);
});

test('the 60 running-second delay and touchline permission are enforced', () => {
  assert.deepEqual(check([exit('a', safe, 0, 270), enter('b')]), {
    ok: false, error: 'MEDICAL_RETURN_REJECTED', medicalError: 'RETURN_TOO_EARLY',
  });
  assert.deepEqual(check([exit(), enter('b', safe, 300,
    { entryBoundary: 'goal-line' })]), {
    ok: false, error: 'MEDICAL_RETURN_REJECTED',
    medicalError: 'WRONG_ENTRY_BOUNDARY',
  });
  assert.deepEqual(check([exit(), enter('b', safe, 300,
    { refereeSignalId: '' })]), { ok: false, error: 'INVALID_ACTIONS' });
});

test('valid source shot by temporarily absent player is rejected, not silently rerolled', () => {
  const shot = original.events.find(e => e.type === 'v6-event' &&
    e.source.type === 'shot' && e.elapsedSeconds < 5100 &&
    home.starters.includes(e.source.playerId));
  assert.ok(shot, 'seed has a starting home shooter');
  const at = shot.elapsedSeconds - 299;
  assert.deepEqual(check([exit('off-shooter', shot.source.playerId, at)]), {
    ok: false, error: 'PARTICIPANT_OFF_FIELD',
  });
});

test('medical absences gate referee-confirmed penalties and opponent own goals', () => {
  const penalty = {
    schemaVersion: 1, decisionId: 'pen-1', fixtureId: fixture.id,
    elapsedSeconds: 0, teamId: fixture.homeClubId, playerId: safe,
    kind: 'penalty-kick', outcome: 'scored',
  };
  assert.deepEqual(check([exit()], [penalty]), {
    ok: false, error: 'PARTICIPANT_OFF_FIELD',
  });
  const ownGoal = {
    schemaVersion: 1, decisionId: 'og-1', fixtureId: fixture.id,
    elapsedSeconds: 0, teamId: fixture.homeClubId, playerId: opponent,
    kind: 'own-goal',
  };
  assert.deepEqual(check([exit('opp-exit', opponent, 0, 15,
    fixture.awayClubId)], [ownGoal]), {
    ok: false, error: 'PARTICIPANT_OFF_FIELD',
  });
});

test('invalid event ordering, replay collisions and unsupported cases fail closed', () => {
  assert.deepEqual(check([enter()]), { ok: false, error: 'NOT_ABSENT' });
  assert.deepEqual(check([exit(), exit('second', safe, 300)]), {
    ok: false, error: 'ALREADY_ABSENT',
  });
  assert.deepEqual(check([exit(), enter('exit-1')]), {
    ok: false, error: 'DUPLICATE_ID',
  });
  assert.deepEqual(check([enter(), exit()]), {
    ok: false, error: 'INVALID_ACTIONS',
  });
  assert.deepEqual(check([exit('a', home.bench[0])]), {
    ok: false, error: 'NOT_ON_FIELD',
  });
  const keeper = home.starters.find(id => position.get(id) === 'GK');
  assert.deepEqual(check([exit('keeper', keeper)]), {
    ok: false, error: 'EXCEPTION_RULING_REQUIRED',
  });
  assert.deepEqual(check([exit('wrong', safe, 0, 15, 'outsider')]), {
    ok: false, error: 'WRONG_TEAM',
  });
  assert.deepEqual(check([{ ...exit(), fixtureId: 'another' }]), {
    ok: false, error: 'WRONG_FIXTURE',
  });
  assert.deepEqual(check([{ ...exit(), extra: true }]), {
    ok: false, error: 'INVALID_ACTIONS',
  });
  assert.deepEqual(check([exit('pen-1')], [{
    schemaVersion: 1, decisionId: 'pen-1', fixtureId: fixture.id,
    elapsedSeconds: 0, teamId: fixture.homeClubId, playerId: safe,
    kind: 'penalty-kick', outcome: 'scored',
  }]), { ok: false, error: 'DUPLICATE_ID' });
});
