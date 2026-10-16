import { isStableId } from './identifiers.js';
import { M1_CLOCK_END_SECONDS, type M1PrematchInput, startM1Clock } from './m1-clock.js';

/**
 * Limited, source-pinned IFAB 2026/27 off-field medical return admission.
 * This is NOT the game clock, an injury diagnosis or referee authentication.
 */
export const M1_OFF_FIELD_RETURN_SCHEMA_VERSION = 1 as const;
export const M1_OFF_FIELD_RETURN_RULES_ID = 'ifab-2026-27-off-field-limited-v1' as const;
const FIELDS = ['schemaVersion', 'fixtureId', 'teamId', 'playerId', 'reason',
  'offFieldAtRunningSeconds', 'restartAtRunningSeconds',
  'requestedAtRunningSeconds', 'returnContext', 'ballInPlay',
  'entryBoundary', 'refereeSignalId'] as const;

export interface M1OffFieldReturn {
  readonly schemaVersion: typeof M1_OFF_FIELD_RETURN_SCHEMA_VERSION;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly reason: 'injury-stopped-play' | 'medical-staff-entered' |
    'requested-on-field-attention';
  readonly offFieldAtRunningSeconds: number;
  /** One-minute countdown starts with the verified restart, never at exit. */
  readonly restartAtRunningSeconds: number;
  readonly requestedAtRunningSeconds: number;
  readonly returnContext: 'running-clock' | 'half-time';
  readonly ballInPlay: boolean;
  readonly entryBoundary: 'touchline' | 'goal-line';
  /** Must be authenticated by a separately trusted referee controller. */
  readonly refereeSignalId: string;
}
export type M1MedicalReturnError = 'INVALID_PREMATCH' | 'INVALID_DECISION' |
  'INELIGIBLE_PLAYER' | 'EXCEPTION_RULING_REQUIRED' |
  'RETURN_TOO_EARLY' | 'WRONG_ENTRY_BOUNDARY' |
  'REFEREE_SIGNAL_REQUIRED';
export type M1MedicalReturnResult =
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_OFF_FIELD_RETURN_SCHEMA_VERSION;
    rulesId: typeof M1_OFF_FIELD_RETURN_RULES_ID;
    fixtureId: string; teamId: string; playerId: string;
    eligibleAtRunningSeconds: number;
    returnContext: M1OffFieldReturn['returnContext'];
  }>
  | Readonly<{ ok: false; error: M1MedicalReturnError }>;

const error = (e: M1MedicalReturnError): M1MedicalReturnResult => ({ ok: false, error: e });
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const validTime = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) < M1_CLOCK_END_SECONDS;

/** Only a verified *ordinary outfield* treatment path, never an IFAB exception. */
export function admitM1OffFieldMedicalReturn(
  prematch: unknown, candidate: unknown,
): M1MedicalReturnResult {
  const checked = startM1Clock(prematch);
  if (!checked.ok) return error('INVALID_PREMATCH');
  if (!rec(candidate) || Object.keys(candidate).length !== FIELDS.length ||
      FIELDS.some(key => !Object.hasOwn(candidate, key)) ||
      candidate.schemaVersion !== M1_OFF_FIELD_RETURN_SCHEMA_VERSION ||
      !isStableId(candidate.fixtureId) || !isStableId(candidate.teamId) ||
      !isStableId(candidate.playerId) ||
      !['injury-stopped-play', 'medical-staff-entered',
        'requested-on-field-attention'].includes(candidate.reason as string) ||
      !validTime(candidate.offFieldAtRunningSeconds) ||
      !validTime(candidate.restartAtRunningSeconds) ||
      !validTime(candidate.requestedAtRunningSeconds) ||
      !['running-clock', 'half-time'].includes(candidate.returnContext as string) ||
      typeof candidate.ballInPlay !== 'boolean' ||
      !['touchline', 'goal-line'].includes(candidate.entryBoundary as string)) {
    return error('INVALID_DECISION');
  }
  const source = prematch as M1PrematchInput;
  if (candidate.fixtureId !== source.fixture.id) return error('INVALID_DECISION');
  const side = candidate.teamId === source.fixture.homeClubId ? 'home' :
    candidate.teamId === source.fixture.awayClubId ? 'away' : null;
  if (!side) return error('INVALID_DECISION');
  const lineup = side === 'home' ? source.homeLineup : source.awayLineup;
  if (!lineup.starters.includes(candidate.playerId as string)) {
    // A substituted-in participant needs the separate verified v7 on-field
    // chronology. This standalone initial-XI-only contract cannot prove it.
    return error('INELIGIBLE_PLAYER');
  }
  const player = source.catalog.players.find(p => p.id === candidate.playerId);
  if (!player || player.primaryPosition === 'GK') {
    return error('EXCEPTION_RULING_REQUIRED');
  }
  const off = candidate.offFieldAtRunningSeconds as number;
  const restart = candidate.restartAtRunningSeconds as number;
  const requested = candidate.requestedAtRunningSeconds as number;
  if (restart < off || requested < restart) return error('INVALID_DECISION');
  if (!isStableId(candidate.refereeSignalId)) return error('REFEREE_SIGNAL_REQUIRED');
  const normalEarliest = restart + 60;
  let eligibleAt = normalEarliest;
  if (candidate.returnContext === 'half-time') {
    // IFAB permits re-entry at the start of the second half if one minute
    // had not elapsed before half-time. This branch is NOT extra-time logic.
    if (off >= 2700 || restart >= 2700 || normalEarliest <= 2700 ||
        requested !== 2700 || candidate.ballInPlay) {
      return error('INVALID_DECISION');
    }
    eligibleAt = 2700;
  }
  if (requested < eligibleAt) return error('RETURN_TOO_EARLY');
  if (candidate.ballInPlay && candidate.entryBoundary !== 'touchline') {
    return error('WRONG_ENTRY_BOUNDARY');
  }
  return {
    ok: true, schemaVersion: M1_OFF_FIELD_RETURN_SCHEMA_VERSION,
    rulesId: M1_OFF_FIELD_RETURN_RULES_ID,
    fixtureId: source.fixture.id, teamId: candidate.teamId as string,
    playerId: candidate.playerId as string,
    eligibleAtRunningSeconds: eligibleAt,
    returnContext: candidate.returnContext as M1OffFieldReturn['returnContext'],
  };
}
