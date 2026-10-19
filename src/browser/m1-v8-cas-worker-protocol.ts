import { isStableId } from '../core/identifiers.js';
import { isPlainJsonTree } from '../core/plain-json-tree.js';

/** Research-only envelope; match legality remains in the v8 CAS domain. */
export const M1_V8_CAS_WORKER_PROTOCOL_VERSION = 1 as const;
const MAX_REQUEST_CHARS = 8_000_000;
const MAX_COMMANDS = 16;
const KEYS = ['schemaVersion', 'kind', 'jobId', 'careerId',
  'expectedRevision', 'requests'];

export interface M1V8WorkerCommitRequest {
  readonly schemaVersion: typeof M1_V8_CAS_WORKER_PROTOCOL_VERSION;
  readonly kind: 'commit';
  readonly jobId: string;
  readonly careerId: string;
  readonly expectedRevision: number;
  readonly requests: readonly unknown[];
}
export type M1V8WorkerAdmission =
  | Readonly<{ ok: true; request: M1V8WorkerCommitRequest }>
  | Readonly<{ ok: false; error: 'INVALID_REQUEST' }>;

/** Validate an entire structured-clone envelope, never trust worker metadata. */
export function readM1V8WorkerCommitRequest(value: unknown): M1V8WorkerAdmission {
  if (!isPlainJsonTree(value) || value === null ||
      typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'INVALID_REQUEST' };
  }
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).length !== KEYS.length ||
      !KEYS.every(key => Object.hasOwn(raw, key)) ||
      raw.schemaVersion !== M1_V8_CAS_WORKER_PROTOCOL_VERSION ||
      raw.kind !== 'commit' ||
      !isStableId(raw.jobId) || !isStableId(raw.careerId) ||
      !Number.isSafeInteger(raw.expectedRevision) ||
      (raw.expectedRevision as number) < 0 ||
      (raw.expectedRevision as number) > 240 ||
      !Array.isArray(raw.requests) || raw.requests.length < 1 ||
      raw.requests.length > MAX_COMMANDS) {
    return { ok: false, error: 'INVALID_REQUEST' };
  }
  try {
    if (JSON.stringify(raw).length > MAX_REQUEST_CHARS) {
      return { ok: false, error: 'INVALID_REQUEST' };
    }
  } catch {
    return { ok: false, error: 'INVALID_REQUEST' };
  }
  return { ok: true, request: raw as unknown as M1V8WorkerCommitRequest };
}
