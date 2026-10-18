#!/usr/bin/env node
/** Offline publisher manifest observation, never a source-rights clearance. */
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 64 * 1024;
const URL = 'https://footbolno.ru/data/index.json';
const DATA_URL = 'https://footbolno.ru/data/league/235-matches.csv';
const TEMPLATE = 'https://footbolno.ru/data/league/{league_id}-matches.csv';
const LICENSE = 'CC BY 4.0';
const REQUIRED = [
  'match_id', 'league_id', 'season', 'status', 'home_id', 'away_id',
  'home_goals', 'away_goals',
];
const obj = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value);
const unique = values => Array.isArray(values) &&
  new Set(values).size === values.length;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * Pure, bounded inspection of a locally acquired manifest. The expected hash
 * is a byte-integrity pin supplied by the caller, NOT upstream authentication.
 */
export function inspectRplSourceManifest(bytes, expectedHash) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 2 ||
      bytes.length > MAX_BYTES) throw Error('Invalid manifest byte size');
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw Error('Invalid SHA-256 pin');
  const actualHash = digest(bytes);
  if (actualHash !== expectedHash) throw Error('Manifest SHA-256 mismatch');
  const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!obj(raw) || raw.source !== 'https://footbolno.ru/' ||
      raw.docs !== 'https://footbolno.ru/otkrytye-dannye' ||
      raw.license !== LICENSE ||
      typeof raw.license_url !== 'string' ||
      !['https://creativecommons.org/licenses/by/4.0/deed.ru',
        'https://creativecommons.org/licenses/by/4.0/'].includes(raw.license_url) ||
      typeof raw.updated !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d:\d\d)$/.test(raw.updated) ||
      !Number.isFinite(Date.parse(raw.updated))) {
    throw Error('Missing or changed publisher license/source declaration');
  }
  if (!Array.isArray(raw.datasets) || raw.datasets.length < 1 ||
      raw.datasets.length > 100) throw Error('Invalid manifest dataset index');
  const leagues = raw.datasets.filter(dataset => obj(dataset) &&
    dataset.name === 'league');
  if (leagues.length !== 1 || leagues[0].csv !== TEMPLATE) {
    throw Error('RPL CSV is not identifiable in publisher manifest');
  }
  if (!obj(raw.fields) || !unique(raw.fields.matches) ||
      raw.fields.matches.length > 64 ||
      raw.fields.matches.some(field => typeof field !== 'string' ||
        field.length < 1 || field.length > 64) ||
      REQUIRED.some(field => !raw.fields.matches.includes(field))) {
    throw Error('Required match fields absent from publisher manifest');
  }
  return {
    schemaVersion: 1,
    status: 'PUBLISHER_LICENSE_CLAIM_NOT_UPSTREAM_RIGHTS_REVIEWED',
    benchmarkApproved: false,
    upstreamRightsVerified: false,
    referenceCompletenessVerified: false,
    source: { url: URL, sha256: actualHash, bytes: bytes.length,
      updatedClaim: raw.updated },
    licenseClaim: { identifier: LICENSE, url: raw.license_url,
      attributionUrl: raw.docs },
    target: { leagueId: 235, csvUrl: DATA_URL,
      advertisedColumns: raw.fields.matches.length },
  };
}

async function main(args) {
  if (args.length !== 2 || !args[0].startsWith('--file=') ||
      !args[1].startsWith('--sha256=')) {
    throw Error('Usage: node scripts/m1-p5-source-manifest.mjs --file=LOCAL.json --sha256=64-hex');
  }
  const file = args[0].slice('--file='.length);
  if (!file) throw Error('Empty manifest path');
  const handle = await open(file, 'r');
  let bytes;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 2 || stat.size > MAX_BYTES) {
      throw Error('Invalid manifest size');
    }
    bytes = await handle.readFile();
  } finally { await handle.close(); }
  const report = inspectRplSourceManifest(bytes,
    args[1].slice('--sha256='.length));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(String(error.message ?? error) + '\n');
    process.exitCode = 1;
  });
}
