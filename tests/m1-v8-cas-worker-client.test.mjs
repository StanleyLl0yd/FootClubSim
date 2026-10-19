import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commitM1V8ViaDedicatedWorker, readM1V8WorkerCommitReply,
  runM1V8WorkerCommit,
} from '../dist/browser/m1-v8-cas-worker-client.js';

const request = () => ({
  schemaVersion: 1, kind: 'commit',
  careerId: 'worker-career', jobId: 'worker-job',
  expectedRevision: 0, requests: [{ schemaVersion: 4 }],
});
const committed = (req = request()) => ({
  schemaVersion: 1, kind: 'committed',
  careerId: req.careerId, jobId: req.jobId,
  journal: {
    schemaVersion: 4, careerId: req.careerId,
    controlledClubId: 'fictional-1', basePackId: 'synthetic',
    basePackVersion: '1', revision: req.expectedRevision + req.requests.length,
    results: Array(req.expectedRevision + req.requests.length).fill({}),
  },
});
const compactReceipt = (req = request()) => ({
  schemaVersion: 1, kind: 'committed-receipt',
  careerId: req.careerId, jobId: req.jobId,
  journalRevision: req.expectedRevision + req.requests.length,
});
const failed = (code, extra = {}) => ({
  schemaVersion: 1, kind: 'failed',
  careerId: 'worker-career', jobId: 'worker-job', code, ...extra,
});
function fakeWorker(onPost = () => {}) {
  return {
    onmessage: null, onerror: null, onmessageerror: null, terminated: 0,
    postMessage(raw) { onPost(this, raw); },
    terminate() { this.terminated++; },
    send(data, origin = '') { this.onmessage?.({ data, origin }); },
  };
}

test('valid CAS acknowledgement is bounded to correlated receipt metadata', async () => {
  const worker = fakeWorker((w, raw) => w.send(committed(raw)));
  const receipt = await runM1V8WorkerCommit(worker, request());
  assert.deepEqual(receipt, {
    careerId: 'worker-career', jobId: 'worker-job', journalRevision: 1,
  });
  assert.equal(worker.terminated, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(Object.hasOwn(receipt, 'journal'), false);
});

test('compact Worker receipt avoids returning a journal and keeps v1 legacy compatibility', async () => {
  const worker = fakeWorker((w, raw) => w.send(compactReceipt(raw)));
  assert.deepEqual(await runM1V8WorkerCommit(worker, request()), {
    careerId: 'worker-career', jobId: 'worker-job', journalRevision: 1,
  });
  assert.equal(worker.terminated, 1);
  assert.deepEqual(readM1V8WorkerCommitReply(compactReceipt(), request()), {
    kind: 'committed',
    receipt: { careerId: 'worker-career', jobId: 'worker-job', journalRevision: 1 },
  });
});

test('compact Worker receipt rejects spoofing, invalid revisions and extra payloads', () => {
  const original = compactReceipt();
  const variants = [
    { ...original, jobId: 'wrong-job' },
    { ...original, careerId: 'wrong-career' },
    { ...original, schemaVersion: 2 },
    { ...original, journalRevision: 0 },
    { ...original, journalRevision: 2 },
    { ...original, journalRevision: '1' },
    { ...original, journalRevision: NaN },
    { ...original, journal: committed().journal },
    { ...original, extra: true },
  ];
  for (const item of variants) {
    assert.equal(readM1V8WorkerCommitReply(item, request()), null);
  }
  let reads = 0;
  const accessor = compactReceipt();
  Object.defineProperty(accessor, 'journalRevision', {
    get() { reads++; return 1; }, enumerable: true,
  });
  assert.equal(readM1V8WorkerCommitReply(accessor, request()), null);
  assert.equal(reads, 0);
  const full = { ...request(), expectedRevision: 240 };
  assert.equal(readM1V8WorkerCommitReply(compactReceipt(full), full), null);
});

test('stale CAS and invalid domain commands are definitive typed failures', async () => {
  for (const [reply, expected] of [
    [failed('STALE_REVISION'), { code: 'STALE_REVISION' }],
    [failed('DOMAIN_REJECTED', { domainError: 'INVALID_BATCH' }),
      { code: 'DOMAIN_REJECTED', domainError: 'INVALID_BATCH' }],
  ]) {
    const worker = fakeWorker(w => w.send(reply));
    await assert.rejects(runM1V8WorkerCommit(worker, request()), expected);
    assert.equal(worker.terminated, 1);
  }
});

test('untrusted acknowledgement fields cannot become successful commits', () => {
  const req = request();
  const variants = [
    { ...committed(), jobId: 'another-job' },
    { ...committed(), careerId: 'another-career' },
    { ...committed(), schemaVersion: 2 },
    { ...committed(), kind: 'progress' },
    { ...committed(), extra: true },
    { ...committed(), journal: { ...committed().journal, revision: 2 } },
    { ...committed(), journal: { ...committed().journal, results: [] } },
    { ...committed(), journal: { ...committed().journal, careerId: 'other' } },
    failed('WORKER_FAILED'),
    failed('DOMAIN_REJECTED', { domainError: 12 }),
    failed('UNAVAILABLE', { irrelevant: 'extra' }),
  ];
  for (const candidate of variants) {
    assert.equal(readM1V8WorkerCommitReply(candidate, req), null);
  }
});

test('accessor reply fields are rejected without invoking the getter', () => {
  let invoked = 0;
  const root = committed();
  Object.defineProperty(root, 'kind', {
    enumerable: true, get() { invoked++; return 'committed'; },
  });
  assert.equal(readM1V8WorkerCommitReply(root, request()), null);
  const nested = committed();
  Object.defineProperty(nested.journal, 'revision', {
    enumerable: true, get() { invoked++; return 1; },
  });
  assert.equal(readM1V8WorkerCommitReply(nested, request()), null);
  assert.equal(invoked, 0);
});

test('unknown worker failure, bad reply, crash and message error are ambiguous', async () => {
  const scenarios = [
    w => w.send(failed('WORKER_FAILED')),
    w => w.send({ ...committed(), jobId: 'unrelated' }),
    w => w.onerror?.({ message: 'worker died' }),
    w => w.onmessageerror?.({ data: null }),
  ];
  for (const scenario of scenarios) {
    const worker = fakeWorker(w => scenario(w));
    await assert.rejects(runM1V8WorkerCommit(worker, request()),
      { code: 'COMMIT_OUTCOME_UNKNOWN' });
    assert.equal(worker.terminated, 1);
  }
});

test('timeout is indeterminate and ignores a late false success', async () => {
  const worker = fakeWorker();
  await assert.rejects(runM1V8WorkerCommit(worker, request(), 4),
    { code: 'COMMIT_OUTCOME_UNKNOWN' });
  assert.equal(worker.terminated, 1);
  worker.send(committed());
  assert.equal(worker.terminated, 1);
});

test('postMessage transport failure is not misreported as a rollback', async () => {
  const worker = fakeWorker(() => { throw new Error('transport unavailable'); });
  await assert.rejects(runM1V8WorkerCommit(worker, request()),
    { code: 'COMMIT_OUTCOME_UNKNOWN' });
  assert.equal(worker.terminated, 1);
});

test('reject invalid input and deadline before sending a command', async () => {
  const worker = fakeWorker(() => { throw new Error('should not post'); });
  await assert.rejects(runM1V8WorkerCommit(worker, { ...request(), jobId: '' }),
    { code: 'INVALID_REQUEST' });
  assert.equal(worker.terminated, 1);
  const other = fakeWorker(() => { throw new Error('should not post'); });
  await assert.rejects(runM1V8WorkerCommit(other, request(), 0),
    { code: 'INVALID_REQUEST' });
  assert.equal(other.terminated, 1);
  await assert.rejects(commitM1V8ViaDedicatedWorker({ ...request(), requests: [] }),
    { code: 'INVALID_REQUEST' });
});
