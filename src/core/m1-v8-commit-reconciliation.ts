import { sameCanonicalValue } from './canonical-value.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { applyM1V8MatchResultBatch, validateM1V8MatchJournal }
  from './m1-v8-result-journal.js';

/**
 * Read-only reconciliation of an indeterminate v8 CAS outcome.
 * This is a verified journal-snapshot observation, never permission to retry
 * a command, claim OS crash durability, or skip a real authoritative read.
 */
export const M1_V8_COMMIT_RECONCILIATION_VERSION = 1 as const;
export type M1V8CommitObservation =
  'RECORDED_IDENTICAL' | 'UNCHANGED_IN_SNAPSHOT' |
  'DIVERGED_IN_SNAPSHOT' | 'HISTORY_SHORTER_THAN_EXPECTED';
export type M1V8CommitReconciliation =
  | Readonly<{ ok: true; schemaVersion: 1;
    status: M1V8CommitObservation; journalRevision: number;
    expectedRevision: number; requestedFixtures: number }>
  | Readonly<{ ok: false; error:
    'INVALID_REQUEST' | 'INVALID_JOURNAL' | 'UNVERIFIABLE_REQUEST' }>;

const failure = (error: 'INVALID_REQUEST' | 'INVALID_JOURNAL' |
  'UNVERIFIABLE_REQUEST'): M1V8CommitReconciliation =>
  ({ ok: false, error });

export function reconcileM1V8UncertainCommit(
  initial: unknown, storedCandidate: unknown,
  expectedRevision: number, requests: unknown,
): M1V8CommitReconciliation {
  if (!Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 || expectedRevision > 240 ||
      !Array.isArray(requests) || requests.length < 1 ||
      requests.length > 16 || !isPlainJsonTree(requests)) {
    return failure('INVALID_REQUEST');
  }
  try {
    if (JSON.stringify(requests).length > 8_000_000) {
      return failure('INVALID_REQUEST');
    }
  } catch {
    return failure('INVALID_REQUEST');
  }
  const checked = validateM1V8MatchJournal(initial, storedCandidate);
  if (!checked.ok) return failure('INVALID_JOURNAL');
  const journal = checked.journal;
  const revision = journal.revision;
  const success = (status: M1V8CommitObservation): M1V8CommitReconciliation =>
    ({ ok: true, schemaVersion: M1_V8_COMMIT_RECONCILIATION_VERSION,
      status, journalRevision: revision, expectedRevision,
      requestedFixtures: requests.length });

  if (revision < expectedRevision) {
    // A restored/shorter history cannot tell us whether the write committed.
    return success('HISTORY_SHORTER_THAN_EXPECTED');
  }
  const prefix = {
    ...journal, revision: expectedRevision,
    results: journal.results.slice(0, expectedRevision),
  };
  // Regenerate the proposed fixture rows from the same strictly verified
  // source prefix; checking command IDs alone can miss colliding payloads.
  const intended = applyM1V8MatchResultBatch(initial, prefix, requests);
  if (!intended.ok) return failure('UNVERIFIABLE_REQUEST');
  if (revision === expectedRevision) return success('UNCHANGED_IN_SNAPSHOT');
  const end = expectedRevision + requests.length;
  if (revision < end || end > 240) return success('DIVERGED_IN_SNAPSHOT');
  const actual = journal.results.slice(expectedRevision, end);
  const proposed = intended.journal.results.slice(expectedRevision, end);
  return success(sameCanonicalValue(actual, proposed) ?
    'RECORDED_IDENTICAL' : 'DIVERGED_IN_SNAPSHOT');
}
