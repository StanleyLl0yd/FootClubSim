import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { inspectOpenFootballRpl2024Season, inspectPinnedOpenFootballRpl,
  OPENFOOTBALL_RPL_2024_25 }
  from '../scripts/m1-p5-openfootball-rpl.mjs';

const clubs = Array.from({ length: 16 }, (_, i) =>
  'Club-' + String(i + 1).padStart(2, '0'));
const rounds = generateDoubleRoundRobin(clubs);
function source() {
  return [
    '= Russia Premier League 2024/25',
    '', '# Teams      16', '# Matches    240', '',
    ...rounds.flatMap((round, ri) => [
      '▪ Matchday ' + (ri + 1),
      ...round.fixtures.map((f, j) =>
        '  ' + f.homeClubId.padEnd(24) + '  v ' +
        f.awayClubId.padEnd(24) + '  ' +
        (ri % 4) + '-' + (j % 3)),
      '',
    ]),
  ].join('\n') + '\n';
}

test('source-pinned pure parser accounts for 240 ordered home-away fixtures', () => {
  const raw = source(), clone = raw.slice();
  const report = inspectOpenFootballRpl2024Season(raw);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.season, '2024/2025');
  assert.equal(report.observed.finishedMatches, 240);
  assert.equal(report.observed.observedClubCount, 16);
  assert.equal(report.observed.homeWins + report.observed.draws +
    report.observed.awayWins, 240);
  assert.equal(report.observed.homeGoals + report.observed.awayGoals,
    report.observed.totalGoals);
  assert.deepEqual(inspectOpenFootballRpl2024Season(raw.replaceAll('\n', '\r\n')),
    report);
  assert.equal(raw, clone);
});

test('untrusted scoreboard transcript cannot contain missing or duplicate fixtures', () => {
  const raw = source(), lines = raw.split('\n');
  const match = lines.findIndex(l => l.includes('  v '));
  const altered = lines.slice();
  altered.splice(match, 1);
  assert.throws(() => inspectOpenFootballRpl2024Season(altered.join('\n')),
    /Incomplete|Invalid round/);
  const duplicated = lines.slice();
  const nextMatch = lines.findIndex((l, i) => i > match && l.includes('  v '));
  duplicated[nextMatch] = duplicated[match];
  assert.throws(() => inspectOpenFootballRpl2024Season(duplicated.join('\n')),
    /Duplicate home-away fixture/);
});

test('score, club, matchday and half-time anomalies fail closed', () => {
  const raw = source();
  const line = raw.split('\n').find(l => l.includes('  v '));
  for (const candidate of [
    raw.replace(line, line.replace(/\d+-\d+$/, '21-0')),
    raw.replace(line, line.replace(/\d+-\d+$/, '0-0 (1-0)')),
    raw.replace('▪ Matchday 2', '▪ Matchday 1'),
    raw.replace('= Russia Premier League 2024/25', '= unrelated competition'),
    raw.replace(line, line.replace('  v ', '  versus ')),
    raw + '  Added Team           v Rival Team           1-0\n',
  ]) assert.throws(() => inspectOpenFootballRpl2024Season(candidate));
});

test('the pinned immutable external byte hash never approves an altered dataset', () => {
  assert.equal(OPENFOOTBALL_RPL_2024_25.commit.length, 40);
  assert.equal(OPENFOOTBALL_RPL_2024_25.sha256.length, 64);
  assert.throws(() => inspectPinnedOpenFootballRpl(
    Buffer.from(source(), 'utf8'), null), /SHA-256 mismatch/);
  assert.throws(() => inspectPinnedOpenFootballRpl(new Uint8Array(10), null),
    /Invalid source bytes/);
});
