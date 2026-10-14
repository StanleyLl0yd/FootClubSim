import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const rf = read('data/drafts/liga-rfs-cup-team-index-links-2026-10-14.json');
const primary = read('data/drafts/liga-roster-sources.json');
const qids = read('data/drafts/liga-wikidata-club-map-v1.json');
const draft = read('data/drafts/liga-personnel-pack-v1.json');

test('all 16 RFU Cup team URL pointers map one-to-one to previously resolved clubs', () => {
  assert.equal(rf.schemaVersion, 1);
  assert.equal(rf.researchDate, '2026-10-14');
  assert.equal(rf.asOfDateRequested, primary.requestedAsOfDate);
  assert.equal(rf.clubs.length, 16);
  assert.deepEqual(rf.clubs.map(x => x.clubId), primary.clubs.map(x => x.clubId));
  assert.deepEqual(rf.clubs.map(x => x.clubId), qids.clubs.map(x => x.clubId));
  assert.equal(new Set(rf.clubs.map(x => x.rfuCupTeamUrl)).size, 16);
  assert.equal(new Set(rf.clubs.map(x => x.clubId)).size, 16);
  for (const x of rf.clubs) {
    assert.match(x.rfuCupTeamUrl, /^https:\/\/www\.rfs\.ru\/cup\/teams\/[1-9]\d*$/);
    assert.ok(x.realClubName.length > 2 && x.realCity.length > 2);
    assert.equal(x.sourcePageReviewedOn, rf.researchDate);
    assert.equal(x.asOfRplRosterVerified, false);
    assert.equal(x.firstTeamStaffVerified, false);
    assert.equal(x.licensedToImportPlayers, false);
  }
});

test('RFU Cup link index cannot be treated as source-data license or factual roster completion', () => {
  assert.equal(rf.provider, 'Russian Football Union');
  assert.match(rf.discoveryUrl, /^https:\/\/www\.rfs\.ru\/cup\/teams$/);
  assert.equal(rf.sourcePermission, 'not-established');
  assert.equal(rf.bulkPlayerRosterCopied, false);
  assert.equal(rf.playerIdentitiesImported, 0);
  assert.equal(rf.verifiedAsOfRplSquads, 0);
  assert.equal(draft.verifiedFactCount, 0);
  assert.equal(draft.availableForCareerStart, false);
});
