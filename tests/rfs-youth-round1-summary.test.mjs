import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const report = read('data/drafts/liga-rfs-youth-round1-summary-2026-10-14.json');
const sources = read('data/drafts/liga-roster-sources.json');
const fixtures = read('data/drafts/liga-cup-round1-match-sources-2026-10-14.json');
const people = read('data/drafts/nadir-personnel-v1.json');
const staging = read('data/drafts/liga-personnel-pack-v1.json');

const expectedCounts = new Map([
  ['lp-nizon', 3], ['lp-pacifica', 2], ['lp-statika-m1', 2],
  ['lp-nadir', 1], ['lp-zelenober', 2], ['lp-vagon', 2],
  ['lp-orendorf', 2], ['lp-spadov', 3], ['lp-patriciy', 3], ['lp-ogkm', 1],
]);

function validate(document) {
  assert.deepEqual(Object.keys(document).sort(), [
    'schemaVersion', 'reviewedOn', 'targetAsOf', 'sourcePublishedOn', 'sourceUrl',
    'sourceKind', 'competition', 'eventDates', 'scope',
    'reportedUnder20Participants', 'reportedClubsWithUnder20Appearances',
    'countsByFictionalClub', 'targetedNadirCase', 'unmentionedClubsEvaluatedAsZero',
    'asOfRplRegistrationsVerified', 'licensedPlayableFactsImported',
    'sourceLineupTablesCopied', 'redistributionRightsEstablished',
  ].sort());
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.reviewedOn, '2026-10-14');
  assert.equal(document.targetAsOf, '2026-10-14');
  assert.equal(document.sourcePublishedOn, '2026-08-06');
  assert.ok(document.sourcePublishedOn < document.targetAsOf);
  assert.equal(document.sourceUrl, 'https://www.rfs.ru/news/224801');
  assert.equal(document.sourceKind, 'official-rfu-post-round-youth-appearance-summary');
  assert.equal(document.competition, 'RFU Cup 2026/27 RPL path round 1');
  assert.deepEqual(document.eventDates, ['2026-08-04', '2026-08-05']);
  assert.ok(document.eventDates.every(date => date <= document.sourcePublishedOn));
  assert.equal(document.scope, 'historical-youth-match-participation-aggregates-only');
  assert.equal(document.reportedUnder20Participants, 21);
  assert.equal(document.reportedClubsWithUnder20Appearances, 10);
  assert.equal(document.unmentionedClubsEvaluatedAsZero, false);
  assert.equal(document.asOfRplRegistrationsVerified, 0);
  assert.equal(document.licensedPlayableFactsImported, 0);
  assert.equal(document.sourceLineupTablesCopied, false);
  assert.equal(document.redistributionRightsEstablished, false);

  const allowedIds = new Set(sources.clubs.map(club => club.clubId));
  assert.equal(allowedIds.size, 16);
  assert.equal(fixtures.fixtures.length, 8);
  const cupIds = new Set(fixtures.fixtures.flatMap(f => [f.homeClubId, f.awayClubId]));
  assert.deepEqual(cupIds, allowedIds);
  assert.equal(document.countsByFictionalClub.length, expectedCounts.size);
  const seen = new Set();
  let total = 0;
  for (const row of document.countsByFictionalClub) {
    assert.deepEqual(Object.keys(row).sort(), ['clubId', 'under20Appeared']);
    assert.ok(allowedIds.has(row.clubId), 'unknown club');
    assert.ok(cupIds.has(row.clubId), 'no dated cup source for club');
    assert.ok(!seen.has(row.clubId), 'duplicate club');
    seen.add(row.clubId);
    assert.equal(row.under20Appeared, expectedCounts.get(row.clubId), 'RFU source count changed');
    assert.ok(Number.isInteger(row.under20Appeared) && row.under20Appeared > 0);
    total += row.under20Appeared;
  }
  assert.deepEqual(seen, new Set(expectedCounts.keys()));
  assert.equal(total, document.reportedUnder20Participants);

  const person = document.targetedNadirCase;
  assert.deepEqual(Object.keys(person).sort(), [
    'fictionalPersonId', 'prototypeName', 'clubId', 'playedOn',
    'sourceFixtureUrl', 'observation', 'asOfRplRegistrationEstablished',
  ].sort());
  assert.equal(person.fictionalPersonId, 'lp-person-0019');
  assert.equal(person.prototypeName, 'Даниил Кондаков');
  assert.equal(person.clubId, 'lp-nadir');
  assert.equal(person.playedOn, '2026-08-05');
  assert.equal(person.observation, 'started-and-assist-attributed-in-official-sources');
  assert.equal(person.asOfRplRegistrationEstablished, false);
  const nadir = fixtures.fixtures.find(f => f.sourceUrl === person.sourceFixtureUrl);
  assert.ok(nadir, 'individual case missing source fixture');
  assert.equal(nadir.playedOn, person.playedOn);
  assert.ok([nadir.homeClubId, nadir.awayClubId].includes(person.clubId));
  assert.ok(Object.values(people.groups).flat().some(p => p.personId === person.fictionalPersonId));
  assert.equal(staging.availableForCareerStart, false);
  assert.equal(staging.verifiedFactCount, 0);
}

test('RFU post-round youth summary retains only the reviewed August aggregates', () => {
  validate(report);
});

test('research guard rejects promotion to October registrations, licensed facts or absent-team zeros', () => {
  for (const [key, value] of [
    ['asOfRplRegistrationsVerified', 1],
    ['licensedPlayableFactsImported', 1],
    ['sourceLineupTablesCopied', true],
    ['redistributionRightsEstablished', true],
    ['unmentionedClubsEvaluatedAsZero', true],
  ]) {
    assert.throws(() => validate({ ...report, [key]: value }), key);
  }
});

test('research guard rejects changed source, incorrect counts, duplicate club and mismatched case', () => {
  assert.throws(() => validate({ ...report, sourceUrl: 'https://rfs.ru/news/224801' }));
  const changed = structuredClone(report);
  changed.countsByFictionalClub[0].under20Appeared += 1;
  assert.throws(() => validate(changed));
  const duplicated = structuredClone(report);
  duplicated.countsByFictionalClub[1].clubId = duplicated.countsByFictionalClub[0].clubId;
  assert.throws(() => validate(duplicated));
  const wrongFixture = structuredClone(report);
  wrongFixture.targetedNadirCase.sourceFixtureUrl = 'https://www.rfs.ru/cup/tournament/match/57205';
  assert.throws(() => validate(wrongFixture));
});
