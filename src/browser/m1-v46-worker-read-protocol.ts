import { isStableId } from '../core/identifiers.js';
import { isPlainJsonTree } from '../core/plain-json-tree.js';

export const M1_V46_READ_PROTOCOL_VERSION=1 as const;
export const M1_V46_SOURCE_STATUS=
  'SOURCE_REPLAYED_SYNTHETIC_NOT_AUTHENTICATED' as const;
export interface M1V46ReadRequest{
  readonly schemaVersion:typeof M1_V46_READ_PROTOCOL_VERSION;
  readonly kind:'read';readonly jobId:string;readonly careerId:string;
}
export function readM1V46ReadRequest(value:unknown):
  M1V46ReadRequest|null{
  if(!isPlainJsonTree(value)||value===null||
      typeof value!=='object'||Array.isArray(value))return null;
  const raw=value as Record<string,unknown>;
  const keys=['schemaVersion','kind','jobId','careerId'];
  if(Object.keys(raw).length!==keys.length||
      !keys.every(key=>Object.hasOwn(raw,key))||
      raw.schemaVersion!==M1_V46_READ_PROTOCOL_VERSION||
      raw.kind!=='read'||!isStableId(raw.jobId)||
      !isStableId(raw.careerId))return null;
  return raw as unknown as M1V46ReadRequest;
}
