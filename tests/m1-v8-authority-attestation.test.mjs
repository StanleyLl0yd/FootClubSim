import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { verifyM1V8AuthorityAttestation, M1_V8_AUTHORITY_PURPOSE }
  from '../dist/core/m1-v8-authority-attestation.js';

const challenge = () => ({
  careerId: 'career-authorization-1', fixtureId: 'fixture-a',
  expectedRevision: 7, challengeId: 'trusted-challenge-unique-1',
});
const penalty = () => ({
  schemaVersion: 1, decisionId: 'decision-p1', fixtureId: 'fixture-a',
  teamId: 'club-home', playerId: 'home-10',
  elapsedSeconds: 300, kind: 'penalty-kick', outcome: 'scored',
});
const medical = () => ({
  schemaVersion: 1, id: 'medical-e1', fixtureId: 'fixture-a',
  teamId: 'club-away', playerId: 'away-11',
  elapsedSeconds: 0, kind: 'treatment-exit',
  reason: 'medical-staff-entered', restartAtRunningSeconds: 30,
});
const trustedDecisions = () => [penalty()];
const medicalActions = () => [medical()];
const keys = webcrypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);

async function signed(context = challenge(),
  decisions = trustedDecisions(), actions = medicalActions()) {
  const pair = await keys;
  const payload = JSON.stringify({
    schemaVersion: 1, purpose: M1_V8_AUTHORITY_PURPOSE,
    ...context, trustedDecisions: decisions, medicalActions: actions,
  });
  const signature = await webcrypto.subtle.sign('Ed25519', pair.privateKey,
    new TextEncoder().encode(payload));
  return {
    schemaVersion: 1, payload,
    signature: Buffer.from(signature).toString('base64url'),
  };
}
const verify = async (envelope, ctx = challenge(), decisions = trustedDecisions(),
  actions = medicalActions(), key = null) =>
  verifyM1V8AuthorityAttestation(key ?? (await keys).publicKey,
    ctx, envelope, decisions, actions);
const rejected = (value, error) => assert.deepEqual(value, { ok: false, error });

test('signed decisions and medical sources are tied to career, match and CAS revision', async () => {
  const envelope = await signed();
  assert.deepEqual(await verify(envelope), {
    ok: true, schemaVersion: 1,
    classification: 'SIGNED_BY_CALLER_SUPPLIED_TRUST_ANCHOR',
    careerId: 'career-authorization-1', fixtureId: 'fixture-a',
    expectedRevision: 7, challengeId: 'trusted-challenge-unique-1',
    decisionsCount: 1, medicalActionsCount: 1,
  });
  const empty = await signed(challenge(), [], []);
  const result = await verify(empty, challenge(), [], []);
  assert.equal(result.ok, true);
  assert.equal(result.decisionsCount, 0);
  assert.equal(result.medicalActionsCount, 0);
});

test('different trusted context or challenge cannot replay the same proof', async () => {
  const envelope = await signed();
  for (const update of [
    { fixtureId: 'fixture-b' },
    { careerId: 'different-career' },
    { expectedRevision: 8 },
    { challengeId: 'different-nonce' },
  ]) {
    rejected(await verify(envelope, { ...challenge(), ...update }),
      'INVALID_ENVELOPE');
  }
  rejected(await verify(envelope, { ...challenge(), expectedRevision: 240 }),
    'INVALID_CONTEXT');
  rejected(await verify(envelope, { ...challenge(), extra: 'untrusted' }),
    'INVALID_CONTEXT');
});

test('attestation cannot be applied to different scoring or medical sources', async () => {
  const envelope = await signed();
  rejected(await verify(envelope, challenge(), [
    { ...penalty(), outcome: 'saved' },
  ]), 'SCOPE_MISMATCH');
  rejected(await verify(envelope, challenge(), [], medicalActions()),
    'SCOPE_MISMATCH');
  rejected(await verify(envelope, challenge(), trustedDecisions(), []),
    'SCOPE_MISMATCH');
  rejected(await verify(envelope, challenge(), trustedDecisions(),
    [{ ...medical(), restartAtRunningSeconds: 31 }]), 'SCOPE_MISMATCH');
});

test('forged signer, altered bytes and lost trusted anchor fail closed', async () => {
  const envelope = await signed();
  const other = await webcrypto.subtle.generateKey('Ed25519', true,
    ['sign', 'verify']);
  rejected(await verify(envelope, challenge(), trustedDecisions(),
    medicalActions(), other.publicKey), 'INVALID_SIGNATURE');
  rejected(await verify({ ...envelope,
    payload: envelope.payload.replace('"scored"', '"saved"') },
    challenge(), [{ ...penalty(), outcome: 'saved' }]),
  'INVALID_SIGNATURE');
  rejected(await verify(envelope, challenge(), trustedDecisions(),
    medicalActions(), (await keys).privateKey),
  'TRUST_ANCHOR_UNAVAILABLE');
});

test('signature envelope and JSON source shape must be canonical and bounded', async () => {
  const envelope = await signed();
  for (const candidate of [
    { ...envelope, extra: true },
    { ...envelope, schemaVersion: 2 },
    { ...envelope, signature: '!' + envelope.signature.slice(1) },
    { ...envelope, signature: envelope.signature + '=' },
    { ...envelope, payload: ' ' + envelope.payload },
    { ...envelope, payload: envelope.payload + ' ' },
    { ...envelope, payload: envelope.payload.replace(
      '"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1') },
    { ...envelope, payload: 'x'.repeat(131072) },
    { ...envelope, payload: '{not JSON}' },
  ]) rejected(await verify(candidate), 'INVALID_ENVELOPE');
});

test('non-JSON aliases, accessors and cycles never reach signing verification', async () => {
  const envelope = await signed();
  let invoked = 0;
  const fake = { ...envelope };
  Object.defineProperty(fake, 'payload', {
    enumerable: true, get() { invoked++; return envelope.payload; },
  });
  rejected(await verify(fake), 'INVALID_ENVELOPE');
  assert.equal(invoked, 0);
  const serializer = { ...envelope,
    toJSON() { invoked++; return envelope; },
  };
  rejected(await verify(serializer), 'INVALID_ENVELOPE');
  assert.equal(invoked, 0);
  const cycle = trustedDecisions();
  cycle[0].same = cycle;
  rejected(await verify(envelope, challenge(), cycle),
    'INVALID_SOURCE');
  const aliased = trustedDecisions();
  aliased.push(aliased[0]);
  rejected(await verify(envelope, challenge(), aliased), 'INVALID_SOURCE');
  rejected(await verify(envelope, challenge(), Array(19).fill(null)),
    'INVALID_SOURCE');
  rejected(await verify(envelope, challenge(), trustedDecisions(),
    Array(37).fill(null)), 'INVALID_SOURCE');
});
