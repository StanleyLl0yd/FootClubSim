import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIGA_PRIKOLOV_IDENTITIES } from '../dist/branding/identities.js';
const read = path => JSON.parse(readFileSync(new URL('../data/drafts/' + path, import.meta.url), 'utf8'));
const measurement = read('liga-wikidata-p54-diagnostic-2026-10-14.json');
const map = read('liga-wikidata-club-map-v1.json');
const draft = read('liga-personnel-pack-v1.json');
const classes = ['boundedCandidate', 'openEndedCandidate', 'unknown', 'outside'];
test('recorded WDQS measurement is 16/16 club coverage but explicitly not first-team roster coverage', () => {
  assert.equal(measurement.schemaVersion, 1);
  assert.equal(measurement.status, 'diagnostic-only-not-roster-snapshot');
  assert.equal(measurement.targetAsOf, '2026-10-14');
  assert.match(measurement.measuredAt, /^2026-10-14T/);
  assert.equal(measurement.measurementCompletedForAll16, true);
  assert.equal(measurement.countsAreClubPersonPairsNotUniqueAcrossClubs, true);
  assert.equal(measurement.independentlyVerifiedAsOfRosterCoverage, false);
  assert.equal(measurement.independentlyVerifiedRosterRows, 0);
  assert.equal(measurement.realPersonIdentityRowsPersisted, 0);
  assert.equal(draft.availableForCareerStart, false);
  assert.equal(measurement.clubs.length, 16);
  assert.deepEqual(measurement.clubs.map(x => x.clubId), LIGA_PRIKOLOV_IDENTITIES.map(x => x.id));
  assert.deepEqual(measurement.clubs.map(x => x.wikidataQid), map.clubs.map(x => x.wikidataQid));
  assert.match(measurement.sourceRun, /^https:\/\/github\.com\/StanleyLl0yd\/FootClubSim\/actions\/runs\/[0-9]+$/);
});

test('all archived aggregates are internally consistent and have no raw personnel identifiers', () => {
  let persons = 0, statements = 0;
  const sums = Object.fromEntries(classes.map(x => [x, 0]));
  for (const club of measurement.clubs) {
    assert.ok(Number.isSafeInteger(club.candidatePersonsAllSeasons) && club.candidatePersonsAllSeasons >= 0);
    assert.ok(Number.isSafeInteger(club.statementCount) && club.statementCount >= club.candidatePersonsAllSeasons);
    assert.equal(classes.reduce((n, x) => n + club.distinctPersonClasses[x], 0), club.candidatePersonsAllSeasons);
    assert.equal(classes.reduce((n, x) => n + club.statementClasses[x], 0), club.statementCount);
    for (const label of classes) sums[label] += club.distinctPersonClasses[label];
    persons += club.candidatePersonsAllSeasons;
    statements += club.statementCount;
    for (const forbidden of ['personId', 'displayName', 'playerQid', 'statementUri', 'birthDate', 'nationalityCodes', 'registeredPlayerCount']) {
      assert.ok(!(forbidden in club), 'unexpected personal/verified roster field ' + forbidden);
    }
  }
  assert.deepEqual(measurement.aggregates, {
    historicalClubPersonPairs: persons,
    historicalMembershipStatements: statements,
    ...sums,
  });
});
