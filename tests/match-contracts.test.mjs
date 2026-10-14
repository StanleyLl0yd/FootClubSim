import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { MATCH_LEDGER_VERSION, M0_ENGINE_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION, deriveMatchLedger } from '../dist/core/match-contracts.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const end = { id: 'end', sequence: 1, elapsedSeconds: 5400, type: 'full-time' };
const base = {
  schemaVersion: MATCH_LEDGER_VERSION,
  engineVersion: M0_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID,
  rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog,
  homeLineup, awayLineup,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
  events: [end],
};

test('nil-nil match derives all-zero statistics from end-only ledger', () => {
  const result = deriveMatchLedger(base);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.report, {
    fixtureId: fixture.id,
    home: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
    away: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
  });
});

test('goals, on-target shots and fixed-point xG follow ordered events only', () => {
  const shots = [
    { id: 's1', sequence: 1, elapsedSeconds: 45, type: 'shot', teamId: fixture.homeClubId,
      playerId: homeLineup.starters[10], xgMilli: 250, outcome: 'goal' },
    { id: 's2', sequence: 2, elapsedSeconds: 2345, type: 'shot', teamId: fixture.awayClubId,
      playerId: awayLineup.starters[10], xgMilli: 130, outcome: 'saved' },
    { id: 's3', sequence: 3, elapsedSeconds: 5201, type: 'shot', teamId: fixture.homeClubId,
      playerId: homeLineup.starters[9], xgMilli: 70, outcome: 'blocked' },
  ];
  const result = deriveMatchLedger({ ...base, events: [...shots, { ...end, sequence: 4 }] });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.report.home, { goals: 1, shots: 2, shotsOnTarget: 1, xgMilli: 320 });
    assert.deepEqual(result.report.away, { goals: 0, shots: 1, shotsOnTarget: 1, xgMilli: 130 });
  }
  assert.deepEqual(deriveMatchLedger({ ...base, events: [...shots, { ...end, sequence: 4 }] }), result);
});

test('wrong fixture clubs and illegal lineups prevent ledger evaluation', () => {
  const wrong = deriveMatchLedger({ ...base, fixture: { ...fixture, awayClubId: fixture.homeClubId } });
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.ok(wrong.errors.some(e => e.code === 'INVALID_FIXTURE'));
  const noKeeper = deriveMatchLedger({ ...base, homeLineup: {
    ...homeLineup, starters: homeLineup.starters.slice(1).concat(homeLineup.bench[0]),
  } });
  assert.equal(noKeeper.ok, false);
  if (!noKeeper.ok) assert.ok(noKeeper.errors.some(e => e.code === 'GOALKEEPER_COUNT'));
});

test('duplicate events, backdating, bad sequences and missing full time are rejected', () => {
  const shot = { id: 'shot', sequence: 1, elapsedSeconds: 4000, type: 'shot',
    teamId: fixture.homeClubId, playerId: homeLineup.starters[10], xgMilli: 100, outcome: 'saved' };
  for (const events of [
    [shot, { ...end, id: 'shot', sequence: 2 }],
    [shot, { ...end, sequence: 2, elapsedSeconds: 3000 }],
    [shot, { ...end, sequence: 3 }],
    [shot],
    [{ ...end, elapsedSeconds: 100 }],
  ]) {
    assert.equal(deriveMatchLedger({ ...base, events }).ok, false);
  }
});

test('invalid event types, shooters, xG and RNG version cannot be accepted', () => {
  const shot = { id: 'shot', sequence: 1, elapsedSeconds: 100, type: 'shot',
    teamId: fixture.homeClubId, playerId: homeLineup.starters[10], xgMilli: 500, outcome: 'goal' };
  for (const changed of [
    { ...shot, teamId: 'unregistered' },
    { ...shot, playerId: awayLineup.starters[10] },
    { ...shot, xgMilli: 1001 },
    { ...shot, outcome: 'unknown' },
    { ...shot, type: 'score' },
  ]) {
    assert.equal(deriveMatchLedger({ ...base, events: [changed, { ...end, sequence: 2 }] }).ok, false);
  }
  assert.equal(deriveMatchLedger({ ...base, rngSeed: 0 }).ok, false);
  assert.equal(deriveMatchLedger({ ...base, rngAlgorithmVersion: 'other' }).ok, false);
});

test('long or empty ledger is rejected before simulation', () => {
  assert.equal(deriveMatchLedger({ ...base, events: [] }).ok, false);
  assert.equal(deriveMatchLedger({ ...base, events: Array(4097).fill(end) }).ok, false);
});

test('both club tactical plans must match the fixture and pass validated ranges', () => {
  for (const change of [
    { ...base.homeTactics, clubId: fixture.awayClubId },
    { ...base.homeTactics, formation: '4-4-4' },
    { ...base.homeTactics, pressing: 101 },
    { ...base.homeTactics, tempo: NaN },
  ]) {
    assert.equal(deriveMatchLedger({ ...base, homeTactics: change }).ok, false);
  }
});

test('match input binds the event ledger to a specific engine and rules version', () => {
  assert.equal(deriveMatchLedger(base).ok, true);
  for (const patch of [
    { schemaVersion: 2 },
    { engineVersion: '1' },
    { rulesPackId: 'rpl-2026-27' },
    { rulesPackVersion: '2' },
  ]) {
    const result = deriveMatchLedger({ ...base, ...patch });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some(error => error.code === 'INVALID_MATCH_VERSION_OR_SEED'));
    }
  }
});

test('malformed runtime input reports typed errors instead of crashing', () => {
  const invalidShapeCases = [
    null,
    { ...base, fixture: null },
    { ...base, catalog: null },
    { ...base, catalog: { ...catalog, players: [null] } },
    { ...base, catalog: { ...catalog, clubs: [null] } },
    { ...base, homeTactics: null },
    { ...base, homeLineup: { ...homeLineup, starters: null } },
    { ...base, rosterRules: null },
  ];
  for (const candidate of invalidShapeCases) {
    const result = deriveMatchLedger(candidate);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some(error => error.code === 'INVALID_MATCH_SHAPE'));
    }
  }
  for (const events of [null, 'bad', [], Array(4097).fill(end)]) {
    const result = deriveMatchLedger({ ...base, events });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some(error => error.code === 'INVALID_EVENT_COUNT'));
    }
  }
  for (const event of [null, false, 42]) {
    const result = deriveMatchLedger({ ...base, events: [event, { ...end, sequence: 2 }] });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some(error => error.code === 'INVALID_EVENT_SHAPE'));
    }
  }
});

test('sparse catalog arrays and oversized roster references never crash match derivation', () => {
  const cases = [
    { ...base, catalog: { ...catalog, players: Array(1) } },
    { ...base, catalog: { ...catalog, clubs: Array(1) } },
    { ...base, catalog: { ...catalog, clubs: [
      { ...catalog.clubs[0], registeredPlayerIds: Array(1) },
      ...catalog.clubs.slice(1),
    ] } },
    { ...base, catalog: { ...catalog, clubs: [
      { ...catalog.clubs[0], registeredPlayerIds: Array(129).fill(catalog.players[0].id) },
      ...catalog.clubs.slice(1),
    ] } },
  ];
  for (const input of cases) {
    assert.doesNotThrow(() => deriveMatchLedger(input));
    const result = deriveMatchLedger(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.some(e => e.code === 'INVALID_MATCH_SHAPE'));
  }
});

test('malformed competition foreigner flags cannot bypass match eligibility validation', () => {
  const first = catalog.players[0];
  for (const invalid of ['false', null, 1]) {
    const altered = {
      ...base,
      catalog: {
        ...catalog,
        players: [{ ...first, foreignerForCompetition: invalid }, ...catalog.players.slice(1)],
      },
    };
    const result = deriveMatchLedger(altered);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.some(error => error.code === 'INVALID_PLAYER'));
  }
});

test('versioned match events reject undeclared fields and missing required fields', () => {
  const shot = {
    id: 's1', sequence: 1, elapsedSeconds: 200,
    type: 'shot', teamId: fixture.homeClubId,
    playerId: homeLineup.starters[10], xgMilli: 100, outcome: 'saved',
  };
  const malformed = [
    [{ ...end, debug: 'unexpected' }],
    [{ ...shot, debug: 'unexpected' }, { ...end, sequence: 2 }],
    [{ id: shot.id, sequence: shot.sequence, elapsedSeconds: shot.elapsedSeconds,
      type: shot.type, teamId: shot.teamId, xgMilli: shot.xgMilli, outcome: shot.outcome },
    { ...end, sequence: 2 }],
    [{ id: shot.id, sequence: shot.sequence, elapsedSeconds: shot.elapsedSeconds,
      type: shot.type, teamId: shot.teamId, playerId: shot.playerId, xgMilli: shot.xgMilli },
    { ...end, sequence: 2 }],
  ];
  for (const events of malformed) {
    const result = deriveMatchLedger({ ...base, events });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.some(e => e.code === 'INVALID_EVENT_SHAPE'));
  }
});
