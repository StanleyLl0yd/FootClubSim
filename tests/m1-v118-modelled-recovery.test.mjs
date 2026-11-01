import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { createInitialCareer } from '../dist/core/save.js';
import { prepareM1V113PlayableMatch }
  from '../dist/core/m1-v113-browser-playtest.js';
import { deriveM1V118InternalRecovery }
  from '../dist/core/m1-v118-modelled-recovery.js';
import {
  startM1V8MatchJournal, applyM1V8MatchResult,
  validateM1V8MatchJournal,
} from '../dist/core/m1-v8-result-journal.js';

const catalog = createSyntheticRplScaleCatalog(2026);
const club = catalog.clubs[0].id;
function start(career) {
  const first = startM1V8MatchJournal(career);
  assert.equal(first.ok, true);
  return first.journal;
}
function commit(career, journal, prepared) {
  const applied = applyM1V8MatchResult(career, journal, prepared.request);
  assert.equal(applied.ok, true, JSON.stringify(applied).slice(0, 400));
  assert.equal(validateM1V8MatchJournal(career, applied.journal).ok, true);
  return applied.journal;
}
function named(proposed, career) {
  const lineup = proposed.fixture.homeClubId === career.selectedClubId ?
    proposed.request.prematch.homeLineup :
    proposed.request.prematch.awayLineup;
  return [...lineup.starters, ...lineup.bench];
}

test('genuine internal-referee modelled injury recovers only after deterministic absent fixtures', () => {
  let selected;
  for (let seed = 1; seed <= 48; seed++) {
    const career = createInitialCareer(catalog, club, seed,
      'v118-source-recovery-' + seed);
    const journal = start(career);
    const proposed = prepareM1V113PlayableMatch(
      career, journal, 'internal-referee');
    assert.equal(proposed?.ok, true, JSON.stringify(proposed).slice(0, 400));
    const incident = proposed.request.plannedCommands.find(value =>
      value.kind === 'injury-withdrawal' && value.teamId === club);
    if (incident) {
      selected = { career, journal, proposed, incident };
      break;
    }
  }
  assert.ok(selected, 'Fixed seed sweep must encounter a selected-club virtual injury');
  const { career, proposed, incident } = selected;
  const original = JSON.stringify(career);
  let journal = commit(career, selected.journal, proposed);
  const verified = deriveM1V118InternalRecovery(career, journal.results[0]);
  const patient = verified.find(item => item.playerId === incident.playerId);
  assert.ok(patient);
  assert.ok(patient.missedCompleteClubFixtures >= 1 &&
    patient.missedCompleteClubFixtures <= 4);
  for (let index = 0; index < patient.missedCompleteClubFixtures; index++) {
    const next = prepareM1V113PlayableMatch(career, journal, 'ordinary');
    assert.equal(next?.ok, true, JSON.stringify(next).slice(0, 400));
    assert.ok(!named(next, career).includes(patient.playerId));
    journal = commit(career, journal, next);
  }
  const returned = prepareM1V113PlayableMatch(career, journal, 'ordinary');
  assert.equal(returned?.ok, true, JSON.stringify(returned).slice(0, 400));
  assert.ok(returned.modelledRecoveries.some(item =>
    item.playerId === patient.playerId &&
    item.sourceFixtureId === proposed.fixture.id));
  assert.ok(!returned.exclusions.some(item => item.playerId === patient.playerId));
  assert.ok(named(returned, career).includes(patient.playerId));
  journal = commit(career, journal, returned);
  assert.equal(prepareM1V113PlayableMatch(career, journal, 'ordinary')?.ok, true);
  assert.equal(JSON.stringify(career), original);
});

test('forged internal-referee identifiers cannot create medical return evidence', () => {
  const career = createInitialCareer(catalog, club, 42, 'v118-forged-identifier');
  let journal = start(career);
  const prepared = prepareM1V113PlayableMatch(career, journal, 'ordinary');
  assert.equal(prepared?.ok, true);
  const firstOutfield = (prepared.fixture.homeClubId === club ?
    prepared.request.prematch.homeLineup : prepared.request.prematch.awayLineup)
    .starters.find(id => catalog.players.find(p => p.id === id)?.primaryPosition !== 'GK');
  const forged = {
    schemaVersion: 1, id: 'm1-v19-ref-3',
    fixtureId: prepared.fixture.id, teamId: club, playerId: firstOutfield,
    elapsedSeconds: 600, kind: 'injury-withdrawal',
    origin: 'trusted-medical',
  };
  const fake = { ...prepared.request,
    plannedCommands: [forged] };
  // An invented event without a matching full deterministic source is never
  // accepted as a previously recorded match result.
  const result = applyM1V8MatchResult(career, journal, fake);
  assert.equal(result.ok, false);
  assert.equal(journal.revision, 0);
});
