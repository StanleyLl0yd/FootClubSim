import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { createInitialCareer } from '../dist/core/save.js';
import { saveNewInitialCareer, loadInitialCareer } from '../dist/browser/initial-career-store.js';

const catalog = createSyntheticRplScaleCatalog(33);
const career = createInitialCareer(catalog, catalog.clubs[0].id, 12, 'test-career');

function makeDatabaseStub() {
  const entries = new Map();
  let closeCount = 0;
  const db = {
    objectStoreNames: { contains: () => true },
    close() { closeCount++; },
    transaction(_store, mode) {
      const tx = { oncomplete: null, onabort: null, onerror: null, objectStore() {
        return {
          add(value, key) {
            assert.equal(mode, 'readwrite');
            const request = { error: null, onerror: null };
            queueMicrotask(() => {
              if (entries.has(key)) {
                request.error = { name: 'ConstraintError' };
                request.onerror?.();
                tx.onabort?.();
              } else {
                entries.set(key, value);
                tx.oncomplete?.();
              }
            });
            return request;
          },
          get(key) {
            assert.equal(mode, 'readonly');
            const request = { result: undefined, onsuccess: null };
            queueMicrotask(() => {
              request.result = entries.get(key);
              request.onsuccess?.();
              tx.oncomplete?.();
            });
            return request;
          },
        };
      } };
      return tx;
    },
  };
  return {
    entries,
    get closeCount() { return closeCount; },
    indexedDB: { open() {
      const request = { result: db, onupgradeneeded: null, onerror: null, onblocked: null, onsuccess: null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    } },
  };
}

test('unavailable IndexedDB does not silently replace a career', async () => {
  const original = globalThis.indexedDB;
  try {
    delete globalThis.indexedDB;
    await assert.rejects(loadInitialCareer(career.careerId), { code: 'UNAVAILABLE' });
    await assert.rejects(saveNewInitialCareer(career), { code: 'UNAVAILABLE' });
  } finally {
    if (original !== undefined) globalThis.indexedDB = original;
  }
});

test('store resolves only after transaction commit; duplicate save never overwrites', async () => {
  const original = globalThis.indexedDB;
  const stub = makeDatabaseStub();
  globalThis.indexedDB = stub.indexedDB;
  try {
    await saveNewInitialCareer(career);
    const written = stub.entries.get(career.careerId);
    assert.equal(typeof written, 'string');
    assert.deepEqual(await loadInitialCareer(career.careerId), career);
    await assert.rejects(saveNewInitialCareer(career), { code: 'DUPLICATE' });
    assert.equal(stub.entries.get(career.careerId), written);
    assert.equal(stub.closeCount, 3);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});

test('missing and tampered records are not returned as valid saves', async () => {
  const original = globalThis.indexedDB;
  const stub = makeDatabaseStub();
  globalThis.indexedDB = stub.indexedDB;
  try {
    await assert.rejects(loadInitialCareer(career.careerId), { code: 'NOT_FOUND' });
    await saveNewInitialCareer(career);
    stub.entries.set(career.careerId, 'corrupt');
    await assert.rejects(loadInitialCareer(career.careerId), { code: 'CORRUPTED' });
    await assert.rejects(loadInitialCareer('   '), { code: 'INVALID_ID' });
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});

test('synchronous transaction, object-store and request failures are typed and close the database', async () => {
  const original = globalThis.indexedDB;
  const unchanged = JSON.stringify(career);
  try {
    for (const fault of ['transaction', 'store', 'request']) {
      let closed = 0;
      const db = {
        objectStoreNames: { contains: () => true },
        close() { closed++; },
        transaction() {
          if (fault === 'transaction') throw new Error('transaction rejected');
          return {
            objectStore() {
              if (fault === 'store') throw new Error('object store unavailable');
              return {
                add() { throw new Error('add rejected'); },
                get() { throw new Error('get rejected'); },
              };
            },
          };
        },
      };
      globalThis.indexedDB = {
        open() {
          const request = {
            result: db, onupgradeneeded: null, onerror: null, onblocked: null, onsuccess: null,
          };
          queueMicrotask(() => request.onsuccess?.());
          return request;
        },
      };
      await assert.rejects(saveNewInitialCareer(career), { code: 'STORAGE_FAILED' });
      await assert.rejects(loadInitialCareer(career.careerId), { code: 'STORAGE_FAILED' });
      assert.equal(closed, 2);
      assert.equal(JSON.stringify(career), unchanged);
    }
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
