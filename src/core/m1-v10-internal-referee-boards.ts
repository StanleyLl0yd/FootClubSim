import { sameCanonicalValue } from './canonical-value.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { simulateM1V9GoalRestartSubstitutions }
  from './m1-v9-goal-restart-referee.js';

/**
 * A deterministic zero-delay **fictional** referee subset:
 * goal -> restart window -> referee issues a board -> immediate departure.
 * No untrusted board/timing claim is accepted. No invented frequency for
 * fouls/cards/injuries/penalties; no old persistence format is modified.
 */
export const M1_V10_INTERNAL_REFEREE_SCHEMA_VERSION = 1 as const;
export const M1_V10_INTERNAL_REFEREE_RULES_ID =
  'ifab-2026-27-goal-restart-internal-normal-subset' as const;

export type M1V10InternalRefereeError =
  'INVALID_SOURCE' | 'MATCH_REJECTED' | 'NO_ENGINE_GOAL_STOPPAGE' |
  'UNSUPPORTED_SUBSTITUTION_CONTEXT' | 'INTERNAL_PROTOCOL_REJECTED' |
  'REPLAY_PARITY_VIOLATION';
export type M1V10InternalRefereeResult =
  | Readonly<{ ok: false; error: M1V10InternalRefereeError; detail?: string }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V10_INTERNAL_REFEREE_SCHEMA_VERSION;
    rulesId: typeof M1_V10_INTERNAL_REFEREE_RULES_ID;
    status: 'INTERNAL_GOAL_BOARD_INSTANT_DEPARTURE_PROTOTYPE';
    boardGroups: readonly Readonly<{
      teamId: string;
      checkpointRunningSeconds: number;
      stoppageId: string;
      issuedSignalIds: readonly string[];
      /** Wall seconds measured *within* the paused virtual stoppage. */
      boardWallSeconds: readonly number[];
      outgoingPlayers: readonly string[];
      incomingPlayers: readonly string[];
      simulatedDepartureWallSeconds: number;
    }>[];
    normalSubstitutionCount: number;
    source: 'INTERNAL_DETERMINISTIC_V8_EVENTS';
    clientRefereeClaimsAccepted: false;
    physicalExitTimeCalibrated: false;
    otherRestartTypesGenerated: false;
    result: Extract<ReturnType<typeof simulateM1V8MedicalPhases>, { ok: true }>;
  }>;

const fail = (error: M1V10InternalRefereeError, detail?: string):
  M1V10InternalRefereeResult =>
  detail === undefined ? { ok: false, error } : { ok: false, error, detail };
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const MAX_SIZES = [10_000_000, 128_000, 2_000_000, 128_000, 128_000];
function snapshotAll(items: readonly unknown[]): readonly unknown[] | null {
  const output: unknown[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!isPlainJsonTree(items[i])) return null;
    try {
      const raw = JSON.stringify(items[i]);
      if (raw.length > MAX_SIZES[i]!) return null;
      output.push(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  return output;
}
interface NormalCommand {
  teamId: string;
  elapsedSeconds: number;
  outPlayerId: string;
  inPlayerId: string;
}
const keyFor = (teamId: string, time: number) => teamId + '\u0000' + time;

/**
 * Internally issues normal substitution boards after an engine-generated
 * goal only. For a group, signals follow in virtual stopped-wall time 0,1,...
 * with all outgoing players leaving at the final signal (zero additional
 * seconds); this intentionally idealizes physical movement.
 *
 * Does NOT provide a full referee or emulate time spent off the field.
 * A future event-driven v11 must model actual stopped clock, physical
 * exit latency, and other IFAB restart types.
 */
export function simulateM1V10WithInternalGoalBoards(
  prematch: unknown, policy: unknown, plannedCommands: unknown = [],
  refereeDecisions: unknown = [], medicalActions: unknown = [],
): M1V10InternalRefereeResult {
  const snap = snapshotAll([
    prematch, policy, plannedCommands, refereeDecisions, medicalActions,
  ]);
  if (!snap) return fail('INVALID_SOURCE');
  const [input, control, rawCommands, decisions, medical] = snap;
  if (!Array.isArray(rawCommands) || rawCommands.length > 212 ||
      !Array.isArray(decisions) || !Array.isArray(medical)) {
    return fail('INVALID_SOURCE');
  }
  const baseline = simulateM1V8MedicalPhases(
    input, control, rawCommands, decisions, medical);
  if (!baseline.ok) return fail('MATCH_REJECTED', baseline.error);
  const groups = new Map<string, NormalCommand[]>();
  let count = 0;
  for (const raw of rawCommands) {
    if (!record(raw) || raw.kind !== 'substitute-normal') continue;
    if (raw.stoppage !== 'referee-authorized' ||
        typeof raw.teamId !== 'string' ||
        typeof raw.elapsedSeconds !== 'number' ||
        typeof raw.outPlayerId !== 'string' ||
        typeof raw.inPlayerId !== 'string') {
      return fail('UNSUPPORTED_SUBSTITUTION_CONTEXT');
    }
    const key = keyFor(raw.teamId, raw.elapsedSeconds);
    const group = groups.get(key) ?? [];
    if (group.length >= 5) return fail('UNSUPPORTED_SUBSTITUTION_CONTEXT');
    group.push({
      teamId: raw.teamId, elapsedSeconds: raw.elapsedSeconds,
      outPlayerId: raw.outPlayerId, inPlayerId: raw.inPlayerId,
    });
    groups.set(key, group);
    count++;
  }
  const goals = new Set(baseline.events.filter(event =>
    event.type === 'shot' && event.outcome === 'goal')
    .map(event => event.elapsedSeconds + 1));
  const dossiers: unknown[] = [];
  const boards: Extract<M1V10InternalRefereeResult, { ok: true }>['boardGroups'][number][] = [];
  for (const commands of groups.values()) {
    const first = commands[0]!;
    if (!goals.has(first.elapsedSeconds)) {
      return fail('NO_ENGINE_GOAL_STOPPAGE');
    }
    const home = first.teamId ===
      (input as {fixture: {homeClubId: string}}).fixture.homeClubId;
    const side = home ? 'home' : 'away';
    const time = first.elapsedSeconds;
    const signals = commands.map((_, index) =>
      'v10-board-' + time + '-' + side + '-' + index);
    const finalWallSecond = commands.length - 1;
    const stoppageId = 'v10-goal-' + time;
    const evidence = commands.length === 1 ? {
      schemaVersion: 1, fixtureId:
        (input as {fixture: {id: string}}).fixture.id,
      teamId: first.teamId,
      outPlayerId: first.outPlayerId, inPlayerId: first.inPlayerId,
      refereeSignalId: signals[0], groupSize: 1,
      signalWallSeconds: 0, exitWallSeconds: 0,
      restartRunningSeconds: time,
    } : {
      schemaVersion: 2, kind: 'group-normal-departures',
      fixtureId: (input as {fixture: {id: string}}).fixture.id,
      teamId: first.teamId, stoppageId,
      finalSignalWallSeconds: finalWallSecond,
      restartRunningSeconds: time,
      departures: commands.map((row, index) => ({
        outPlayerId: row.outPlayerId, inPlayerId: row.inPlayerId,
        refereeSignalId: signals[index],
        signalWallSeconds: index, exitWallSeconds: finalWallSecond,
      })),
    };
    dossiers.push({ checkpointSeconds: time, evidence });
    boards.push({
      teamId: first.teamId, checkpointRunningSeconds: time,
      stoppageId, issuedSignalIds: signals,
      boardWallSeconds: commands.map((_, i) => i),
      outgoingPlayers: commands.map(row => row.outPlayerId),
      incomingPlayers: commands.map(row => row.inPlayerId),
      simulatedDepartureWallSeconds: finalWallSecond,
    });
  }
  // Re-executes the source-based Law 8 admission AND original Law 3
  // single/group ten-second checks on internally issued board claims.
  const checked = simulateM1V9GoalRestartSubstitutions(
    input, control, rawCommands, decisions, medical, dossiers);
  if (!checked.ok) return fail('INTERNAL_PROTOCOL_REJECTED', checked.error);
  if (!sameCanonicalValue(baseline, checked.result)) {
    return fail('REPLAY_PARITY_VIOLATION');
  }
  return {
    ok: true, schemaVersion: M1_V10_INTERNAL_REFEREE_SCHEMA_VERSION,
    rulesId: M1_V10_INTERNAL_REFEREE_RULES_ID,
    status: 'INTERNAL_GOAL_BOARD_INSTANT_DEPARTURE_PROTOTYPE',
    boardGroups: boards, normalSubstitutionCount: count,
    source: 'INTERNAL_DETERMINISTIC_V8_EVENTS',
    clientRefereeClaimsAccepted: false,
    physicalExitTimeCalibrated: false,
    otherRestartTypesGenerated: false,
    result: checked.result,
  };
}
