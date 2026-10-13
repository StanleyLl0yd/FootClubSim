import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { validateCatalog, validateLineup } from '../dist/core/validation.js';
import { importSyntheticCatalog } from '../dist/core/import.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';

test('seeded 16-club pack is reproducible and passes import', () => {
  const pack = createSyntheticRplScaleCatalog(123);
  assert.equal(pack.clubs.length, 16);
  assert.equal(pack.players.length, 368);
  assert.deepEqual(validateCatalog(pack), []);
  assert.deepEqual(createSyntheticRplScaleCatalog(123), pack);
  assert.notDeepEqual(createSyntheticRplScaleCatalog(124), pack);
  assert.equal(pack.packVersion, '1-seed-123');
  assert.equal(createSyntheticRplScaleCatalog(123).packVersion, pack.packVersion);
  assert.notEqual(createSyntheticRplScaleCatalog(124).packVersion, pack.packVersion);
  assert.equal(importSyntheticCatalog(JSON.stringify(pack)).ok, true);
});
test('fictional squads generate valid default lineups', () => {
  const pack = createSyntheticRplScaleCatalog(8);
  const byId = new Map(pack.players.map(p => [p.id, p]));
  for (const club of pack.clubs) {
    assert.deepEqual(validateLineup(defaultSyntheticLineup(club), club, byId,
      { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 }), []);
  }
  assert.equal(generateDoubleRoundRobin(pack.clubs.map(c => c.id)).length, 30);
});
