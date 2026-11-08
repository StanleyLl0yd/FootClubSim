import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createManagerProfile, MANAGER_SKILL_KEYS, readManagerProfile,
  regenerateManagerBiography, startingManagerSkills,
} from '../dist/core/manager-profile.js';
import { createInitialCareer, exportInitialCareer, importInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { startM1MatchResultJournal } from '../dist/core/m1-result-journal.js';
import {
  startM1V188LeagueJournal, prepareM1V188LeagueMatch, applyM1V188LeagueMatch,
} from '../dist/core/m1-v188-league-source-journal.js';
import {
  encodeM1V188FullCareerBackup, decodeM1V188FullCareerBackup,
} from '../dist/browser/m1-v188-full-career-backup.js';

const name = 'Алекс Тренеров';
const catalog = createSyntheticRplScaleCatalog(42);
const club = catalog.clubs[0].id;

test('preset trade-offs and arbitrary custom allocations use the same exact budget', () => {
  const player = startingManagerSkills('former-player');
  const theorist = startingManagerSkills('theorist');
  assert.deepEqual(MANAGER_SKILL_KEYS.map(key => player[key]), [10, 9, 13, 8, 10, 14, 14, 12, 7, 7, 8, 8]);
  assert.deepEqual(MANAGER_SKILL_KEYS.map(key => theorist[key]), [14, 13, 9, 13, 11, 8, 7, 9, 14, 7, 9, 6]);
  const boundary = Object.fromEntries(MANAGER_SKILL_KEYS.map((key, i) => [key, i < 6 ? 5 : 15]));
  for (const [origin, skills] of [
    ['former-player', player], ['theorist', theorist],
    ['custom', startingManagerSkills('custom')], ['custom', boundary], ['custom', player],
  ]) {
    assert.equal(Object.values(skills).reduce((sum, value) => sum + value), 120);
    assert.deepEqual(createManagerProfile(name, origin, skills, 42).skills, skills);
  }

  const invalid = [
    { ...player, tacticalKnowledge: 9 }, { ...player, tacticalKnowledge: 11 },
    { ...player, tacticalKnowledge: 4, negotiation: 13 },
    { ...player, tacticalKnowledge: 16, negotiation: 1 },
    { ...player, tacticalKnowledge: 10.5, negotiation: 6.5 },
    { ...player, tacticalKnowledge: '10' }, { ...player, additionalSkill: 0 },
    { ...player, tacticalKnowledge: undefined },
  ];
  for (const skills of invalid)
    assert.throws(() => createManagerProfile(name, 'custom', skills, 42), RangeError);
  assert.throws(() => createManagerProfile(name, 'theorist', player, 42), RangeError);
  assert.throws(() => createManagerProfile(' ', 'custom', player, 42), RangeError);
  assert.throws(() => createManagerProfile(name, 'custom', player, 0), RangeError);
});

test('biographies follow origin and skills, with repeatable chronology and independent regeneration', () => {
  const analystSkills = {
    ...startingManagerSkills('custom'), tacticalKnowledge: 15, mediaCommunication: 5,
  };
  const leaderSkills = {
    ...startingManagerSkills('custom'), peopleManagement: 15, negotiation: 5,
  };
  for (const [origin, skills, kinds] of [
    ['former-player', startingManagerSkills('former-player'), ['playing-debut', 'playing-milestone', 'coaching']],
    ['theorist', startingManagerSkills('theorist'), ['courses', 'analyst', 'coaching']],
    ['custom', analystSkills, ['grassroots', 'analysis', 'coaching']],
    ['custom', leaderSkills, ['grassroots', 'leadership', 'coaching']],
    ['custom', startingManagerSkills('custom'), ['grassroots', 'generalist', 'coaching']],
  ]) {
    const first = createManagerProfile(name, origin, skills, 0xffffffff);
    assert.deepEqual(createManagerProfile(name, origin, skills, 0xffffffff), first);
    assert.deepEqual(first.biography.events.map(event => event.kind), kinds);
    assert.ok(first.biography.events.every((event, i, events) =>
      event.yearsBeforeStart > 0 && (!i || events[i - 1].yearsBeforeStart > event.yearsBeforeStart)));
    const second = regenerateManagerBiography(first);
    assert.equal(second.biography.seed, 1);
    assert.notDeepEqual(second.biography.events, first.biography.events);
    assert.deepEqual(second.skills, first.skills);
    assert.deepEqual(readManagerProfile(second), second);
    const forged = structuredClone(second);
    forged.biography.events[0].yearsBeforeStart = 1;
    assert.equal(readManagerProfile(forged), null);
  }
});

test('the accepted profile survives initial and full-career archives without changing match results', async () => {
  const profile = regenerateManagerBiography(
    createManagerProfile(name, 'custom', startingManagerSkills('custom'), 19));
  const legacy = createInitialCareer(catalog, club, 42, 'profile-career');
  const career = createInitialCareer(catalog, club, 42, 'profile-career', profile);
  assert.equal(career.saveSchemaVersion, 2);
  assert.equal(legacy.saveSchemaVersion, 1);
  assert.equal(startM1MatchResultJournal(career).ok, true);
  const initial = await exportInitialCareer(career);
  assert.deepEqual(await importInitialCareer(initial), { ok: true, value: career });
  assert.deepEqual(await importInitialCareer(await exportInitialCareer(legacy)), { ok: true, value: legacy });
  await assert.rejects(exportInitialCareer({
    ...career, managerProfile: { ...profile, biography: { ...profile.biography, events: [] } },
  }), RangeError);

  const empty = startM1V188LeagueJournal(career);
  assert.equal(empty.ok, true);
  const next = prepareM1V188LeagueMatch(career, empty.journal);
  assert.equal(next?.ok, true);
  assert.deepEqual(next, prepareM1V188LeagueMatch(legacy, empty.journal));
  const played = applyM1V188LeagueMatch(career, empty.journal, next.request);
  assert.equal(played.ok, true);
  const archive = await encodeM1V188FullCareerBackup(career, played.journal);
  assert.deepEqual(await decodeM1V188FullCareerBackup(archive, [catalog]), {
    initial: career, journal: played.journal,
  });
});
