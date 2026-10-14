import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const index = read('data/drafts/liga-cup-round1-match-sources-2026-10-14.json');
const clubs = read('data/drafts/liga-roster-sources.json').clubs.map(x => x.clubId);
const qids = read('data/drafts/liga-wikidata-club-map-v1.json').clubs.map(x => x.clubId);
const draft = read('data/drafts/liga-personnel-pack-v1.json');

test('eight completed August fixture source links cover each of the 16 fictional clubs exactly once', () => {
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.observedOn, '2026-10-14');
  assert.equal(index.targetAsOf, '2026-10-14');
  assert.equal(index.fixtures.length, 8);
  const expected = new Set(clubs);
  assert.equal(expected.size, 16);
  assert.deepEqual(clubs, qids);
  const seenClubs = new Set();
  const seenFixtures = new Set();
  const seenUrls = new Set();
  for (const f of index.fixtures) {
    assert.match(f.fixtureId, /^rfs-cup-2026-08-0[45]-[a-z0-9-]+$/);
    assert.ok(!seenFixtures.has(f.fixtureId), 'duplicate match ID');
    seenFixtures.add(f.fixtureId);
    assert.match(f.sourceUrl, /^https:\/\/www\.rfs\.ru\/cup\/tournament\/match\/[1-9]\d*$/);
    assert.ok(!seenUrls.has(f.sourceUrl), 'duplicate RFU match source');
    seenUrls.add(f.sourceUrl);
    assert.ok(['2026-08-04', '2026-08-05'].includes(f.playedOn));
    assert.ok(f.playedOn < index.targetAsOf);
    assert.equal(f.sourceKind, 'federation-completed-match-page');
    assert.equal(f.asOfRosterVerified, false);
    assert.notEqual(f.homeClubId, f.awayClubId);
    for (const key of [f.homeClubId, f.awayClubId]) {
      assert.ok(expected.has(key), 'unknown official fictional team ID');
      assert.equal(seenClubs.has(key), false, 'club appears more than once');
      seenClubs.add(key);
    }
    assert.deepEqual(Object.keys(f).sort(), ['fixtureId','playedOn','sourceUrl','homeClubId','awayClubId','sourceKind','asOfRosterVerified'].sort(), 'unexpected roster facts in link-only research');
  }
  assert.deepEqual(seenClubs, expected);
});

test('source discovery may not masquerade as licensed, date-verified or playable roster facts', () => {
  assert.deepEqual(Object.keys(index).sort(), [
    'schemaVersion','observedOn','targetAsOf','edition','scope','rightsForBulkSourceReuse',
    'rosterTablesCopied','playerOrStaffRecordsImported','asOfRegistrationsVerified',
    'eligibleFirstTeamRosterDenominatorsVerified','fixtures',
  ].sort());
  assert.equal(index.scope, 'source-link-discovery-only-not-an-as-of-registration-database');
  assert.match(index.edition, /2026\/27/);
  assert.equal(index.rightsForBulkSourceReuse, 'not-established');
  assert.equal(index.rosterTablesCopied, false);
  assert.equal(index.playerOrStaffRecordsImported, 0);
  assert.equal(index.asOfRegistrationsVerified, 0);
  assert.equal(index.eligibleFirstTeamRosterDenominatorsVerified, 0);
  assert.equal(draft.availableForCareerStart, false);
  assert.equal(draft.verifiedFactCount, 0);
});
