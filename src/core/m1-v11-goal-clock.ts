import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS } from './m1-clock.js';
import { simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * Isolated dual-clock Law 8 prototype. Only internally seeded v8 open-play
 * goals produce whistles. No extra fouls, physical substitutions or penalties
 * are invented, and historical v8 time/RNG/saved events remain unchanged.
 */
export const M1_V11_GOAL_CLOCK_SCHEMA = 1 as const;
export const M1_V11_GOAL_CLOCK_RULES = 'ifab-2026-27-law8-goal-dual-clock-research' as const;
const MAX_GOALS = 18;
const MAX_EVENTS = 2 * MAX_GOALS + 2;
type ClockStatus = 'running' | 'stopped' | 'full-time';
export type M1V11GoalClockError =
  'INVALID_SOURCE' | 'INVALID_PAUSE' | 'INVALID_MATCH' |
  'INVALID_GOAL_SOURCE' | 'INVALID_STATE';
export interface M1V11GoalClockEvent {
  readonly sequence: number;
  readonly id: string;
  readonly kind: 'kickoff' | 'goal-whistle' | 'restart-kickoff' | 'full-time';
  /** Playing-time seconds; never advance during a whistle. */
  readonly runningSeconds: number;
  /** Synthetic uninterrupted wall time, including stopped-play procedures. */
  readonly wallSeconds: number;
  readonly sourceGoalId: string | null;
  readonly scoringTeamId: string | null;
}
export interface M1V11GoalClockState {
  readonly schemaVersion: typeof M1_V11_GOAL_CLOCK_SCHEMA;
  readonly rulesId: typeof M1_V11_GOAL_CLOCK_RULES;
  readonly sourceEngine: 'm1-v8-replayed-open-play-only';
  readonly fixtureId: string;
  readonly rngSeed: number;
  /** Synthetic research-only wall seconds per goal stoppage. NOT calibrated. */
  readonly pauseWallSeconds: number;
  readonly eventCursor: number;
  readonly status: ClockStatus;
  readonly runningSeconds: number;
  readonly wallSeconds: number;
  readonly events: readonly M1V11GoalClockEvent[];
}
export type M1V11GoalClockResult =
  | Readonly<{ok: true; state: M1V11GoalClockState}>
  | Readonly<{ok: false; error: M1V11GoalClockError}>;
const bad = (error: M1V11GoalClockError): M1V11GoalClockResult =>
  ({ ok: false, error });
const validPause = (v: unknown): v is number =>
  Number.isSafeInteger(v) && typeof v === 'number' && v >= 0 && v <= 120;
function buildTimeline(prematch: unknown, policy: unknown, pause: number):
  Readonly<{ok: true; fixtureId: string; rngSeed: number;
    events: readonly M1V11GoalClockEvent[]}> |
  Readonly<{ok: false; error: M1V11GoalClockError}> {
  if (!isPlainJsonTree(prematch) || !isPlainJsonTree(policy)) {
    return { ok: false, error: 'INVALID_SOURCE' };
  }
  const simulated = simulateM1V8MedicalPhases(prematch, policy, [], [], []);
  if (!simulated.ok) return { ok: false, error: 'INVALID_MATCH' };
  const events: M1V11GoalClockEvent[] = [];
  const push = (kind: M1V11GoalClockEvent['kind'], runningSeconds: number,
    wallSeconds: number, sourceGoalId: string | null = null,
    scoringTeamId: string | null = null): void => {
    events.push({ sequence: events.length + 1, id: 'v11-clock-' + (events.length + 1),
      kind, runningSeconds, wallSeconds, sourceGoalId, scoringTeamId });
  };
  push('kickoff', 0, 0);
  let running = 0, wall = 0, prior = -1, number = 0;
  for (const source of simulated.events) {
    if (source.type !== 'shot' || source.outcome !== 'goal') continue;
    // Phase 18 ends at 5399 and might not be restarted before full-time.
    // Do not fabricate an 18th restart opportunity at the final whistle.
    if (source.elapsedSeconds === M1_CLOCK_END_SECONDS - 1) continue;
    if (source.elapsedSeconds <= prior ||
        source.elapsedSeconds < 0 ||
        source.elapsedSeconds >= M1_CLOCK_END_SECONDS ||
        number >= MAX_GOALS ||
        source.elapsedSeconds < running) {
      return { ok: false, error: 'INVALID_GOAL_SOURCE' };
    }
    prior = source.elapsedSeconds;
    number++;
    wall += source.elapsedSeconds - running;
    running = source.elapsedSeconds;
    push('goal-whistle', running, wall, source.id, source.teamId);
    wall += pause;
    push('restart-kickoff', running, wall, source.id, source.teamId);
  }
  wall += M1_CLOCK_END_SECONDS - running;
  push('full-time', M1_CLOCK_END_SECONDS, wall);
  if (events.length > MAX_EVENTS) return { ok: false, error: 'INVALID_GOAL_SOURCE' };
  return { ok: true, fixtureId: simulated.fixtureId, rngSeed: simulated.rngSeed, events };
}
function reconstruct(source: Extract<ReturnType<typeof buildTimeline>, {ok:true}>,
  pause: number, cursor: number): M1V11GoalClockState {
  const events = source.events.slice(0, cursor).map(e => ({...e}));
  const latest = events[events.length - 1]!;
  const status: ClockStatus = latest.kind === 'full-time' ? 'full-time' :
    latest.kind === 'goal-whistle' ? 'stopped' : 'running';
  return {
    schemaVersion: M1_V11_GOAL_CLOCK_SCHEMA,
    rulesId: M1_V11_GOAL_CLOCK_RULES,
    sourceEngine: 'm1-v8-replayed-open-play-only',
    fixtureId: source.fixtureId, rngSeed: source.rngSeed,
    pauseWallSeconds: pause, eventCursor: cursor,
    status, runningSeconds: latest.runningSeconds,
    wallSeconds: latest.wallSeconds, events,
  };
}
/** Kickoff from the real v8 deterministic goals; no other whistle admitted. */
export function startM1V11GoalClock(
  prematch: unknown, policy: unknown, pauseWallSeconds: unknown,
): M1V11GoalClockResult {
  if (!validPause(pauseWallSeconds)) return bad('INVALID_PAUSE');
  const source = buildTimeline(prematch, policy, pauseWallSeconds);
  if (!source.ok) return source;
  return { ok: true, state: reconstruct(source, pauseWallSeconds, 1) };
}
/** Replay source and full prefix BEFORE advancing an untrusted saved snapshot. */
export function advanceM1V11GoalClock(
  prematch: unknown, policy: unknown, snapshot: unknown,
  expectedPauseWallSeconds: unknown,
): M1V11GoalClockResult {
  if (!validPause(expectedPauseWallSeconds)) return bad('INVALID_PAUSE');
  if (!isPlainJsonTree(snapshot) || snapshot === null ||
      typeof snapshot !== 'object' || Array.isArray(snapshot) ||
      !Object.hasOwn(snapshot, 'pauseWallSeconds') ||
      !Object.hasOwn(snapshot, 'eventCursor')) return bad('INVALID_STATE');
  const data = snapshot as Record<string, unknown>;
  if (!validPause(data.pauseWallSeconds) ||
      data.pauseWallSeconds !== expectedPauseWallSeconds ||
      !Number.isSafeInteger(data.eventCursor) ||
      typeof data.eventCursor !== 'number' ||
      data.eventCursor < 1 || data.eventCursor > MAX_EVENTS) {
    return bad('INVALID_STATE');
  }
  const timeline = buildTimeline(prematch, policy, data.pauseWallSeconds);
  if (!timeline.ok) return timeline;
  if (data.eventCursor > timeline.events.length ||
      !sameCanonicalValue(snapshot,
        reconstruct(timeline, data.pauseWallSeconds, data.eventCursor))) {
    return bad('INVALID_STATE');
  }
  const next = Math.min(timeline.events.length, data.eventCursor + 1);
  return { ok: true, state: reconstruct(timeline, data.pauseWallSeconds, next) };
}
/** Auto and interactive steps use precisely the same validated transition. */
export function runM1V11GoalClock(
  prematch: unknown, policy: unknown, pauseWallSeconds: unknown,
): M1V11GoalClockResult {
  const started = startM1V11GoalClock(prematch, policy, pauseWallSeconds);
  if (!started.ok) return started;
  let current = started.state;
  for (let i = 0; i < MAX_EVENTS && current.status !== 'full-time'; i++) {
    const next = advanceM1V11GoalClock(
      prematch, policy, current, pauseWallSeconds);
    if (!next.ok) return next;
    current = next.state;
  }
  return current.status === 'full-time' ? { ok: true, state: current } :
    bad('INVALID_STATE');
}
