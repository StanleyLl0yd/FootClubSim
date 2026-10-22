import { sameCanonicalValue } from './canonical-value.js';
import { isStableId } from './identifiers.js';
import {
  applyM1V32ExposureBatch, validateM1V32ExposureJournal,
} from './m1-v32-causal-medical-journal.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * Observation ONLY after an ambiguous CAS/Worker reply.
 * Full history and all source inputs are independently replay-validated.
 * No result authorizes automatic retry or asserts durable OS-level storage.
 */
export const M1_V45_REVIEW_SCHEMA = 1 as const;
const KEYS = ['schemaVersion','careerId','expectedRevision','requests'];
export type M1V45ReviewResult =
  | Readonly<{ok:false;error:
    'INVALID_CLAIM'|'CORRUPTED_HISTORY'|'INVALID_SOURCE';
    automaticRetryAllowed:false}>
  | Readonly<{ok:true;status:
    'OBSERVED_COMMITTED'|'NOT_OBSERVED_AT_READ'|'DIVERGENT_HISTORY';
    careerId:string;journalRevision:number;expectedRevision:number;
    commandCount:number;
    fullSourceReplayVerified:true;
    automaticRetryAllowed:false}>;

const invalid=(error:'INVALID_CLAIM'|'CORRUPTED_HISTORY'|'INVALID_SOURCE'):
  M1V45ReviewResult=>({ok:false,error,automaticRetryAllowed:false});
const statusResult=(status:'OBSERVED_COMMITTED'|'NOT_OBSERVED_AT_READ'|
  'DIVERGENT_HISTORY',careerId:string,journalRevision:number,
  expectedRevision:number,commandCount:number):M1V45ReviewResult=>({
    ok:true,status,careerId,journalRevision,expectedRevision,
    commandCount,fullSourceReplayVerified:true,automaticRetryAllowed:false,
  });
const rec=(v:unknown):v is Record<string,unknown> =>
  v!==null&&typeof v==='object'&&!Array.isArray(v);

/**
 * Call after a missing, crashed, timed-out or unrecognized Worker receipt.
 * A NOT_OBSERVED_AT_READ result is a snapshot, NOT proof that a separate
 * in-flight writer cannot still commit. Never automatically retry it.
 *
 * A positive OBSERVED_COMMITTED requires the complete current journal to
 * replay and the original requested batch to source-replay against the
 * authenticated-by-model historical prefix, matching every appended row.
 * Model source replay is NOT referee, medical or sanctions authentication.
 */
export function reviewM1V45PotentialCAS(
  initialCareer:unknown,journalCandidate:unknown,claimCandidate:unknown,
):M1V45ReviewResult {
  if(!isPlainJsonTree(claimCandidate)||!rec(claimCandidate)||
      Object.keys(claimCandidate).length!==KEYS.length||
      !KEYS.every(k=>Object.hasOwn(claimCandidate,k))||
      claimCandidate.schemaVersion!==M1_V45_REVIEW_SCHEMA||
      !isStableId(claimCandidate.careerId)||
      !Number.isSafeInteger(claimCandidate.expectedRevision)||
      (claimCandidate.expectedRevision as number)<0||
      (claimCandidate.expectedRevision as number)>240||
      !Array.isArray(claimCandidate.requests)||
      claimCandidate.requests.length<1||
      claimCandidate.requests.length>16||
      (claimCandidate.expectedRevision as number)+
        claimCandidate.requests.length>240)return invalid('INVALID_CLAIM');

  const journal=validateM1V32ExposureJournal(
    initialCareer,journalCandidate);
  if(!journal.ok)return invalid('CORRUPTED_HISTORY');
  if(journal.journal.careerId!==claimCandidate.careerId)
    return invalid('INVALID_CLAIM');
  const expectedRevision=claimCandidate.expectedRevision as number;
  const commandCount=claimCandidate.requests.length;
  const current=journal.journal;
  if(current.revision<expectedRevision)
    return statusResult('DIVERGENT_HISTORY',current.careerId,
      current.revision,expectedRevision,commandCount);
  const baseline={
    ...current,revision:expectedRevision,
    results:current.results.slice(0,expectedRevision),
  };
  const expected=applyM1V32ExposureBatch(
    initialCareer,baseline,claimCandidate.requests,expectedRevision);
  if(!expected.ok)return invalid('INVALID_SOURCE');

  if(current.revision===expectedRevision)
    return statusResult('NOT_OBSERVED_AT_READ',current.careerId,
      current.revision,expectedRevision,commandCount);
  if(current.revision<expectedRevision+commandCount)
    return statusResult('DIVERGENT_HISTORY',current.careerId,
      current.revision,expectedRevision,commandCount);
  const claimedRows=expected.journal.results.slice(expectedRevision);
  const savedRows=current.results.slice(
    expectedRevision,expectedRevision+commandCount);
  return statusResult(
    sameCanonicalValue(claimedRows,savedRows)?
      'OBSERVED_COMMITTED':'DIVERGENT_HISTORY',
    current.careerId,current.revision,expectedRevision,commandCount);
}
