import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importM0SyntheticProvenance, syntheticProvenanceMatchesCatalog } from '../dist/core/provenance.js';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';

const json = await readFile(new URL('../data/packs/m0-synthetic-manifest.json', import.meta.url), 'utf8');
const fixture = JSON.parse(json);
const importChange = change => importM0SyntheticProvenance(JSON.stringify({ ...fixture, ...change }));

test('M0 provenance parser validates the authored manifest and matching generated pack', () => {
  const result = importM0SyntheticProvenance(json);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.notStrictEqual(result.value, fixture);
  assert.equal(result.value.manifestSchemaVersion, 1);
  assert.deepEqual(result.value.assetPaths, []);
  const catalog = createSyntheticRplScaleCatalog(result.value.generatorSeed);
  assert.equal(syntheticProvenanceMatchesCatalog(result.value, catalog), true);
  assert.equal(syntheticProvenanceMatchesCatalog(result.value,
    createSyntheticRplScaleCatalog(result.value.generatorSeed + 1)), false);
});

test('invalid versions, oversized JSON and malformed declarations are rejected', () => {
  assert.deepEqual(importM0SyntheticProvenance('{'), { ok: false, error: 'INVALID_JSON' });
  assert.deepEqual(importM0SyntheticProvenance(null), { ok: false, error: 'TOO_LARGE' });
  assert.deepEqual(importM0SyntheticProvenance('x'.repeat(16_385)), { ok: false, error: 'TOO_LARGE' });
  assert.deepEqual(importChange({ manifestSchemaVersion: 2 }),
    { ok: false, error: 'UNSUPPORTED_SCHEMA' });
  assert.deepEqual(importChange({ packVersion: '1-seed-999' }),
    { ok: false, error: 'INVALID_MANIFEST' });
  for (const change of [
    { rightsBasis: 'copied-from-third-party' },
    { containsThirdPartyFootballData: true },
    { containsThirdPartyArtwork: true },
    { assetPaths: ['assets/club.png'] },
    { reviewStatus: 'approved' },
    { generator: '../external/generator.ts' },
    { generatorSeed: 0 },
    { generatorSeed: 1.5 },
    { generatorSeed: 0x1_0000_0000 },
    { declaredAt: '2026-02-30' },
    { declaredAt: '2026-99-99' },
    { catalogSchemaVersion: 2 },
  ]) {
    assert.deepEqual(importChange(change), { ok: false, error: 'INVALID_MANIFEST' });
  }
  assert.deepEqual(importM0SyntheticProvenance(JSON.stringify({ ...fixture, unexpected: 1 })),
    { ok: false, error: 'INVALID_MANIFEST' });
  const { rightsBasis: _removed, ...withoutBasis } = fixture;
  assert.deepEqual(importM0SyntheticProvenance(JSON.stringify(withoutBasis)),
    { ok: false, error: 'INVALID_MANIFEST' });
});
