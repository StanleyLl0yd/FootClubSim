import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS } from './m1-clock.js';
import { simulateM1V20InternalReferee, type M1V20InternalRefereeRun,
  type M1V20GeneratedIncident } from './m1-v20-referee-halftime-coaching.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * Isolated v21: source-linked stop/restart timing for generated fouls.
 * It is NOT a new penalty/set-piece simulator: foul position, advantage,
 * ball placement and physical restart adjudication are still unknown.
 * The v20/v17/v8 match is evaluated only once and remains authoritative.
 */
export const M1_V21_STOPPAGE_SCHEMA = 1 as const;
export const M1_V21_STOPPAGE_RULES =
  'ifab-2026-27-foul-stoppage-chronology-location-unresolved' as const;

type RunV20 = Extract<M1V20InternalRefereeRun, { ok: true }>;
type SourceEvent = RunV20['match']['events'][number];
type FoulIncident = M1V20GeneratedIncident;
type TimelineKind = SourceEvent['kind'] |
  'synthetic-foul-whistle' | 'synthetic-foul-restart';
type Snapshot = SourceEvent['onField'];
export interface M1V21ChronologyEvent {
  readonly id: string;
  readonly sequence: number;
  readonly kind: TimelineKind;
  readonly runningSeconds: number;
  readonly wallSeconds: number;
  /** Underlying v17 event for either copied events or generated stops. */
  readonly sourceV17EventId: string;
  readonly sourceEventId: string | null;
  readonly teamId: string | null;
  readonly playerId: string | null;
  readonly replacedByPlayerId: string | null;
  readonly onField: Snapshot;
  readonly generatedFoulId: string | null;
  /** Opposing club; award *candidate* only, not legal restart decision. */
  readonly candidateRestartTeamId: string | null;
}
export type M1V21ChronologyError =
  'INVALID_SOURCE' | 'INVALID_STOPPAGE_INTERVAL' |
  'SOURCE_MATCH_REJECTED' | 'CHRONOLOGY_MISMATCH';
export type M1V21ChronologyRun =
  | Readonly<{ ok: false; error: M1V21ChronologyError }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V21_STOPPAGE_SCHEMA;
    rulesId: typeof M1_V21_STOPPAGE_RULES;
    status: 'SYNTHETIC_FOUL_STOPPAGES_NOT_FULL_RESTART_RULES';
    fixtureId: string;
    foulPauseWallSeconds: number;
    generatedFoulStoppages: number;
    totalFoulStoppedWallSeconds: number;
    totalRunningSeconds: typeof M1_CLOCK_END_SECONDS;
    totalWallSeconds: number;
    events: readonly M1V21ChronologyEvent[];
    source: RunV20;
    restartLocationAndPenaltyAdjudicated: false;
    inPlayCoachSubstitutionSupported: false;
    timedPlayerExitAuthenticated: false;
    refereeSimulationCalibrated: false;
  }>;
const fail = (error: M1V21ChronologyError): M1V21ChronologyRun =>
  ({ ok: false, error });
const FoulKinds = new Set<string>([
  'caution', 'second-yellow-dismissal', 'straight-red-dismissal',
]);
const sorted = (players: readonly string[]): string[] => [...players].sort();
const cloneXI = (s: Snapshot): Snapshot =>
  ({ home: sorted(s.home), away: sorted(s.away) });

export function simulateM1V21FoulStoppageChronology(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown = [],
  foulPauseWallSeconds: unknown = 20,
): M1V21ChronologyRun {
  if (!Number.isSafeInteger(foulPauseWallSeconds) ||
      (foulPauseWallSeconds as number) < 1 ||
      (foulPauseWallSeconds as number) > 120) {
    return fail('INVALID_STOPPAGE_INTERVAL');
  }
  if (!isPlainJsonTree(prematch) || !isPlainJsonTree(policy) ||
      !isPlainJsonTree(halfTimeCommands)) return fail('INVALID_SOURCE');
  const source = simulateM1V20InternalReferee(
    prematch, policy, halfTimeCommands);
  if (!source.ok) return fail('SOURCE_MATCH_REJECTED');
  const fixture = source.match.fixtureId;
  const homeId = source.match.events[0]?.teamId;
  // Kickoff's teamId is deliberately null. Identify sides using the
  // source-validated prematch instead of inferring them from event order.
  const fixtureObject = (prematch as {fixture?: unknown}).fixture;
  if (!fixtureObject || typeof fixtureObject !== 'object' ||
      Array.isArray(fixtureObject)) return fail('INVALID_SOURCE');
  const ids = fixtureObject as {id?: unknown;homeClubId?: unknown;
    awayClubId?: unknown};
  if (ids.id !== fixture || typeof ids.homeClubId !== 'string' ||
      typeof ids.awayClubId !== 'string' ||
      ids.homeClubId === ids.awayClubId || homeId !== null) {
    return fail('CHRONOLOGY_MISMATCH');
  }
  const incidentByV17Event = new Map<string, FoulIncident>();
  for (const incident of source.generatedIncidents) {
    if (incident.sanction === 'injury-withdrawal') continue;
    if (incidentByV17Event.has(incident.sourceEventId)) {
      return fail('CHRONOLOGY_MISMATCH');
    }
    incidentByV17Event.set(incident.sourceEventId, incident);
  }
  const timeline: M1V21ChronologyEvent[] = [];
  let stopped = 0;
  let lastRunning = 0;
  let lastWall = 0;
  let physicalXI: Snapshot | null = null;
  const append = (
    kind: TimelineKind, upstream: SourceEvent,
    at: number, snapshot: Snapshot,
    foul: FoulIncident | null = null,
    restartTeamId: string | null = null,
  ): void => {
    timeline.push({
      id: 'm1-v21-event-' + (timeline.length + 1),
      sequence: timeline.length + 1, kind,
      runningSeconds: upstream.runningSeconds,
      wallSeconds: at, sourceV17EventId: upstream.id,
      sourceEventId: upstream.sourceEventId,
      teamId: upstream.teamId, playerId: upstream.playerId,
      replacedByPlayerId: upstream.replacedByPlayerId,
      onField: cloneXI(snapshot),
      generatedFoulId: foul?.id ?? null,
      candidateRestartTeamId: restartTeamId,
    });
  };
  for (const event of source.match.events) {
    const wall = event.wallSeconds + stopped;
    if (event.runningSeconds < lastRunning || wall < lastWall) {
      return fail('CHRONOLOGY_MISMATCH');
    }
    const foul = incidentByV17Event.get(event.id) ?? null;
    if (foul) {
      if (!FoulKinds.has(event.kind) ||
          foul.playerId !== event.playerId ||
          foul.teamId !== event.teamId ||
          foul.elapsedSeconds !== event.runningSeconds ||
          !physicalXI ||
          !(event.teamId === ids.homeClubId ||
            event.teamId === ids.awayClubId)) {
        return fail('CHRONOLOGY_MISMATCH');
      }
      const side = event.teamId === ids.homeClubId ? 'home' : 'away';
      if (!physicalXI[side].includes(foul.playerId)) {
        return fail('CHRONOLOGY_MISMATCH');
      }
      const restartTeamId = side === 'home' ?
        ids.awayClubId : ids.homeClubId;
      append('synthetic-foul-whistle', event, wall, physicalXI,
        foul, restartTeamId);
      append(event.kind, event, wall, event.onField);
      const restartWall = wall + (foulPauseWallSeconds as number);
      append('synthetic-foul-restart', event, restartWall,
        event.onField, foul, restartTeamId);
      stopped += foulPauseWallSeconds as number;
      incidentByV17Event.delete(event.id);
      lastWall = restartWall;
    } else {
      append(event.kind, event, wall, event.onField);
      lastWall = wall;
    }
    physicalXI = event.onField;
    lastRunning = event.runningSeconds;
  }
  if (incidentByV17Event.size > 0 ||
      source.match.events.at(-1)?.kind !== 'full-time' ||
      timeline.at(-1)?.kind !== 'full-time' ||
      timeline.at(-1)?.runningSeconds !== M1_CLOCK_END_SECONDS ||
      timeline.length > 320) return fail('CHRONOLOGY_MISMATCH');
  const fouls = source.generatedIncidents.filter(i =>
    i.sanction !== 'injury-withdrawal').length;
  if (fouls * (foulPauseWallSeconds as number) !== stopped ||
      timeline.length !== source.match.events.length + 2 * fouls) {
    return fail('CHRONOLOGY_MISMATCH');
  }
  return {
    ok: true, schemaVersion: M1_V21_STOPPAGE_SCHEMA,
    rulesId: M1_V21_STOPPAGE_RULES,
    status: 'SYNTHETIC_FOUL_STOPPAGES_NOT_FULL_RESTART_RULES',
    fixtureId: fixture,
    foulPauseWallSeconds: foulPauseWallSeconds as number,
    generatedFoulStoppages: fouls,
    totalFoulStoppedWallSeconds: stopped,
    totalRunningSeconds: M1_CLOCK_END_SECONDS,
    totalWallSeconds: timeline.at(-1)!.wallSeconds,
    events: timeline, source,
    restartLocationAndPenaltyAdjudicated: false,
    inPlayCoachSubstitutionSupported: false,
    timedPlayerExitAuthenticated: false,
    refereeSimulationCalibrated: false,
  };
}
export function verifyM1V21FoulStoppageChronology(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown,
  foulPauseWallSeconds: unknown, candidate: unknown,
): boolean {
  if (!isPlainJsonTree(candidate)) return false;
  const replay = simulateM1V21FoulStoppageChronology(
    prematch, policy, halfTimeCommands, foulPauseWallSeconds);
  return replay.ok && sameCanonicalValue(replay, candidate);
}
