import assert from 'node:assert/strict';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9_.:-]{3,127}$/i;

function dateIsValid(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function exactKeys(value, keys, context) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), context + ': expected object');
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), context + ': unexpected or missing keys');
}

/**
 * This validates provenance declarations, not the truth of facts or legal authority
 * of a purported grant. A separate human review remains mandatory.
 */
export function validateCandidateEvidence(record, requestedAsOfDate) {
  exactKeys(record, [
    'sourceRecordId', 'provider', 'sourceUrl', 'sourceRevision', 'license',
    'permissionEvidenceUrl', 'collectedAt', 'effectiveAsOf', 'rightsReview',
    'factReview', 'redistributionAllowed',
  ], 'evidence');
  assert.match(record.sourceRecordId, SOURCE_ID_PATTERN);
  assert.ok(dateIsValid(requestedAsOfDate), 'invalid snapshot date');
  assert.ok(dateIsValid(record.collectedAt), 'invalid collection date');
  assert.equal(record.effectiveAsOf, requestedAsOfDate, 'evidence snapshot mismatch');
  assert.equal(record.rightsReview, 'human-verified', 'rights review missing');
  assert.equal(record.factReview, 'human-verified', 'factual review missing');
  assert.equal(record.redistributionAllowed, true, 'redistribution not cleared');
  assert.match(record.sourceRevision, /^[a-z0-9_.:-]{1,128}$/i);
  assert.match(record.sourceUrl, /^https:\/\/[^\s/]+\/\S+$/);
  if (record.provider === 'Wikidata') {
    assert.equal(record.license, 'CC0-1.0');
    assert.match(record.sourceUrl, /^https:\/\/www\.wikidata\.org\/wiki\/Q[1-9][0-9]*$/);
    assert.equal(record.permissionEvidenceUrl, 'https://www.wikidata.org/wiki/Wikidata:Copyright');
  } else {
    assert.equal(record.license, 'explicit-permission', 'unlicensed third-party source');
    assert.match(record.permissionEvidenceUrl, /^https:\/\/[^\s/]+\/\S+$/, 'missing grant evidence');
  }
  return true;
}

export function validateCandidateFact(fact, evidence, requestedAsOfDate) {
  exactKeys(fact, [
    'personId', 'clubId', 'field', 'value', 'sourceRecordId',
    'effectiveAsOf', 'verificationStatus',
  ], 'fact');
  assert.match(fact.personId, /^lp-person-[0-9]{4,}$/);
  assert.match(fact.clubId, /^lp-[a-z0-9-]+$/);
  assert.ok(['birthDate', 'nationalityCodes', 'primaryPosition', 'secondaryPositions', 'affiliation', 'staffRole'].includes(fact.field), 'unsupported fact field');
  assert.equal(fact.verificationStatus, 'human-verified');
  assert.equal(fact.effectiveAsOf, requestedAsOfDate);
  assert.equal(fact.sourceRecordId, evidence.sourceRecordId, 'fact/evidence mismatch');
  validateCandidateEvidence(evidence, requestedAsOfDate);
  if (fact.field === 'birthDate') {
    assert.ok(dateIsValid(fact.value) && fact.value <= requestedAsOfDate, 'invalid birth date');
  } else if (fact.field === 'nationalityCodes') {
    assert.ok(Array.isArray(fact.value) && fact.value.length > 0 && fact.value.every(code => typeof code === 'string' && /^[A-Z]{2}$/.test(code)), 'invalid nationality codes');
    assert.equal(new Set(fact.value).size, fact.value.length, 'duplicate nationality');
  } else if (fact.field === 'primaryPosition' || fact.field === 'secondaryPositions') {
    const positions = new Set(['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'ST']);
    const values = fact.field === 'primaryPosition' ? [fact.value] : fact.value;
    assert.ok(Array.isArray(values) && values.every(value => positions.has(value)), 'invalid position');
    assert.equal(new Set(values).size, values.length, 'duplicate positions');
  } else {
    assert.ok(typeof fact.value === 'string' && fact.value.trim().length > 0 && fact.value.length <= 100, 'invalid role/affiliation');
  }
  return true;
}

export function validatePersonnelDraftPack(pack, { nadir, worklist, register, m0 }) {
  exactKeys(pack, [
    'manifestSchemaVersion', 'packId', 'packVersion', 'packKind', 'asOfDate',
    'releaseState', 'availableForCareerStart', 'rightsReviewStatus',
    'sourceRegistryPath', 'worklistPath', 'identityDrafts', 'evidenceRecords',
    'factRecords', 'verifiedFactCount', 'm0Compatibility',
  ], 'draft manifest');
  assert.equal(pack.manifestSchemaVersion, 1);
  assert.equal(pack.packId, 'liga-prikolov-personnel');
  assert.match(pack.packVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(pack.packKind, 'identity-staging');
  assert.ok(dateIsValid(pack.asOfDate));
  assert.equal(pack.asOfDate, '2026-10-14');
  assert.equal(pack.releaseState, 'blocked');
  assert.equal(pack.availableForCareerStart, false);
  assert.equal(pack.rightsReviewStatus, 'pending');
  assert.equal(pack.sourceRegistryPath, 'data/drafts/liga-roster-sources.json');
  assert.equal(pack.worklistPath, 'data/drafts/liga-roster-worklist.json');
  assert.deepEqual(pack.evidenceRecords, [], 'draft cannot silently import evidence');
  assert.deepEqual(pack.factRecords, [], 'draft cannot silently import person facts');
  assert.equal(pack.verifiedFactCount, 0);
  assert.deepEqual(pack.m0Compatibility, {
    packId: m0.packId,
    packVersion: m0.packVersion,
    modifiesM0Catalog: false,
    modifiesRevisionZeroSaves: false,
  });
  assert.notEqual(pack.packId, m0.packId);
  assert.equal(nadir.asOf, pack.asOfDate);
  assert.equal(nadir.reviewStatus, 'identity-only-unverified');
  assert.equal(worklist.asOf, pack.asOfDate);
  assert.equal(register.requestedAsOfDate, pack.asOfDate);
  assert.equal(register.allowedForAutomatedBulkImport, false);
  assert.equal(register.playableRosterRecords, 0);
  assert.equal(register.clubs.length, 16);
  assert.equal(worklist.clubs.length, 16);
  assert.deepEqual(worklist.clubs.map(club => club.clubId), register.clubs.map(club => club.clubId));
  assert.equal(new Set(register.clubs.map(club => club.clubId)).size, 16);
  assert.ok(register.clubs.every(club => !club.asOfRosterVerified && !club.staffVerified && club.redistributionPermission === 'not-established'));
  assert.equal(pack.identityDrafts.length, 1);
  assert.deepEqual(pack.identityDrafts[0], {
    clubId: 'lp-nadir',
    path: 'data/drafts/nadir-personnel-v1.json',
    approvedIdentityCount: 46,
    factsVerified: false,
  });
  assert.equal(nadir.clubId, pack.identityDrafts[0].clubId);
  assert.equal(nadir.schemaVersion, 2);
  const people = Object.values(nadir.groups).flat();
  assert.equal(people.length, pack.identityDrafts[0].approvedIdentityCount);
  const seen = new Set();
  for (const person of people) {
    exactKeys(person, ['personId', 'displayName'], 'identity draft');
    assert.match(person.personId, /^lp-person-[0-9]{4,}$/);
    assert.ok(typeof person.displayName === 'string' && person.displayName.trim().length >= 3);
    assert.ok(!seen.has(person.personId), 'duplicate person ID');
    seen.add(person.personId);
  }
  return { packId: pack.packId, version: pack.packVersion, stagedIdentities: people.length, verifiedFacts: 0, playable: false };
}
