import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { createInitialCareer, exportInitialCareer, importInitialCareer } from '../dist/core/save.js';

const catalog = createSyntheticRplScaleCatalog(31);
const club = catalog.clubs[0].id;
const make = () => createInitialCareer(catalog, club, 42, 'career-1');

test('initial career has independent catalog snapshot and deterministic export', async () => {
  const original = make();
  assert.notStrictEqual(original.catalog, catalog);
  assert.equal(original.catalog.players.length, 368);
  assert.equal(original.revision, 0);
  assert.equal(original.engineVersion, '0');
  const first = await exportInitialCareer(original);
  assert.equal(await exportInitialCareer(make()), first);
  const result = await importInitialCareer(first);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, original);
    assert.notStrictEqual(result.value.catalog, original.catalog);
    assert.equal(result.value.selectedClubId, club);
  }
});

test('bad seed, career ID and selected club cannot produce a career', () => {
  assert.throws(() => createInitialCareer(catalog, club, 0, 'career-1'), RangeError);
  assert.throws(() => createInitialCareer(catalog, 'unknown-club', 1, 'career-1'), RangeError);
  assert.throws(() => createInitialCareer(catalog, club, 1, ' '), RangeError);
});

test('tampering with a valid save is detected before parsing its inner payload', async () => {
  const envelope = JSON.parse(await exportInitialCareer(make()));
  const changed = { ...envelope, payload: envelope.payload.replace('fictional-1', 'fictional-X') };
  assert.deepEqual(await importInitialCareer(JSON.stringify(changed)), { ok: false, error: 'INTEGRITY_ERROR' });
  assert.deepEqual(await importInitialCareer(JSON.stringify({ ...envelope, checksum: 'z'.repeat(64) })),
    { ok: false, error: 'INVALID_FORMAT' });
});

test('unrecognized schema and invalid references are rejected even with a correct checksum', async () => {
  const envelope = JSON.parse(await exportInitialCareer(make()));
  async function replacePayload(change) {
    const payload = JSON.stringify(change(JSON.parse(envelope.payload)));
    const bytes = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return JSON.stringify({
      ...envelope, payload,
      checksum: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''),
    });
  }
  assert.deepEqual(await importInitialCareer(await replacePayload(s => ({ ...s, saveSchemaVersion: 2 }))),
    { ok: false, error: 'UNSUPPORTED_VERSION' });
  assert.deepEqual(await importInitialCareer(await replacePayload(s => ({ ...s, selectedClubId: 'missing' }))),
    { ok: false, error: 'INVALID_DATA' });
  assert.deepEqual(await importInitialCareer(await replacePayload(s => ({ ...s, revision: 1 }))),
    { ok: false, error: 'INVALID_DATA' });
  assert.deepEqual(await importInitialCareer(await replacePayload(s => ({ ...s, rngState: 0 }))),
    { ok: false, error: 'INVALID_DATA' });
  assert.deepEqual(await importInitialCareer(await replacePayload(s => ({ ...s, basePackVersion: 'unrelated' }))),
    { ok: false, error: 'INVALID_DATA' });
});

test('malformed, oversized and alien save envelopes fail without side effects', async () => {
  assert.deepEqual(await importInitialCareer('{'), { ok: false, error: 'INVALID_JSON' });
  assert.deepEqual(await importInitialCareer(' '.repeat(5_000_001)), { ok: false, error: 'TOO_LARGE' });
  assert.deepEqual(await importInitialCareer('{"format":"other"}'), { ok: false, error: 'INVALID_FORMAT' });
  const valid = JSON.parse(await exportInitialCareer(make()));
  assert.deepEqual(await importInitialCareer(JSON.stringify({ ...valid, payload: ' '.repeat(4_500_001) })),
    { ok: false, error: 'TOO_LARGE' });
  assert.deepEqual(await importInitialCareer(JSON.stringify({ ...valid, unexpected: true })),
    { ok: false, error: 'INVALID_FORMAT' });
});

test('export rejects tampered typed values rather than signing them', async () => {
  const original = make();
  await assert.rejects(exportInitialCareer({ ...original, selectedClubId: 'unknown' }), RangeError);
  await assert.rejects(exportInitialCareer({ ...original, catalog: { ...catalog, clubs: [] } }), RangeError);
});
