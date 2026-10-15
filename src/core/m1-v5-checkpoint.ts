import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import type { M1PlayerControlState } from './m1-player-control.js';
import type { M1SubstitutionState } from './m1-substitutions.js';
import type { MatchLedgerReport } from './match-contracts.js';
import {
  deriveM1V5Ledger, M1_V5_DRAWS_PER_PHASE, M1_V5_ENGINE_VERSION,
  M1_V5_EVENT_SCHEMA_VERSION, simulateM1V5Phases, type M1V5Event,
} from './m1-phases-v5.js';
import { SeededRng } from './rng.js';

/**
 * V5 normal-substitution action checkpoints are intentionally separate from
 * v3/v4 formats. This implementation replays from the trusted original seed.
 * Snapshot structural consistency is NOT authenticated storage provenance.
 */
export interface M1V5Checkpoint {
  readonly engineVersion: typeof M1_V5_ENGINE_VERSION;
  readonly schemaVersion: typeof M1_V5_EVENT_SCHEMA_VERSION;
  readonly completedPhases: number;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly controlled: M1PlayerControlState;
  readonly substitutions: M1SubstitutionState;
  readonly events: readonly M1V5Event[];
  readonly report: MatchLedgerReport | null;
}
export type M1V5CheckpointResult =
  | Readonly<{ ok: true; checkpoint: M1V5Checkpoint }>
  | Readonly<{ ok: false; error:
    'INVALID_PHASE' | 'INVALID_SCHEDULE' | 'INVALID_SOURCE' |
    'INVALID_CHECKPOINT' | 'BACKDATED_COMMAND' }>;
const SNAPSHOT_KEYS = [
  'engineVersion', 'schemaVersion', 'completedPhases', 'rngSeed', 'rngState',
  'rngDraws', 'controlled', 'substitutions', 'events', 'report',
] as const;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));

function withoutSequence(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !Number.isInteger(value.sequence)) return null;
  const command = { ...value };
  delete command.sequence;
  return command;
}

/**
 * Reconstruct each stream's causal order. Same-second team/individual orders
 * commute with normal substitutions for currently active original starters.
 * Orders to removed starters are refused in v5 at their actual admission time;
 * canonical validation of that replay can therefore never authorize them.
 */
function previousCommands(candidate: unknown): readonly Record<string, unknown>[] | null {
  if (!isRecord(candidate) || !isRecord(candidate.controlled) ||
      !isRecord(candidate.substitutions) ||
      !isRecord(candidate.controlled.controlled) ||
      !Array.isArray(candidate.controlled.commands) ||
      !Array.isArray(candidate.controlled.controlled.commands) ||
      !Array.isArray(candidate.substitutions.commands) ||
      candidate.controlled.commands.length > 64 ||
      candidate.controlled.controlled.commands.length > 64 ||
      candidate.substitutions.commands.length > 10) return null;
  const schedule: { command: Record<string, unknown>; order: number }[] = [];
  const streams = [
    candidate.controlled.controlled.commands,
    candidate.controlled.commands,
    candidate.substitutions.commands,
  ] as const;
  for (let source = 0; source < streams.length; source++) {
    for (const item of streams[source]!) {
      const command = withoutSequence(item);
      if (command === null || !Number.isInteger(command.elapsedSeconds)) return null;
      schedule.push({ command, order: source });
    }
  }
  schedule.sort((a, b) =>
    (a.command.elapsedSeconds as number) - (b.command.elapsedSeconds as number) ||
    a.order - b.order);
  return schedule.map(entry => entry.command);
}

/** Produce a version-5 prefix, verifying match admission before computing it. */
export function createM1V5Checkpoint(
  prematch: unknown, policy: unknown, completedPhases: unknown, commands: unknown = [],
): M1V5CheckpointResult {
  if (!Number.isInteger(completedPhases) || (completedPhases as number) < 0 ||
      (completedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_PHASE' };
  }
  const phase = completedPhases as number;
  const endTime = phase * M1_CLOCK_STEP_SECONDS;
  if (!Array.isArray(commands) || commands.length > 138 ||
      commands.some(x => !isRecord(x) || !Number.isInteger(x.elapsedSeconds) ||
        (x.elapsedSeconds as number) >= endTime)) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const result = simulateM1V5Phases(prematch, policy, commands);
  if (!result.ok) return { ok: false, error: 'INVALID_SOURCE' };
  const atFullTime = phase === M1_CLOCK_MAX_EVENTS;
  const events = result.events.filter(event =>
    event.type === 'full-time' ? atFullTime : event.elapsedSeconds < endTime)
    .map(event => ({ ...event }));
  const rng = new SeededRng(result.rngSeed);
  const draws = phase * M1_V5_DRAWS_PER_PHASE;
  for (let i = 0; i < draws; i++) rng.nextUint32();
  const copyClock = (clock: M1PlayerControlState['controlled']['clock']) => ({
    ...clock,
    elapsedSeconds: endTime,
    status: atFullTime ? 'full-time' as const : 'running' as const,
    events: clock.events.slice(0, phase).map(event => ({ ...event })),
  });
  const controlled: M1PlayerControlState = {
    ...result.controlled,
    controlled: {
      ...result.controlled.controlled,
      clock: copyClock(result.controlled.controlled.clock),
    },
  };
  const substitutions: M1SubstitutionState = {
    ...result.substitutions,
    clock: copyClock(result.substitutions.clock),
  };
  const report = atFullTime ? deriveM1V5Ledger(prematch, policy, events) : null;
  if (report !== null && !report.ok) return { ok: false, error: 'INVALID_SOURCE' };
  return { ok: true, checkpoint: {
    engineVersion: M1_V5_ENGINE_VERSION,
    schemaVersion: M1_V5_EVENT_SCHEMA_VERSION,
    completedPhases: phase,
    rngSeed: result.rngSeed, rngState: rng.snapshot(), rngDraws: draws,
    controlled, substitutions, events,
    report: report === null ? null : report.report,
  } };
}

/**
 * Verify all past decisions against trusted prematch + policy, then accept
 * only future actions. Bounded correctness-first replay, not optimized resume.
 */
export function resumeM1V5Checkpoint(
  prematch: unknown, policy: unknown, previous: unknown,
  nextCompletedPhases: unknown, newCommands: unknown = [],
): M1V5CheckpointResult {
  if (!isRecord(previous) || !exactKeys(previous, SNAPSHOT_KEYS) ||
      previous.engineVersion !== M1_V5_ENGINE_VERSION ||
      previous.schemaVersion !== M1_V5_EVENT_SCHEMA_VERSION ||
      !Number.isInteger(previous.completedPhases) ||
      (previous.completedPhases as number) < 0 ||
      (previous.completedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_CHECKPOINT' };
  }
  const originalPhase = previous.completedPhases as number;
  if (!Number.isInteger(nextCompletedPhases) ||
      (nextCompletedPhases as number) < originalPhase ||
      (nextCompletedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_PHASE' };
  }
  if (!Array.isArray(newCommands) || newCommands.length > 138) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const previousSchedule = previousCommands(previous);
  if (previousSchedule === null) return { ok: false, error: 'INVALID_CHECKPOINT' };
  const recomputed = createM1V5Checkpoint(prematch, policy, originalPhase, previousSchedule);
  if (!recomputed.ok || !sameCanonicalValue(previous, recomputed.checkpoint)) {
    return { ok: false, error: 'INVALID_CHECKPOINT' };
  }
  const allowedFrom = originalPhase * M1_CLOCK_STEP_SECONDS;
  for (const command of newCommands) {
    if (!isRecord(command) || !Number.isInteger(command.elapsedSeconds)) {
      return { ok: false, error: 'INVALID_SCHEDULE' };
    }
    if ((command.elapsedSeconds as number) < allowedFrom) {
      return { ok: false, error: 'BACKDATED_COMMAND' };
    }
  }
  return createM1V5Checkpoint(
    prematch, policy, nextCompletedPhases, [...previousSchedule, ...newCommands],
  );
}
