import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import { M1_V6_DRAWS_PER_PHASE, M1_V6_ENGINE_VERSION,
  M1_V6_EVENT_SCHEMA_VERSION, simulateM1V6Phases,
  type M1V6Event } from './m1-phases-v6.js';
import type { M1PlayerControlState } from './m1-player-control.js';
import type { M1AvailabilityState } from './m1-availability.js';
import type { MatchLedgerReport } from './match-contracts.js';
import { SeededRng } from './rng.js';

/**
 * Replay-verified v6 checkpoint: original command order is retained explicitly.
 * Not a signed save, direct RNG-state optimizer or M0/v5 migration.
 */
export const M1_V6_CHECKPOINT_SCHEMA_VERSION = 1 as const;
export interface M1V6Checkpoint {
  readonly schemaVersion: typeof M1_V6_CHECKPOINT_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_V6_ENGINE_VERSION;
  readonly actionSchemaVersion: typeof M1_V6_EVENT_SCHEMA_VERSION;
  readonly completedPhases: number;
  readonly commands: readonly unknown[];
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly controlled: M1PlayerControlState;
  readonly availability: M1AvailabilityState;
  readonly events: readonly M1V6Event[];
  readonly report: MatchLedgerReport | null;
}
export type M1V6CheckpointResult =
  | Readonly<{ ok: true; checkpoint: M1V6Checkpoint }>
  | Readonly<{ ok: false; error: 'INVALID_PHASE' | 'INVALID_SCHEDULE' |
    'INVALID_SOURCE' | 'INVALID_CHECKPOINT' | 'BACKDATED_COMMAND' }>;
const KEYS = [
  'schemaVersion', 'engineVersion', 'actionSchemaVersion', 'completedPhases',
  'commands', 'rngSeed', 'rngState', 'rngDraws',
  'controlled', 'availability', 'events', 'report',
] as const;
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));

/** Rebuild the canonical fixture then reveal only the requested phase prefix. */
export function createM1V6Checkpoint(
  prematch: unknown, policy: unknown, completedPhases: unknown, commands: unknown = [],
): M1V6CheckpointResult {
  if (!Number.isInteger(completedPhases) || (completedPhases as number) < 0 ||
      (completedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_PHASE' };
  }
  if (!Array.isArray(commands) || commands.length > 212) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const phase = completedPhases as number;
  const time = phase * M1_CLOCK_STEP_SECONDS;
  if (commands.some(command => !rec(command) ||
      !Number.isInteger(command.elapsedSeconds) ||
      (command.elapsedSeconds as number) >= time)) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const match = simulateM1V6Phases(prematch, policy, commands);
  if (!match.ok) return { ok: false, error: 'INVALID_SOURCE' };
  const complete = phase === M1_CLOCK_MAX_EVENTS;
  const events = match.events.filter(event =>
    event.type === 'full-time' ? complete : event.elapsedSeconds < time);
  const rng = new SeededRng(match.rngSeed);
  const draws = phase * M1_V6_DRAWS_PER_PHASE;
  for (let i = 0; i < draws; i++) rng.nextUint32();
  const clockAt = (clock: M1PlayerControlState['controlled']['clock']) => ({
    ...clock,
    elapsedSeconds: time,
    status: complete ? 'full-time' as const : 'running' as const,
    events: clock.events.slice(0, phase).map(event => ({ ...event })),
  });
  const controlled: M1PlayerControlState = {
    ...match.controlled,
    controlled: { ...match.controlled.controlled,
      clock: clockAt(match.controlled.controlled.clock) },
  };
  const availability: M1AvailabilityState = {
    ...match.availability,
    status: complete ? 'full-time' : 'playing',
    substitutions: {
      ...match.availability.substitutions,
      clock: clockAt(match.availability.substitutions.clock),
    },
  };
  return { ok: true, checkpoint: {
    schemaVersion: M1_V6_CHECKPOINT_SCHEMA_VERSION,
    engineVersion: M1_V6_ENGINE_VERSION,
    actionSchemaVersion: M1_V6_EVENT_SCHEMA_VERSION,
    completedPhases: phase,
    commands: structuredClone(commands),
    rngSeed: match.rngSeed, rngState: rng.snapshot(), rngDraws: draws,
    controlled, availability, events, report: complete ? match.report : null,
  } };
}

/** A saved snapshot must match exact prior seed+source+ordered referee commands. */
export function resumeM1V6Checkpoint(
  prematch: unknown, policy: unknown, previous: unknown,
  nextCompletedPhases: unknown, newCommands: unknown = [],
): M1V6CheckpointResult {
  if (!rec(previous) || !exact(previous, KEYS) ||
      previous.schemaVersion !== M1_V6_CHECKPOINT_SCHEMA_VERSION ||
      previous.engineVersion !== M1_V6_ENGINE_VERSION ||
      previous.actionSchemaVersion !== M1_V6_EVENT_SCHEMA_VERSION ||
      !Number.isInteger(previous.completedPhases) ||
      (previous.completedPhases as number) < 0 ||
      (previous.completedPhases as number) > M1_CLOCK_MAX_EVENTS ||
      !Array.isArray(previous.commands)) {
    return { ok: false, error: 'INVALID_CHECKPOINT' };
  }
  const phase = previous.completedPhases as number;
  if (!Number.isInteger(nextCompletedPhases) ||
      (nextCompletedPhases as number) < phase ||
      (nextCompletedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_PHASE' };
  }
  if (!Array.isArray(newCommands) || newCommands.length > 212) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const canonical = createM1V6Checkpoint(
    prematch, policy, phase, previous.commands);
  if (!canonical.ok || !sameCanonicalValue(canonical.checkpoint, previous)) {
    return { ok: false, error: 'INVALID_CHECKPOINT' };
  }
  const min = phase * M1_CLOCK_STEP_SECONDS;
  for (const raw of newCommands) {
    if (!rec(raw) || !Number.isInteger(raw.elapsedSeconds)) {
      return { ok: false, error: 'INVALID_SCHEDULE' };
    }
    if ((raw.elapsedSeconds as number) < min) {
      return { ok: false, error: 'BACKDATED_COMMAND' };
    }
  }
  return createM1V6Checkpoint(prematch, policy, nextCompletedPhases,
    [...previous.commands, ...newCommands]);
}
