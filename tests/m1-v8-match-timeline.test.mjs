import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveM1VerifiedV8MatchTimeline }
  from '../dist/core/m1-v8-match-timeline.js';
import { startM1V8MatchJournal, applyM1V8MatchResult }
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
  catalog, catalog.clubs[0].id, 42, 'v8-timeline-career');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(round => round.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function request(fixture, revision, opts = {}) {
  const home = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
  const away = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
  const shooter = home.starters.find(id => positions.get(id) !== 'GK');
  const defender = away.starters.find(id => positions.get(id) !== 'GK');
  const input = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog, homeLineup: home, awayLineup: away,
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 42 + revision,
  };
  const plannedCommands = opts.special ? [{
    schemaVersion: 1, id: 'yellow-' + revision, fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: shooter,
    elapsedSeconds: 1200, kind: 'caution', origin: 'trusted-referee',
  }] : [];
  const trustedDecisions = opts.special ? [{
    schemaVersion: 1, decisionId: 'penalty-' + revision,
    fixtureId: fixture.id, teamId: fixture.homeClubId, playerId: shooter,
    elapsedSeconds: 600, kind: 'penalty-kick', outcome: 'scored',
  }, {
    schemaVersion: 1, decisionId: 'own-' + revision,
    fixtureId: fixture.id, teamId: fixture.homeClubId, playerId: defender,
    elapsedSeconds: 900, kind: 'own-goal',
  }] : [];
  const medicalActions = opts.special ? [{
    schemaVersion: 1, id: 'exit-' + revision,
    fixtureId: fixture.id, teamId: fixture.homeClubId,
    playerId: shooter, elapsedSeconds: 0,
    kind: 'treatment-exit', reason: 'medical-staff-entered',
    restartAtRunningSeconds: 15,
  }, {
    schemaVersion: 1, id: 'return-' + revision,
    fixtureId: fixture.id, teamId: fixture.homeClubId,
    playerId: shooter, elapsedSeconds: 300,
    kind: 'treatment-return', returnContext: 'running-clock',
    ballInPlay: true, entryBoundary: 'touchline',
    refereeSignalId: 'externally-asserted',
  }] : [];
  const result = simulateM1V8MedicalPhases(
    input, policy, plannedCommands, trustedDecisions, medicalActions);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 280));
  return {
    schemaVersion: 4, commandId: 'timeline-' + revision,
    careerId: initial.careerId, expectedRevision: revision,
    prematch: input, policy, plannedCommands, trustedDecisions,
    medicalActions, result,
  };
}
function committed(items) {
  const started = startM1V8MatchJournal(initial);
  assert.equal(started.ok, true);
  let journal = started.journal;
  for (const item of items) {
    const next = applyM1V8MatchResult(initial, journal, item);
    assert.equal(next.ok, true, JSON.stringify(next).slice(0, 260));
    journal = next.journal;
  }
  return journal;
}
function read(journal, fixtureId) {
  const result = deriveM1VerifiedV8MatchTimeline(initial, journal, fixtureId);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 280));
  return result.timeline;
}

test('selected v8 match restores all events and exact running score from journal', () => {
  const item = request(fixtures[0], 0, { special: true });
  const journal = committed([item]);
  const before = structuredClone(journal);
  const timeline = read(journal, fixtures[0].id);
  assert.equal(timeline.schemaVersion, 1);
  assert.equal(timeline.status,
    'SYNTHETIC_V8_REPLAYED_TIMELINE_NO_OFFICIAL_AUTHORITY');
  assert.equal(timeline.journalRevision, 1);
  assert.equal(timeline.eventCount, item.result.events.length);
  assert.deepEqual(timeline.events, item.result.events);
  assert.equal(timeline.events.at(-1).type, 'full-time');
  assert.equal(timeline.events.some(x => x.type === 'medical'), true);
  assert.equal(timeline.events.some(x => x.type === 'availability'), true);
  assert.equal(timeline.events.some(x => x.type === 'adjudication'), true);
  assert.deepEqual(timeline.finalScore, {
    home: item.result.report.home.goals,
    away: item.result.report.away.goals,
  });
  assert.equal(timeline.goals.length,
    timeline.finalScore.home + timeline.finalScore.away);
  assert.equal(timeline.goals.some(x => x.kind === 'penalty'), true);
  assert.equal(timeline.goals.some(x => x.kind === 'own-goal'), true);
  assert.deepEqual(timeline.goals.at(-1).scoreAfter, timeline.finalScore);
  for (let i = 0; i < timeline.goals.length; i++) {
    const goal = timeline.goals[i];
    const event = timeline.events[goal.sequence - 1];
    assert.equal(goal.eventId, event.id);
    assert.equal(goal.elapsedSeconds, event.elapsedSeconds);
    assert.equal(goal.scoreAfter.home + goal.scoreAfter.away, i + 1);
  }
  assert.deepEqual(journal, before);
});

test('multi-match journal returns only selected fixture, not other events', () => {
  const commands = [
    request(fixtures[1], 0),
    request(fixtures[0], 1, { special: true }),
  ];
  const journal = committed(commands);
  const a = read(journal, fixtures[1].id);
  const b = read(journal, fixtures[0].id);
  assert.equal(a.fixtureId, fixtures[1].id);
  assert.equal(b.fixtureId, fixtures[0].id);
  assert.equal(a.journalRevision, 2);
  assert.equal(b.journalRevision, 2);
  assert.equal(a.events.some(x => x.type === 'medical'), false);
  assert.equal(b.events.some(x => x.type === 'medical'), true);
  assert.equal(a.eventCount, commands[0].result.events.length);
  assert.equal(b.eventCount, commands[1].result.events.length);
  assert.deepEqual(read(journal, fixtures[1].id), a);
});

test('empty journal, wrong target, legacy and tampered history fail closed', () => {
  const empty = committed([]);
  assert.deepEqual(deriveM1VerifiedV8MatchTimeline(
    initial, empty, fixtures[0].id),
  { ok: false, error: 'NOT_COMMITTED' });
  assert.deepEqual(deriveM1VerifiedV8MatchTimeline(initial, empty, ''),
    { ok: false, error: 'INVALID_FIXTURE' });
  assert.deepEqual(deriveM1VerifiedV8MatchTimeline(initial, empty, 1),
    { ok: false, error: 'INVALID_FIXTURE' });
  const journal = committed([request(fixtures[0], 0, { special: true })]);
  assert.deepEqual(deriveM1VerifiedV8MatchTimeline(
    initial, journal, fixtures[1].id),
  { ok: false, error: 'NOT_COMMITTED' });
  const corrupt = structuredClone(journal);
  corrupt.results[0].dossier.match.home.goals += 1;
  const before = structuredClone(corrupt);
  assert.deepEqual(deriveM1VerifiedV8MatchTimeline(
    initial, corrupt, fixtures[0].id),
  { ok: false, error: 'INVALID_JOURNAL' });
  assert.deepEqual(corrupt, before);
  const old = startM1V7MatchJournal(initial);
  assert.equal(old.ok, true);
  assert.deepEqual(deriveM1VerifiedV8MatchTimeline(
    initial, old.journal, fixtures[0].id),
  { ok: false, error: 'INVALID_JOURNAL' });
});
