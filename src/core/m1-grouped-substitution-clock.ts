import { isStableId } from './identifiers.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { M1_CLOCK_END_SECONDS, startM1Clock, type M1PrematchInput }
  from './m1-clock.js';

/** IFAB 2026/27 Law 3; isolated multi-player departure clock. */
export const M1_GROUP_DEPARTURE_SCHEMA_VERSION = 2 as const;
export const M1_GROUP_DEPARTURE_RULES_ID =
  'ifab-2026-27-group-last-signal-limited' as const;
const GROUP_FIELDS = [
  'schemaVersion', 'kind', 'fixtureId', 'teamId', 'stoppageId',
  'finalSignalWallSeconds', 'restartRunningSeconds', 'departures',
] as const;
const PLAYER_FIELDS = [
  'outPlayerId', 'inPlayerId', 'refereeSignalId', 'signalWallSeconds',
  'exitWallSeconds',
] as const;

export interface M1GroupedDeparturePlayer {
  readonly outPlayerId: string;
  readonly inPlayerId: string;
  readonly refereeSignalId: string;
  readonly signalWallSeconds: number;
  readonly exitWallSeconds: number;
}
export interface M1GroupedDepartureClaim {
  readonly schemaVersion: typeof M1_GROUP_DEPARTURE_SCHEMA_VERSION;
  readonly kind: 'group-normal-departures';
  readonly fixtureId: string;
  readonly teamId: string;
  readonly stoppageId: string;
  /** Must equal last actually asserted signal in this group. */
  readonly finalSignalWallSeconds: number;
  /** Verified running-play restart time is NOT established by this JSON. */
  readonly restartRunningSeconds: number;
  readonly departures: readonly M1GroupedDeparturePlayer[];
}
export type M1GroupedDepartureError =
  'INVALID_PREMATCH' | 'INVALID_CLAIM' | 'WRONG_FIXTURE' |
  'UNKNOWN_TEAM' | 'UNKNOWN_NAMED_PLAYER' | 'DUPLICATE_PARTICIPANT' |
  'UNVERIFIABLE_SIGNAL_ORDER';
export type M1GroupedDepartureResult =
  | Readonly<{ ok: false; error: M1GroupedDepartureError }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_GROUP_DEPARTURE_SCHEMA_VERSION;
    rulesId: typeof M1_GROUP_DEPARTURE_RULES_ID;
    fixtureId: string;
    teamId: string;
    stoppageId: string;
    finalSignalWallSeconds: number;
    groupSize: number;
    outcomes: readonly Readonly<{
      outPlayerId: string;
      inPlayerId: string;
      status: 'WITHIN_TEN_SECONDS' | 'REFEREE_REVIEW_REQUIRED';
      conditionalEarliestLateEntryRunningSeconds: number | null;
      refereeEntryApprovalRequired: true;
    }>[];
    physicalStoppageAuthenticated: false;
    refereeAuthorityAuthenticated: false;
  }>;

const fail = (error: M1GroupedDepartureError): M1GroupedDepartureResult =>
  ({ ok: false, error });
const exact = (object: object, keys: readonly string[]): boolean =>
  Reflect.ownKeys(object).length === keys.length &&
  keys.every(key => Object.hasOwn(object, key));
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const validWallSecond = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 &&
  (value as number) <= 86_400;

/**
 * A referee's independently verified signal and active-team legal transition
 * are still required. This routine only derives a conditional clock result.
 * The IFAB warning that boards must not be deliberately delayed also needs
 * external adjudication, not an assumption based on arbitrary timestamps.
 */
export function inspectM1GroupedSubstitutionDepartures(
  prematch: unknown, claim: unknown,
): M1GroupedDepartureResult {
  const started = startM1Clock(prematch);
  if (!started.ok) return fail('INVALID_PREMATCH');
  if (!isPlainJsonTree(claim) || !record(claim) ||
      !exact(claim, GROUP_FIELDS) ||
      claim.schemaVersion !== M1_GROUP_DEPARTURE_SCHEMA_VERSION ||
      claim.kind !== 'group-normal-departures' ||
      !isStableId(claim.fixtureId) || !isStableId(claim.teamId) ||
      !isStableId(claim.stoppageId) ||
      !validWallSecond(claim.finalSignalWallSeconds) ||
      !Number.isSafeInteger(claim.restartRunningSeconds) ||
      (claim.restartRunningSeconds as number) < 0 ||
      (claim.restartRunningSeconds as number) >= M1_CLOCK_END_SECONDS ||
      !Array.isArray(claim.departures) ||
      claim.departures.length < 2 || claim.departures.length > 5) {
    return fail('INVALID_CLAIM');
  }
  if (claim.fixtureId !== started.state.fixtureId) return fail('WRONG_FIXTURE');
  const input = prematch as M1PrematchInput;
  const lineup = claim.teamId === started.state.homeClubId ? input.homeLineup :
    claim.teamId === started.state.awayClubId ? input.awayLineup : null;
  if (!lineup) return fail('UNKNOWN_TEAM');
  const named = new Set([...lineup.starters, ...lineup.bench]);
  const bench = new Set(lineup.bench);
  const exits = new Set<string>(), entries = new Set<string>(),
    signals = new Set<string>();
  const observations: M1GroupedDeparturePlayer[] = [];
  let lastBoard = -1;
  for (const row of claim.departures) {
    if (!record(row) || !exact(row, PLAYER_FIELDS) ||
        !isStableId(row.outPlayerId) || !isStableId(row.inPlayerId) ||
        !isStableId(row.refereeSignalId) ||
        !validWallSecond(row.signalWallSeconds) ||
        !validWallSecond(row.exitWallSeconds) ||
        row.exitWallSeconds < row.signalWallSeconds) {
      return fail('INVALID_CLAIM');
    }
    if (row.signalWallSeconds < lastBoard) {
      return fail('UNVERIFIABLE_SIGNAL_ORDER');
    }
    lastBoard = row.signalWallSeconds;
    if (exits.has(row.outPlayerId) || entries.has(row.inPlayerId) ||
        signals.has(row.refereeSignalId) || row.outPlayerId === row.inPlayerId) {
      return fail('DUPLICATE_PARTICIPANT');
    }
    if (!named.has(row.outPlayerId) || !bench.has(row.inPlayerId)) {
      return fail('UNKNOWN_NAMED_PLAYER');
    }
    exits.add(row.outPlayerId);
    entries.add(row.inPlayerId);
    signals.add(row.refereeSignalId);
    observations.push({
      outPlayerId: row.outPlayerId, inPlayerId: row.inPlayerId,
      refereeSignalId: row.refereeSignalId,
      signalWallSeconds: row.signalWallSeconds,
      exitWallSeconds: row.exitWallSeconds,
    });
  }
  if (lastBoard !== claim.finalSignalWallSeconds ||
      [...exits].some(id => entries.has(id))) {
    return fail('UNVERIFIABLE_SIGNAL_ORDER');
  }
  const deadline = (claim.finalSignalWallSeconds as number) + 10;
  return {
    ok: true, schemaVersion: M1_GROUP_DEPARTURE_SCHEMA_VERSION,
    rulesId: M1_GROUP_DEPARTURE_RULES_ID,
    fixtureId: claim.fixtureId as string,
    teamId: claim.teamId as string,
    stoppageId: claim.stoppageId as string,
    finalSignalWallSeconds: claim.finalSignalWallSeconds as number,
    groupSize: observations.length,
    outcomes: observations.map(row => {
      const late = row.exitWallSeconds > deadline;
      return {
        outPlayerId: row.outPlayerId, inPlayerId: row.inPlayerId,
        status: late ? 'REFEREE_REVIEW_REQUIRED' as const :
          'WITHIN_TEN_SECONDS' as const,
        conditionalEarliestLateEntryRunningSeconds: late ?
          (claim.restartRunningSeconds as number) + 60 : null,
        refereeEntryApprovalRequired: true as const,
      };
    }),
    physicalStoppageAuthenticated: false,
    refereeAuthorityAuthenticated: false,
  };
}
