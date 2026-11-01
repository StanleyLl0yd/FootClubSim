import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { createInitialCareer } from '../dist/core/save.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import { prepareM1V113PlayableMatch }
  from '../dist/core/m1-v113-browser-playtest.js';
import {
  startM1V8MatchJournal, applyM1V8MatchResult,
  validateM1V8MatchJournal,
} from '../dist/core/m1-v8-result-journal.js';

const catalog = createSyntheticRplScaleCatalog(2026);
const initial = createInitialCareer(catalog, catalog.clubs[0].id,
  42, 'v115-known-eligibility');
const sourceM0 = JSON.stringify(initial);
const players = new Map(catalog.players.map(p => [p.id, p]));
function start() {
  const r = startM1V8MatchJournal(initial);
  assert.equal(r.ok, true);
  return r.journal;
}
function prepare(journal) {
  const r = prepareM1V113PlayableMatch(initial, journal, 'ordinary');
  assert.equal(r?.ok, true, JSON.stringify(r).slice(0, 400));
  return r;
}
function createEvent(proposed, player, kind, time, suffix) {
  const fixture = proposed.fixture;
  return {
    schemaVersion: 1, id: 'v115-' + suffix + '-' + fixture.id,
    fixtureId: fixture.id, teamId: initial.selectedClubId,
    playerId: player, elapsedSeconds: time, kind,
    origin: kind === 'injury-withdrawal' ? 'trusted-medical' : 'trusted-referee',
  };
}
function commit(journal, proposed, events = []) {
  const result = simulateM1V8MedicalPhases(
    proposed.request.prematch, proposed.request.policy, events, [], []);
  assert.equal(result.ok, true, JSON.stringify(result).slice(0, 450));
  const req = { ...proposed.request, plannedCommands: events, result };
  const next = applyM1V8MatchResult(initial, journal, req);
  assert.equal(next.ok, true, JSON.stringify(next).slice(0, 350));
  assert.equal(validateM1V8MatchJournal(initial, next.journal).ok, true);
  return next.journal;
}
function ownLineup(proposed) {
  return proposed.fixture.homeClubId === initial.selectedClubId ?
    proposed.request.prematch.homeLineup : proposed.request.prematch.awayLineup;
}
function named(proposed) {
  const lineup = ownLineup(proposed);
  return [...lineup.starters, ...lineup.bench];
}
const firstField = (proposed) => ownLineup(proposed).starters
  .find(id => players.get(id)?.primaryPosition !== 'GK');

test('medical withdrawal excludes only known patient and next match can be played', () => {
  let journal = start();
  const first = prepare(journal), patient = firstField(first);
  journal = commit(journal, first,
    [createEvent(first, patient, 'injury-withdrawal', 1200, 'withdraw')]);
  const second = prepare(journal);
  assert.equal(named(second).includes(patient), false);
  assert.equal(second.exclusions.filter(x => x.playerId === patient)
    .map(x => x.reason).join(''), 'unresolved-medical-withdrawal');
  journal = commit(journal, second);
  const third = prepare(journal);
  assert.equal(named(third).includes(patient), false);
  assert.equal(JSON.stringify(initial), sourceM0);
});

test('second yellow creates one modelled game ban, then player returns without unverified medical recovery', () => {
  let journal = start();
  const first = prepare(journal), player = firstField(first);
  journal = commit(journal, first, [
    createEvent(first, player, 'caution', 600, 'yellow1'),
    createEvent(first, player, 'caution', 900, 'yellow2'),
  ]);
  const suspended = prepare(journal);
  assert.ok(!named(suspended).includes(player));
  assert.equal(suspended.exclusions.find(x => x.playerId === player)?.reason,
    'second-yellow-one-fixture');
  journal = commit(journal, suspended);
  const eligible = prepare(journal);
  assert.ok(named(eligible).includes(player));
  assert.ok(!eligible.exclusions.some(x => x.playerId === player));
});

test('straight red remains restricted until KDK decision, but does not freeze the entire playable career', () => {
  let journal = start();
  const first = prepare(journal), player = firstField(first);
  journal = commit(journal, first,
    [createEvent(first, player, 'direct-red', 600, 'straight')]);
  const second = prepare(journal);
  assert.ok(!named(second).includes(player));
  assert.equal(second.exclusions.find(x => x.playerId === player)?.reason,
    'unresolved-direct-red');
  journal = commit(journal, second);
  assert.ok(!named(prepare(journal)).includes(player));
});

test('four distinct simple cautions cause one automatic suspension in controlled-club history', () => {
  let journal = start(), player = '';
  for (let index = 0; index < 4; index++) {
    const planned = prepare(journal);
    if (index === 0) player = firstField(planned);
    assert.ok(named(planned).includes(player));
    journal = commit(journal, planned,
      [createEvent(planned, player, 'caution', 600, 'simple-' + index)]);
  }
  const ban = prepare(journal);
  assert.ok(!named(ban).includes(player));
  assert.equal(ban.exclusions.find(x => x.playerId === player)?.reason,
    'four-simple-cautions-one-fixture');
  journal = commit(journal, ban);
  assert.ok(named(prepare(journal)).includes(player));
});

