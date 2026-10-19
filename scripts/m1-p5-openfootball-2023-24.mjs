#!/usr/bin/env node
/**
 * Exact-source 2023/24 research observation. A single wrong home/away
 * fixture in the upstream text is corrected ONLY in transient memory.
 * Never overwrite, mirror, bundle or relicense the original data.
 */
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inspectOpenFootballRplSeason } from './m1-p5-openfootball-rpl.mjs';

export const OPENFOOTBALL_RPL_2023_24 = Object.freeze({
  repo: 'openfootball/europe',
  commit: '63df627f3c87ce71708f016522ea236cf74332c3',
  blobSha1: '3ea6829a971d1cbdf56552be0519cc125707bd99',
  sha256: '18512df8829a945f2b543a8ed5e8c3259e216263bc3e2a35c5545421d27b59cc',
  path: 'russia/2023-24_ru1.txt',
  licenseClaim: 'CC0-1.0',
});
const OLD_ROW = '    19:00  FK Sochi                v Spartak Moskva           0-1 (0-0)';
const VERIFIED_ROW =
  '    19:00  Spartak Moskva           v FK Sochi                1-0 (0-0)';
const KNOWN_COUNTS = Object.freeze({
  finishedMatches: 240, homeWins: 113, draws: 66, awayWins: 61,
  scoreless: 20, homeGoals: 359, awayGoals: 278,
  totalGoals: 637, observedClubCount: 16,
});
const SOURCE_LIMIT = 131_072;

/**
 * Deterministic research-only transform; the accepting entrypoint enforces
 * the immutable SHA-256 BEFORE calling it. Never publish its derived rows.
 */
export function rewriteOneDocumented2023Fixture(source) {
  const pieces = source.split(OLD_ROW);
  const first = source.indexOf('▪ Matchday 8');
  const next = source.indexOf('▪ Matchday 9');
  const lineStart = source.indexOf(OLD_ROW);
  if (pieces.length !== 2 || first < 0 || next <= first ||
      lineStart < first || lineStart >= next ||
      !source.slice(first, lineStart).includes('Sat Sep 16')) {
    throw Error('Single verified matchday-8 correction was not applicable');
  }
  return pieces.join(VERIFIED_ROW);
}

export function inspectPinned2023RplTrainingCandidate(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 100 ||
      bytes.length > SOURCE_LIMIT) throw Error('Invalid source byte length');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== OPENFOOTBALL_RPL_2023_24.sha256) {
    throw Error('Pinned RPL 2023/24 source SHA-256 mismatch');
  }
  const original = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const repaired = rewriteOneDocumented2023Fixture(original);
  const report = inspectOpenFootballRplSeason(repaired, '2023/2024');
  for (const [key, count] of Object.entries(KNOWN_COUNTS)) {
    if (report.observed[key] !== count) {
      throw Error('Corrected 2023/24 reference disagrees: ' + key);
    }
  }
  return {
    schemaVersion: 1,
    status: 'ONE_EVIDENCE_BOUND_FIX_NOT_CALIBRATED',
    sourceRightsStatus: 'PUBLISHER_CC0_CLAIM_UPSTREAM_NOT_VERIFIED',
    primarySourceEvidenceStatus: 'ONE_CORRECTION_CONFIRMED_BY_RFU_AND_CLUB',
    referenceApproved: false,
    modelTuned: false,
    trainingSeason: '2023/2024',
    reservedUntouchedHoldoutSeason: '2024/2025',
    source: { ...OPENFOOTBALL_RPL_2023_24,
      sha256, bytes: bytes.length },
    correction: {
      count: 1, matchday: 8, matchDate: '2023-09-16',
      originalHome: 'FK Sochi', originalAway: 'Spartak Moskva',
      originalScore: '0-1',
      correctedHome: 'Spartak Moskva', correctedAway: 'FK Sochi',
      correctedScore: '1-0',
      rfUCalendar: 'https://www.rfs.ru/tournament/1434/calendar?round_id=18568',
      clubAnnouncement: 'https://pfcsochi.ru/news/2023-2024/rfs-i-rpl-soglasovali-perenos-matchey-mezhdu-sochi-i-spartakom/',
    },
    observed: report.observed,
    sourceBytesModified: false,
    inMemoryDerivedViewOnly: true,
    unavailableMetrics: ['shots', 'shotsOnTarget', 'xG', 'cards', 'injuries'],
  };
}

async function main(args) {
  if (args.length !== 1 || !args[0].startsWith('--file=') ||
      !args[0].slice('--file='.length)) {
    throw Error('Usage: node scripts/m1-p5-openfootball-2023-24.mjs --file=LOCAL_SOURCE.txt');
  }
  const path = args[0].slice('--file='.length);
  const handle = await open(path, 'r');
  let bytes;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 100 || stat.size > SOURCE_LIMIT) {
      throw Error('Invalid source file size');
    }
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  process.stdout.write(JSON.stringify(inspectPinned2023RplTrainingCandidate(bytes),
    null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(String(error.message ?? error) + '\n');
    process.exitCode = 1;
  });
}
