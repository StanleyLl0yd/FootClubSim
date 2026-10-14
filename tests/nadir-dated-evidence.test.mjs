import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => JSON.parse(readFileSync(new URL('../data/drafts/' + file, import.meta.url), 'utf8'));
const evidence = read('nadir-dated-observations-v1.json');
const register = read('liga-roster-sources.json');
const draft = read('nadir-personnel-v1.json');
const pack = read('liga-personnel-pack-v1.json');
test('two targeted club-published transfer leads are research-only, with no roster promotion', () => {
  assert.equal(evidence.reviewDate, '2026-10-14');
  assert.equal(evidence.sourceType, 'official-club-digital-match-programme');
  assert.equal(evidence.rosterVerified, false);
  assert.equal(evidence.factRowsAuthorizedForPlayablePack, 0);
  assert.equal(evidence.copyrightedSourceMaterialCopied, false);
  assert.equal(evidence.attachedPhotographsOrCrests, false);
  assert.equal(evidence.sourceDataLicense, 'unknown');
  assert.equal(evidence.redistributionOfUnderlyingSiteDatabase, 'not-authorized');
  assert.equal(evidence.observations.length, 2);
  assert.equal(register.clubs.find(c => c.clubId === 'lp-nadir').supplementalDatedSourceUrl, evidence.sourceUrl);
  assert.equal(pack.availableForCareerStart, false);
  assert.equal(pack.verifiedFactCount, 0);
  assert.equal(register.playableRosterRecords, 0);
});
test('transfer lead person and clubs use existing IDs, not display names as primary keys', () => {
  const names = Object.values(draft.groups).flat();
  const personIdSet = new Set(names.map(x => x.personId));
  const clubIdSet = new Set(register.clubs.map(x => x.clubId));
  const ids = new Set();
  for (const lead of evidence.observations) {
    assert.match(lead.wikidataPrototypeQid, /^Q[1-9][0-9]*$/);
    assert.match(lead.observationId, /^nadir-transfer-lead-2026-[0-9]{2}$/);
    assert.ok(!ids.has(lead.observationId), 'duplicate observation ID');
    ids.add(lead.observationId);
    assert.ok(clubIdSet.has(lead.fromClubId));
    assert.ok(clubIdSet.has(lead.toClubId));
    assert.notEqual(lead.fromClubId, lead.toClubId);
    if (lead.fictionalPersonId !== null) assert.ok(personIdSet.has(lead.fictionalPersonId));
    assert.equal(lead.status, 'single-official-source-requires-date-and-registration-crosscheck');
  }
  assert.equal(evidence.observations[0].fictionalPersonId, 'lp-person-0020');
  assert.equal(evidence.observations[1].fictionalPersonId, null);
});
