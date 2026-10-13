import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkerRequest, readWorkerReply, WORKER_PROTOCOL_VERSION } from '../dist/core/worker-protocol.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { MATCH_LEDGER_VERSION, M0_ENGINE_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION, deriveMatchLedger } from '../dist/core/match-contracts.js';
import { RNG_VERSION } from '../dist/core/rng.js';

const catalog = createSyntheticRplScaleCatalog(4);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(club => club.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(club => [club.id, club]));
const input = {
  schemaVersion: MATCH_LEDGER_VERSION,
  engineVersion: M0_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID,
  rulesPackVersion: M0_RULES_PACK_VERSION,
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 7,
  fixture, catalog,
  homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
  awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  events: [{ id: 'ft', type: 'full-time', sequence: 1, elapsedSeconds: 5400 }],
};
const request = {
  protocolVersion: WORKER_PROTOCOL_VERSION,
  kind: 'derive-ledger',
  jobId: 'job-1',
  careerId: 'career-1',
  expectedRevision: 0,
  input,
};
const pending = {
  jobId: 'job-1', careerId: 'career-1',
  expectedRevision: 0, fixtureId: fixture.id, cancelled: false,
};
const derived = deriveMatchLedger(input);
assert.equal(derived.ok, true);
const reply = {
  protocolVersion: WORKER_PROTOCOL_VERSION,
  kind: 'completed', jobId: pending.jobId, careerId: pending.careerId,
  basedOnRevision: pending.expectedRevision, report: derived.report,
};
function failure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.error, code);
}

test('worker request has an explicit versioned and bounded structured-clone envelope', () => {
  const result = readWorkerRequest(request);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.kind, 'derive-ledger');
  const cancel = readWorkerRequest({
    protocolVersion: 1, kind: 'cancel', jobId: 'cancel-1',
    careerId: 'career-1', targetJobId: 'job-1',
  });
  assert.equal(cancel.ok, true);
});

test('worker request rejects foreign versions, bad IDs, revisions and unbounded input', () => {
  for (const value of [
    null,
    { ...request, protocolVersion: 2 },
    { ...request, kind: 'simulate-season' },
    { ...request, extra: 'unexpected' },
    { ...request, jobId: '\u202e' },
    { ...request, expectedRevision: -1 },
    { ...request, expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...request, input: null },
    { ...request, input: { ...input, catalog: null } },
    { ...request, input: { ...input, events: Array(4097) } },
    { ...request, input: { ...input, catalog: { ...catalog, players: Array(2049) } } },
    { protocolVersion: 1, kind: 'cancel', jobId: 'job-1', careerId: 'career-1', targetJobId: 'job-1' },
  ]) failure(readWorkerRequest(value), 'INVALID_MESSAGE');
});

test('transport admission does not falsely claim match inputs are valid', () => {
  const malformed = { ...request, input: { ...input, catalog: { ...catalog, players: [null] } } };
  assert.equal(readWorkerRequest(malformed).ok, true);
  assert.equal(deriveMatchLedger(malformed.input).ok, false);
});

test('report reply is isolated, bounded and correlated with its fixture', () => {
  const result = readWorkerReply(reply, pending, 0);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, reply);
    assert.notStrictEqual(result.value.report, reply.report);
    assert.notStrictEqual(result.value.report.home, reply.report.home);
  }
  failure(readWorkerReply({ ...reply, report: { ...reply.report, fixtureId: 'wrong' } }, pending, 0), 'WRONG_FIXTURE');
});

test('late worker responses cannot overwrite a changed or cancelled career', () => {
  failure(readWorkerReply({ ...reply, jobId: 'unrelated' }, pending, 0), 'WRONG_JOB');
  failure(readWorkerReply({ ...reply, careerId: 'other-career' }, pending, 0), 'WRONG_JOB');
  failure(readWorkerReply({ ...reply, basedOnRevision: 1 }, pending, 0), 'STALE_RESULT');
  failure(readWorkerReply(reply, pending, 1), 'STALE_RESULT');
  failure(readWorkerReply(reply, { ...pending, cancelled: true }, 0), 'CANCELLED_JOB');
});

test('typed worker progress, failure and cancellation signals are validated', () => {
  const base = {
    protocolVersion: 1, jobId: pending.jobId, careerId: pending.careerId,
    basedOnRevision: 0,
  };
  assert.equal(readWorkerReply({ ...base, kind: 'progress', percent: 45 }, pending, 0).ok, true);
  assert.equal(readWorkerReply({ ...base, kind: 'failed', code: 'INVALID_INPUT' }, pending, 0).ok, true);
  assert.equal(readWorkerReply({ ...base, kind: 'cancelled' }, pending, 0).ok, true);
  assert.equal(readWorkerReply({ ...base, kind: 'cancelled' }, { ...pending, cancelled: true }, 0).ok, true);
  for (const value of [
    { ...base, kind: 'progress', percent: 101 },
    { ...base, kind: 'progress', percent: NaN },
    { ...base, kind: 'failed', code: 'any arbitrary message' },
    { ...base, kind: 'cancelled', report: reply.report },
  ]) failure(readWorkerReply(value, pending, 0), 'INVALID_MESSAGE');
});

test('fake worker reports cannot claim impossible score/shots/xG', () => {
  for (const report of [
    { ...reply.report, home: { ...reply.report.home, goals: 1 } },
    { ...reply.report, home: { ...reply.report.home, shotsOnTarget: 1 } },
    { ...reply.report, home: { ...reply.report.home, shots: 1, xgMilli: 1001 } },
    { ...reply.report, away: { ...reply.report.away, goals: -1 } },
    { ...reply.report, away: { ...reply.report.away, shots: NaN } },
  ]) failure(readWorkerReply({ ...reply, report }, pending, 0), 'INVALID_REPORT');
});
