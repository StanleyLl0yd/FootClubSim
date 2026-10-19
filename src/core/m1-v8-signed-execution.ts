import { isPlainJsonTree } from './plain-json-tree.js';
import { startM1Clock } from './m1-clock.js';
import { verifyM1V8AuthorityAttestation,
  type M1V8AuthorityVerificationError }
  from './m1-v8-authority-attestation.js';
import { simulateM1V8MedicalPhases,
  type M1V8Error, type M1V8Result }
  from './m1-v8-medical-phases.js';

/**
 * Isolated, read-only signed-source research gate. No authentic issuer, key
 * enrollment, request nonce registry, store transaction or official result.
 */
export const M1_V8_SIGNED_EXECUTION_SCHEMA_VERSION = 1 as const;
const MAX_PREMATCH = 8_000_000;
const MAX_POLICY = 128_000;
const MAX_COMMANDS = 2_000_000;
const MAX_SOURCE = 160_000;

type SignedRunError =
  | Readonly<{ ok: false; error: 'INVALID_SNAPSHOT' | 'INVALID_PREMATCH' |
    'FIXTURE_SCOPE_MISMATCH' }>
  | Readonly<{ ok: false; error: 'AUTHORITY_REJECTED';
    authorityError: M1V8AuthorityVerificationError }>
  | Readonly<{ ok: false; error: 'MATCH_REJECTED'; matchError: M1V8Error }>;

export type M1V8SignedExecutionResult =
  | SignedRunError
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V8_SIGNED_EXECUTION_SCHEMA_VERSION;
    classification: 'SIGNED_SOURCE_CHECKED_NOT_OFFICIAL_AUTHORITY';
    careerId: string;
    fixtureId: string;
    expectedRevision: number;
    challengeId: string;
    result: M1V8Result;
  }>;

/** Clone all caller-editable JSON synchronously before awaiting WebCrypto. */
function cloneJson(value: unknown, limit: number): unknown | undefined {
  try {
    if (!isPlainJsonTree(value)) return undefined;
    const json = JSON.stringify(value);
    if (typeof json !== 'string' || json.length > limit) return undefined;
    return JSON.parse(json) as unknown;
  } catch {
    return undefined;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Reject invalid authority before any match calculation. A successful signed
 * source is still checked by the ordinary deterministic v8 rules and replay.
 * The trusted host must additionally pin the careerId, revision and unique
 * challenge to its actual durable game state, and authenticate signer roles.
 */
export async function simulateM1V8WithSignedSource(
  prematch: unknown, policy: unknown, plannedCommands: unknown,
  trustedDecisions: unknown, medicalActions: unknown,
  trustedContext: unknown, signedEnvelope: unknown,
  publicKeyFromTrustedHost: unknown,
): Promise<M1V8SignedExecutionResult> {
  const original = cloneJson(prematch, MAX_PREMATCH);
  const teamPolicy = cloneJson(policy, MAX_POLICY);
  const commands = cloneJson(plannedCommands, MAX_COMMANDS);
  const decisions = cloneJson(trustedDecisions, MAX_SOURCE);
  const medical = cloneJson(medicalActions, MAX_SOURCE);
  const context = cloneJson(trustedContext, MAX_SOURCE);
  const envelope = cloneJson(signedEnvelope, MAX_SOURCE);
  if (!original || !teamPolicy || !Array.isArray(commands) ||
      !Array.isArray(decisions) || !Array.isArray(medical) ||
      !record(context) || !record(envelope)) {
    return { ok: false, error: 'INVALID_SNAPSHOT' };
  }
  const started = startM1Clock(original);
  if (!started.ok) return { ok: false, error: 'INVALID_PREMATCH' };
  if (context.fixtureId !== started.state.fixtureId) {
    return { ok: false, error: 'FIXTURE_SCOPE_MISMATCH' };
  }
  const verified = await verifyM1V8AuthorityAttestation(
    publicKeyFromTrustedHost, context, envelope, decisions, medical);
  if (!verified.ok) {
    return { ok: false, error: 'AUTHORITY_REJECTED',
      authorityError: verified.error };
  }
  const match = simulateM1V8MedicalPhases(
    original, teamPolicy, commands, decisions, medical);
  if (!match.ok) {
    return { ok: false, error: 'MATCH_REJECTED', matchError: match.error };
  }
  return {
    ok: true, schemaVersion: M1_V8_SIGNED_EXECUTION_SCHEMA_VERSION,
    classification: 'SIGNED_SOURCE_CHECKED_NOT_OFFICIAL_AUTHORITY',
    careerId: verified.careerId, fixtureId: verified.fixtureId,
    expectedRevision: verified.expectedRevision,
    challengeId: verified.challengeId, result: match,
  };
}
