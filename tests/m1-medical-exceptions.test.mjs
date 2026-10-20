import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectM1MedicalExceptionClaim as inspect }
  from '../dist/core/m1-medical-exceptions.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin }
  from '../dist/core/fixtures.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { RNG_VERSION } from '../dist/core/rng.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c =>
  c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c =>
  c.id === fixture.awayClubId));
const pos = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const hk = home.starters.find(id => pos.get(id) === 'GK');
const ak = away.starters.find(id => pos.get(id) === 'GK');
const ho = home.starters.filter(id => pos.get(id) !== 'GK');
const ao = away.starters.filter(id => pos.get(id) !== 'GK');
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: {starterCount: 11, maxBench: 12, maxForeignersOnField: 7},
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 601,
};
const claim = (kind, changes = {}) => ({
  schemaVersion: 1, fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: ho[0], kind,
  relatedTeamId: null, relatedPlayerId: null, opponentCard: null,
  physicalOffenceDeclared: false, bothPlayersNeedAttentionDeclared: false,
  severeInjuryDeclared: false, penaltyAwardedDeclared: false,
  penaltyTakerDeclared: false, ...changes,
});
const valid = input => {
  const r = inspect(prematch, input);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exceptionKind, input.kind);
  assert.equal(r.refereeAuthorityAuthenticated, false);
  assert.equal(r.medicalAuthorityAuthenticated, false);
  assert.equal(r.currentPhysicalPresenceVerified, false);
  assert.equal(r.playerLeaveOrReturnAuthorized, false);
  assert.match(r.status, /NOT_AUTHENTICATED/);
  return r;
};
const invalid = (input, expected = 'EXCEPTION_FACTS_INCONSISTENT') =>
  assert.deepEqual(inspect(prematch, input), {ok: false, error: expected});

test('each narrow Law 5 exception has explicit source-shaped claim facts', () => {
  valid(claim('goalkeeper-injury', {playerId: hk}));
  valid(claim('keeper-outfield-collision', {
    playerId: hk, relatedTeamId: fixture.awayClubId,
    relatedPlayerId: ao[0], bothPlayersNeedAttentionDeclared: true,
  }));
  valid(claim('keeper-outfield-collision', {
    relatedTeamId: fixture.awayClubId, relatedPlayerId: ak,
    bothPlayersNeedAttentionDeclared: true,
  }));
  valid(claim('same-team-collision', {
    relatedTeamId: fixture.homeClubId, relatedPlayerId: ho[1],
    bothPlayersNeedAttentionDeclared: true,
  }));
  valid(claim('severe-injury', {severeInjuryDeclared: true}));
  for (const card of ['yellow', 'red']) {
    valid(claim('opponent-cautioned-or-sent-off', {
      relatedTeamId: fixture.awayClubId,
      relatedPlayerId: ao[0], opponentCard: card,
      physicalOffenceDeclared: true,
    }));
  }
  valid(claim('injured-penalty-taker', {
    penaltyAwardedDeclared: true, penaltyTakerDeclared: true,
  }));
});

test('contradictions cannot turn an ordinary injury into an exception', () => {
  invalid(claim('goalkeeper-injury'));
  invalid(claim('goalkeeper-injury', {
    playerId: hk, severeInjuryDeclared: true,
  }));
  invalid(claim('keeper-outfield-collision', {
    relatedTeamId: fixture.awayClubId, relatedPlayerId: ao[0],
    bothPlayersNeedAttentionDeclared: true,
  }));
  invalid(claim('same-team-collision', {
    relatedTeamId: fixture.awayClubId, relatedPlayerId: ao[0],
    bothPlayersNeedAttentionDeclared: true,
  }));
  invalid(claim('same-team-collision', {
    relatedTeamId: fixture.homeClubId, relatedPlayerId: ho[0],
    bothPlayersNeedAttentionDeclared: true,
  }), 'UNSUPPORTED_PLAYER_HISTORY');
  invalid(claim('severe-injury'));
  invalid(claim('opponent-cautioned-or-sent-off', {
    relatedTeamId: fixture.awayClubId, relatedPlayerId: ao[0],
  }));
  invalid(claim('opponent-cautioned-or-sent-off', {
    relatedTeamId: fixture.homeClubId, relatedPlayerId: ho[1],
    opponentCard: 'yellow', physicalOffenceDeclared: true,
  }));
  invalid(claim('injured-penalty-taker', {
    penaltyAwardedDeclared: true,
  }));
  invalid(claim('injured-penalty-taker', {
    penaltyTakerDeclared: true,
  }));
  invalid(claim('severe-injury', {
    severeInjuryDeclared: true, opponentCard: 'yellow',
  }));
  invalid(claim('keeper-outfield-collision', {
    playerId: hk, relatedTeamId: fixture.awayClubId,
    relatedPlayerId: ao[0],
  }));
  invalid(claim('opponent-cautioned-or-sent-off', {
    relatedTeamId: fixture.awayClubId,
    relatedPlayerId: ao[0], opponentCard: 'yellow',
  }));
});

test('no bench player, foreign fixture or self-asserted active roster is trusted', () => {
  invalid(claim('severe-injury', {
    playerId: home.bench[0], severeInjuryDeclared: true,
  }), 'UNSUPPORTED_PLAYER_HISTORY');
  invalid(claim('severe-injury', {
    playerId: 'ghost', severeInjuryDeclared: true,
  }), 'UNSUPPORTED_PLAYER_HISTORY');
  invalid(claim('goalkeeper-injury', {
    playerId: hk, teamId: fixture.awayClubId,
  }), 'UNSUPPORTED_PLAYER_HISTORY');
  invalid(claim('goalkeeper-injury', {
    playerId: hk, teamId: 'ghost-club',
  }), 'UNKNOWN_TEAM');
  invalid(claim('goalkeeper-injury', {
    playerId: hk, fixtureId: 'other-fixture',
  }), 'WRONG_FIXTURE');
  invalid(claim('opponent-cautioned-or-sent-off', {
    relatedTeamId: fixture.awayClubId,
    relatedPlayerId: away.bench[0], opponentCard: 'red',
  }), 'UNSUPPORTED_PLAYER_HISTORY');
  invalid(claim('opponent-cautioned-or-sent-off', {
    relatedTeamId: fixture.awayClubId,
    relatedPlayerId: 'unlisted-player', opponentCard: 'red',
  }), 'UNSUPPORTED_PLAYER_HISTORY');
});

test('strict schema and poison input fail closed, without invoking getters', () => {
  for (const change of [
    {schemaVersion: 2}, {kind: 'concussion'}, {other: 12},
    {relatedTeamId: fixture.awayClubId}, {penaltyTakerDeclared: 'true'},
    {opponentCard: 'pending'}, {severeInjuryDeclared: null},
    {physicalOffenceDeclared: null},
    {bothPlayersNeedAttentionDeclared: 'yes'},
  ]) {
    invalid(claim('goalkeeper-injury', {playerId: hk, ...change}),
      'INVALID_CLAIM');
  }
  assert.deepEqual(inspect({...prematch, rngSeed: 0},
    claim('goalkeeper-injury', {playerId: hk})),
  {ok: false, error: 'INVALID_PREMATCH'});
  let getterHits = 0;
  const poisoned = claim('goalkeeper-injury', {playerId: hk});
  Object.defineProperty(poisoned, 'playerId', {
    enumerable: true, get() {getterHits++; return hk;},
  });
  invalid(poisoned, 'INVALID_CLAIM');
  const cyclic = claim('goalkeeper-injury', {playerId: hk});
  cyclic.loop = cyclic;
  invalid(cyclic, 'INVALID_CLAIM');
  assert.equal(getterHits, 0);
});

test('same inputs reproduce a provenance-limited result without mutation', () => {
  const raw = claim('injured-penalty-taker', {
    penaltyAwardedDeclared: true, penaltyTakerDeclared: true,
  });
  const before = structuredClone(raw);
  const original = structuredClone(prematch);
  assert.deepEqual(valid(raw), valid(raw));
  assert.deepEqual(raw, before);
  assert.deepEqual(prematch, original);
});
