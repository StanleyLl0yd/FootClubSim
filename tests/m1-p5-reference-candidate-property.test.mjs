import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { analyzeRplCsvCandidate } from '../scripts/m1-p5-reference-candidate.mjs';

const header = 'match_id,league_id,season,status,home_id,away_id,home_goals,away_goals';
const sha = input => createHash('sha256').update(input).digest('hex');
const inspect = input => analyzeRplCsvCandidate(input, '2024/2025', sha(input));

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

function syntheticRows(seed) {
  const next = generator(seed);
  const records = [];
  const count = 3 + next() % 45;
  for (let i = 0; i < count; i++) {
    const home = 100 + next() % 16;
    let away = 100 + next() % 16;
    if (home === away) away = 100 + (away - 99) % 16;
    const homeGoals = next() % 9, awayGoals = next() % 9;
    records.push({ id: i + 1, home: String(home), away: String(away),
      homeGoals, awayGoals });
  }
  return records;
}

function toCsv(records, lineEnding = '\n') {
  return [header, ...records.map(r => [
    r.id, 235, '2024/2025', 'finished', r.home, r.away, r.homeGoals, r.awayGoals,
  ].join(','))].join(lineEnding) + lineEnding;
}

function oracle(records) {
  const clubs = new Map(), seenPairs = new Set();
  let repeats = 0, homeWins = 0, draws = 0, awayWins = 0;
  let homeGoals = 0, awayGoals = 0, scoreless = 0, bothScored = 0;
  for (const row of records) {
    const pair = row.home + ':' + row.away;
    if (seenPairs.has(pair)) repeats++;
    seenPairs.add(pair);
    for (const [id, side] of [[row.home, 'home'], [row.away, 'away']]) {
      const counts = clubs.get(id) ?? { home: 0, away: 0 };
      counts[side]++;
      clubs.set(id, counts);
    }
    if (row.homeGoals > row.awayGoals) homeWins++;
    else if (row.homeGoals === row.awayGoals) draws++;
    else awayWins++;
    homeGoals += row.homeGoals;
    awayGoals += row.awayGoals;
    if (!row.homeGoals && !row.awayGoals) scoreless++;
    if (row.homeGoals && row.awayGoals) bothScored++;
  }
  const range = values => ({ min: Math.min(...values), max: Math.max(...values) });
  const entries = [...clubs.values()];
  return {
    finishedMatches: records.length, homeWins, draws, awayWins, scoreless,
    bothScored, homeGoals, awayGoals, totalGoals: homeGoals + awayGoals,
    coverage: {
      observedClubCount: clubs.size,
      finishedAppearancesPerClub: range(entries.map(v => v.home + v.away)),
      finishedHomeMatchesPerClub: range(entries.map(v => v.home)),
      finishedAwayMatchesPerClub: range(entries.map(v => v.away)),
      repeatedHomeAwayFixtures: repeats,
    },
  };
}

test('128 independently seeded valid CSV cohorts conserve all observed counts', () => {
  for (let seed = 1; seed <= 128; seed++) {
    const rows = syntheticRows(seed);
    const expected = oracle(rows), actual = inspect(toCsv(rows));
    assert.equal(actual.finishedMatches, expected.finishedMatches);
    assert.deepEqual(actual.coverage, expected.coverage);
    assert.deepEqual(actual.goalTotals, {
      home: expected.homeGoals, away: expected.awayGoals, total: expected.totalGoals,
    });
    assert.equal(actual.goalsPerMatch.total, expected.totalGoals);
    assert.equal(actual.goalsPerMatch.mean,
      expected.totalGoals / expected.finishedMatches);
    for (const [source, name] of [
      ['homeWin', 'homeWins'], ['draw', 'draws'], ['awayWin', 'awayWins'],
      ['scoreless', 'scoreless'], ['bothScored', 'bothScored'],
    ]) {
      assert.equal(actual.outcomes[source].numerator, expected[name]);
      assert.equal(actual.outcomes[source].denominator, expected.finishedMatches);
      assert.ok(actual.outcomes[source].wilson95.lower <=
        actual.outcomes[source].rate);
      assert.ok(actual.outcomes[source].wilson95.upper >=
        actual.outcomes[source].rate);
    }
    assert.equal(actual.status,
      'UNAPPROVED_EXTERNAL_REFERENCE_CANDIDATE_NOT_CALIBRATED');
    assert.equal(actual.isCompleteSeason, 'NOT_ESTABLISHED');
  }
});

test('96 pinned valid-hash but invalid-content variants fail closed', () => {
  const row = '1,235,2024/2025,finished,10,20,2,1';
  const corrupt = [
    [header, row, row],
    [header.replace('away_goals', 'home_goals'), row],
    [header, row.replace(',235,', ',999,')],
    [header, row.replace('finished', 'postponed')],
    [header, row.replace('2024/2025', '2024/2027')],
    [header, row.replace(',10,20,', ',10,10,')],
    [header, row.replace(',2,1', ',31,1')],
    [header, row.replace(',2,1', ',,1')],
    [header, row + ',extra'],
    [header, row + '"quoted"'],
    [header, row.replace(',2,1', ',2\0,1')],
    [header, row.replace(',2,1', ',2\r,1')],
    [header, row.replace(',2,1', ',"unterminated,1')],
  ];
  for (let seed = 1; seed <= 96; seed++) {
    const lines = corrupt[(Math.imul(seed, 17) >>> 0) % corrupt.length];
    const csv = lines.join('\n') + '\n';
    assert.throws(() => inspect(csv), undefined, 'mutation seed ' + seed);
  }
});

test('row order and CRLF cannot change integer counts or leak an ignored text column', () => {
  const rows = syntheticRows(917);
  const withVenue = (values, ending) => [
    header + ',venue',
    ...values.map(r => [
      r.id, 235, '2024/2025', 'finished', r.home, r.away,
      r.homeGoals, r.awayGoals, '"Private, Location"',
    ].join(',')),
  ].join(ending) + ending;
  const forward = inspect(withVenue(rows, '\n'));
  const reverse = inspect(withVenue([...rows].reverse(), '\r\n'));
  assert.deepEqual(forward.coverage, reverse.coverage);
  assert.deepEqual(forward.goalTotals, reverse.goalTotals);
  assert.deepEqual(forward.outcomes, reverse.outcomes);
  assert.equal(JSON.stringify(forward).includes('Private, Location'), false);
  assert.equal(JSON.stringify(reverse).includes('Private, Location'), false);
  assert.notEqual(forward.source.sha256, reverse.source.sha256);
});
