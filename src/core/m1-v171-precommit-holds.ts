import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {applyM1V120Source,type M1V120Gate}
  from './m1-v120-playable-journal.js';
import {reviewM1V126DenseSourceHolds}
  from './m1-v126-dense-source-holds.js';
import type {InitialCareerSave} from './save.js';
import type {M1V120Journal} from './m1-v120-playable-journal.js';

const ADMITTED_COMMAND_PREFIXES=[
  'v122-ordinary-','v124-virtual-referee-',
  'v128-fictional-continuation-','v132-sub-','v136-double-',
  'v138-multi-','v158-goal-multi-','v166-combined-',
] as const;

/** Validate origins on the whole prospective persisted history, not only
 * its newest entry. Legacy source-replayable journals remain readable,
 * but unverifiable source claims cannot authorize further writes.
 */
function verifiedSourceOrigins(
  initial:InitialCareerSave,journal:M1V120Journal,
):boolean{
  return journal.entries.every(entry=>
    ADMITTED_COMMAND_PREFIXES.some(prefix=>
      entry.commandId===prefix+entry.fixtureId)&&
    entry.source.prematch.rngSeed===
      deriveM1FixtureSeed(initial.rngState,entry.fixtureId));
}

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
  if(!verifiedSourceOrigins(initial,accepted.journal))
    return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
  const holds=reviewM1V126DenseSourceHolds(initial,accepted.journal);
  if(!holds.ok)return {ok:false,error:holds.error};
  return accepted;
}
