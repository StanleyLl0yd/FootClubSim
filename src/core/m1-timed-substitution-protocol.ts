import { isStableId } from './identifiers.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { M1_CLOCK_END_SECONDS, startM1Clock, type M1PrematchInput }
  from './m1-clock.js';

/**
 * IFAB 2026/27 Law 3, single outgoing player, ten-second departure rule.
 * Source authenticity and physical stoppages must be verified outside this
 * pure research-only admission. This does NOT execute a substitution.
 */
export const M1_TIMED_SUBSTITUTION_SCHEMA_VERSION = 1 as const;
export const M1_TIMED_SUBSTITUTION_RULES_ID =
  'ifab-2026-27-single-departure-limited' as const;
const KEYS = [
  'schemaVersion', 'fixtureId', 'teamId', 'outPlayerId', 'inPlayerId',
  'refereeSignalId', 'groupSize', 'signalWallSeconds',
  'exitWallSeconds', 'restartRunningSeconds',
] as const;

export interface M1TimedSubstitutionEvidence {
  readonly schemaVersion: typeof M1_TIMED_SUBSTITUTION_SCHEMA_VERSION;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly outPlayerId: string;
  readonly inPlayerId: string;
  /** External referee signal identity, not a proof of its authenticity. */
  readonly refereeSignalId: string;
  /** Group substitutions use the last board/signal; excluded from v1. */
  readonly groupSize: 1;
  /** Elapsed real-world wall seconds, not 300-second match checkpoints. */
  readonly signalWallSeconds: number;
  readonly exitWallSeconds: number;
  /** Running game clock when play restarted, not the wall-clock timestamp. */
  readonly restartRunningSeconds: number;
}
export type M1TimedSubstitutionError =
  'INVALID_PREMATCH' | 'INVALID_EVIDENCE' | 'WRONG_FIXTURE' |
  'UNKNOWN_TEAM' | 'UNKNOWN_NAMED_PLAYER' | 'REFEREE_SIGNAL_REQUIRED' |
  'GROUPED_RULING_REQUIRED';
export type M1TimedSubstitutionResult =
  | Readonly<{ ok: false; error: M1TimedSubstitutionError }>
  | Readonly<{
    ok: true;
    schemaVersion: 1;
    rulesId: typeof M1_TIMED_SUBSTITUTION_RULES_ID;
    fixtureId: string;
    outPlayerId: string;
    inPlayerId: string;
    status: 'WITHIN_TEN_SECONDS' | 'REFEREE_REVIEW_REQUIRED';
    /** Conditional threshold only: not a valid restart or entry decision. */
    conditionalEarliestLateEntryRunningSeconds: number | null;
    refereeEntryApprovalRequired: true;
  }>;

const fail = (error: M1TimedSubstitutionError): M1TimedSubstitutionResult =>
  ({ ok: false, error });
const validSecond = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 &&
  (value as number) <= 86_400;

/**
 * Checking departure time cannot authenticate the referee or medical
 * exceptions, prove a physical stoppage, or update the active XI.
 * Above 10 seconds means referee REVIEW, not automatic punishment: the
 * referee may waive the limit for injury, safety or boundary proximity.
 */
export function inspectM1TimedSubstitutionDeparture(
  prematch: unknown, evidence: unknown,
): M1TimedSubstitutionResult {
  const started = startM1Clock(prematch);
  if (!started.ok) return fail('INVALID_PREMATCH');
  if (!isPlainJsonTree(evidence) || evidence === null ||
      typeof evidence !== 'object' || Array.isArray(evidence)) {
    return fail('INVALID_EVIDENCE');
  }
  const raw = evidence as Record<string, unknown>;
  if (Object.keys(raw).length !== KEYS.length ||
      KEYS.some(key => !Object.hasOwn(raw, key)) ||
      raw.schemaVersion !== M1_TIMED_SUBSTITUTION_SCHEMA_VERSION ||
      !isStableId(raw.fixtureId) || !isStableId(raw.teamId) ||
      !isStableId(raw.outPlayerId) || !isStableId(raw.inPlayerId) ||
      raw.outPlayerId === raw.inPlayerId ||
      !validSecond(raw.signalWallSeconds) || !validSecond(raw.exitWallSeconds) ||
      (raw.exitWallSeconds as number) < (raw.signalWallSeconds as number) ||
      !Number.isSafeInteger(raw.restartRunningSeconds) ||
      (raw.restartRunningSeconds as number) < 0 ||
      (raw.restartRunningSeconds as number) >= M1_CLOCK_END_SECONDS) {
    return fail('INVALID_EVIDENCE');
  }
  if (!isStableId(raw.refereeSignalId)) return fail('REFEREE_SIGNAL_REQUIRED');
  if (raw.groupSize !== 1) return fail('GROUPED_RULING_REQUIRED');
  const input = prematch as M1PrematchInput;
  if (raw.fixtureId !== started.state.fixtureId) return fail('WRONG_FIXTURE');
  const lineup = raw.teamId === started.state.homeClubId ? input.homeLineup :
    raw.teamId === started.state.awayClubId ? input.awayLineup : null;
  if (!lineup) return fail('UNKNOWN_TEAM');
  const named = [...lineup.starters, ...lineup.bench];
  if (!named.includes(raw.outPlayerId as string) ||
      !lineup.bench.includes(raw.inPlayerId as string)) {
    return fail('UNKNOWN_NAMED_PLAYER');
  }
  const late = (raw.exitWallSeconds as number) -
    (raw.signalWallSeconds as number) > 10;
  return {
    ok: true, schemaVersion: M1_TIMED_SUBSTITUTION_SCHEMA_VERSION,
    rulesId: M1_TIMED_SUBSTITUTION_RULES_ID,
    fixtureId: started.state.fixtureId,
    outPlayerId: raw.outPlayerId as string,
    inPlayerId: raw.inPlayerId as string,
    status: late ? 'REFEREE_REVIEW_REQUIRED' : 'WITHIN_TEN_SECONDS',
    conditionalEarliestLateEntryRunningSeconds: late ?
      (raw.restartRunningSeconds as number) + 60 : null,
    refereeEntryApprovalRequired: true,
  };
}
