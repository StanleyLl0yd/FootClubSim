import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const cli = 'scripts/m1-v24-causal-corpus.mjs';
const run = (start = 1, count = 12, fixtures = 1) =>
  JSON.parse(execFileSync(process.execPath, [
    cli, '--start=' + start, '--count=' + count,
    '--fixtures=' + fixtures,
  ], {encoding: 'utf8', timeout: 30000}));

test('v24 causal seeded corpus is deterministic and source-verifiable', () => {
  const a = run();
  const b = run();
  assert.deepEqual(a, b);
  assert.equal(a.schemaVersion, 2);
  assert.equal(a.start, 1);
  assert.equal(a.count, 12);
  assert.equal(a.fixtureCount, 1);
  assert.equal(a.totalMatches, 12);
  assert.equal(a.fixtureSummaries.length, 1);
  assert.equal(a.accepted + a.rejected, a.totalMatches);
  assert.ok(a.accepted >= 1);
  assert.equal(a.realFootballReferenceSample, false);
  assert.equal(a.syntheticFoulAndMedicalRatesCalibrated, false);
  assert.equal(a.externalRefereeAndMedicalAuthorityAuthenticated, false);
  assert.match(a.deterministicSha256, /^[0-9a-f]{64}$/);
  assert.equal(a.assessedReturns, a.temporaryAssessments);
  assert.ok(a.totalExposurePlayerSeconds >= 14 * 5400 * a.accepted);
  assert.ok(a.totalExposurePlayerSeconds <= 22 * 5400 * a.accepted);
  assert.equal(Object.values(a.rejectionReasons)
    .reduce((n,v) => n + v, 0), a.rejected);
});

test('shifted pinned seeds change the deterministic evidence digest', () => {
  const first = run(1, 6);
  const second = run(21, 6);
  assert.notEqual(first.deterministicSha256, second.deterministicSha256);
  assert.equal(first.count, second.count);
  assert.equal(first.realFootballReferenceSample, false);
});

test('multi-fixture cohort has independent fixture coverage and replay fingerprint', () => {
  const a = run(1, 4, 3);
  assert.deepEqual(a, run(1, 4, 3));
  assert.equal(a.fixtureCount, 3);
  assert.equal(a.totalMatches, 12);
  assert.equal(a.fixtureSummaries.length, 3);
  assert.equal(new Set(a.fixtureSummaries.map(x => x.fixtureId)).size, 3);
  assert.equal(a.accepted + a.rejected, a.totalMatches);
  for (const entry of a.fixtureSummaries) {
    assert.equal(entry.accepted + entry.rejected, 4);
    assert.ok(entry.accepted > 0);
  }
  assert.notEqual(a.deterministicSha256, run(1, 4, 1).deterministicSha256);
  assert.equal(a.realFootballReferenceSample, false);
  assert.equal(a.externalRefereeAndMedicalAuthorityAuthenticated, false);
});

test('argument abuse and out-of-range seeds fail without a fabricated result', () => {
  for (const args of [
    ['--start=0'], ['--count=0'], ['--count=129'],
    ['--start=4294967296'], ['--start=4294967295','--count=2'],
    ['--start=NaN'], ['--count=-1'], ['--count=1.5'],
    ['--count=1','--count=2'], ['--bogus=1'], ['1'],
    ['--count'], ['--fixtures'], ['--fixtures=0'],
    ['--fixtures=33'], ['--fixtures=NaN'],
    ['--fixtures=1','--fixtures=2'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      encoding:'utf8',timeout:30000,
    });
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.equal(result.stdout, '', JSON.stringify(args));
    assert.match(result.stderr, /M1_V24_CORPUS_ERROR:/);
  }
});
