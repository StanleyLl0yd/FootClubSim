#!/usr/bin/env node
/** Local, hash-pinned inspection only. No network, benchmark approval or calibration. */
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ROWS = 100000;
const MAX_COLUMNS = 64;
const MAX_CELL_LENGTH = 4096;
const REQUIRED = [
  'match_id', 'league_id', 'season', 'status', 'home_id', 'away_id',
  'home_goals', 'away_goals',
];
const STATUSES = new Set(['finished', 'scheduled', 'live', 'cancelled']);
const SOURCE_URL = 'https://footbolno.ru/data/league/235-matches.csv';
const ATTRIBUTION_URL = 'https://footbolno.ru/otkrytye-dannye';
const Z95 = 1.959963984540054;

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes('\0')) throw Error('CSV contains NUL');
  const rows = [];
  let row = [], field = '', quoted = false, afterQuote = false, atStart = true;
  function cell() {
    if (field.length > MAX_CELL_LENGTH) throw Error('Oversized CSV cell');
    row.push(field);
    if (row.length > MAX_COLUMNS) throw Error('Too many CSV columns');
    field = '';
    atStart = true;
    afterQuote = false;
  }
  function line() {
    cell();
    if (row.length === 1 && row[0] === '') throw Error('Blank CSV row');
    rows.push(row);
    if (rows.length > MAX_ROWS + 1) throw Error('Too many CSV rows');
    row = [];
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else { field += c; }
    } else if (afterQuote) {
      if (c === ',') cell();
      else if (c === '\n') line();
      else if (c === '\r' && text[i + 1] === '\n') { line(); i++; }
      else throw Error('Invalid character after closing quote');
    } else if (c === '"') {
      if (!atStart) throw Error('Unexpected quote in CSV cell');
      quoted = true;
      atStart = false;
    } else if (c === ',') cell();
    else if (c === '\n') line();
    else if (c === '\r' && text[i + 1] === '\n') { line(); i++; }
    else if (c === '\r') throw Error('Unexpected bare carriage return');
    else { field += c; atStart = false; }
    if (field.length > MAX_CELL_LENGTH) throw Error('Oversized CSV cell');
  }
  if (quoted) throw Error('Unterminated quoted CSV field');
  if (row.length || field || afterQuote || !atStart) line();
  if (rows.length < 2) throw Error('CSV requires a header and data');
  const [header, ...records] = rows;
  if (new Set(header).size !== header.length) throw Error('Duplicate CSV header');
  for (const name of REQUIRED) {
    if (!header.includes(name)) throw Error(`Missing required CSV column: ${name}`);
  }
  for (const row of records) {
    if (row.length !== header.length) throw Error('Inconsistent CSV column count');
  }
  return { header, records };
}

function wilson(success, count) {
  const p = success / count, z2 = Z95 ** 2;
  const denominator = 1 + z2 / count;
  const center = (p + z2 / (2 * count)) / denominator;
  const half = Z95 * Math.sqrt((p * (1 - p) + z2 / (4 * count)) / count) /
    denominator;
  return { numerator: success, denominator: count, rate: p,
    wilson95: { lower: Math.max(0, center - half),
      upper: Math.min(1, center + half) } };
}

export function analyzeRplCsvCandidate(csv, season, expectedHash) {
  if (!/^\d{4}\/\d{4}$/.test(season) ||
      Number(season.slice(5)) !== Number(season.slice(0, 4)) + 1) {
    throw Error('Season must be consecutive YYYY/YYYY');
  }
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw Error('Invalid SHA-256 pin');
  const bytes = Buffer.from(csv, 'utf8');
  if (!bytes.length || bytes.length > MAX_BYTES) throw Error('Invalid CSV byte size');
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== expectedHash) throw Error('CSV SHA-256 mismatch');
  const { header, records } = parseCsv(csv);
  const col = Object.fromEntries(header.map((key, i) => [key, i]));
  const seen = new Set();
  const exclusions = { otherSeason: 0, scheduled: 0, live: 0, cancelled: 0 };
  let count = 0, homeWin = 0, awayWin = 0, draw = 0, nilNil = 0;
  let goalsTotal = 0, squaredDiff = 0, goalsMean = 0, bothScored = 0;
  let homeGoals = 0, awayGoals = 0, repeatedHomeAwayFixtures = 0;
  const clubAppearances = new Map(), directedFixtures = new Set();
  for (const record of records) {
    const get = name => record[col[name]];
    if (get('league_id') !== '235') throw Error('CSV contains non-RPL league ID');
    const id = get('match_id');
    if (!id || seen.has(id)) throw Error('Missing or duplicate match ID');
    seen.add(id);
    const rowSeason = get('season');
    if (!/^\d{4}\/\d{4}$/.test(rowSeason) ||
        Number(rowSeason.slice(5)) !== Number(rowSeason.slice(0, 4)) + 1) {
      throw Error('Invalid row season');
    }
    const status = get('status');
    if (!STATUSES.has(status)) throw Error('Unknown fixture status');
    if (get('season') !== season) { exclusions.otherSeason++; continue; }
    if (status !== 'finished') { exclusions[status]++; continue; }
    const homeId = get('home_id'), awayId = get('away_id');
    if (!homeId || !awayId || homeId === awayId) {
      throw Error('Invalid competing team identifiers');
    }
    function goal(name) {
      const value = get(name);
      if (!/^(?:0|[1-9][0-9]?)$/.test(value) || Number(value) > 30) {
        throw Error(`Invalid finished-match ${name}`);
      }
      return Number(value);
    }
    const h = goal('home_goals'), a = goal('away_goals');
    const fixtureKey = `${homeId.length}:${homeId}${awayId}`;
    if (directedFixtures.has(fixtureKey)) repeatedHomeAwayFixtures++;
    directedFixtures.add(fixtureKey);
    for (const [id, side] of [[homeId, 'home'], [awayId, 'away']]) {
      const appearances = clubAppearances.get(id) ?? { home: 0, away: 0 };
      appearances[side]++;
      clubAppearances.set(id, appearances);
    }
    homeGoals += h;
    awayGoals += a;
    count++;
    if (h > a) homeWin++;
    else if (h === a) draw++;
    else awayWin++;
    if (h === 0 && a === 0) nilNil++;
    if (h > 0 && a > 0) bothScored++;
    const goals = h + a;
    goalsTotal += goals;
    const delta = goals - goalsMean;
    goalsMean += delta / count;
    squaredDiff += delta * (goals - goalsMean);
  }
  if (!count) throw Error('No completed matches for requested season');
  const ranges = values => ({ min: Math.min(...values), max: Math.max(...values) });
  const appearances = [...clubAppearances.values()];
  const stdDev = count < 2 ? null : Math.sqrt(squaredDiff / (count - 1));
  const margin = stdDev === null ? null : Z95 * stdDev / Math.sqrt(count);
  return {
    schemaVersion: 1,
    status: 'UNAPPROVED_EXTERNAL_REFERENCE_CANDIDATE_NOT_CALIBRATED',
    rightsStatus: 'UPSTREAM_RIGHTS_NOT_VERIFIED',
    isCompleteSeason: 'NOT_ESTABLISHED',
    source: { url: SOURCE_URL, attributionUrl: ATTRIBUTION_URL,
      sha256: actualHash, bytes: bytes.length },
    leagueId: 235, season, csvRows: records.length,
    finishedMatches: count, exclusions,
    coverage: {
      observedClubCount: clubAppearances.size,
      finishedAppearancesPerClub: ranges(appearances.map(x => x.home + x.away)),
      finishedHomeMatchesPerClub: ranges(appearances.map(x => x.home)),
      finishedAwayMatchesPerClub: ranges(appearances.map(x => x.away)),
      repeatedHomeAwayFixtures,
    },
    goalTotals: { home: homeGoals, away: awayGoals, total: goalsTotal },
    outcomes: { homeWin: wilson(homeWin, count), draw: wilson(draw, count),
      awayWin: wilson(awayWin, count), scoreless: wilson(nilNil, count),
      bothScored: wilson(bothScored, count) },
    goalsPerMatch: { total: goalsTotal, mean: goalsTotal / count,
      sampleStdDev: stdDev, normalMean95: margin === null ? null : {
        lower: goalsMean - margin, upper: goalsMean + margin } },
    unavailableMetrics: ['shots', 'shotsOnTarget', 'xG', 'injuries'],
  };
}

async function main(args) {
  if (args.length !== 3 || !args[0].startsWith('--file=') ||
      !args[1].startsWith('--season=') || !args[2].startsWith('--sha256=')) {
    throw Error('Usage: node scripts/m1-p5-reference-candidate.mjs --file=LOCAL.csv --season=YYYY/YYYY --sha256=64-hex');
  }
  const file = args[0].slice('--file='.length);
  if (!file) throw Error('Empty CSV path');
  const handle = await open(file, 'r');
  let bytes;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size < 1 || info.size > MAX_BYTES) {
      throw Error('Invalid CSV file size');
    }
    bytes = await handle.readFile();
  } finally { await handle.close(); }
  if (bytes.length > MAX_BYTES) throw Error('CSV too large');
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const report = analyzeRplCsvCandidate(decoder.decode(bytes),
    args[1].slice('--season='.length), args[2].slice('--sha256='.length));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(String(error.message ?? error) + '\n');
    process.exitCode = 1;
  });
}
