import { isStableId } from './identifiers.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { validateM1V26ExposureJournal }
  from './m1-v26-exposure-journal.js';
import { inspectM1V25GeneratedFoulLaw5Evidence,
  type M1V25Law5FoulInspection }
  from './m1-v25-law5-generated-foul-evidence.js';
import { inspectM1V27NamedSubstituteFoulEvidence,
  type M1V27Law5BenchResult }
  from './m1-v27-law5-named-substitute-evidence.js';
import type { InitialCareerSave } from './save.js';

/**
 * v28 reads a fully replay-validated v26 career journal before inspecting
 * a synthetic Law 5 incident. A caller cannot splice together a different
 * prematch, coach action, or match to authorize a medical exception.
 *
 * This is model provenance, NOT authentication of a referee, a clinician,
 * the actual occurrence of an injury or treatment permission.
 */
export const M1_V28_JOURNAL_LAW5_SCHEMA = 1 as const;
export const M1_V28_JOURNAL_LAW5_RULES =
  'm1-v26-journal-source-bound-v25-v27-law5-evidence-only' as const;

type Evidence =
  | Extract<M1V25Law5FoulInspection, {ok: true}>
  | Extract<M1V27Law5BenchResult, {ok: true}>;

export type M1V28JournalLaw5Error =
  'INVALID_INITIAL_CAREER' | 'INVALID_JOURNAL' |
  'INVALID_REVIEW_SCOPE' | 'STALE_REVISION' |
  'FIXTURE_NOT_FINALIZED' | 'INCIDENT_EVIDENCE_REJECTED';

export type M1V28JournalLaw5Review =
  | Readonly<{ok: false; error: M1V28JournalLaw5Error;
    evidenceError?: string}>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V28_JOURNAL_LAW5_SCHEMA;
    rulesId: typeof M1_V28_JOURNAL_LAW5_RULES;
    status: 'JOURNAL_AND_SYNTHETIC_FOUL_REPLAYED_NO_MEDICAL_AUTHORITY';
    careerId: string;
    journalRevision: number;
    fixtureId: string;
    appliedCommandId: string;
    incidentId: string;
    evidence: Evidence;
    journalSourceReplayed: true;
    actualInjuryAuthenticated: false;
    externalRefereeAuthorityAuthenticated: false;
    externalMedicalAuthorityAuthenticated: false;
    physicalLeaveOrReturnAuthorized: false;
  }>;

const fail = (error: M1V28JournalLaw5Error,
  evidenceError?: string): M1V28JournalLaw5Review =>
  evidenceError ? {ok: false, error, evidenceError} : {ok: false, error};

/**
 * Full old history replay occurs before selecting a fixture and before any
 * case-specific incident inspection. No fast path skips journal validation.
 */
export function inspectM1V28JournalBoundLaw5Evidence(
  initial: unknown, journalCandidate: unknown,
  expectedRevision: unknown, fixtureId: unknown,
  claim: unknown, incidentId: unknown,
): M1V28JournalLaw5Review {
  if (!Number.isSafeInteger(expectedRevision) ||
      (expectedRevision as number) < 0 ||
      (expectedRevision as number) > 240 ||
      !isStableId(fixtureId) || !isStableId(incidentId) ||
      !isPlainJsonTree(claim)) return fail('INVALID_REVIEW_SCOPE');

  const validated = validateM1V26ExposureJournal(initial, journalCandidate);
  if (!validated.ok) {
    return fail(validated.error === 'INVALID_INITIAL_CAREER' ?
      'INVALID_INITIAL_CAREER' : 'INVALID_JOURNAL');
  }
  const journal = validated.journal;
  if (journal.revision !== expectedRevision) return fail('STALE_REVISION');
  const row = journal.results.find(r => r.fixtureId === fixtureId);
  if (!row) return fail('FIXTURE_NOT_FINALIZED');
  const original = initial as InitialCareerSave;
  const prematch = {...row.source.prematch, catalog: original.catalog};
  const sourceArgs = [
    prematch, row.source.policy, claim, incidentId,
    row.source.halfTimeCommands, row.source.inPlayCommands,
  ] as const;
  const strict = inspectM1V25GeneratedFoulLaw5Evidence(...sourceArgs);
  let evidence: Evidence;
  if (strict.ok) {
    evidence = strict;
  } else if (strict.error === 'CLAIM_REJECTED' &&
      strict.claimError === 'UNSUPPORTED_PLAYER_HISTORY') {
    const substitute = inspectM1V27NamedSubstituteFoulEvidence(...sourceArgs);
    if (!substitute.ok) {
      return fail('INCIDENT_EVIDENCE_REJECTED', substitute.error);
    }
    evidence = substitute;
  } else {
    return fail('INCIDENT_EVIDENCE_REJECTED', strict.error);
  }
  if (evidence.fixtureId !== fixtureId || evidence.incidentId !== incidentId) {
    return fail('INCIDENT_EVIDENCE_REJECTED', 'SOURCE_ID_MISMATCH');
  }
  return {
    ok: true, schemaVersion: M1_V28_JOURNAL_LAW5_SCHEMA,
    rulesId: M1_V28_JOURNAL_LAW5_RULES,
    status: 'JOURNAL_AND_SYNTHETIC_FOUL_REPLAYED_NO_MEDICAL_AUTHORITY',
    careerId: journal.careerId, journalRevision: journal.revision,
    fixtureId, appliedCommandId: row.commandId, incidentId,
    evidence, journalSourceReplayed: true,
    actualInjuryAuthenticated: false,
    externalRefereeAuthorityAuthenticated: false,
    externalMedicalAuthorityAuthenticated: false,
    physicalLeaveOrReturnAuthorized: false,
  };
}
