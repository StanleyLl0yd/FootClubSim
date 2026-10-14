import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIGA_PRIKOLOV_IDENTITIES } from '../dist/branding/identities.js';

const clubs = LIGA_PRIKOLOV_IDENTITIES;
test('all 16 approved fictional club names have unique stable IDs and valid readable badge specs', () => {
  assert.equal(clubs.length, 16);
  assert.equal(new Set(clubs.map(club => club.id)).size, 16);
  assert.equal(new Set(clubs.map(club => club.name)).size, 16);
  for (const club of clubs) {
    assert.match(club.id, /^lp-[a-z0-9-]+$/);
    assert.equal(club.letter, club.name.slice(0, 1));
    for (const key of ['outerColor', 'middleColor', 'centerColor', 'letterColor']) {
      assert.match(club[key], /^#[0-9A-F]{6}$/);
    }
    assert.notEqual(club.letterColor, club.centerColor);
  }
  assert.deepEqual(clubs.map(club => club.name), [
    'Надир', 'Зеленобер', 'Вагон', 'Патриций', 'ОГКМ', 'Пацифика',
    'Статика М1', 'Изумруд', 'Упрёк', 'Спадов', 'Корни Запретов',
    'Орендорф', 'Низон', 'Статика М2', 'Чужбина', 'Огнетушитель',
  ]);
});
test('Nadir and both Statika emblems retain exact owner-approved zone ordering and captions', () => {
  const find = id => clubs.find(club => club.id === 'lp-' + id);
  assert.deepEqual([find('nadir').centerColor, find('nadir').middleColor, find('nadir').outerColor],
    ['#1253A5', '#FFFFFF', '#77C7F4']);
  assert.equal(find('statika-m1').letter, 'С');
  assert.equal(find('statika-m1').subtitle, 'М1');
  assert.equal(find('statika-m2').subtitle, 'М2');
  assert.deepEqual([find('statika-m1').outerColor, find('statika-m1').middleColor, find('statika-m1').centerColor],
    ['#77C7F4', '#1253A5', '#FFFFFF']);
  assert.deepEqual([find('statika-m2').outerColor, find('statika-m2').middleColor, find('statika-m2').centerColor],
    ['#1253A5', '#FFFFFF', '#77C7F4']);
  for (const club of clubs.filter(club => !club.id.startsWith('lp-statika'))) {
    assert.equal(club.subtitle, undefined);
  }
});
test('fictional personnel drafts are isolated, named, and never mistaken for playable M0 data', () => {
  const roster = JSON.parse(readFileSync(new URL('../data/drafts/nadir-personnel-v0.json', import.meta.url), 'utf8'));
  const worklist = JSON.parse(readFileSync(new URL('../data/drafts/liga-roster-worklist.json', import.meta.url), 'utf8'));
  const counts = Object.fromEntries(Object.entries(roster.groups).map(([key, group]) => [key, group.length]));
  assert.deepEqual(counts, { goalkeepers: 4, defenders: 9, midfielders: 7, attackers: 6, coaches: 12, board: 2, support: 6 });
  const allNames = Object.values(roster.groups).flat();
  assert.equal(allNames.length, 46);
  assert.equal(new Set(allNames).size, 46);
  assert.equal(roster.reviewStatus, 'identity-only-unverified');
  assert.deepEqual(worklist.clubs.map(row => row.clubId), clubs.map(club => club.id));
  assert.equal(worklist.clubs.filter(row => row.rosterStatus === 'pending-source-and-rights-verification').length, 15);
});

function luminance(hex) {
  const channels = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
test('central badge lettering passes WCAG 4.5:1 contrast on all 16 badge disks', () => {
  for (const club of clubs) {
    const a = luminance(club.letterColor);
    const b = luminance(club.centerColor);
    const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(contrast >= 4.5, club.name + ' has insufficient letter contrast: ' + contrast.toFixed(2));
  }
});
test('clubs with equal initial letters have distinct three-zone badge palettes', () => {
  const palettes = new Set();
  for (const club of clubs) {
    const key = [club.letter, club.outerColor, club.middleColor, club.centerColor].join('/');
    assert.ok(!palettes.has(key), club.name + ' has a duplicated letter and palette');
    palettes.add(key);
  }
});
