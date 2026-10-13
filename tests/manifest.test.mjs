import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { importSyntheticCatalog } from '../dist/core/import.js';

const path = new URL('../data/packs/m0-synthetic-manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(path, 'utf8'));

test('declared synthetic pack provenance matches the actual seeded catalog', () => {
  const catalog = createSyntheticRplScaleCatalog(manifest.generatorSeed);
  assert.equal(manifest.manifestSchemaVersion, 1);
  assert.equal(manifest.catalogSchemaVersion, catalog.schemaVersion);
  assert.equal(manifest.packId, catalog.packId);
  assert.equal(manifest.packVersion, catalog.packVersion);
  assert.equal(manifest.generator, 'src/core/synthetic.ts');
  assert.equal(manifest.rightsBasis, 'project-authored-synthetic');
  assert.equal(manifest.containsThirdPartyFootballData, false);
  assert.equal(manifest.containsThirdPartyArtwork, false);
  assert.deepEqual(manifest.assetPaths, []);
  assert.equal(manifest.reviewStatus, 'synthetic-only');
  assert.equal(catalog.clubs.length, 16);
  assert.equal(catalog.players.length, 368);
  assert.equal(importSyntheticCatalog(JSON.stringify(catalog)).ok, true);
});

test('the provenance declaration does not misidentify another seeded dataset', () => {
  const different = createSyntheticRplScaleCatalog(manifest.generatorSeed + 1);
  assert.notEqual(manifest.packVersion, different.packVersion);
  assert.equal(manifest.packId, different.packId);
  assert.match(manifest.declaredAt, /^\d{4}-\d{2}-\d{2}$/);
});
