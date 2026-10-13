import test from 'node:test';
import assert from 'node:assert/strict';
import { isStableId } from '../dist/core/identifiers.js';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { importSyntheticCatalog } from '../dist/core/import.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { validateDoubleRoundRobin } from '../dist/core/fixture-validation.js';
import { createInitialCareer } from '../dist/core/save.js';

test('stable identifiers preserve existing user-generated catalog and career IDs', () => {
  for (const value of ['fictional-rpl-scale', '1-seed-2026', 'fictional-1-player-23', 'm0-ui-initial-career', 'a:b/2.v3']) {
    assert.equal(isStableId(value), true, value);
  }
});

test('blank, misleading, oversized and control-containing identifiers are uniformly rejected', () => {
  const bad = ['', ' ', 'a b', ' a', 'a ', 'a\t', 'a\n', 'a\r', 'a\u0000b', 'a\u202eb', 'a\u2066b', 'x'.repeat(129), null, 123, {}, []];
  for (const value of bad) assert.equal(isStableId(value), false, JSON.stringify(value));
});

test('synthetic import and fixture validation enforce the same identifier contract', () => {
  const pack = createSyntheticRplScaleCatalog(5);
  const changed = {
    ...pack, clubs: [{ ...pack.clubs[0], id: 'fictional-1\n' }, ...pack.clubs.slice(1)],
  };
  assert.deepEqual(importSyntheticCatalog(JSON.stringify(changed)), { ok: false, error: 'INVALID_DATA' });
  const ids = pack.clubs.map(club => club.id);
  assert.throws(() => generateDoubleRoundRobin([ids[0], 'bad\tid']), RangeError);
  assert.ok(validateDoubleRoundRobin(generateDoubleRoundRobin(ids), [...ids.slice(0, 15), 'bad\nid']).length);
  assert.throws(() => createInitialCareer(pack, pack.clubs[0].id, 11, ' invalid'), RangeError);
});
