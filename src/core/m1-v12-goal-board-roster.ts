import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS } from './m1-clock.js';
import { simulateM1V10WithInternalGoalBoards } from './m1-v10-internal-referee-boards.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * M1-P3 versioned research adapter: one auditable event stream owns
 * shot time, virtual goal whistles, internally issued substitution
 * boards, immediate actual roster transitions and restart wall-time.
 * This is the TIMELY departure-only subset of a future complete referee.
 */
export const M1_V12_GOAL_BOARD_ROSTER_SCHEMA = 1 as const;
export const M1_V12_GOAL_BOARD_ROSTER_RULES =
  'ifab-2026-27-goal-board-roster-immediate-subset' as const;
type Kind = 'kickoff' | 'source-shot' | 'goal-whistle' |
  'board-signal' | 'substitution-applied' | 'restart-kickoff' | 'full-time';
export type M1V12RosterError =
  'INVALID_SOURCE' | 'INVALID_PAUSE' | 'UNSUPPORTED_COMMAND' |
  'SOURCE_MATCH_REJECTED' | 'STOPPAGE_TOO_SHORT' |
  'RESTART_CAUSALITY' | 'ROSTER_REPLAY_MISMATCH' |
  'UNSUPPORTED_SOURCE_EVENT';
export interface M1V12RosterEvent {
  readonly schemaVersion: typeof M1_V12_GOAL_BOARD_ROSTER_SCHEMA;
  readonly sequence: number;
  readonly id: string;
  readonly kind: Kind;
  readonly runningSeconds: number;
  readonly wallSeconds: number;
  readonly sourceEventId: string | null;
  readonly teamId: string | null;
  readonly playerId: string | null;
  readonly outPlayerId: string | null;
  readonly inPlayerId: string | null;
  readonly onField: Readonly<{
    home: readonly string[];
    away: readonly string[];
  }>;
}
export type M1V12RosterRun =
  | Readonly<{ ok: false; error: M1V12RosterError; detail?: string }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V12_GOAL_BOARD_ROSTER_SCHEMA;
    rulesId: typeof M1_V12_GOAL_BOARD_ROSTER_RULES;
    status: 'GOAL_ONLY_TIMELY_SUBSTITUTIONS_REPLAYED';
    fixtureId: string;
    rngSeed: number;
    rngState: number;
    rngDraws: number;
    pauseWallSeconds: number;
    events: readonly M1V12RosterEvent[];
    finalOnField: Readonly<{home: readonly string[]; away: readonly string[]}>;
    finalScore: Readonly<{home: number; away: number}>;
    generatedSpecialEvents: false;
    nonGoalStoppagesSupported: false;
    lateSubstitutionPendingSupported: false;
    physicalDepartureLatencyCalibrated: false;
    fullPlayingTimeReferee: false;
  }>;
const fail = (error: M1V12RosterError, detail?: string): M1V12RosterRun =>
  detail === undefined ? { ok: false, error } : { ok: false, error, detail };
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const validPause = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 120;
const sorted = (it: Iterable<string>): string[] => [...it].sort();
function cloneSource(value: unknown, maximum: number): unknown | null {
  if (!isPlainJsonTree(value)) return null;
  try {
    const encoded = JSON.stringify(value);
    if (encoded.length > maximum) return null;
    return JSON.parse(encoded) as unknown;
  } catch {
    return null;
  }
}
type Board = Extract<ReturnType<typeof simulateM1V10WithInternalGoalBoards>,
  {ok:true}>['boardGroups'][number];
type Action = Readonly<{
  at: number; priority: number; teamId: string; side: 'home' | 'away';
  index: number; kind: 'board-signal' | 'substitution-applied';
  outPlayerId: string; inPlayerId: string; signalId: string;
}>;

/**
 * Only internal v8 shot/goal source and v10 approved instant board groups
 * are eligible. Medical exits, late departure, discretionary rulings and
 * all non-goal whistles are deliberately refused rather than simulated
 * with an incorrect XI.
 */
export function simulateM1V12GoalBoardRoster(
  prematch: unknown, policy: unknown, plannedCommands: unknown = [],
  pauseWallSeconds: unknown = 0,
): M1V12RosterRun {
  if (!validPause(pauseWallSeconds)) return fail('INVALID_PAUSE');
  const input = cloneSource(prematch, 10_000_000);
  const control = cloneSource(policy, 128_000);
  const cmds = cloneSource(plannedCommands, 2_000_000);
  if (!record(input) || !record(input.fixture) ||
      !record(input.homeLineup) || !record(input.awayLineup) ||
      !Array.isArray(input.homeLineup.starters) ||
      !Array.isArray(input.awayLineup.starters) ||
      !Array.isArray(cmds) || cmds.length > 212 ||
      control === null) return fail('INVALID_SOURCE');
  if (cmds.some(x => !record(x) || x.kind !== 'substitute-normal')) {
    return fail('UNSUPPORTED_COMMAND');
  }
  const simulated = simulateM1V10WithInternalGoalBoards(input, control, cmds, [], []);
  if (!simulated.ok) {
    return fail('SOURCE_MATCH_REJECTED', simulated.error);
  }
  const match = simulated.result;
  const fixture = input.fixture;
  if (typeof fixture.id !== 'string' ||
      typeof fixture.homeClubId !== 'string' ||
      typeof fixture.awayClubId !== 'string' ||
      fixture.id !== match.fixtureId) return fail('INVALID_SOURCE');
  const home = new Set(input.homeLineup.starters as string[]);
  const away = new Set(input.awayLineup.starters as string[]);
  if (home.size !== 11 || away.size !== 11) return fail('INVALID_SOURCE');
  const teams = {home, away};
  const events: M1V12RosterEvent[] = [];
  let running = 0;
  let wall = 0;
  function emit(kind: Kind, time: number, atWall: number,
    sourceEventId: string | null = null, teamId: string | null = null,
    playerId: string | null = null, outPlayerId: string | null = null,
    inPlayerId: string | null = null): void {
    events.push({
      schemaVersion: M1_V12_GOAL_BOARD_ROSTER_SCHEMA,
      sequence: events.length + 1, id: 'm1-v12-event-' + (events.length + 1),
      kind, runningSeconds: time, wallSeconds: atWall,
      sourceEventId, teamId, playerId, outPlayerId, inPlayerId,
      onField: {home: sorted(home), away: sorted(away)},
    });
  }
  emit('kickoff', 0, 0);
  const groups = new Map<number, Board[]>();
  for (const board of simulated.boardGroups) {
    if (board.checkpointRunningSeconds < 1 ||
        board.checkpointRunningSeconds >= M1_CLOCK_END_SECONDS ||
        board.issuedSignalIds.length !== board.outgoingPlayers.length ||
        board.incomingPlayers.length !== board.outgoingPlayers.length ||
        board.boardWallSeconds.length !== board.outgoingPlayers.length ||
        board.outgoingPlayers.length === 0 ||
        board.simulatedDepartureWallSeconds > pauseWallSeconds ||
        board.boardWallSeconds.some(offset => offset < 0 ||
          offset > board.simulatedDepartureWallSeconds)) {
      return fail('STOPPAGE_TOO_SHORT');
    }
    const bucket = groups.get(board.checkpointRunningSeconds) ?? [];
    bucket.push(board);
    groups.set(board.checkpointRunningSeconds, bucket);
  }
  let lastShot = -1;
  for (const source of match.events) {
    if (source.type === 'availability' || source.type === 'full-time') continue;
    if (source.type !== 'shot') return fail('UNSUPPORTED_SOURCE_EVENT');
    if (source.elapsedSeconds < running ||
        source.elapsedSeconds <= lastShot ||
        source.elapsedSeconds >= M1_CLOCK_END_SECONDS) {
      return fail('RESTART_CAUSALITY');
    }
    wall += source.elapsedSeconds - running;
    running = source.elapsedSeconds;
    lastShot = running;
    const side = source.teamId === fixture.homeClubId ? 'home' :
      source.teamId === fixture.awayClubId ? 'away' : null;
    if (!side || !teams[side].has(source.playerId)) {
      return fail('ROSTER_REPLAY_MISMATCH');
    }
    emit('source-shot', running, wall, source.id, source.teamId, source.playerId);
    if (source.outcome !== 'goal') continue;
    // No substitute can be admitted after the final-phase goal.
    if (running === M1_CLOCK_END_SECONDS - 1) continue;
    emit('goal-whistle', running, wall, source.id, source.teamId,
      source.playerId);
    const bucket = groups.get(running + 1) ?? [];
    const actions: Action[] = [];
    for (const board of bucket) {
      const s = board.teamId === fixture.homeClubId ? 'home' :
        board.teamId === fixture.awayClubId ? 'away' : null;
      if (!s) return fail('ROSTER_REPLAY_MISMATCH');
      for (let i = 0; i < board.outgoingPlayers.length; i++) {
        const ids = {outPlayerId: board.outgoingPlayers[i]!,
          inPlayerId: board.incomingPlayers[i]!, signalId: board.issuedSignalIds[i]!};
        actions.push({ ...ids, side: s, teamId: board.teamId, index: i,
          kind: 'board-signal', at: board.boardWallSeconds[i]!, priority: 0 });
        actions.push({ ...ids, side: s, teamId: board.teamId, index: i,
          kind: 'substitution-applied', at: board.simulatedDepartureWallSeconds,
          priority: 1 });
      }
    }
    actions.sort((a, b) => a.at - b.at || a.priority - b.priority ||
      a.teamId.localeCompare(b.teamId) || a.index - b.index);
    for (const action of actions) {
      if (action.kind === 'board-signal') {
        emit('board-signal', running, wall + action.at,
          action.signalId, action.teamId, null,
          action.outPlayerId, action.inPlayerId);
      } else {
        const xi = teams[action.side];
        if (!xi.has(action.outPlayerId) || xi.has(action.inPlayerId)) {
          return fail('ROSTER_REPLAY_MISMATCH');
        }
        xi.delete(action.outPlayerId);
        xi.add(action.inPlayerId);
        if (xi.size !== 11) return fail('ROSTER_REPLAY_MISMATCH');
        emit('substitution-applied', running, wall + action.at,
          action.signalId, action.teamId, null,
          action.outPlayerId, action.inPlayerId);
      }
    }
    groups.delete(running + 1);
    wall += pauseWallSeconds;
    emit('restart-kickoff', running, wall, source.id, source.teamId);
  }
  if (groups.size !== 0) return fail('RESTART_CAUSALITY');
  wall += M1_CLOCK_END_SECONDS - running;
  emit('full-time', M1_CLOCK_END_SECONDS, wall);
  if (events.length > 256 ||
      !sameCanonicalValue(
        {home: sorted(home), away: sorted(away)}, match.onFieldAtFullTime)) {
    return fail('ROSTER_REPLAY_MISMATCH');
  }
  return {
    ok: true,
    schemaVersion: M1_V12_GOAL_BOARD_ROSTER_SCHEMA,
    rulesId: M1_V12_GOAL_BOARD_ROSTER_RULES,
    status: 'GOAL_ONLY_TIMELY_SUBSTITUTIONS_REPLAYED',
    fixtureId: match.fixtureId, rngSeed: match.rngSeed,
    rngState: match.rngState, rngDraws: match.rngDraws,
    pauseWallSeconds, events,
    finalOnField: {home: sorted(home), away: sorted(away)},
    finalScore: {home: match.report.home.goals, away: match.report.away.goals},
    generatedSpecialEvents: false,
    nonGoalStoppagesSupported: false,
    lateSubstitutionPendingSupported: false,
    physicalDepartureLatencyCalibrated: false,
    fullPlayingTimeReferee: false,
  };
}
export function verifyM1V12GoalBoardRoster(
  prematch: unknown, policy: unknown, commands: unknown,
  pauseWallSeconds: unknown, candidate: unknown,
): boolean {
  if (!isPlainJsonTree(candidate)) return false;
  const source = simulateM1V12GoalBoardRoster(
    prematch, policy, commands, pauseWallSeconds);
  return source.ok && sameCanonicalValue(candidate, source);
}
