import {applyM1V120Source,type M1V120Gate}
  from './m1-v120-playable-journal.js';
import {reviewM1V126DenseSourceHolds}
  from './m1-v126-dense-source-holds.js';
import type {InitialCareerSave} from './save.js';
import type {M1V120Journal} from './m1-v120-playable-journal.js';

export const M1_V171_PRECOMMIT_HOLDS_SCHEMA=171 as const;
export type M1V171Admission=M1V120Gate|
  Readonly<{ok:false;error:'UNVERIFIED_VIRTUAL_SOURCE'|
    'HISTORICAL_HOLD_BYPASS'}>;

/** Fail closed before the native IndexedDB transaction's put.
 * This is fictional hold integrity, not KDK or clinical certification.
 */
export function admitM1V171SourceWithHolds(
  initial:InitialCareerSave,journal:M1V120Journal,request:unknown,
):M1V171Admission{
  const accepted=applyM1V120Source(initial,journal,request);
  if(!accepted.ok)return accepted;
  const holds=reviewM1V126DenseSourceHolds(initial,accepted.journal);
  if(!holds.ok)return {ok:false,error:holds.error};
  return accepted;
}
