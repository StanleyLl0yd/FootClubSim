import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL('../data/drafts/' + name, import.meta.url), 'utf8'));
const conflicts = read('liga-wikidata-crossclub-collision-2026-10-14.json');
const members = read('liga-wikidata-p54-diagnostic-2026-10-14.json');
const fields = read('liga-wikidata-candidate-field-diagnostic-2026-10-14.json');
const draft = read('liga-personnel-pack-v1.json');
test('cross-club conflict report contains aggregates, not registrations or source person identifiers', () => {
  assert.equal(conflicts.schemaVersion, 1);
  assert.equal(conflicts.status, 'diagnostic-open-ended-membership-conflicts');
  assert.equal(conflicts.targetAsOf, '2026-10-14');
  assert.equal(conflicts.allClubQueriesSucceeded, true);
  assert.match(conflicts.observedAt, /^2026-10-14T/);
  assert.equal(conflicts.confirmedOfficialDoubleRegistrations, 0);
  assert.equal(conflicts.sourcePersonIdentifiersPublished, 0);
  assert.equal(draft.availableForCareerStart, false);
  assert.equal(draft.verifiedFactCount, 0);
  assert.equal(conflicts.clubs.length, 16);
  assert.deepEqual(conflicts.clubs.map(x => x.clubId), members.clubs.map(x => x.clubId));
});
test('per-club conflicts are bounded by candidate counts and league totals are consistent', () => {
  let pairs = 0, conflictedClubPairs = 0;
  for (let i = 0; i < conflicts.clubs.length; i++) {
    const c = conflicts.clubs[i];
    assert.equal(c.candidatePairs, members.clubs[i].distinctPersonClasses.openEndedCandidate);
    assert.equal(c.candidatePairs, fields.clubs[i].candidatePersons);
    assert.ok(Number.isSafeInteger(c.flaggedConflictingPairs));
    assert.ok(c.flaggedConflictingPairs >= 0 && c.flaggedConflictingPairs <= c.candidatePairs);
    assert.deepEqual(Object.keys(c).sort(), ['clubId', 'candidatePairs', 'flaggedConflictingPairs'].sort());
    pairs += c.candidatePairs;
    conflictedClubPairs += c.flaggedConflictingPairs;
  }
  assert.equal(conflicts.totalClubPersonPairs, pairs);
  assert.equal(conflicts.totalClubPersonPairs - conflicts.uniqueWikidataPersons, conflicts.excessClubPersonPairs);
  assert.ok(conflicts.personsInMultipleCandidateClubs > 0);
  assert.ok(conflicts.personsInMultipleCandidateClubs <= conflicts.excessClubPersonPairs);
  assert.ok(conflictedClubPairs >= conflicts.personsInMultipleCandidateClubs * 2);
});
