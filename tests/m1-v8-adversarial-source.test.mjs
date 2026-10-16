import test from 'node:test';
import assert from 'node:assert/strict';
import { applyM1V8MatchResultBatch, startM1V8MatchJournal,
  validateM1V8MatchJournal }
  from '../dist/core/m1-v8-result-journal.js';
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

// Deliberately fixed, local and fast enough for the required Core CI.
// The campaign tests integrity, NOT licensed football realism.
const catalog = createSyntheticRplScaleCatalog(77);
const initial = createInitialCareer(
  catalog, catalog.clubs[0].id, 42, 'v8-adversarial-source');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const byClub = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function request(fixture, revision) {
  const homeLineup = defaultSyntheticLineup(byClub.get(fixture.homeClubId));
  const awayLineup = defaultSyntheticLineup(byClub.get(fixture.awayClubId));
  const prematch = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog, homeLineup, awayLineup,
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 42 + revision,
  };
  const taker = homeLineup.starters.find(id => positions.get(id) !== 'GK');
  const opponent = awayLineup.starters.find(id => positions.get(id) !== 'GK');
  const trustedDecisions = [
    { schemaVersion: 1, decisionId: 'penalty-' + revision,
      fixtureId: fixture.id, teamId: fixture.homeClubId,
      playerId: taker, elapsedSeconds: 600,
      kind: 'penalty-kick', outcome: 'scored' },
    { schemaVersion: 1, decisionId: 'own-goal-' + revision,
      fixtureId: fixture.id, teamId: fixture.homeClubId,
      playerId: opponent, elapsedSeconds: 900, kind: 'own-goal' },
  ];
  const medicalActions = [
    { schemaVersion: 1, id: 'exit-' + revision,
      fixtureId: fixture.id, teamId: fixture.homeClubId, playerId: taker,
      elapsedSeconds: 0, kind: 'treatment-exit',
      reason: 'medical-staff-entered', restartAtRunningSeconds: 15 },
    { schemaVersion: 1, id: 'return-' + revision,
      fixtureId: fixture.id, teamId: fixture.homeClubId, playerId: taker,
      elapsedSeconds: 300, kind: 'treatment-return',
      returnContext: 'running-clock', ballInPlay: true,
      entryBoundary: 'touchline', refereeSignalId: 'asserted-not-authenticated' },
  ];
  const plannedCommands = [];
  const result = simulateM1V8MedicalPhases(
    prematch, policy, plannedCommands, trustedDecisions, medicalActions);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 300));
  return {
    schemaVersion: 4, commandId: 'source-' + revision,
    careerId: initial.careerId, expectedRevision: revision,
    prematch, policy, plannedCommands, trustedDecisions, medicalActions,
    result,
  };
}
const started = startM1V8MatchJournal(initial);
assert.equal(started.ok, true);
const committed = fixtures.slice(0, 4).map((fixture, i) => request(fixture, i));
const applied = applyM1V8MatchResultBatch(initial, started.journal, committed);
assert.equal(applied.ok, true, JSON.stringify(applied).slice(0, 300));
const journal = applied.journal;
const followup = request(fixtures[4], 4);

// Every mutation changes a checked field, source, identity or JSON shape.
const mutations = [
  (doc, i) => { doc.results[i].rngState ^= 1; },
  (doc, i) => { doc.results[i].rngSeed ^= 1; },
  (doc, i) => { doc.results[i].rngDraws++; },
  (doc, i) => { doc.results[i].eventCount++; },
  (doc, i) => { doc.results[i].round++; },
  (doc, i) => { doc.results[i].fixtureId = 'forged-fixture'; },
  (doc, i) => { doc.results[i].engineVersion = 'forged'; },
  (doc, i) => { doc.results[i].dossier.match.home.goals++; },
  (doc, i) => { doc.results[i].dossier.match.away.goals++; },
  (doc, i) => { doc.results[i].dossier.players[0].goals++; },
  (doc, i) => { doc.results[i].dossier.players[0].yellowCards++; },
  (doc, i) => { doc.results[i].dossier.teams.home.unusedBench = []; },
  (doc, i) => { doc.results[i].source.prematch.rngSeed ^= 1; },
  (doc, i) => { doc.results[i].source.trustedDecisions = []; },
  (doc, i) => { doc.results[i].source.medicalActions = []; },
  (doc, i) => { doc.results[i].source.plannedCommands = [{}]; },
  (doc, i) => { doc.results[i].source.unexpected = true; },
  (doc, i) => { doc.results[i].source.prematch.catalog = {}; },
  (doc, i) => { doc.results[i].extra = 1; },
  (doc, i) => { doc.results[i].dossier.players[0].playerId = 'forged'; },
];

// Fixed xorshift32 schedule: no Math.random, external data or saved snapshots.
function* deterministicCases(count) {
  let state = 0x5a17b00b;
  for (let k = 0; k < count; k++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    yield { index: (state >>> 0) % 4, mutation: k % mutations.length };
  }
}

test('bounded deterministic adversarial corpus rejects altered source and results', () => {
  const before = structuredClone(journal);
  const cases = [...deterministicCases(80)];
  for (const { index, mutation } of cases) {
    const poisoned = structuredClone(journal);
    mutations[mutation](poisoned, index);
    const checked = validateM1V8MatchJournal(initial, poisoned);
    assert.deepEqual(checked, { ok: false, error: 'INVALID_JOURNAL' },
      'mutation ' + mutation + ' at entry ' + index);
  }
  assert.equal(cases.length, 80);
  assert.deepEqual(journal, before);
  assert.deepEqual(validateM1V8MatchJournal(initial, journal),
    { ok: true, journal });
});

test('invalid prior state prevents every new batch, never leaks a partial revision', () => {
  const before = structuredClone(journal);
  // A representative sample exercises batch prevalidation, not 80 full
  // replaying batch attempts on a CI runner.
  for (let j = 0; j < mutations.length; j += 4) {
    const poisoned = structuredClone(journal);
    mutations[j](poisoned, j % 4);
    assert.deepEqual(applyM1V8MatchResultBatch(initial, poisoned, [followup]),
      { ok: false, error: 'INVALID_JOURNAL' });
  }
  assert.deepEqual(journal, before);
  const legitimate = applyM1V8MatchResultBatch(initial, journal, [followup]);
  assert.equal(legitimate.ok, true);
  assert.equal(legitimate.journal.revision, 5);
});

test('hostile JSON shapes are rejected without source mutation or exceptions', () => {
  const malformed = [];
  const withHole = structuredClone(journal);
  delete withHole.results[1];
  malformed.push(withHole);
  const nonfinite = structuredClone(journal);
  nonfinite.results[0].rngDraws = Infinity;
  malformed.push(nonfinite);
  const extraUndefined = structuredClone(journal);
  extraUndefined.results[0].extra = undefined;
  malformed.push(extraUndefined);
  const cycle = structuredClone(journal);
  cycle.results[0].source.self = cycle;
  malformed.push(cycle);
  for (const candidate of malformed) {
    assert.deepEqual(validateM1V8MatchJournal(initial, candidate),
      { ok: false, error: 'INVALID_JOURNAL' });
  }
});

test('candidate result corruption cannot be hidden inside an otherwise legal batch', () => {
  const requests = fixtures.slice(4, 7).map((fixture, i) =>
    request(fixture, 4 + i));
  const forged = structuredClone(requests[1]);
  forged.result.report.home.goals++;
  assert.deepEqual(applyM1V8MatchResultBatch(initial, journal,
    [requests[0], forged, requests[2]]),
  { ok: false, error: 'INVALID_MATCH_RESULT' });
  assert.equal(journal.revision, 4);
  assert.equal(requests[2].expectedRevision, 6);
});
