import { sameCanonicalValue } from './canonical-value.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import { M1_V6_DRAWS_PER_PHASE } from './m1-phases-v6.js';
import { M1_V8_ENGINE_VERSION, M1_V8_EVENT_SCHEMA_VERSION,
  simulateM1V8MedicalPhases, type M1V8Event, type M1V8Result }
  from './m1-v8-medical-phases.js';
import { SeededRng, RNG_VERSION } from './rng.js';

/**
 * Ordinary interactive pause/continue preview for v8. NOT a referee
 * interruption, no competition ruling, no career application.
 */
export const M1_V8_CHECKPOINT_SCHEMA_VERSION = 1 as const;
export interface M1V8PhaseCheckpoint {
  readonly schemaVersion: typeof M1_V8_CHECKPOINT_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly status: 'preview-paused' | 'full-time-preview';
  readonly fixtureId: string;
  readonly completedPhases: number;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly events: readonly M1V8Event[];
  readonly provisionalScore: Readonly<{ home: number; away: number }>;
  readonly offFieldAtCheckpoint: readonly string[];
  readonly onFieldAtCheckpoint: M1V8Result['onFieldAtFullTime'];
  readonly plannedCommands: readonly unknown[];
  readonly trustedDecisions: readonly unknown[];
  readonly medicalActions: readonly unknown[];
  /** Only an explicitly completed synthetic preview has a terminal report. */
  readonly report: M1V8Result['report'] | null;
}
export type M1V8CheckpointResult =
  | Readonly<{ ok: true; checkpoint: M1V8PhaseCheckpoint }>
  | Readonly<{ ok: false; error:
    'INVALID_PHASE' | 'INVALID_SCHEDULE' | 'INVALID_SOURCE' |
    'INVALID_CHECKPOINT' | 'BACKDATED_ACTION' | 'MATCH_FINISHED' }>;
const KEYS = [
  'schemaVersion', 'engineVersion', 'eventSchemaVersion',
  'rngAlgorithmVersion', 'status', 'fixtureId', 'completedPhases', 'rngSeed',
  'rngState', 'rngDraws', 'events', 'provisionalScore',
  'offFieldAtCheckpoint', 'onFieldAtCheckpoint', 'plannedCommands',
  'trustedDecisions', 'medicalActions', 'report',
] as const;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(v).length === fields.length && fields.every(k => Object.hasOwn(v, k));
const fail = (error: Exclude<M1V8CheckpointResult,
  { ok: true }>['error']): M1V8CheckpointResult => ({ ok: false, error });
const historical = (raw: unknown, cutoff: number, medical: boolean): raw is unknown[] =>
  Array.isArray(raw) && raw.every(item =>
    record(item) && Number.isSafeInteger(item.elapsedSeconds) &&
    (item.elapsedSeconds as number) >= 0 &&
    (item.elapsedSeconds as number) < cutoff &&
    (!medical || item.kind !== 'treatment-exit' ||
      (Number.isSafeInteger(item.restartAtRunningSeconds) &&
        (item.restartAtRunningSeconds as number) < cutoff)));
const after = (items: unknown[], cutoff: number): 'valid' | 'invalid' | 'backdated' => {
  for (const item of items) {
    if (!record(item) || !Number.isSafeInteger(item.elapsedSeconds)) return 'invalid';
    if ((item.elapsedSeconds as number) < cutoff) return 'backdated';
  }
  return 'valid';
};
const clone = (value: unknown[]): unknown[] =>
  JSON.parse(JSON.stringify(value)) as unknown[];

/**
 * Re-run the fixed-seed v8 evaluator from the authentic source inputs,
 * including any medically absent XI. Only reveal the completed phase prefix.
 * Internally evaluated future phases are discarded and NOT trusted as
 * future match facts or as permission to resume a referee-stopped game.
 */
export function createM1V8PhaseCheckpoint(
  prematch: unknown, policy: unknown, completedPhases: unknown,
  plannedCommands: unknown = [], trustedDecisions: unknown = [],
  medicalActions: unknown = [],
): M1V8CheckpointResult {
  if (!Number.isSafeInteger(completedPhases) ||
      (completedPhases as number) < 0 ||
      (completedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return fail('INVALID_PHASE');
  }
  // Refuse malformed serializable action history before reading any getter
  // or running the headless evaluator; JSON.stringify is not validation.
  if (!isPlainJsonTree(plannedCommands) ||
      !isPlainJsonTree(trustedDecisions) ||
      !isPlainJsonTree(medicalActions)) return fail('INVALID_SCHEDULE');
  const phase = completedPhases as number;
  const cutoff = phase * M1_CLOCK_STEP_SECONDS;
  if (!historical(plannedCommands, cutoff, false) ||
      !historical(trustedDecisions, cutoff, false) ||
      !historical(medicalActions, cutoff, true) ||
      plannedCommands.length > 212 || trustedDecisions.length > 18 ||
      medicalActions.length > 36) return fail('INVALID_SCHEDULE');
  const simulated = simulateM1V8MedicalPhases(
    prematch, policy, plannedCommands, trustedDecisions, medicalActions,
  );
  if (!simulated.ok) return fail('INVALID_SOURCE');
  const completed = phase === M1_CLOCK_MAX_EVENTS;
  const events = simulated.events.filter(e =>
    e.elapsedSeconds < cutoff || (completed && e.type === 'full-time'));
  const provisionalScore = { home: 0, away: 0 };
  const homeId = (prematch as { fixture: { homeClubId: string } }).fixture.homeClubId;
  const awayId = (prematch as { fixture: { awayClubId: string } }).fixture.awayClubId;
  for (const event of events) {
    let club: string | null = null;
    if (event.type === 'shot' && event.outcome === 'goal') {
      club = event.teamId;
    } else if (event.type === 'adjudication' &&
        (event.decision.kind === 'own-goal' ||
          event.decision.outcome === 'scored')) {
      club = event.decision.teamId;
    }
    if (club === null) continue;
    if (club === homeId) provisionalScore.home++;
    else if (club === awayId) provisionalScore.away++;
    else return fail('INVALID_SOURCE');
  }
  const draws = phase * M1_V6_DRAWS_PER_PHASE;
  const rng = new SeededRng(simulated.rngSeed);
  for (let i = 0; i < draws; i++) rng.nextFloat();
  let sources: { plannedCommands: unknown[]; trustedDecisions: unknown[];
    medicalActions: unknown[] };
  try {
    sources = {
      plannedCommands: clone(plannedCommands),
      trustedDecisions: clone(trustedDecisions),
      medicalActions: clone(medicalActions),
    };
  } catch {
    return fail('INVALID_SOURCE');
  }
  return { ok: true, checkpoint: {
    schemaVersion: M1_V8_CHECKPOINT_SCHEMA_VERSION,
    engineVersion: M1_V8_ENGINE_VERSION,
    eventSchemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    rngAlgorithmVersion: RNG_VERSION,
    status: completed ? 'full-time-preview' : 'preview-paused',
    fixtureId: simulated.fixtureId, completedPhases: phase,
    rngSeed: simulated.rngSeed, rngState: rng.snapshot(), rngDraws: draws,
    events, provisionalScore,
    offFieldAtCheckpoint: simulated.offFieldAtFullTime,
    onFieldAtCheckpoint: simulated.onFieldAtFullTime,
    ...sources, report: completed ? simulated.report : null,
  } };
}

/**
 * Reject altered checkpoints by recalculating the historical prefix before
 * allowing later coaching or independently asserted medical/referee input.
 * This correctness-first implementation reruns all 18 bounded phases; it
 * does not implement optimized PRNG continuation or source authentication.
 */
export function resumeM1V8PhaseCheckpoint(
  prematch: unknown, policy: unknown, previous: unknown,
  nextCompletedPhases: unknown, newCommands: unknown = [],
  newDecisions: unknown = [], newMedicalActions: unknown = [],
): M1V8CheckpointResult {
  if (!isPlainJsonTree(previous) || !record(previous) ||
      !exact(previous, KEYS) ||
      previous.schemaVersion !== M1_V8_CHECKPOINT_SCHEMA_VERSION ||
      previous.engineVersion !== M1_V8_ENGINE_VERSION ||
      previous.eventSchemaVersion !== M1_V8_EVENT_SCHEMA_VERSION ||
      !Number.isSafeInteger(previous.completedPhases) ||
      (previous.completedPhases as number) < 0 ||
      (previous.completedPhases as number) > M1_CLOCK_MAX_EVENTS ||
      !Array.isArray(newCommands) || !Array.isArray(newDecisions) ||
      !Array.isArray(newMedicalActions)) return fail('INVALID_CHECKPOINT');
  const oldPhase = previous.completedPhases as number;
  if (!Number.isSafeInteger(nextCompletedPhases) ||
      (nextCompletedPhases as number) < oldPhase ||
      (nextCompletedPhases as number) > M1_CLOCK_MAX_EVENTS) {
    return fail('INVALID_PHASE');
  }
  const verified = createM1V8PhaseCheckpoint(
    prematch, policy, oldPhase, previous.plannedCommands,
    previous.trustedDecisions, previous.medicalActions,
  );
  if (!verified.ok || !sameCanonicalValue(verified.checkpoint, previous)) {
    return fail('INVALID_CHECKPOINT');
  }
  if (oldPhase === M1_CLOCK_MAX_EVENTS) {
    return newCommands.length || newDecisions.length || newMedicalActions.length ?
      fail('MATCH_FINISHED') : { ok: true, checkpoint: verified.checkpoint };
  }
  if (!isPlainJsonTree(newCommands) || !isPlainJsonTree(newDecisions) ||
      !isPlainJsonTree(newMedicalActions)) return fail('INVALID_SCHEDULE');
  const cutoff = oldPhase * M1_CLOCK_STEP_SECONDS;
  const checks = [after(newCommands, cutoff), after(newDecisions, cutoff),
    after(newMedicalActions, cutoff)];
  if (checks.includes('invalid')) return fail('INVALID_SCHEDULE');
  if (checks.includes('backdated')) return fail('BACKDATED_ACTION');
  return createM1V8PhaseCheckpoint(
    prematch, policy, nextCompletedPhases,
    [...(previous.plannedCommands as unknown[]), ...newCommands],
    [...(previous.trustedDecisions as unknown[]), ...newDecisions],
    [...(previous.medicalActions as unknown[]), ...newMedicalActions],
  );
}
