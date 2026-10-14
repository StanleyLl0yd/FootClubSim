import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIGA_PRIKOLOV_IDENTITIES } from '../dist/branding/identities.js';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const research = read('data/drafts/liga-wikipedia-source-map-2026-10-14.json');
const nadir = read('data/drafts/nadir-personnel-v1.json');
const draftPack = read('data/drafts/liga-personnel-pack-v1.json');
const sourceRegister = read('data/drafts/liga-roster-sources.json');

const headings = [
  ['lp-nizon', '«Акрон» (Тольятти)'],
  ['lp-uprek', '«Ахмат» (Грозный)'],
  ['lp-pacifica', '«Балтика» (Калининград)'],
  ['lp-statika-m2', '«Динамо» (Махачкала)'],
  ['lp-statika-m1', '«Динамо» (Москва)'],
  ['lp-nadir', '«Зенит» (Санкт-Петербург)'],
  ['lp-zelenober', '«Краснодар» (Краснодар)'],
  ['lp-korni-zapretov', '«Крылья Советов» (Самара)'],
  ['lp-vagon', '«Локомотив» (Москва)'],
  ['lp-orendorf', '«Оренбург» (Оренбург)'],
  ['lp-chuzhbina', '«Родина» (Москва)'],
  ['lp-spadov', '«Ростов» (Ростов-на-Дону)'],
  ['lp-izumrud', '«Рубин» (Казань)'],
  ['lp-patriciy', '«Спартак» (Москва)'],
  ['lp-ognetushitel', '«Факел» (Воронеж)'],
  ['lp-ogkm', 'ЦСКА (Москва)'],
];

function validate(record) {
  assert.deepEqual(Object.keys(record).sort(), [
    'schemaVersion', 'reviewedOn', 'targetAsOf', 'sourcePolicy', 'importScope',
    'wikipediaSources', 'participatingClubs', 'targetedNadirDiscrepancy',
    'contentLicense', 'imagesOrProtectedArticleTextsCopied', 'sourcePlayerRowsImported',
    'asOfRegisteredClubRostersVerified', 'licensedPlayableFactRowsImported',
    'modifiesExistingSyntheticPack', 'modifiesExistingSaves',
  ].sort());
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.reviewedOn, '2026-10-14');
  assert.equal(record.targetAsOf, '2026-10-14');
  assert.equal(record.sourcePolicy, 'wikipedia-first-prototype-research-with-independent-dated-crosschecks');
  assert.equal(record.importScope, 'research-source-reference-only-not-a-playable-personnel-dataset');
  assert.equal(record.wikipediaSources.length, 3);
  const sources = new Map();
  for (const source of record.wikipediaSources) {
    assert.deepEqual(Object.keys(source).sort(), [
      'id','url','revisionId','revisionUrl','lastEditedOn','scope','canProveCompleteRegisteredRoster',
    ].sort());
    assert.match(source.id, /^[a-z0-9-]+$/);
    assert.equal(sources.has(source.id), false);
    sources.set(source.id, source);
    const parsed = new URL(source.url);
    assert.equal(parsed.protocol, 'https:');
    assert.equal(parsed.hostname, 'ru.wikipedia.org');
    assert.match(parsed.pathname, /^\/wiki\/.+$/);
    assert.equal(parsed.search, '');
    assert.equal(parsed.hash, '');
    assert.ok(Number.isSafeInteger(source.revisionId) && source.revisionId > 0);
    const frozen = new URL(source.revisionUrl);
    assert.equal(frozen.protocol, 'https:');
    assert.equal(frozen.hostname, parsed.hostname);
    assert.equal(frozen.pathname, '/w/index.php');
    assert.deepEqual([...frozen.searchParams.keys()], ['oldid']);
    assert.equal(frozen.searchParams.get('oldid'), String(source.revisionId));
    assert.equal(frozen.hash, '');
    assert.match(source.lastEditedOn, /^2026-10-1[12]$/);
    assert.ok(source.lastEditedOn <= record.targetAsOf);
    assert.equal(source.canProveCompleteRegisteredRoster, false);
  }
  for (const [id, revision, scope] of [
    ['rpl-squads-2026-27', 155579206, 'players-who-appeared-in-at-least-one-rpl-match-only'],
    ['rpl-season-2026-27', 155571074, '16-participants-season-coaches-captains-and-changes-unfrozen-roles'],
    ['zenit-club-overview', 155561861, 'zenit-main-second-youth-loans-leadership-and-coaching-overview'],
  ]) {
    assert.equal(sources.get(id)?.revisionId, revision);
    assert.equal(sources.get(id)?.scope, scope);
  }
  assert.equal(record.participatingClubs.length, 16);
  assert.deepEqual(
    record.participatingClubs.map(({clubId,wikipediaSquadsSection}) => [clubId,wikipediaSquadsSection]),
    headings
  );
  const expected = new Set(LIGA_PRIKOLOV_IDENTITIES.map(c => c.id));
  assert.deepEqual(new Set(headings.map(x => x[0])), expected);
  assert.deepEqual(new Set(sourceRegister.clubs.map(c => c.clubId)), expected);
  assert.equal(new Set(record.participatingClubs.map(c => c.wikipediaSquadsSection)).size, 16);
  for (const row of record.participatingClubs) {
    assert.deepEqual(Object.keys(row).sort(), ['clubId','wikipediaSquadsSection']);
  }

  const comparison = record.targetedNadirDiscrepancy;
  assert.deepEqual(Object.keys(comparison).sort(), [
    'clubId', 'approvedFictionalIdentityCount', 'approvedPlayerIdentityCount',
    'wikipediaMainTeamListedPlayers', 'wikipediaSecondTeamPrototypePointers',
    'wikipediaYouthTeamPrototypePointers', 'differingRoleClassificationsRequireFollowup',
    'asOfMainTeamRegistrationEstablished',
  ].sort());
  assert.equal(comparison.clubId, 'lp-nadir');
  assert.equal(comparison.approvedFictionalIdentityCount, 46);
  assert.equal(comparison.approvedPlayerIdentityCount, 26);
  assert.equal(comparison.wikipediaMainTeamListedPlayers, 24);
  assert.equal(comparison.differingRoleClassificationsRequireFollowup, true);
  assert.equal(comparison.asOfMainTeamRegistrationEstablished, false);
  const validNadir = new Map(Object.values(nadir.groups).flat().map(p => [p.personId, p.displayName]));
  const second = comparison.wikipediaSecondTeamPrototypePointers;
  const youth = comparison.wikipediaYouthTeamPrototypePointers;
  assert.deepEqual(second, [{ fictionalPersonId:'lp-person-0004', fictionalIdentity:'Максим Зайкин', prototype:'Максим Зайцев' }]);
  assert.deepEqual(youth, [{ fictionalPersonId:'lp-person-0018', fictionalIdentity:'Амир Музаев', prototype:'Амир Мусаев' }]);
  for (const row of [...second, ...youth]) {
    assert.equal(validNadir.get(row.fictionalPersonId), row.fictionalIdentity);
  }
  assert.equal(record.contentLicense, 'Wikipedia article text is CC BY-SA 4.0; article extracts and copied tables are not included; separate material may have other rights');
  assert.equal(record.imagesOrProtectedArticleTextsCopied, false);
  assert.equal(record.sourcePlayerRowsImported, 0);
  assert.equal(record.asOfRegisteredClubRostersVerified, 0);
  assert.equal(record.licensedPlayableFactRowsImported, 0);
  assert.equal(record.modifiesExistingSyntheticPack, false);
  assert.equal(record.modifiesExistingSaves, false);
  assert.equal(draftPack.availableForCareerStart, false);
  assert.equal(draftPack.verifiedFactCount, 0);
}

test('Wikipedia editions cover 16 approved club IDs without posing as complete registrations', () => {
  validate(research);
});

test('Wikipedia research refuses registration, bulk import and save-modification promotion', () => {
  for (const [key, value] of [
    ['sourcePlayerRowsImported', 1],
    ['asOfRegisteredClubRostersVerified', 16],
    ['licensedPlayableFactRowsImported', 1],
    ['imagesOrProtectedArticleTextsCopied', true],
    ['modifiesExistingSyntheticPack', true],
    ['modifiesExistingSaves', true],
  ]) assert.throws(() => validate({...research,[key]:value}), key);
});

test('Wikipedia source and Nadir affiliation change requires explicit review', () => {
  const wrongRevision = structuredClone(research);
  wrongRevision.wikipediaSources[0].revisionId++;
  assert.throws(() => validate(wrongRevision));
  const driftingUrl = structuredClone(research);
  driftingUrl.wikipediaSources[0].revisionUrl =
    'https://ru.wikipedia.org/wiki/Чемпионат_России_по_футболу_2026/2027_(составы)';
  assert.throws(() => validate(driftingUrl));
  const mismatchedOldid = structuredClone(research);
  mismatchedOldid.wikipediaSources[0].revisionUrl =
    'https://ru.wikipedia.org/w/index.php?oldid=155579207';
  assert.throws(() => validate(mismatchedOldid));
  const duplicatedSection = structuredClone(research);
  duplicatedSection.participatingClubs[1].wikipediaSquadsSection = duplicatedSection.participatingClubs[0].wikipediaSquadsSection;
  assert.throws(() => validate(duplicatedSection));
  const wrongAffiliation = structuredClone(research);
  wrongAffiliation.targetedNadirDiscrepancy.wikipediaYouthTeamPrototypePointers[0].fictionalPersonId = 'lp-person-0020';
  assert.throws(() => validate(wrongAffiliation));
});
