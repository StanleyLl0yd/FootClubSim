import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileM1V8ConfirmedSanctions }
  from '../dist/core/m1-v8-sanction-review.js';
import { applyM1V8MatchResult, startM1V8MatchJournal }
  from '../dist/core/m1-v8-result-journal.js';
import { startM1V7MatchJournal }
  from '../dist/core/m1-v7-result-journal.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';

const catalog = createSyntheticRplScaleCatalog(77);
const initial = createInitialCareer(
  catalog, catalog.clubs[0].id, 42, 'v8-sanctions');
const schedule = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const fixture = schedule[0];
const future = schedule.find(f => f.id !== fixture.id &&
  (f.homeClubId === fixture.homeClubId ||
    f.awayClubId === fixture.homeClubId));
assert.ok(future);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function prematch(match = fixture, benchReduction = 0) {
  const home = defaultSyntheticLineup(clubs.get(match.homeClubId));
  const away = defaultSyntheticLineup(clubs.get(match.awayClubId));
  return {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture: match, catalog,
    homeLineup: { ...home, bench: home.bench.slice(0, home.bench.length - benchReduction) },
    awayLineup: away,
    homeTactics: defaultTacticalPlan(match.homeClubId),
    awayTactics: defaultTacticalPlan(match.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
  };
}
const previousSource = prematch();
const currentSource = prematch(future);
const starting = previousSource.homeLineup.starters[0];
const unused = previousSource.homeLineup.bench[0];
const used = previousSource.homeLineup.bench.find(id =>
  positions.get(id) !== 'GK');
const out = previousSource.homeLineup.starters.find(id =>
  positions.get(id) !== 'GK');
function ban(playerId, affectedFixtureIds, rulingId = 'referee-confirmed-ban') {
  return { schemaVersion: 1, rulingId,
    kind: 'match-suspension', clubId: fixture.homeClubId,
    playerId, affectedFixtureIds };
}
const empty = startM1V8MatchJournal(initial);
assert.equal(empty.ok, true);
function committed(source = previousSource, commands = []) {
  const simulated = simulateM1V8MedicalPhases(source, policy, commands, [], []);
  assert.equal(simulated.ok, true, JSON.stringify(simulated).slice(0, 200));
  const stored = applyM1V8MatchResult(initial, empty.journal, {
    schemaVersion: 4, commandId: 'complete-first',
    careerId: initial.careerId, expectedRevision: 0, prematch: source,
    policy, plannedCommands: commands, trustedDecisions: [],
    medicalActions: [], result: simulated,
  });
  assert.equal(stored.ok, true, JSON.stringify(stored).slice(0, 180));
  return stored.journal;
}
const check = (journal, rulings, source = currentSource, career = initial) =>
  reconcileM1V8ConfirmedSanctions(career, journal, source, rulings);

test('an authenticated empty source snapshot and no completed matches is admissible', () => {
  assert.deepEqual(check(empty.journal, []), {
    ok: true, review: {
      schemaVersion: 1, careerId: initial.careerId, journalRevision: 0,
      fixtureId: future.id, examinedCompletedFixtures: 0,
      rulingCount: 0, blockedHomePlayers: [], blockedAwayPlayers: [],
    },
  });
});

test('current pre-match XI and substitutes are blocked equally', () => {
  const presentClub = fixture.homeClubId === future.homeClubId ?
    currentSource.homeLineup : currentSource.awayLineup;
  for (const id of [presentClub.starters[0], presentClub.bench[0]]) {
    assert.deepEqual(check(empty.journal, [ban(id, [future.id])]), {
      ok: false, error: 'CURRENT_LINEUP_BLOCKED',
      affectedFixtureIds: [future.id], affectedPlayerIds: [id],
    });
  }
});

test('past starter and unused substitute conflicts are both exact, no ambiguity', () => {
  const journal = committed();
  for (const [id, listing] of [
    [starting, 'starter'],
    [unused, 'unused-substitute'],
  ]) {
    assert.deepEqual(check(journal, [ban(id, [fixture.id])]), {
      ok: false, error: 'HISTORICAL_MATCHDAY_SHEET_CONFLICT',
      affectedFixtureIds: [fixture.id], affectedPlayerIds: [id],
      historicalConflicts: [{ fixtureId: fixture.id, playerId: id, listing }],
    });
  }
});

test('a previously used substitute is recorded as used, not incorrectly unused', () => {
  const commands = [{
    schemaVersion: 1, commandId: 'normal-sub',
    fixtureId: fixture.id, teamId: fixture.homeClubId,
    elapsedSeconds: 300, actor: { kind: 'player' },
    kind: 'substitute-normal', outPlayerId: out,
    inPlayerId: used, stoppage: 'referee-authorized',
  }];
  const journal = committed(previousSource, commands);
  assert.deepEqual(check(journal, [ban(used, [fixture.id])]), {
    ok: false, error: 'HISTORICAL_MATCHDAY_SHEET_CONFLICT',
    affectedFixtureIds: [fixture.id], affectedPlayerIds: [used],
    historicalConflicts: [{
      fixtureId: fixture.id, playerId: used, listing: 'used-substitute',
    }],
  });
});

test('complete old matchday list proves a genuinely unlisted player absent', () => {
  const short = prematch(fixture, 1);
  const removed = previousSource.homeLineup.bench.at(-1);
  const journal = committed(short);
  assert.equal(journal.results[0].dossier.teams.home.namedPlayerIds.includes(removed),
    false);
  const checked = check(journal, [ban(removed, [fixture.id])]);
  assert.equal(checked.ok, true, JSON.stringify(checked).slice(0, 160));
  assert.equal(checked.review.examinedCompletedFixtures, 1);
});

test('historical conflicts take priority over a blocked current line-up', () => {
  const journal = committed();
  const current = fixture.homeClubId === future.homeClubId ?
    currentSource.homeLineup : currentSource.awayLineup;
  const id = current.starters.find(player => previousSource.homeLineup.starters.includes(player));
  assert.ok(id);
  const checked = check(journal, [ban(id, [fixture.id, future.id])]);
  assert.equal(checked.ok, false);
  assert.equal(checked.error, 'HISTORICAL_MATCHDAY_SHEET_CONFLICT');
  assert.deepEqual(checked.affectedFixtureIds, [fixture.id]);
});

test('duplicate and malformed ruling source fails before historical inspection', () => {
  assert.deepEqual(check(empty.journal, [ban(starting, ['not-a-fixture'])]),
    { ok: false, error: 'INVALID_RULINGS' });
  assert.deepEqual(check(empty.journal, [
    ban(starting, [fixture.id], 'one'),
    ban(starting, [fixture.id], 'two'),
  ]), { ok: false, error: 'INVALID_RULINGS' });
});

test('corrupt history, legacy journal and already committed fixture fail closed', () => {
  const journal = committed();
  const older = startM1V7MatchJournal(initial);
  assert.equal(older.ok, true);
  assert.deepEqual(check(older.journal, []),
    { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(check({ ...journal, results: [
    { ...journal.results[0], dossier: {
      ...journal.results[0].dossier,
      teams: { ...journal.results[0].dossier.teams, home: {
        ...journal.results[0].dossier.teams.home, benchNamed: [],
      } },
    } },
  ] }, []), { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(check(journal, [], previousSource),
    { ok: false, error: 'ALREADY_COMMITTED_FIXTURE' });
  assert.deepEqual(check(empty.journal, [], {
    ...currentSource, catalog: { ...catalog, clubs: [] },
  }), { ok: false, error: 'INVALID_PREMATCH' });
});

test('sanction inspection never mutates source, journal or rulings', () => {
  const journal = committed();
  const orders = [ban(unused, [fixture.id])];
  const snapshot = structuredClone(journal);
  const prior = structuredClone(orders);
  check(journal, orders);
  assert.deepEqual(journal, snapshot);
  assert.deepEqual(orders, prior);
});
