#!/usr/bin/env node
/**
 * Research-only, pinned CC0-publisher-claimed RPL 2024/25 score distribution.
 * Never imports raw third-party teams into game packs or approves calibration.
 */
import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const OPENFOOTBALL_RPL_2024_25 = Object.freeze({
  repo: 'openfootball/europe',
  commit: '63df627f3c87ce71708f016522ea236cf74332c3',
  blobSha1: '6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc',
  sha256: 'f315f67d49e5f2ed26bb5b2504244f36d37be958b5ccadd1755fb6b71b015dcb',
  path: 'russia/2024-25_ru1.txt',
  license: 'CC0-1.0',
});
const MAX_SOURCE_BYTES = 131_072;
const SEASON_HEADERS = Object.freeze({
  '2023/2024': '= Russia Premier League 2023/24',
  '2024/2025': '= Russia Premier League 2024/25',
});
const ROUND = /^\s*▪\s*Matchday\s+(\d+)\s*$/;
const RESULT = /^\s*(?:(?:[01]?\d|2[0-3]):[0-5]\d\s+)?(.+?)\s{2,}v\s+(.+?)\s{2,}(\d+)-(\d+)(?:\s+\((\d+)-(\d+)\))?\s*$/;
const METRICS = [
  'finishedMatches', 'homeWins', 'draws', 'awayWins', 'scoreless',
  'homeGoals', 'awayGoals', 'totalGoals', 'observedClubCount',
];

export function inspectOpenFootballRplSeason(source, season) {
  const header = Object.hasOwn(SEASON_HEADERS, season) ?
    SEASON_HEADERS[season] : null;
  if (header === null || typeof source !== 'string' || source.length < 100 ||
      Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES ||
      !source.startsWith(header + '\r\n') &&
        !source.startsWith(header + '\n')) {
    throw Error('Invalid RPL season header or size');
  }
  const seen = new Set(), teams = new Set();
  const rounds = new Map();
  let currentRound = 0;
  const observed = {
    finishedMatches: 0, homeWins: 0, draws: 0, awayWins: 0,
    scoreless: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0,
    observedClubCount: 0,
  };
  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(ROUND);
    if (heading) {
      const round = Number(heading[1]);
      if (round !== currentRound + 1 || round > 30) {
        throw Error('Invalid or repeated matchday order');
      }
      currentRound = round;
      rounds.set(round, { matches: 0, teams: new Set() });
      continue;
    }
    const match = line.match(RESULT);
    if (!match) {
      if (/\s+v\s+/.test(line) || /^\s*\d{1,2}:\d\d\s/.test(line)) {
        throw Error('Unparseable match row');
      }
      continue;
    }
    if (currentRound === 0) throw Error('Match before first matchday');
    const home = match[1].trim(), away = match[2].trim();
    const hg = Number(match[3]), ag = Number(match[4]);
    if (home.length < 2 || home.length > 80 ||
        away.length < 2 || away.length > 80 || home === away ||
        !Number.isSafeInteger(hg) || !Number.isSafeInteger(ag) ||
        hg > 20 || ag > 20) throw Error('Invalid match identity or goals');
    if (match[5] !== undefined) {
      const hh = Number(match[5]), ah = Number(match[6]);
      if (hh > hg || ah > ag) throw Error('Half-time score exceeds full-time');
    }
    const pair = home + '\u0000' + away;
    if (seen.has(pair)) throw Error('Duplicate home-away fixture');
    const round = rounds.get(currentRound);
    if (round.teams.has(home) || round.teams.has(away) ||
        round.matches >= 8) throw Error('Invalid round participant schedule');
    seen.add(pair);teams.add(home);teams.add(away);
    round.teams.add(home);round.teams.add(away);round.matches++;
    observed.finishedMatches++;
    observed.homeGoals += hg;observed.awayGoals += ag;
    observed.totalGoals += hg + ag;
    if (hg > ag) observed.homeWins++;
    else if (hg < ag) observed.awayWins++;
    else observed.draws++;
    if (hg === 0 && ag === 0) observed.scoreless++;
  }
  if (rounds.size !== 30 || observed.finishedMatches !== 240 ||
      teams.size !== 16 || seen.size !== 240 ||
      [...rounds.values()].some(x => x.matches !== 8 || x.teams.size !== 16)) {
    throw Error('Incomplete 16-team double round robin');
  }
  for (const home of teams) for (const away of teams) {
    if (home !== away && !seen.has(home + '\u0000' + away)) {
      throw Error('Missing home-away fixture');
    }
  }
  observed.observedClubCount = teams.size;
  return { schemaVersion: 1, season, observed };
}

/** Preserves the original locked 2024/25 inspection interface. */
export function inspectOpenFootballRpl2024Season(source) {
  return inspectOpenFootballRplSeason(source, '2024/2025');
}

/**
 * Exact source hash proves reproducibility, not upstream rights or factual truth.
 * No names, dates or raw match rows are emitted.
 */
export function inspectPinnedOpenFootballRpl(bytes, published) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 100 ||
      bytes.length > MAX_SOURCE_BYTES) throw Error('Invalid source bytes');
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== OPENFOOTBALL_RPL_2024_25.sha256) {
    throw Error('Pinned OpenFootball SHA-256 mismatch');
  }
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const { observed } = inspectOpenFootballRpl2024Season(source);
  if (published?.schemaVersion !== 1 ||
      published.kind !== 'UNAPPROVED_PUBLISHED_AGGREGATE_CROSSCHECK' ||
      published.season !== '2024/2025' ||
      published.rightsStatus !== 'NOT_REVIEWED' ||
      published.sourceIndependence !== 'NOT_ESTABLISHED' ||
      METRICS.some(key => !Number.isSafeInteger(published.observed?.[key]))) {
    throw Error('Unreviewed published-aggregate baseline missing or changed');
  }
  const differences = METRICS.filter(key =>
    observed[key] !== published.observed[key]);
  return {
    schemaVersion: 1,
    status: 'SOURCE_PINNED_CC0_CLAIM_NOT_CALIBRATED',
    referenceApproved: false,
    upstreamRightsVerified: false,
    primaryMatchByMatchVerified: false,
    sourceIndependenceVerified: false,
    publisherLicenseClaim: OPENFOOTBALL_RPL_2024_25.license,
    source: { repository: OPENFOOTBALL_RPL_2024_25.repo,
      commit: OPENFOOTBALL_RPL_2024_25.commit,
      path: OPENFOOTBALL_RPL_2024_25.path,
      sha256: actualHash, bytes: bytes.length },
    observed,
    publishedAggregateComparison: {
      matched: differences.length === 0, differentMetrics: differences,
      sourcesIndependenceClaimed: false,
    },
    unavailableReferenceMetrics: ['shots', 'shotsOnTarget', 'xG', 'injuries',
      'refereeDecisions', 'cardEvents'],
  };
}

async function main(args) {
  if (args.length !== 1 || !args[0].startsWith('--file=') ||
      !args[0].slice('--file='.length)) {
    throw Error('Usage: node scripts/m1-p5-openfootball-rpl.mjs --file=PINNED_LOCAL.txt');
  }
  const file = args[0].slice('--file='.length);
  const handle = await open(file, 'r');
  let bytes;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 100 || stat.size > MAX_SOURCE_BYTES) {
      throw Error('Invalid source file size');
    }
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  const published = JSON.parse(await readFile(
    new URL('../data/rpl-2024-25-published-aggregate-research.json', import.meta.url), 'utf8'));
  process.stdout.write(JSON.stringify(inspectPinnedOpenFootballRpl(bytes,
    published), null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(String(error.message ?? error) + '\n');
    process.exitCode = 1;
  });
}
