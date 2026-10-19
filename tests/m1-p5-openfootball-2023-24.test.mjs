import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { inspectOpenFootballRplSeason, inspectOpenFootballRpl2024Season }
  from '../scripts/m1-p5-openfootball-rpl.mjs';
import { OPENFOOTBALL_RPL_2023_24, inspectPinned2023RplTrainingCandidate }
  from '../scripts/m1-p5-openfootball-2023-24.mjs';

const clubs = Array.from({ length: 16 }, (_, i) =>
  'Club-' + String(i + 1).padStart(2, '0'));
const schedule = generateDoubleRoundRobin(clubs);
const transcript = (season) => [
  '= Russia Premier League ' + season,
  '', '# Teams      16', '# Matches    240', '',
  ...schedule.flatMap((round, ri) => [
    '▪ Matchday ' + (ri + 1),
    ...round.fixtures.map((f, index) =>
      '    14:00  ' + f.homeClubId.padEnd(24) + '  v ' +
      f.awayClubId.padEnd(24) + '  ' + (ri % 4) + '-' + (index % 3)),
    '',
  ]),
].join('\n') + '\n';

test('the shared full-calendar invariant admits both frozen season formats', () => {
  const old = inspectOpenFootballRplSeason(transcript('2023/24'), '2023/2024');
  const newer = inspectOpenFootballRplSeason(transcript('2024/25'), '2024/2025');
  assert.deepEqual(old.observed, newer.observed);
  assert.equal(old.season, '2023/2024');
  assert.equal(newer.season, '2024/2025');
  assert.deepEqual(inspectOpenFootballRpl2024Season(transcript('2024/25')),
    newer);
  for (const [source, season] of [
    [transcript('2023/24'), '2024/2025'],
    [transcript('2024/25'), '2023/2024'],
    [transcript('2022/23'), '2022/2023'],
  ]) assert.throws(() => inspectOpenFootballRplSeason(source, season));
});

test('a structurally complete 240-row transcript with duplicated home-away fixture fails', () => {
  const lines = transcript('2023/24').split('\n');
  const first = lines.findIndex(x => x.includes('  v '));
  const another = lines.findIndex((x, i) => i > first && x.includes('  v '));
  lines[another] = lines[first];
  assert.throws(() => inspectOpenFootballRplSeason(
    lines.join('\n'), '2023/2024'), /Duplicate home-away fixture/);
});

test('known bad and forged 2023/24 snapshots cannot bypass byte pinning', () => {
  assert.equal(OPENFOOTBALL_RPL_2023_24.commit.length, 40);
  assert.equal(OPENFOOTBALL_RPL_2023_24.sha256.length, 64);
  assert.equal(OPENFOOTBALL_RPL_2023_24.blobSha1.length, 40);
  for (const text of [transcript('2023/24'),
    ' '.repeat(150_000),
    transcript('2023/24').replace('Matchday 8', 'Matchday 9')]) {
    assert.throws(() => inspectPinned2023RplTrainingCandidate(
      Buffer.from(text, 'utf8')), /source SHA-256 mismatch|source byte length/);
  }
  assert.throws(() => inspectPinned2023RplTrainingCandidate(new Uint8Array(0)),
    /source byte length/);
});

test('1970 data or same-score home/away reversal cannot silently qualify', () => {
  const rows = transcript('2023/24').split('\n');
  const first = rows.findIndex(x => x.includes('  v '));
  rows[first] = rows[first].replace(/\d+-\d+$/, '8-0 (9-0)');
  assert.throws(() => inspectOpenFootballRplSeason(
    rows.join('\n'), '2023/2024'), /Half-time score exceeds full-time/);
  assert.throws(() => inspectOpenFootballRplSeason(
    transcript('2023/24').replace('▪ Matchday 2', '▪ Matchday 1'),
    '2023/2024'), /Invalid or repeated matchday order/);
});
