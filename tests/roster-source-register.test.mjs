import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIGA_PRIKOLOV_IDENTITIES } from '../dist/branding/identities.js';

const register = JSON.parse(readFileSync(new URL('../data/drafts/liga-roster-sources.json', import.meta.url), 'utf8'));

test('official roster source discovery covers exactly the 16 independently identified clubs', () => {
  assert.equal(register.schemaVersion, 1);
  assert.equal(register.requestedAsOfDate, '2026-10-14');
  assert.equal(register.clubs.length, 16);
  assert.deepEqual(register.clubs.map(entry => entry.clubId), LIGA_PRIKOLOV_IDENTITIES.map(club => club.id));
  assert.equal(new Set(register.clubs.map(entry => entry.sourceUrl)).size, 16);
  for (const entry of register.clubs) {
    assert.match(entry.sourceUrl, /^https:\/\/[a-z0-9.-]+\//i);
    assert.ok(entry.realPrototype.length > 1);
    assert.equal(entry.asOfRosterVerified, false);
    assert.equal(entry.staffVerified, false);
    assert.equal(entry.dataLicense, 'unknown');
    assert.equal(entry.redistributionPermission, 'not-established');
  }
});

test('source discovery cannot masquerade as licensed, finished 2026/27 player imports', () => {
  assert.equal(register.rightsStatus, 'not-reviewed');
  assert.equal(register.allowedForAutomatedBulkImport, false);
  assert.equal(register.playableRosterRecords, 0);
  assert.ok(register.clubs.some(entry => entry.snapshotStatus === 'public-squad-url-unconfirmed'));
  assert.ok(register.clubs.some(entry => entry.snapshotStatus === 'empty-page-use-dated-match-protocols'));
});
