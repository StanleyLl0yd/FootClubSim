import { sameCanonicalValue } from './canonical-value.js';
import { isStableId } from './identifiers.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * Detached Ed25519 proof of exactly the referee/medical source supplied to
 * an isolated v8 match. This proves possession of a caller-trusted signing
 * key, NOT that this key belongs to a real referee, RFU, physician or KDK.
 * Never import a key from the signature envelope or an editable career save.
 */
export const M1_V8_AUTHORITY_ATTESTATION_SCHEMA = 1 as const;
export const M1_V8_AUTHORITY_PURPOSE =
  'footclubsim-m1-v8-referee-medical-source' as const;

export interface M1V8AuthorityContext {
  readonly careerId: string;
  readonly fixtureId: string;
  readonly expectedRevision: number;
  /** An externally issued challenge, unique for each authorization attempt. */
  readonly challengeId: string;
}

export interface M1V8SignedAuthorityEnvelope {
  readonly schemaVersion: typeof M1_V8_AUTHORITY_ATTESTATION_SCHEMA;
  /** Exactly JSON.stringify(payloadObject), signed as UTF-8 bytes. */
  readonly payload: string;
  /** Canonical unpadded base64url encoding of a 64-byte Ed25519 signature. */
  readonly signature: string;
}

export type M1V8AuthorityVerificationError =
  'INVALID_CONTEXT' | 'INVALID_SOURCE' | 'INVALID_ENVELOPE' |
  'SCOPE_MISMATCH' | 'INVALID_SIGNATURE' | 'TRUST_ANCHOR_UNAVAILABLE';
export type M1V8AuthorityVerification =
  | Readonly<{ ok: false; error: M1V8AuthorityVerificationError }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V8_AUTHORITY_ATTESTATION_SCHEMA;
    classification: 'SIGNED_BY_CALLER_SUPPLIED_TRUST_ANCHOR';
    careerId: string;
    fixtureId: string;
    expectedRevision: number;
    challengeId: string;
    decisionsCount: number;
    medicalActionsCount: number;
  }>;

const CONTEXT_KEYS = [
  'careerId', 'fixtureId', 'expectedRevision', 'challengeId',
] as const;
const ENVELOPE_KEYS = ['schemaVersion', 'payload', 'signature'] as const;
const SOURCE_KEYS = [
  'schemaVersion', 'purpose', ...CONTEXT_KEYS, 'trustedDecisions',
  'medicalActions',
] as const;
const MAX_SIGNED_BYTES = 128 * 1024;
const MAX_DECISIONS = 18;
const MAX_MEDICAL_ACTIONS = 36;
const error = (kind: M1V8AuthorityVerificationError): M1V8AuthorityVerification =>
  ({ ok: false, error: kind });

function exact(value: object, keys: readonly string[]): boolean {
  return Reflect.ownKeys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validContext(value: unknown): value is M1V8AuthorityContext {
  if (!isPlainJsonTree(value) || !isRecord(value) ||
      !exact(value, CONTEXT_KEYS)) return false;
  return isStableId(value.careerId) && isStableId(value.fixtureId) &&
    isStableId(value.challengeId) &&
    Number.isSafeInteger(value.expectedRevision) &&
    (value.expectedRevision as number) >= 0 &&
    (value.expectedRevision as number) < 240;
}
function validStream(value: unknown, max: number): value is readonly unknown[] {
  return isPlainJsonTree(value) && Array.isArray(value) && value.length <= max;
}
function validKey(key: unknown): key is CryptoKey {
  try {
    if (key === null || typeof key !== 'object') return false;
    const value = key as CryptoKey;
    return value.type === 'public' && value.algorithm.name === 'Ed25519' &&
      value.usages.length === 1 && value.usages[0] === 'verify';
  } catch {
    return false;
  }
}

/**
 * Enforces strict source equality, then verifies the detached signature.
 * A valid result must still be submitted to the ordinary v8 replay/eligibility
 * checks. The host MUST independently establish the authentic trusted key,
 * the uniqueness of challengeId and the career's current revision.
 */
export async function verifyM1V8AuthorityAttestation(
  publicKeyFromTrustedHost: unknown,
  trustedContext: unknown,
  envelope: unknown,
  trustedDecisions: unknown,
  medicalActions: unknown,
): Promise<M1V8AuthorityVerification> {
  if (!validContext(trustedContext)) return error('INVALID_CONTEXT');
  if (!validStream(trustedDecisions, MAX_DECISIONS) ||
      !validStream(medicalActions, MAX_MEDICAL_ACTIONS)) {
    return error('INVALID_SOURCE');
  }
  if (!isPlainJsonTree(envelope) || !isRecord(envelope) ||
      !exact(envelope, ENVELOPE_KEYS) ||
      envelope.schemaVersion !== M1_V8_AUTHORITY_ATTESTATION_SCHEMA ||
      typeof envelope.payload !== 'string' ||
      typeof envelope.signature !== 'string' ||
      !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature)) {
    return error('INVALID_ENVELOPE');
  }
  const utf8 = new TextEncoder().encode(envelope.payload);
  if (utf8.length === 0 || utf8.length > MAX_SIGNED_BYTES) {
    return error('INVALID_ENVELOPE');
  }
  let signed: unknown;
  try {
    signed = JSON.parse(envelope.payload);
    // A strict JSON serialization rejects duplicate keys, ambiguous number
    // spellings, extra whitespace and surrogate normalization differences.
    if (!isPlainJsonTree(signed) || JSON.stringify(signed) !== envelope.payload ||
        !isRecord(signed)) return error('INVALID_ENVELOPE');
    const parsed = signed;
    if (!exact(parsed, SOURCE_KEYS) ||
        parsed.schemaVersion !== M1_V8_AUTHORITY_ATTESTATION_SCHEMA ||
        parsed.purpose !== M1_V8_AUTHORITY_PURPOSE ||
        !validContext(Object.fromEntries(CONTEXT_KEYS.map(key => [key, parsed[key]]))) ||
        CONTEXT_KEYS.some(key => parsed[key] !== trustedContext[key]) ||
        !validStream(parsed.trustedDecisions, MAX_DECISIONS) ||
        !validStream(parsed.medicalActions, MAX_MEDICAL_ACTIONS)) {
      return error('INVALID_ENVELOPE');
    }
  } catch {
    return error('INVALID_ENVELOPE');
  }
  const payload = signed as Record<string, unknown>;
  if (!sameCanonicalValue(payload.trustedDecisions, trustedDecisions) ||
      !sameCanonicalValue(payload.medicalActions, medicalActions)) {
    return error('SCOPE_MISMATCH');
  }
  if (!validKey(publicKeyFromTrustedHost) ||
      typeof crypto === 'undefined' || !crypto.subtle) {
    return error('TRUST_ANCHOR_UNAVAILABLE');
  }
  let signatureBytes: Uint8Array;
  try {
    const padded = envelope.signature.replace(/-/g, '+').replace(/_/g, '/') + '==';
    const decoded = atob(padded);
    if (decoded.length !== 64) return error('INVALID_ENVELOPE');
    signatureBytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    // No alternative encodings for the same signature bytes.
    const encoded = btoa(decoded).replace(/\+/g, '-').replace(/\//g, '_')
      .replace(/=+$/g, '');
    if (encoded !== envelope.signature) return error('INVALID_ENVELOPE');
  } catch {
    return error('INVALID_ENVELOPE');
  }
  try {
    const verified = await crypto.subtle.verify('Ed25519',
      publicKeyFromTrustedHost, signatureBytes, utf8);
    if (!verified) return error('INVALID_SIGNATURE');
  } catch {
    return error('TRUST_ANCHOR_UNAVAILABLE');
  }
  return {
    ok: true, schemaVersion: M1_V8_AUTHORITY_ATTESTATION_SCHEMA,
    classification: 'SIGNED_BY_CALLER_SUPPLIED_TRUST_ANCHOR',
    careerId: trustedContext.careerId,
    fixtureId: trustedContext.fixtureId,
    expectedRevision: trustedContext.expectedRevision,
    challengeId: trustedContext.challengeId,
    decisionsCount: trustedDecisions.length,
    medicalActionsCount: medicalActions.length,
  };
}
