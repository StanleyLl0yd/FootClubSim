import type { M1ControlledState, M1RecordedCommand } from './m1-control.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import type { MatchLedgerReport } from './match-contracts.js';
import {
  M1_ACTION_DRAW_COUNT_PER_PHASE, M1_ACTION_ENGINE_VERSION,
  M1_ACTION_EVENT_SCHEMA_VERSION, simulateM1SyntheticPhases,
  type M1SyntheticEvent,
} from './m1-phases.js';
import { SeededRng } from './rng.js';

/**
 * P2 replay-verified snapshots: bounded recomputation from trusted prematch
 * context, NOT a long-lived mutable action-engine state or signed save file.
 */
export interface M1PhaseCheckpoint {
  readonly engineVersion: typeof M1_ACTION_ENGINE_VERSION;
  readonly schemaVersion: typeof M1_ACTION_EVENT_SCHEMA_VERSION;
  readonly completedPhases: number;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly controlled: M1ControlledState;
  readonly events: readonly M1SyntheticEvent[];
  readonly report: MatchLedgerReport | null;
}
export type M1PhaseCheckpointResult =
  | Readonly<{ ok: true; checkpoint: M1PhaseCheckpoint }>
  | Readonly<{ ok: false; error:
    'INVALID_PHASE' | 'INVALID_SCHEDULE' | 'INVALID_SOURCE' |
    'INVALID_CHECKPOINT' | 'BACKDATED_COMMAND' }>;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keysMatch = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const CHECKPOINT_KEYS = [
  'engineVersion', 'schemaVersion', 'completedPhases', 'rngSeed', 'rngState',
  'rngDraws', 'controlled', 'events', 'report',
] as const;

function commandWithoutSequence(command: M1RecordedCommand): Record<string, unknown> {
  return {
    schemaVersion: command.schemaVersion,
    commandId: command.commandId,
    fixtureId: command.fixtureId,
    teamId: command.teamId,
    elapsedSeconds: command.elapsedSeconds,
    actor: { ...command.actor },
    kind: command.kind,
    plan: { ...command.plan },
  };
}

/**
 * Build a canonical checkpoint at an exact 300s boundary.
 *
 * For this initial implementation all up-to-date phase outputs are regenerated
 * from the start (at most 18 phases), then truncated. This prevents undetected
 * divergence but is deliberately NOT a performance-optimized true RNG resume.
 */
export function createM1PhaseCheckpoint(
  prematch: unknown, policy: unknown, completedPhases: unknown, commands: unknown = [],
): M1PhaseCheckpointResult {
  if (!Number.isInteger(completedPhases) || (completedPhases as number) < 0 ||
      (completedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_PHASE' };
  }
  if (!Array.isArray(commands) || commands.length > 64) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const phaseCount = completedPhases as number;
  const time = phaseCount * M1_CLOCK_STEP_SECONDS;
  // No future orders may silently influence the saved snapshot.
  for (const command of commands) {
    if (!record(command) || !Number.isInteger(command.elapsedSeconds) ||
        (command.elapsedSeconds as number) >= time) {
      return { ok: false, error: 'INVALID_SCHEDULE' };
    }
  }
  const full = simulateM1SyntheticPhases(prematch, policy, commands);
  if (!full.ok) return { ok: false, error: 'INVALID_SOURCE' };
  const rng = new SeededRng(full.rngSeed);
  const draws = phaseCount * M1_ACTION_DRAW_COUNT_PER_PHASE;
  for (let i = 0; i < draws; i++) rng.nextUint32();
  const completed = phaseCount === M1_CLOCK_MAX_EVENTS;
  const clock = full.controlled.clock;
  const events = full.events.filter(event =>
    event.type !== 'full-time' ? event.elapsedSeconds < time : completed);
  const checkpoint: M1PhaseCheckpoint = {
    engineVersion: M1_ACTION_ENGINE_VERSION,
    schemaVersion: M1_ACTION_EVENT_SCHEMA_VERSION,
    completedPhases: phaseCount, rngSeed: full.rngSeed,
    rngState: rng.snapshot(), rngDraws: draws,
    controlled: {
      ...full.controlled,
      clock: {
        ...clock,
        elapsedSeconds: time,
        status: completed ? 'full-time' : 'running',
        events: clock.events.slice(0, phaseCount).map(event => ({ ...event })),
      },
    },
    events: events.map(event => ({ ...event })),
    report: completed ? full.report : null,
  };
  return { ok: true, checkpoint };
}

/**
 * Validate the prior checkpoint against trusted input by full replay, then
 * accept only commands at or after its virtual time, and move forward.
 * No extension can replace history from completed phases.
 */
export function resumeM1PhaseCheckpoint(
  prematch: unknown, policy: unknown, previous: unknown,
  nextCompletedPhases: unknown, newCommands: unknown = [],
): M1PhaseCheckpointResult {
  if (!record(previous) || !keysMatch(previous, CHECKPOINT_KEYS) ||
      previous.engineVersion !== M1_ACTION_ENGINE_VERSION ||
      previous.schemaVersion !== M1_ACTION_EVENT_SCHEMA_VERSION ||
      !Number.isInteger(previous.completedPhases) ||
      (previous.completedPhases as number) < 0 ||
      (previous.completedPhases as number) > M1_CLOCK_MAX_EVENTS ||
      !record(previous.controlled) || !Array.isArray(previous.controlled.commands) ||
      previous.controlled.commands.length > 64) {
    return { ok: false, error: 'INVALID_CHECKPOINT' };
  }
  const priorPhase = previous.completedPhases as number;
  if (!Number.isInteger(nextCompletedPhases) ||
      (nextCompletedPhases as number) < priorPhase ||
      (nextCompletedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_PHASE' };
  }
  if (!Array.isArray(newCommands) || newCommands.length > 64) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const priorCommands: Record<string, unknown>[] = [];
  for (const raw of previous.controlled.commands) {
    if (!record(raw)) return { ok: false, error: 'INVALID_CHECKPOINT' };
    // Verified in the deterministic reconstruction below, not trusted here.
    priorCommands.push(commandWithoutSequence(raw as unknown as M1RecordedCommand));
  }
  const regenerated = createM1PhaseCheckpoint(prematch, policy, priorPhase, priorCommands);
  if (!regenerated.ok ||
      JSON.stringify(regenerated.checkpoint) !== JSON.stringify(previous)) {
    return { ok: false, error: 'INVALID_CHECKPOINT' };
  }
  const minimum = priorPhase * M1_CLOCK_STEP_SECONDS;
  for (const command of newCommands) {
    if (!record(command) || !Number.isInteger(command.elapsedSeconds)) {
      return { ok: false, error: 'INVALID_SCHEDULE' };
    }
    if ((command.elapsedSeconds as number) < minimum) {
      return { ok: false, error: 'BACKDATED_COMMAND' };
    }
  }
  return createM1PhaseCheckpoint(
    prematch, policy, nextCompletedPhases, [...priorCommands, ...newCommands],
  );
}
