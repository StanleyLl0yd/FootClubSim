import { sameCanonicalValue } from './canonical-value.js';
import { startM1ControlledMatch, type M1ControlledState, type M1RecordedCommand } from './m1-control.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput } from './m1-clock.js';
import type { MatchLedgerReport } from './match-contracts.js';
import {
  M1_ACTION_ENGINE_VERSION,
  M1_ACTION_EVENT_SCHEMA_VERSION, deriveM1SyntheticLedger,
  extendTrustedM1PhaseWindow, type M1PhaseWindow, type M1SyntheticEvent,
} from './m1-phases.js';

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

function checkpointFromWindow(
  prematch: unknown, window: M1PhaseWindow, phaseCount: number,
): M1PhaseCheckpointResult {
  const completed = phaseCount === M1_CLOCK_MAX_EVENTS;
  const report = completed ? deriveM1SyntheticLedger(prematch, window.events) : null;
  if (report !== null && !report.ok) return { ok: false, error: 'INVALID_SOURCE' };
  return { ok: true, checkpoint: {
    engineVersion: M1_ACTION_ENGINE_VERSION,
    schemaVersion: M1_ACTION_EVENT_SCHEMA_VERSION,
    completedPhases: phaseCount,
    rngSeed: (prematch as M1PrematchInput).rngSeed,
    rngState: window.rngState,
    rngDraws: window.rngDraws,
    controlled: window.controlled,
    events: window.events,
    report: report === null ? null : report.report,
  } };
}

/** Build only the requested 0..18 phases; do not simulate unseen future shots. */
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
  for (const command of commands) {
    if (!record(command) || !Number.isInteger(command.elapsedSeconds) ||
        (command.elapsedSeconds as number) >= time) {
      return { ok: false, error: 'INVALID_SCHEDULE' };
    }
  }
  const start = startM1ControlledMatch(prematch, policy);
  if (!start.ok || !record(prematch)) return { ok: false, error: 'INVALID_SOURCE' };
  const window = extendTrustedM1PhaseWindow(prematch as unknown as M1PrematchInput, {
    controlled: start.state, events: [],
    rngState: (prematch as unknown as M1PrematchInput).rngSeed, rngDraws: 0,
  }, commands, phaseCount);
  if (!window.ok) return { ok: false, error: 'INVALID_SOURCE' };
  return checkpointFromWindow(prematch, window.window, phaseCount);
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
      !sameCanonicalValue(regenerated.checkpoint, previous)) {
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
  // Previous history has been fully checked against trusted prematch and policy.
  // Generate only the missing phases with the verified xorshift32 continuation.
  const next = extendTrustedM1PhaseWindow(prematch as M1PrematchInput, {
    controlled: regenerated.checkpoint.controlled,
    events: regenerated.checkpoint.events,
    rngState: regenerated.checkpoint.rngState,
    rngDraws: regenerated.checkpoint.rngDraws,
  }, newCommands, nextCompletedPhases as number);
  if (!next.ok) return { ok: false, error: 'INVALID_SOURCE' };
  return checkpointFromWindow(prematch, next.window, nextCompletedPhases as number);
}
