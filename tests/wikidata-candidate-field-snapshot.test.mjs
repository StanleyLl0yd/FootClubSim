import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = name => JSON.parse(readFileSync(new URL('../data/drafts/' + name, import.meta.url), 'utf8'));
const map = load('liga-wikidata-club-map-v1.json');
const members = load('liga-wikidata-p54-diagnostic-2026-10-14.json');
const fields = load('liga-wikidata-candidate-field-diagnostic-2026-10-14.json');
const draft = load('liga-personnel-pack-v1.json');
test('dated field availability snapshot covers 16 club QIDs without producing player facts', () => {
  assert.equal(fields.schemaVersion, 1);
  assert.equal(fields.status, 'research-field-presence-only');
  assert.equal(fields.targetAsOf, '2026-10-14');
  assert.match(fields.measuredAt, /^2026-10-14T/);
  assert.equal(fields.completeForAll16, true);
  assert.equal(fields.countsAreClubPersonPairsNotUniqueAcrossClubs, true);
  assert.equal(fields.realPersonRecordsPersisted, 0);
  assert.equal(fields.factsVerifiedAsOfTargetDate, 0);
  assert.equal(fields.rosterRegistrationsVerified, 0);
  assert.equal(draft.availableForCareerStart, false);
  assert.deepEqual(fields.clubs.map(x => x.clubId), map.clubs.map(x => x.clubId));
  assert.deepEqual(fields.clubs.map(x => x.wikidataQid), map.clubs.map(x => x.wikidataQid));
});
test('all candidate field counts agree with P54 measurement and aggregate arithmetic', () => {
  const sums = { candidateClubPersonPairs: 0, birthDatePresent: 0, citizenshipPresent: 0, positionPresent: 0, allThreePresent: 0 };
  for (let i = 0; i < fields.clubs.length; i++) {
    const club = fields.clubs[i];
    assert.equal(club.candidatePersons, members.clubs[i].distinctPersonClasses.openEndedCandidate);
    for (const key of ['candidatePersons','birthDate','citizenship','position','allThree']) {
      assert.ok(Number.isSafeInteger(club[key]) && club[key] >= 0 && club[key] <= club.candidatePersons);
    }
    assert.ok(club.allThree <= Math.min(club.birthDate, club.citizenship, club.position));
    sums.candidateClubPersonPairs += club.candidatePersons;
    sums.birthDatePresent += club.birthDate;
    sums.citizenshipPresent += club.citizenship;
    sums.positionPresent += club.position;
    sums.allThreePresent += club.allThree;
    assert.deepEqual(Object.keys(club).sort(), ['clubId','wikidataQid','candidatePersons','birthDate','citizenship','position','allThree'].sort());
  }
  assert.deepEqual(fields.aggregate, sums);
  assert.equal(sums.candidateClubPersonPairs, members.aggregates.openEndedCandidate);
});
