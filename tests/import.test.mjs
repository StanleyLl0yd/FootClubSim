import test from 'node:test';
import assert from 'node:assert/strict';
import { importSyntheticCatalog } from '../dist/core/import.js';
import { FIELD_ATTRIBUTE_KEYS, GOALKEEPER_ATTRIBUTE_KEYS } from '../dist/core/model.js';

const attributes = Object.fromEntries([...FIELD_ATTRIBUTE_KEYS, ...GOALKEEPER_ATTRIBUTE_KEYS].map(key => [key, 50]));
const player = {
  id: 'fictional-player', displayName: 'Fictional Goalkeeper',
  primaryPosition: 'GK', foreignerForCompetition: false, attributes,
};
const club = {
  id: 'fictional-club', displayName: 'Fictional Club',
  registeredPlayerIds: [player.id],
};
const pack = {
  schemaVersion: 1, source: 'synthetic', packId: 'fictional-2026',
  packVersion: '1', players: [player], clubs: [club],
};

test('import accepts bounded valid synthetic JSON', () => {
  const result = importSyntheticCatalog(JSON.stringify(pack));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.clubs, pack.clubs);
});
test('import rejects invalid JSON and unsupported schema', () => {
  assert.deepEqual(importSyntheticCatalog('{'), { ok: false, error: 'INVALID_JSON' });
  assert.deepEqual(importSyntheticCatalog(JSON.stringify({ ...pack, schemaVersion: 2 })), { ok: false, error: 'INVALID_SCHEMA' });
  assert.deepEqual(importSyntheticCatalog(JSON.stringify({ ...pack, source: 'unauthorized' })), { ok: false, error: 'INVALID_SCHEMA' });
});
test('import rejects incomplete attributes and bad references', () => {
  assert.deepEqual(importSyntheticCatalog(JSON.stringify({ ...pack, players: [{ ...player, attributes: {} }] })), { ok: false, error: 'INVALID_DATA' });
  assert.deepEqual(importSyntheticCatalog(JSON.stringify({ ...pack, clubs: [{ ...club, registeredPlayerIds: ['nonexistent'] }] })), { ok: false, error: 'INVALID_DATA' });
});
test('import caps payload size and collection count', () => {
  assert.deepEqual(importSyntheticCatalog(' '.repeat(4_000_001)), { ok: false, error: 'TOO_LARGE' });
  assert.deepEqual(importSyntheticCatalog(JSON.stringify({ ...pack, clubs: Array(65).fill(club) })), { ok: false, error: 'INVALID_DATA' });
  assert.deepEqual(importSyntheticCatalog(JSON.stringify({ ...pack, clubs: [{ ...club, registeredPlayerIds: Array(129).fill(player.id) }] })), { ok: false, error: 'INVALID_DATA' });
});
