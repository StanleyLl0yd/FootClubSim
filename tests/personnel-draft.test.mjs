import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validatePersonnelDraftPack, validateCandidateEvidence, validateCandidateFact,
} from '../scripts/validate-personnel-draft.mjs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const data = {
  pack: read('data/drafts/liga-personnel-pack-v1.json'),
  nadir: read('data/drafts/nadir-personnel-v1.json'),
  worklist: read('data/drafts/liga-roster-worklist.json'),
  register: read('data/drafts/liga-roster-sources.json'),
  m0: read('data/packs/m0-synthetic-manifest.json'),
};

test('independently versioned personnel draft preserves all 46 approved identities and M0', () => {
  const result = validatePersonnelDraftPack(data.pack, data);
  assert.deepEqual(result, {
    packId: 'liga-prikolov-personnel',
    version: '0.1.0',
    stagedIdentities: 46,
    verifiedFacts: 0,
    playable: false,
  });
});

test('no unverified roster facts, fake rights declarations or altered M0 compatibility can enter the draft', () => {
  for (const mutation of [
    pack => { pack.factRecords.push({ personId: 'lp-person-0001' }); },
    pack => { pack.evidenceRecords.push({ license: 'CC0-1.0' }); },
    pack => { pack.availableForCareerStart = true; },
    pack => { pack.releaseState = 'ready'; },
    pack => { pack.rightsReviewStatus = 'human-verified'; },
    pack => { pack.m0Compatibility.modifiesRevisionZeroSaves = true; },
    pack => { pack.m0Compatibility.packVersion = 'changed'; },
    pack => { pack.unexpected = true; },
  ]) {
    const pack = structuredClone(data.pack);
    mutation(pack);
    assert.throws(() => validatePersonnelDraftPack(pack, data));
  }
});

test('identity drafts fail closed on duplicate IDs, copied factual fields or conflicting club indices', () => {
  const duplicated = structuredClone(data);
  duplicated.nadir.groups.defenders[0].personId = duplicated.nadir.groups.goalkeepers[0].personId;
  assert.throws(() => validatePersonnelDraftPack(duplicated.pack, duplicated), /duplicate person ID/);
  const extraFact = structuredClone(data);
  extraFact.nadir.groups.goalkeepers[0].birthDate = '2001-01-01';
  assert.throws(() => validatePersonnelDraftPack(extraFact.pack, extraFact), /unexpected or missing keys/);
  const wrongClub = structuredClone(data);
  wrongClub.worklist.clubs[0].clubId = 'lp-other';
  assert.throws(() => validatePersonnelDraftPack(wrongClub.pack, wrongClub));
});

const wikidata = {
  sourceRecordId: 'wd-q123-p54-rev567',
  provider: 'Wikidata',
  sourceUrl: 'https://www.wikidata.org/wiki/Q123',
  sourceRevision: '567',
  license: 'CC0-1.0',
  permissionEvidenceUrl: 'https://www.wikidata.org/wiki/Wikidata:Copyright',
  collectedAt: '2026-10-14',
  effectiveAsOf: '2026-10-14',
  rightsReview: 'human-verified',
  factReview: 'human-verified',
  redistributionAllowed: true,
};

const fact = {
  personId: 'lp-person-0001',
  clubId: 'lp-nadir',
  field: 'primaryPosition',
  value: 'GK',
  sourceRecordId: 'wd-q123-p54-rev567',
  effectiveAsOf: '2026-10-14',
  verificationStatus: 'human-verified',
};

test('future fact admission requires matched dated evidence and explicit redistribution permission', () => {
  assert.equal(validateCandidateFact(fact, wikidata, '2026-10-14'), true);
  for (const mutate of [
    x => { x.redistributionAllowed = false; },
    x => { x.rightsReview = 'pending'; },
    x => { x.factReview = 'pending'; },
    x => { x.license = 'unknown'; },
    x => { x.provider = 'Official club'; },
    x => { x.sourceUrl = 'https://other.example.com/club'; },
    x => { x.effectiveAsOf = '2025-10-14'; },
    x => { x.collectedAt = '2026-02-30'; },
  ]) {
    const source = structuredClone(wikidata);
    mutate(source);
    assert.throws(() => validateCandidateEvidence(source, '2026-10-14'));
  }
  const invalidFact = { ...fact, sourceRecordId: 'other-record' };
  assert.throws(() => validateCandidateFact(invalidFact, wikidata, '2026-10-14'), /mismatch/);
  assert.throws(() => validateCandidateFact({ ...fact, value: 'unrecognized' }, wikidata, '2026-10-14'), /position/);
  assert.throws(() => validateCandidateFact({ ...fact, field: 'birthDate', value: '2026-10-15' }, wikidata, '2026-10-14'), /birth date/);
  assert.throws(() => validateCandidateFact({ ...fact, field: 'nationalityCodes', value: ['RU', 'RU'] }, wikidata, '2026-10-14'), /duplicate nationality/);
});

test('non-Wikidata sources need explicit permission evidence, not public accessibility', () => {
  const withoutGrant = {
    ...wikidata,
    provider: 'Official club',
    sourceUrl: 'https://example.org/roster',
    permissionEvidenceUrl: 'https://example.org/rights',
  };
  assert.throws(() => validateCandidateEvidence(withoutGrant, '2026-10-14'), /unlicensed/);
  assert.equal(validateCandidateEvidence({
    ...withoutGrant,
    license: 'explicit-permission',
  }, '2026-10-14'), true);
});
