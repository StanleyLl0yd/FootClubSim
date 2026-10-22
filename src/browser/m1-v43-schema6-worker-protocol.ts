import { isStableId } from '../core/identifiers.js';
import { isPlainJsonTree } from '../core/plain-json-tree.js';

export const M1_V43_WORKER_PROTOCOL_VERSION = 1 as const;
const KEYS = ['schemaVersion', 'kind', 'jobId', 'careerId',
  'expectedRevision', 'requests'];
const MAX_REQUEST_CHARS = 8_000_000;
export interface M1V43WorkerRequest {
  readonly schemaVersion: typeof M1_V43_WORKER_PROTOCOL_VERSION;
  readonly kind: 'commit';
  readonly jobId: string;
  readonly careerId: string;
  readonly expectedRevision: number;
  readonly requests: readonly unknown[];
}
export type M1V43WorkerAdmission =
  | Readonly<{ok:true;request:M1V43WorkerRequest}>
  | Readonly<{ok:false;error:'INVALID_REQUEST'}>;

/** Reject accessors, sparse arrays, custom prototypes, aliases and nonfinite values. */
export function readM1V43WorkerRequest(value: unknown): M1V43WorkerAdmission {
  if (!isPlainJsonTree(value) || value === null ||
      typeof value !== 'object' || Array.isArray(value)) {
    return {ok:false,error:'INVALID_REQUEST'};
  }
  const raw=value as Record<string,unknown>;
  if(Object.keys(raw).length!==KEYS.length ||
      !KEYS.every(k=>Object.hasOwn(raw,k)) ||
      raw.schemaVersion!==M1_V43_WORKER_PROTOCOL_VERSION ||
      raw.kind!=='commit' ||
      !isStableId(raw.jobId) || !isStableId(raw.careerId) ||
      !Number.isSafeInteger(raw.expectedRevision) ||
      (raw.expectedRevision as number)<0 ||
      (raw.expectedRevision as number)>240 ||
      !Array.isArray(raw.requests) ||
      raw.requests.length<1 || raw.requests.length>16) {
    return {ok:false,error:'INVALID_REQUEST'};
  }
  try {
    if(JSON.stringify(raw).length>MAX_REQUEST_CHARS)
      return {ok:false,error:'INVALID_REQUEST'};
  } catch {return {ok:false,error:'INVALID_REQUEST'};}
  return {ok:true,request:raw as unknown as M1V43WorkerRequest};
}
