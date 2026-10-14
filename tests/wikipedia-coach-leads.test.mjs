import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIGA_PRIKOLOV_IDENTITIES } from '../dist/branding/identities.js';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const research = read('data/drafts/liga-wikipedia-coach-leads-2026-10-14.json');
const sources = read('data/drafts/liga-wikipedia-source-map-2026-10-14.json');
const nadir = read('data/drafts/nadir-personnel-v1.json');
const staging = read('data/drafts/liga-personnel-pack-v1.json');

const namedCoachLeads = new Map([
  ['lp-nizon', 'Срджан Благоевич'],
  ['lp-uprek', 'Станислав Черчесов'],
  ['lp-pacifica', 'Андрей Талалаев'],
  ['lp-statika-m2', 'Вадим Евсеев'],
  ['lp-statika-m1', 'Сандро Шварц'],
  ['lp-nadir', 'Сергей Семак'],
  ['lp-zelenober', 'Мурад Мусаев'],
  ['lp-korni-zapretov', 'Сергей Булатов'],
  ['lp-vagon', 'Михаил Галактионов'],
  ['lp-orendorf', 'Ильдар Ахметзянов'],
  ['lp-chuzhbina', 'Джонатан Альба'],
  ['lp-spadov', 'Дмитрий Кириченко'],
  ['lp-izumrud', 'Франк Артига'],
  ['lp-patriciy', 'Хуан Карседо'],
  ['lp-ognetushitel', 'Алексей Ребко'],
  ['lp-ogkm', 'Дмитрий Игдисамов'],
]);

function validate(doc) {
  assert.deepEqual(Object.keys(doc).sort(), [
    'schemaVersion', 'reviewedOn', 'targetAsOf', 'wikipediaSourceId', 'wikipediaRevisionId', 'wikipediaRevisionUrl',
    'sourceArticleUrl', 'sourceSection', 'scope', 'reportedCoachLeads',
    'reportedCoachTransitions', 'licensedPlayableStaffFactsImported', 'completeVerifiedStaffLists',
    'sourceTableCopied', 'sourceTextOrImagesCopied', 'sourceRightsReview',
    'modifiesOwnerApprovedNames', 'modifiesCurrentSaves',
  ].sort());
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.reviewedOn, '2026-10-14');
  assert.equal(doc.targetAsOf, '2026-10-14');
  const registered = sources.wikipediaSources.find(src => src.id === doc.wikipediaSourceId);
  assert.ok(registered);
  assert.equal(doc.wikipediaRevisionId, registered.revisionId);
  assert.equal(doc.wikipediaRevisionId, 155571074);
  assert.equal(doc.sourceArticleUrl, registered.url);
  assert.equal(doc.wikipediaRevisionUrl, registered.revisionUrl);
  assert.equal(doc.sourceSection, 'Официальные представители / Тренерские изменения');
  assert.equal(doc.scope, 'observed-wikipedia-head-coach-candidates-not-verified-as-of-staff-appointments');
  const leagueIds = new Set(LIGA_PRIKOLOV_IDENTITIES.map(c => c.id));
  assert.deepEqual(new Set(namedCoachLeads.keys()), leagueIds);
  assert.equal(doc.reportedCoachLeads.length, 16);
  const seen = new Set();
  for (const row of doc.reportedCoachLeads) {
    assert.deepEqual(Object.keys(row).sort(), [
      'fictionalClubId','prototypeName','role','sourceMarksActing',
      'approvedFictionalPersonId','appointmentAsOfVerified',
    ].sort());
    assert.ok(leagueIds.has(row.fictionalClubId), 'unknown club');
    assert.equal(seen.has(row.fictionalClubId), false, 'duplicate coach club row');
    seen.add(row.fictionalClubId);
    assert.equal(row.prototypeName, namedCoachLeads.get(row.fictionalClubId));
    assert.equal(row.role, 'head-coach-source-lead');
    assert.equal(row.sourceMarksActing, row.fictionalClubId === 'lp-ognetushitel');
    assert.equal(row.appointmentAsOfVerified, false);
    if (row.fictionalClubId === 'lp-nadir') {
      assert.equal(row.approvedFictionalPersonId, 'lp-person-0027');
      assert.ok(nadir.groups.coaches.some(p => p.personId === row.approvedFictionalPersonId));
    } else {
      assert.equal(row.approvedFictionalPersonId, null);
    }
  }
  assert.deepEqual(seen, leagueIds);
  assert.equal(doc.reportedCoachTransitions.length, 4);
  const expectedTransitions = [
    ['lp-chuzhbina','2026-09-21','Хуан Диас','Барсег Киракосян',true],
    ['lp-spadov','2026-09-26','Джонатан Альба','Дмитрий Кириченко',false],
    ['lp-chuzhbina','2026-10-08','Барсег Киракосян','Джонатан Альба',false],
    ['lp-ognetushitel','2026-10-11','Олег Василенко','Алексей Ребко',true],
  ];
  assert.deepEqual(doc.reportedCoachTransitions.map(t => [
    t.fictionalClubId,t.reportedEffectiveDate,t.previousPrototypeName,
    t.nextPrototypeName,t.sourceMarksNextActing,
  ]), expectedTransitions);
  for (const event of doc.reportedCoachTransitions) {
    assert.deepEqual(Object.keys(event).sort(), [
      'fictionalClubId','reportedEffectiveDate','previousPrototypeName',
      'nextPrototypeName','sourceMarksNextActing','effectiveDateIndependentlyVerified',
    ].sort());
    assert.ok(event.reportedEffectiveDate < doc.targetAsOf);
    assert.equal(event.effectiveDateIndependentlyVerified, false);
  }
  const lastByClub = new Map(doc.reportedCoachTransitions.map(x => [x.fictionalClubId, x.nextPrototypeName]));
  for (const [clubId,name] of lastByClub) assert.equal(namedCoachLeads.get(clubId),name);
  const rostovDeparture = doc.reportedCoachTransitions.find(t => t.fictionalClubId === 'lp-spadov');
  const rodinaArrival = doc.reportedCoachTransitions.find(t => t.fictionalClubId === 'lp-chuzhbina' && t.nextPrototypeName === 'Джонатан Альба');
  assert.equal(rostovDeparture.previousPrototypeName, rodinaArrival.nextPrototypeName);
  assert.ok(rostovDeparture.reportedEffectiveDate < rodinaArrival.reportedEffectiveDate);
  assert.equal(doc.licensedPlayableStaffFactsImported, 0);
  assert.equal(doc.completeVerifiedStaffLists, 0);
  assert.equal(doc.sourceTableCopied, false);
  assert.equal(doc.sourceTextOrImagesCopied, false);
  assert.equal(doc.sourceRightsReview, 'pending');
  assert.equal(doc.modifiesOwnerApprovedNames, false);
  assert.equal(doc.modifiesCurrentSaves, false);
  assert.equal(staging.availableForCareerStart, false);
  assert.equal(staging.verifiedFactCount, 0);
}

test('Wikipedia coaching leads represent sixteen different clubs without certified staff lists', () => {
  validate(research);
});

test('Wikipedia coach evidence cannot be promoted to licensed or verified staff records', () => {
  for (const [key,value] of [
    ['licensedPlayableStaffFactsImported', 1],
    ['completeVerifiedStaffLists', 16],
    ['sourceTableCopied', true],
    ['sourceTextOrImagesCopied', true],
    ['modifiesOwnerApprovedNames', true],
    ['modifiesCurrentSaves', true],
  ]) assert.throws(() => validate({...research,[key]:value}));
});

test('Wikipedia dated coach movement and acting status require explicit review', () => {
  const changedRevision = structuredClone(research);
  changedRevision.wikipediaRevisionId++;
  assert.throws(() => validate(changedRevision));
  const mismatch = structuredClone(research);
  mismatch.wikipediaRevisionUrl = 'https://ru.wikipedia.org/w/index.php?oldid=155571075';
  assert.throws(() => validate(mismatch));
  const duplicate = structuredClone(research);
  duplicate.reportedCoachLeads[1].fictionalClubId = duplicate.reportedCoachLeads[0].fictionalClubId;
  assert.throws(() => validate(duplicate));
  const wrongActing = structuredClone(research);
  wrongActing.reportedCoachLeads.find(r => r.fictionalClubId === 'lp-ognetushitel').sourceMarksActing = false;
  assert.throws(() => validate(wrongActing));
  const overlap = structuredClone(research);
  overlap.reportedCoachTransitions[2].reportedEffectiveDate = '2026-09-01';
  assert.throws(() => validate(overlap));
});
