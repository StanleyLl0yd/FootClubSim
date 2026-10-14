import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const report = read('data/drafts/nadir-rfs-cup-review-2026-10-14.json');
const nadir = read('data/drafts/nadir-personnel-v1.json');
const pack = read('data/drafts/liga-personnel-pack-v1.json');
const soccerGroups = ['goalkeepers', 'defenders', 'midfielders', 'attackers'];

test('RFU Cup source comparison remains a non-playable observation, not a roster import', () => {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.targetAsOfDate, nadir.asOf);
  assert.equal(report.researchState, 'source-triangulation-only-not-an-as-of-roster');
  assert.equal(report.fictionalClubId, nadir.clubId);
  assert.match(report.cupListing.url, /^https:\/\/www\.rfs\.ru\/cup\/teams\/26$/);
  assert.equal(report.cupListing.observedListedNames, 29);
  assert.equal(report.cupListing.approvedNadirFootballerIdentityDrafts, soccerGroups.reduce((n, g) => n + nadir.groups[g].length, 0));
  assert.equal(report.cupListing.manuallyNameMatchedDraftPrototypes, 26);
  assert.equal(report.cupListing.unmatchedIndexNames, report.cupListing.observedListedNames - report.cupListing.manuallyNameMatchedDraftPrototypes);
  assert.equal(report.cupListing.timeFrozen, false);
  assert.equal(report.cupListing.firstTeamRplRegistrationsVerified, 0);
  assert.equal(report.cupListing.permissionToRedistributeSourceTable, false);
  assert.equal(report.cupListing.dataLicense, 'unknown');
  assert.deepEqual(report.rightsAndRelease, {
    targetedManualResearchOnly: true,
    copiedBulkRosterTable: false,
    sourceMaterialsOrImagesIncluded: false,
    redistributionRightsVerified: false,
    playableFactRowsImported: 0,
    m0SeedOrSavesModified: false,
  });
  assert.equal(pack.verifiedFactCount, 0);
  assert.equal(pack.availableForCareerStart, false);
});

test('all extra RFU Cup index names have unique dated, specific corroborating movement leads', () => {
  assert.equal(report.outdatedOrConflictingIndexLeads.length, report.cupListing.unmatchedIndexNames);
  const ids = new Set();
  const names = new Set();
  for (const lead of report.outdatedOrConflictingIndexLeads) {
    assert.equal(lead.rfsIndexStillListsPlayer, true);
    assert.equal(lead.asOfRegistrationEstablished, false);
    assert.equal(lead.fictionalPersonId, null);
    assert.ok(lead.prototypeName.length > 4);
    assert.match(lead.evidenceUrl, /^https:\/\//);
    assert.ok(lead.reportedOn || lead.reportedInMonth);
    assert.ok(lead.reportedDestinationClubId || lead.reportedDestinationExternal);
    if (lead.reportedOn) assert.ok(lead.reportedOn < report.targetAsOfDate);
    if (lead.reportedInMonth) assert.ok(lead.reportedInMonth < report.targetAsOfDate.slice(0, 7));
    assert.equal(ids.has(lead.leadId), false);
    assert.equal(names.has(lead.prototypeName), false);
    ids.add(lead.leadId);
    names.add(lead.prototypeName);
  }
});

test('position classification flags reference only existing approved player IDs', () => {
  assert.equal(report.groupingFlags.length, report.cupListing.categoryDiscrepanciesToReview);
  const idToGroup = new Map(soccerGroups.flatMap(group => nadir.groups[group].map(person => [person.personId, group])));
  const seen = new Set();
  for (const flag of report.groupingFlags) {
    assert.equal(idToGroup.get(flag.fictionalPersonId), flag.approvedDraftGroup);
    assert.notEqual(flag.approvedDraftGroup, flag.rfsBroadGroup);
    assert.equal(flag.rfsBroadGroup, 'midfielders');
    assert.equal(seen.has(flag.fictionalPersonId), false);
    seen.add(flag.fictionalPersonId);
  }
});
