import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createM1V8PersistedJournal, loadM1V8PersistedJournal,
  commitM1V8PersistedBatch,
} from '../dist/browser/m1-v8-journal-store.js';
import { saveNewInitialCareer } from '../dist/browser/initial-career-store.js';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { simulateM1V8Phases } from '../dist/core/m1-v8-medical-phases.js';

// Minimal asynchronous IndexedDB model: transactions on the same DB serialize,
// writes are staged and committed only on transaction completion.
function fakeIndexedDB() {
  const spaces = new Map();
  const pending = new Map();
  let quotaPut = false;
  function space(dbName, storeName) {
    if (!spaces.has(dbName)) spaces.set(dbName, new Map());
    const stores = spaces.get(dbName);
    if (!stores.has(storeName)) stores.set(storeName, new Map());
    return stores.get(storeName);
  }
  function db(name) {
    const stores = spaces.get(name) ?? new Map();
    spaces.set(name, stores);
    return {
      objectStoreNames: { contains(key) { return stores.has(key); } },
      createObjectStore(key) {
        if (stores.has(key)) throw new Error('already exists');
        stores.set(key, new Map());
      },
      close() {},
      transaction(storeName, mode) {
        if (!stores.has(storeName)) throw new Error('store unavailable');
        const queue = pending.get(name) ?? [];
        pending.set(name, queue);
        const operations = [];
        let staged, done = false, aborted = false;
        const tx = {
          error: null, oncomplete: null, onabort: null, onerror: null,
          abort() { if (done) throw new Error('transaction inactive'); aborted = true; },
          objectStore(key) {
            if (key !== storeName) throw new Error('wrong store');
            function request(kind, value, id) {
              if (mode !== 'readwrite' && kind !== 'get') throw new Error('readonly');
              const req = { result: undefined, error: null, onsuccess: null, onerror: null };
              operations.push({ kind, value: kind === 'get' ? undefined :
                structuredClone(value), id, req });
              return req;
            }
            return {
              get(id) { return request('get', null, id); },
              add(value, id) { return request('add', value, id); },
              put(value, id) { return request('put', value, id); },
            };
          },
        };
        const context = { start };
        function finish(success) {
          if (done) return;
          done = true;
          if (success) {
            spaces.get(name).set(storeName, staged);
            tx.oncomplete?.();
          } else tx.onabort?.();
          assert.equal(queue.shift(), context);
          if (queue.length) queueMicrotask(queue[0].start);
        }
        function drain() {
          if (aborted) { finish(false); return; }
          const op = operations.shift();
          if (!op) { finish(true); return; }
          let failure = null;
          if (op.kind === 'get') {
            op.req.result = staged.has(op.id) ? structuredClone(staged.get(op.id)) :
              undefined;
          } else if (op.kind === 'add' && staged.has(op.id)) {
            failure = 'ConstraintError';
          } else if (op.kind === 'put' && quotaPut) {
            failure = 'QuotaExceededError';
          } else staged.set(op.id, structuredClone(op.value));
          if (failure) {
            op.req.error = { name: failure };
            tx.error = { name: failure };
            op.req.onerror?.();
            aborted = true;
          } else op.req.onsuccess?.();
          queueMicrotask(drain);
        }
        function start() {
          staged = new Map([...space(name, storeName)].map(([key, value]) =>
            [key, structuredClone(value)]));
          queueMicrotask(drain);
        }
        queue.push(context);
        if (queue.length === 1) queueMicrotask(start);
        return tx;
      },
    };
  }
  return {
    entries(dbName, storeName) { return space(dbName, storeName); },
    setQuotaPut(value) { quotaPut = value; },
    indexedDB: { open(name) {
      const request = {
        result: db(name), error: null, onupgradeneeded: null,
        onerror: null, onblocked: null, onsuccess: null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    } },
  };
}
const catalog = createSyntheticRplScaleCatalog(71);
const career = createInitialCareer(catalog, catalog.clubs[0].id, 19, 'm1-v8-persist');
const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
  .flatMap(r => r.fixtures);
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
function matchRequest(fixture, revision, commandId, seed = 19) {
  const prematch = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog,
    homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
  };
  const result = simulateM1V8Phases(prematch, policy, [], []);
  assert.equal(result.ok, true);
  return {
    schemaVersion: 4, commandId, careerId: career.careerId,
    expectedRevision: revision, prematch, policy,
    plannedCommands: [], trustedDecisions: [], medicalActions: [], result,
  };
}
async function withStorage(callback) {
  const prior = globalThis.indexedDB;
  const mock = fakeIndexedDB();
  globalThis.indexedDB = mock.indexedDB;
  try {
    await saveNewInitialCareer(career);
    return await callback(mock);
  } finally {
    if (prior === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = prior;
  }
}

test('isolated v8 initialization is add-only; saved result persists after reload', async () => {
  await withStorage(async () => {
    await assert.rejects(loadM1V8PersistedJournal(career.careerId),
      { code: 'NOT_FOUND' });
    const started = await createM1V8PersistedJournal(career.careerId);
    assert.equal(started.revision, 0);
    await assert.rejects(createM1V8PersistedJournal(career.careerId),
      { code: 'ALREADY_EXISTS' });
    const req = matchRequest(fixtures[0], 0, 'persist-1');
    const committed = await commitM1V8PersistedBatch(career.careerId, 0, [req]);
    assert.equal(committed.revision, 1);
    assert.deepEqual(await loadM1V8PersistedJournal(career.careerId), committed);
    await assert.rejects(commitM1V8PersistedBatch(career.careerId, 0,
      [matchRequest(fixtures[1], 0, 'persist-stale')]), { code: 'STALE_REVISION' });
    assert.deepEqual(await loadM1V8PersistedJournal(career.careerId), committed);
  });
});

test('a later invalid batch member never commits the earlier valid member', async () => {
  await withStorage(async () => {
    const empty = await createM1V8PersistedJournal(career.careerId);
    const good = matchRequest(fixtures[0], 0, 'batch-good');
    const stale = matchRequest(fixtures[1], 0, 'batch-stale');
    await assert.rejects(commitM1V8PersistedBatch(career.careerId, 0,
      [good, stale]), { code: 'DOMAIN_REJECTED', domainError: 'STALE_REVISION' });
    assert.deepEqual(await loadM1V8PersistedJournal(career.careerId), empty);
    await assert.rejects(commitM1V8PersistedBatch(career.careerId, 0, []),
      { code: 'DOMAIN_REJECTED', domainError: 'INVALID_BATCH' });
    assert.deepEqual(await loadM1V8PersistedJournal(career.careerId), empty);
  });
});

test('two browser writers serialize and cannot overwrite each other', async () => {
  await withStorage(async () => {
    await createM1V8PersistedJournal(career.careerId);
    const commands = [
      matchRequest(fixtures[0], 0, 'writer-a'),
      matchRequest(fixtures[1], 0, 'writer-b'),
    ];
    const settled = await Promise.allSettled(commands.map(cmd =>
      commitM1V8PersistedBatch(career.careerId, 0, [cmd])));
    assert.equal(settled.filter(s => s.status === 'fulfilled').length, 1);
    const failed = settled.find(s => s.status === 'rejected');
    assert.equal(failed.reason.code, 'STALE_REVISION');
    const stored = await loadM1V8PersistedJournal(career.careerId);
    assert.equal(stored.revision, 1);
    assert.equal(stored.results.length, 1);
    assert.ok(['writer-a', 'writer-b'].includes(stored.results[0].commandId));
  });
});

test('quota-aborted put rolls back and permits a valid retry', async () => {
  await withStorage(async mock => {
    const before = await createM1V8PersistedJournal(career.careerId);
    const request = matchRequest(fixtures[0], 0, 'quota-retry');
    mock.setQuotaPut(true);
    await assert.rejects(commitM1V8PersistedBatch(career.careerId, 0, [request]),
      { code: 'QUOTA_EXCEEDED' });
    assert.deepEqual(await loadM1V8PersistedJournal(career.careerId), before);
    mock.setQuotaPut(false);
    const after = await commitM1V8PersistedBatch(career.careerId, 0, [request]);
    assert.equal(after.revision, 1);
  });
});

test('malformed stored data is rejected, never repaired or overwritten', async () => {
  await withStorage(async mock => {
    await createM1V8PersistedJournal(career.careerId);
    const entries = mock.entries('footclubsim-m1-v8', 'result-journals');
    const damaged = { ...entries.get(career.careerId), revision: 5 };
    entries.set(career.careerId, damaged);
    await assert.rejects(loadM1V8PersistedJournal(career.careerId),
      { code: 'CORRUPTED' });
    await assert.rejects(commitM1V8PersistedBatch(career.careerId, 0,
      [matchRequest(fixtures[0], 0, 'untrusted')]), { code: 'CORRUPTED' });
    await assert.rejects(createM1V8PersistedJournal(career.careerId),
      { code: 'ALREADY_EXISTS' });
    assert.deepEqual(entries.get(career.careerId), damaged);
  });
});

test('invalid IDs and unavailable IndexedDB do not alter source careers', async () => {
  await withStorage(async () => {
    await assert.rejects(createM1V8PersistedJournal('  '), { code: 'INVALID_ID' });
    await assert.rejects(commitM1V8PersistedBatch(career.careerId, -1, []),
      { code: 'DOMAIN_REJECTED', domainError: 'INVALID_APPLY_COMMAND' });
    const original = globalThis.indexedDB;
    try {
      delete globalThis.indexedDB;
      await assert.rejects(createM1V8PersistedJournal(career.careerId),
        { code: 'UNAVAILABLE' });
    } finally {
      globalThis.indexedDB = original;
    }
  });
});

test('v8 journal lives in a distinct database from historical v7 storage', async () => {
  await withStorage(async mock => {
    await createM1V8PersistedJournal(career.careerId);
    assert.equal(mock.entries('footclubsim-m1-v8', 'result-journals').size, 1);
    assert.equal(mock.entries('footclubsim-m1-v7', 'result-journals').size, 0);
    const req = matchRequest(fixtures[0], 0, 'v8-isolated');
    await commitM1V8PersistedBatch(career.careerId, 0, [req]);
    assert.equal(mock.entries('footclubsim-m1-v7', 'result-journals').size, 0);
    assert.equal(mock.entries('footclubsim-m1-v8', 'result-journals')
      .get(career.careerId).revision, 1);
  });
});
