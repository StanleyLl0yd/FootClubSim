import { sameCanonicalValue } from './canonical-value.js';
import type { M1PlayerControlState } from './m1-player-control.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import {
  deriveM1V4Ledger, M1_V4_DRAWS_PER_PHASE, M1_V4_ENGINE_VERSION,
  M1_V4_EVENT_SCHEMA_VERSION, simulateM1V4Phases, type M1V4Event,
} from './m1-phases-v4.js';
import type { MatchLedgerReport } from './match-contracts.js';
import { SeededRng } from './rng.js';

/**
 * V4 initial safe replay checkpoints. This bounded implementation recomputes
 * the full 18-phase synthetic run to verify original seed/command history.
 * A later optimized continuation must have a separate equivalence proof.
 */
export interface M1V4Checkpoint {
  readonly engineVersion: typeof M1_V4_ENGINE_VERSION;
  readonly schemaVersion: typeof M1_V4_EVENT_SCHEMA_VERSION;
  readonly completedPhases: number;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly controlled: M1PlayerControlState;
  readonly events: readonly M1V4Event[];
  readonly report: MatchLedgerReport | null;
}
export type M1V4CheckpointResult =
  | Readonly<{ ok: true; checkpoint: M1V4Checkpoint }>
  | Readonly<{ ok: false; error:
    'INVALID_PHASE' | 'INVALID_SCHEDULE' | 'INVALID_SOURCE' |
    'INVALID_CHECKPOINT' | 'BACKDATED_COMMAND' }>;
const KEYS = [
  'engineVersion', 'schemaVersion', 'completedPhases', 'rngSeed', 'rngState',
  'rngDraws', 'controlled', 'events', 'report',
] as const;
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const ownKeys = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));

function bareRecorded(raw: unknown): Record<string, unknown> | null {
  if (!rec(raw) || !Number.isInteger(raw.sequence)) return null;
  const copy = { ...raw };
  delete copy.sequence;
  return copy;
}
function priorSchedule(value: unknown): readonly Record<string, unknown>[] | null {
  if (!rec(value) || !rec(value.controlled) ||
      !Array.isArray(value.commands) ||
      !Array.isArray(value.controlled.commands) ||
      value.commands.length > 64 || value.controlled.commands.length > 64) return null;
  const schedule: Record<string, unknown>[] = [];
  for (const row of [...value.commands, ...value.controlled.commands]) {
    const command = bareRecorded(row);
    if (!command) return null;
    schedule.push(command);
  }
  // Individual/team queues preserve their own order; interleaving at one
  // checkpoint is immaterial to the two independent admitted command effects.
  schedule.sort((a, b) => (a.elapsedSeconds as number) - (b.elapsedSeconds as number));
  return schedule;
}

/** Stop at a canonical 300s boundary and expose no future phase events. */
export function createM1V4Checkpoint(
  prematch: unknown, policy: unknown, completedPhases: unknown, commands: unknown = [],
): M1V4CheckpointResult {
  if (!Number.isInteger(completedPhases) || (completedPhases as number) < 0 ||
      (completedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_PHASE' };
  }
  const phase = completedPhases as number;
  const time = phase * M1_CLOCK_STEP_SECONDS;
  if (!Array.isArray(commands) || commands.length > 128 ||
      commands.some(c => !rec(c) || !Number.isInteger(c.elapsedSeconds) ||
        (c.elapsedSeconds as number) >= time)) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const simulated = simulateM1V4Phases(prematch, policy, commands);
  if (!simulated.ok) return { ok: false, error: 'INVALID_SOURCE' };
  const finished = phase === M1_CLOCK_MAX_EVENTS;
  const events = simulated.events.filter(e =>
    e.type === 'full-time' ? finished : e.elapsedSeconds < time).map(e => ({ ...e }));
  const rng = new SeededRng(simulated.rngSeed);
  const rngDraws = phase * M1_V4_DRAWS_PER_PHASE;
  for (let i = 0; i < rngDraws; i++) rng.nextUint32();
  const clock = simulated.controlled.controlled.clock;
  const controlled: M1PlayerControlState = {
    ...simulated.controlled,
    controlled: {
      ...simulated.controlled.controlled,
      clock: {
        ...clock, elapsedSeconds: time,
        status: finished ? 'full-time' : 'running',
        events: clock.events.slice(0, phase).map(e => ({ ...e })),
      },
    },
  };
  const report = finished ? deriveM1V4Ledger(prematch, events) : null;
  if (report !== null && !report.ok) return { ok: false, error: 'INVALID_SOURCE' };
  return { ok: true, checkpoint: {
    engineVersion: M1_V4_ENGINE_VERSION,
    schemaVersion: M1_V4_EVENT_SCHEMA_VERSION,
    completedPhases: phase, rngSeed: simulated.rngSeed,
    rngState: rng.snapshot(), rngDraws, controlled, events,
    report: report === null ? null : report.report,
  } };
}

/**
 * Recompute and validate every earlier authorized order/event against the
 * trusted prematch and policy, then permit new commands only in the future.
 * This is NOT cryptographic authentication and not optimized direct RNG resume.
 */
export function resumeM1V4Checkpoint(
  prematch: unknown, policy: unknown, previous: unknown,
  nextCompletedPhases: unknown, newCommands: unknown = [],
): M1V4CheckpointResult {
  if (!rec(previous) || !ownKeys(previous, KEYS) ||
      previous.engineVersion !== M1_V4_ENGINE_VERSION ||
      previous.schemaVersion !== M1_V4_EVENT_SCHEMA_VERSION ||
      !Number.isInteger(previous.completedPhases) ||
      (previous.completedPhases as number) < 0 ||
      (previous.completedPhases as number) > M1_CLOCK_MAX_EVENTS ||
      !Array.isArray(newCommands) || newCommands.length > 128) {
    return { ok: false, error: 'INVALID_CHECKPOINT' };
  }
  const oldPhase = previous.completedPhases as number;
  if (!Number.isInteger(nextCompletedPhases) ||
      (nextCompletedPhases as number) < oldPhase ||
      (nextCompletedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return { ok: false, error: 'INVALID_PHASE' };
  }
  const prior = priorSchedule(previous.controlled);
  if (prior === null) return { ok: false, error: 'INVALID_CHECKPOINT' };
  const verified = createM1V4Checkpoint(prematch, policy, oldPhase, prior);
  if (!verified.ok || !sameCanonicalValue(verified.checkpoint, previous)) {
    return { ok: false, error: 'INVALID_CHECKPOINT' };
  }
  const time = oldPhase * M1_CLOCK_STEP_SECONDS;
  for (const item of newCommands) {
    if (!rec(item) || !Number.isInteger(item.elapsedSeconds)) {
      return { ok: false, error: 'INVALID_SCHEDULE' };
    }
    if ((item.elapsedSeconds as number) < time) {
      return { ok: false, error: 'BACKDATED_COMMAND' };
    }
  }
  return createM1V4Checkpoint(
    prematch, policy, nextCompletedPhases, [...prior, ...newCommands],
  );
}
