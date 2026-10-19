import { isPlainJsonTree } from './plain-json-tree.js';
import { M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS,
  startM1Clock } from './m1-clock.js';
import { inspectM1TimedSubstitutionDeparture }
  from './m1-timed-substitution-protocol.js';
import { inspectM1GroupedSubstitutionDepartures }
  from './m1-grouped-substitution-clock.js';
import { simulateM1V8MedicalPhases, type M1V8Result,
  type M1V8Error } from './m1-v8-medical-phases.js';

/**
 * M1-P3 bridge: require one complete normal substitution-time observation for
 * each team/checkpoint BEFORE simulating with unchanged v8. All timing claims
 * are still externally UNAUTHENTICATED and are not actual referee decisions.
 */
export const M1_V8_TIMED_SUBSTITUTION_ADMISSION_VERSION = 1 as const;
type Failure = 'INVALID_PREMATCH' | 'INVALID_DOSSIER' | 'NO_EVIDENCE' |
  'UNSUPPORTED_HALF_TIME' | 'WRONG_CHECKPOINT' | 'MISMATCHED_PARTICIPANTS' |
  'LATE_REQUIRES_REFEREE_RULING';
type Command = Readonly<{
  commandId: string;
  fixtureId: string;
  teamId: string;
  outPlayerId: string;
  inPlayerId: string;
  elapsedSeconds: number;
  stoppage: string;
  kind: 'substitute-normal';
}>;
type Dossier = Readonly<{
  checkpointSeconds: number;
  evidence: unknown;
}>;
export type M1V8TimedSubstitutionExecution =
  | Readonly<{ ok: false; error: Failure }>
  | Readonly<{ ok: false; error: 'MATCH_REJECTED'; matchError: M1V8Error }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V8_TIMED_SUBSTITUTION_ADMISSION_VERSION;
    status: 'REPORTED_TIMING_BOUND_NOT_REFEREE_AUTHENTICATED';
    normalSubstitutionCount: number;
    evidenceGroupCount: number;
    physicalStoppageAuthenticated: false;
    refereeAuthorityAuthenticated: false;
    result: M1V8Result;
  }>;
const bad = (error: Failure): M1V8TimedSubstitutionExecution =>
  ({ ok: false, error });
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).length === keys.length &&
  keys.every(k => Object.hasOwn(v, k));
const checkpoint = (s: unknown): s is number =>
  Number.isInteger(s) && (s as number) > 0 &&
  (s as number) < M1_CLOCK_END_SECONDS &&
  (s as number) % M1_CLOCK_STEP_SECONDS === 0;
const groupKey = (teamId: string, seconds: number) =>
  teamId + '\u0000' + seconds;

/**
 * Existing M1 v8 accepts ordinary normal-substitution commands at 300-second
 * checkpoints. This bridge refuses to auto-interpret those as physically
 * completed when no corresponding IFAB 2026/27 departure-clock evidence
 * exists. Only source-backed, timely single/group claims are cross-checked.
 *
 * It does NOT claim the clock or signal is authentic. A future self-contained
 * virtual referee must own whistles, game clock, entry and exceptions.
 */
export function simulateM1V8WithTimedSubstitutionCoverage(
  prematch: unknown, policy: unknown, plannedCommands: unknown,
  refereeDecisions: unknown, medicalActions: unknown,
  timingDossiers: unknown,
): M1V8TimedSubstitutionExecution {
  const started = startM1Clock(prematch);
  if (!started.ok) return bad('INVALID_PREMATCH');
  if (!isPlainJsonTree(plannedCommands) ||
      !Array.isArray(plannedCommands) ||
      plannedCommands.length > 212 ||
      !isPlainJsonTree(timingDossiers) ||
      !Array.isArray(timingDossiers) ||
      timingDossiers.length > 18) return bad('INVALID_DOSSIER');
  const substitutions = new Map<string, Command[]>();
  let number = 0;
  for (const input of plannedCommands) {
    if (!record(input) || input.kind !== 'substitute-normal') continue;
    if (input.fixtureId !== started.state.fixtureId ||
        typeof input.teamId !== 'string' || !checkpoint(input.elapsedSeconds) ||
        typeof input.outPlayerId !== 'string' ||
        typeof input.inPlayerId !== 'string' ||
        (input.stoppage !== 'referee-authorized' && input.stoppage !== 'half-time')) {
      return bad('INVALID_DOSSIER');
    }
    if (input.stoppage === 'half-time') return bad('UNSUPPORTED_HALF_TIME');
    const key = groupKey(input.teamId, input.elapsedSeconds);
    const group = substitutions.get(key) ?? [];
    if (group.length >= 5) return bad('INVALID_DOSSIER');
    group.push(input as unknown as Command);
    substitutions.set(key, group);
    number++;
  }
  if (timingDossiers.length !== substitutions.size) {
    return bad('NO_EVIDENCE');
  }
  const used = new Set<string>();
  for (const raw of timingDossiers) {
    if (!record(raw) || !exact(raw, ['checkpointSeconds', 'evidence']) ||
        !checkpoint(raw.checkpointSeconds) || !record(raw.evidence)) {
      return bad('INVALID_DOSSIER');
    }
    const evidence = raw.evidence;
    if (evidence.restartRunningSeconds !== raw.checkpointSeconds) {
      return bad('WRONG_CHECKPOINT');
    }
    if (typeof evidence.teamId !== 'string' ||
        typeof evidence.fixtureId !== 'string' ||
        evidence.fixtureId !== started.state.fixtureId) {
      return bad('INVALID_DOSSIER');
    }
    const key = groupKey(evidence.teamId, raw.checkpointSeconds);
    if (used.has(key)) return bad('INVALID_DOSSIER');
    const expected = substitutions.get(key);
    if (!expected) return bad('MISMATCHED_PARTICIPANTS');
    used.add(key);
    const claims = evidence.schemaVersion === 1 ?
      inspectM1TimedSubstitutionDeparture(prematch, evidence) :
      evidence.schemaVersion === 2 ?
        inspectM1GroupedSubstitutionDepartures(prematch, evidence) : null;
    if (!claims?.ok) return bad('INVALID_DOSSIER');
    const actual = claims.schemaVersion === 1 ?
      [{ outPlayerId: claims.outPlayerId, inPlayerId: claims.inPlayerId,
        status: claims.status }] : claims.outcomes;
    if (expected.length !== actual.length ||
        actual.some((item, i) =>
          item.outPlayerId !== expected[i]?.outPlayerId ||
          item.inPlayerId !== expected[i]?.inPlayerId)) {
      return bad('MISMATCHED_PARTICIPANTS');
    }
    if (actual.some(item => item.status !== 'WITHIN_TEN_SECONDS')) {
      return bad('LATE_REQUIRES_REFEREE_RULING');
    }
  }
  if (used.size !== substitutions.size) return bad('NO_EVIDENCE');
  const computed = simulateM1V8MedicalPhases(
    prematch, policy, plannedCommands, refereeDecisions, medicalActions);
  if (!computed.ok) return { ok: false, error: 'MATCH_REJECTED',
    matchError: computed.error };
  return {
    ok: true, schemaVersion: M1_V8_TIMED_SUBSTITUTION_ADMISSION_VERSION,
    status: 'REPORTED_TIMING_BOUND_NOT_REFEREE_AUTHENTICATED',
    normalSubstitutionCount: number, evidenceGroupCount: used.size,
    physicalStoppageAuthenticated: false,
    refereeAuthorityAuthenticated: false,
    result: computed,
  };
}
