import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIGA_PRIKOLOV_IDENTITIES } from '../dist/branding/identities.js';

const load = name => JSON.parse(readFileSync(new URL('../data/drafts/' + name, import.meta.url), 'utf8'));
const map = load('liga-wikidata-club-map-v1.json');
const sourceRegister = load('liga-roster-sources.json');
const draftPack = load('liga-personnel-pack-v1.json');

test('16 fictional clubs resolve to 16 unique, canonical football-club Wikidata objects', () => {
  assert.equal(map.schemaVersion, 1);
  assert.equal(map.reviewedOn, '2026-10-14');
  assert.equal(map.intendedAsOfDate, sourceRegister.requestedAsOfDate);
  assert.equal(map.sourceProvider, 'Wikidata');
  assert.equal(map.sourceStructuredDataLicense, 'CC0-1.0');
  assert.equal(map.clubs.length, 16);
  assert.deepEqual(map.clubs.map(entry => entry.clubId), LIGA_PRIKOLOV_IDENTITIES.map(x => x.id));
  assert.deepEqual(map.clubs.map(entry => entry.clubId), sourceRegister.clubs.map(x => x.clubId));
  const qids = map.clubs.map(entry => entry.wikidataQid);
  assert.equal(new Set(qids).size, 16);
  assert.equal(new Set(map.clubs.map(entry => entry.entityUrl)).size, 16);
  for (const entry of map.clubs) {
    assert.match(entry.wikidataQid, /^Q[1-9][0-9]*$/);
    assert.equal(entry.entityUrl, 'https://www.wikidata.org/wiki/' + entry.wikidataQid);
    assert.equal(entry.entityReview, 'label-and-football-club-type-matched');
    assert.equal(entry.rosterCoverage, 'unmeasured');
    assert.equal(typeof entry.ambiguityNote, 'string');
  }
});

test('club QID discovery never implies playable squads or licensed person-data coverage', () => {
  assert.equal(map.qualifiedPersonFacts, 0);
  assert.equal(map.verifiedRosterCoverage, false);
  assert.equal(sourceRegister.playableRosterRecords, 0);
  assert.equal(draftPack.availableForCareerStart, false);
  assert.equal(draftPack.verifiedFactCount, 0);
  assert.equal(draftPack.releaseState, 'blocked');
  assert.ok(map.clubs.find(x => x.clubId === 'lp-statika-m1').ambiguityNote.includes('multisport'));
  assert.ok(map.clubs.find(x => x.clubId === 'lp-statika-m2').ambiguityNote.includes('2021'));
});
