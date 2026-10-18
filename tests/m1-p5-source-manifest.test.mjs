import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectRplSourceManifest }
  from '../scripts/m1-p5-source-manifest.mjs';

const sample = () => ({
  name: 'Russian football data',
  source: 'https://footbolno.ru/',
  docs: 'https://footbolno.ru/otkrytye-dannye',
  license: 'CC BY 4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/deed.ru',
  updated: '2026-10-17T19:06:32+00:00',
  datasets: [{ name: 'teams', csv: 'https://footbolno.ru/data/teams.csv' },
    { name: 'league', json: 'https://footbolno.ru/data/league/{league_id}.json',
      csv: 'https://footbolno.ru/data/league/{league_id}-matches.csv' }],
  fields: { matches: [
    'match_id', 'league_id', 'league', 'season', 'date_utc', 'status',
    'home_id', 'away_id', 'home_goals', 'away_goals', 'venue',
  ] },
});
const serialize = source => Buffer.from(JSON.stringify(source), 'utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inspect = source => {
  const bytes = serialize(source);
  return inspectRplSourceManifest(bytes, hash(bytes));
};

test('pinned publisher manifest describes rights CLAIM without approving upstream data', () => {
  const report = inspect(sample());
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.status,
    'PUBLISHER_LICENSE_CLAIM_NOT_UPSTREAM_RIGHTS_REVIEWED');
  assert.equal(report.benchmarkApproved, false);
  assert.equal(report.upstreamRightsVerified, false);
  assert.equal(report.referenceCompletenessVerified, false);
  assert.equal(report.licenseClaim.identifier, 'CC BY 4.0');
  assert.equal(report.source.updatedClaim, '2026-10-17T19:06:32+00:00');
  assert.equal(report.target.csvUrl,
    'https://footbolno.ru/data/league/235-matches.csv');
  assert.equal(report.target.advertisedColumns, 11);
  assert.equal(JSON.stringify(report).includes('teams.csv'), false);
  const next = sample();
  next.license_url = 'https://creativecommons.org/licenses/by/4.0/';
  assert.equal(inspect(next).upstreamRightsVerified, false);
});

test('changed license, source address, dataset, columns and timestamps fail closed', () => {
  const changes = [
    x => { x.license = 'All rights reserved'; },
    x => { x.license = 'CC0'; },
    x => { x.license_url = 'https://creativecommons.org/licenses/by-sa/4.0/'; },
    x => { x.license_url = 'http://creativecommons.org/licenses/by/4.0/'; },
    x => { x.source = 'https://other.example/'; },
    x => { x.docs = 'https://other.example/rights'; },
    x => { x.updated = 'today'; },
    x => { x.updated = '2026-10-17T19:06:32'; },
    x => { x.datasets[1].csv = 'https://evil.example/235-matches.csv'; },
    x => { x.datasets.push({ ...x.datasets[1] }); },
    x => { x.datasets = []; },
    x => { x.fields.matches = x.fields.matches.filter(n => n !== 'home_goals'); },
    x => { x.fields.matches.push('season'); },
    x => { x.fields.matches[0] = ''; },
    x => { x.fields.matches = null; },
    x => { delete x.fields; },
  ];
  for (const [index, modify] of changes.entries()) {
    const s = sample();
    modify(s);
    assert.throws(() => inspect(s), undefined, 'changed manifest ' + index);
  }
});

test('unpinned or invalid UTF-8 bytes cannot masquerade as published declarations', () => {
  const bytes = serialize(sample());
  assert.throws(() => inspectRplSourceManifest(bytes, '0'.repeat(64)),
    /SHA-256 mismatch/);
  assert.throws(() => inspectRplSourceManifest(bytes, 'NOT_A_HASH'),
    /SHA-256 pin/);
  assert.throws(() => inspectRplSourceManifest(Buffer.alloc(70 * 1024),
    '0'.repeat(64)), /byte size/);
  const invalid = Buffer.from([0xff, 0xfe, 0x00]);
  assert.throws(() => inspectRplSourceManifest(invalid, hash(invalid)));
  const broken = Buffer.from('{"license":', 'utf8');
  assert.throws(() => inspectRplSourceManifest(broken, hash(broken)));
});

test('offline CLI uses local JSON only and does not print source rows or file path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fcs-license-manifest-'));
  const path = join(dir, 'publisher-claims.json');
  try {
    const data = serialize(sample());
    writeFileSync(path, data);
    const cli = 'scripts/m1-p5-source-manifest.mjs';
    const run = (...args) => spawnSync(process.execPath, [cli, ...args],
      { cwd: process.cwd(), encoding: 'utf8' });
    const good = run('--file=' + path, '--sha256=' + hash(data));
    assert.equal(good.status, 0, good.stderr);
    const report = JSON.parse(good.stdout);
    assert.equal(report.status,
      'PUBLISHER_LICENSE_CLAIM_NOT_UPSTREAM_RIGHTS_REVIEWED');
    assert.equal(good.stdout.includes(path), false);
    assert.equal(good.stdout.includes('home_goals'), false);
    for (const rejected of [
      run('--file=' + path),
      run('--sha256=' + hash(data), '--file=' + path),
      run('--file=' + path, '--sha256=' + '0'.repeat(64)),
      run('--file=' + path, '--sha256=' + hash(data), '--fetch'),
    ]) {
      assert.notEqual(rejected.status, 0);
      assert.equal(rejected.stdout, '');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
