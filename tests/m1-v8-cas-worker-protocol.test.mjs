import test from 'node:test';
import assert from 'node:assert/strict';
import { readM1V8WorkerCommitRequest, M1_V8_CAS_WORKER_PROTOCOL_VERSION }
  from '../dist/browser/m1-v8-cas-worker-protocol.js';

const valid = () => ({
  schemaVersion: 1, kind: 'commit', jobId: 'worker-job-1',
  careerId: 'worker-career-1', expectedRevision: 0,
  requests: [{ schemaVersion: 4 }],
});
const reject = value => assert.deepEqual(readM1V8WorkerCommitRequest(value),
  { ok: false, error: 'INVALID_REQUEST' });

test('worker envelope is versioned, closed-shape and bounded before CAS', () => {
  assert.equal(M1_V8_CAS_WORKER_PROTOCOL_VERSION, 1);
  assert.deepEqual(readM1V8WorkerCommitRequest(valid()), {
    ok: true, request: valid(),
  });
  for (const candidate of [
    null, [], 17, 'commit',
    { ...valid(), schemaVersion: 2 },
    { ...valid(), kind: 'load' },
    { ...valid(), jobId: ' ' },
    { ...valid(), careerId: '' },
    { ...valid(), expectedRevision: -1 },
    { ...valid(), expectedRevision: 241 },
    { ...valid(), expectedRevision: 0.5 },
    { ...valid(), requests: [] },
    { ...valid(), requests: Array(17).fill({}) },
    { ...valid(), unexpected: true },
    { ...valid(), requests: [{ value: Number.POSITIVE_INFINITY }] },
    { ...valid(), requests: [{ payload: 'x'.repeat(8_000_000) }] },
  ]) reject(candidate);
});

test('worker transport never invokes accessors, methods or aliased JSON', () => {
  let calls = 0;
  const withGetter = valid();
  Object.defineProperty(withGetter, 'surprise', {
    enumerable: true, get() { calls++; return 'secret'; },
  });
  reject(withGetter);
  const withSerializer = { ...valid(),
    toJSON() { calls++; return valid(); },
  };
  reject(withSerializer);
  const cycle = valid();
  cycle.requests[0].cycle = cycle;
  reject(cycle);
  const aliased = valid();
  const request = { command: 'same' };
  aliased.requests = [request, request];
  reject(aliased);
  assert.equal(calls, 0);
});
