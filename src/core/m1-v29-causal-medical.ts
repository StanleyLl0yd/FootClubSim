import { sameCanonicalValue } from './canonical-value.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { simulateM1V29CausalMedicalSource,
  type M1V29CausalAssessment, type M1V29CausalSourceRun }
  from './m1-v23-temporary-treatment.js';

/**
 * Isolated v29: the in-game referee + synthetic medical stream runs
 * inside one physical-XI match, not against a caller-supplied injury.
 * This is simulation provenance, not independent clinical evidence.
 */
export const M1_V29_CAUSAL_MEDICAL_SCHEMA = 1 as const;
export const M1_V29_CAUSAL_MEDICAL_RULES =
  'ifab-2026-27-internal-foul-linked-medical-prototype' as const;

export type M1V29CausalMedicalRun =
  | Extract<M1V29CausalSourceRun, {ok:false}>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V29_CAUSAL_MEDICAL_SCHEMA;
    rulesId: typeof M1_V29_CAUSAL_MEDICAL_RULES;
    status: 'SYNTHETIC_VICTIM_AND_MEDICAL_NEED_NOT_CLINICALLY_VERIFIED';
    fixtureId: string;
    assessments: readonly M1V29CausalAssessment[];
    source: Extract<M1V29CausalSourceRun, {ok:true}>;
    sourcePhysicalXIAndMedicalActionsReplayed: true;
    internalRefereeDecisionGenerated: true;
    realWorldInjuryAuthenticated: false;
    externalRefereeAuthorityAuthenticated: false;
    externalMedicalAuthorityAuthenticated: false;
    physicalTimingAuthenticated: false;
    calibratedInjuryRate: false;
    namedBenchTreatmentSupported: false;
    otherLaw5ExceptionsSupported: false;
    careerJournalIntegrated: false;
  }>;

export function simulateM1V29CausalMedical(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown = [],
  inPlayCommands: unknown = [],
): M1V29CausalMedicalRun {
  const source = simulateM1V29CausalMedicalSource(
    prematch, policy, halfTimeCommands, inPlayCommands);
  if (!source.ok) return source;
  return {
    ok: true, schemaVersion: M1_V29_CAUSAL_MEDICAL_SCHEMA,
    rulesId: M1_V29_CAUSAL_MEDICAL_RULES,
    status: 'SYNTHETIC_VICTIM_AND_MEDICAL_NEED_NOT_CLINICALLY_VERIFIED',
    fixtureId: source.fixtureId,
    assessments: source.causalAssessments.map(a => ({...a})),
    source, sourcePhysicalXIAndMedicalActionsReplayed: true,
    internalRefereeDecisionGenerated: true,
    realWorldInjuryAuthenticated: false,
    externalRefereeAuthorityAuthenticated: false,
    externalMedicalAuthorityAuthenticated: false,
    physicalTimingAuthenticated: false,
    calibratedInjuryRate: false,
    namedBenchTreatmentSupported: false,
    otherLaw5ExceptionsSupported: false,
    careerJournalIntegrated: false,
  };
}

export function verifyM1V29CausalMedical(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown,
  inPlayCommands: unknown, candidate: unknown,
): boolean {
  if (!isPlainJsonTree(candidate)) return false;
  const replay = simulateM1V29CausalMedical(
    prematch, policy, halfTimeCommands, inPlayCommands);
  return replay.ok && sameCanonicalValue(replay, candidate);
}
