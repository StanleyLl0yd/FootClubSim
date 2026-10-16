import { sameCanonicalValue } from './canonical-value.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import { M1_V6_DRAWS_PER_PHASE } from './m1-phases-v6.js';
import { M1_V8_ENGINE_VERSION, M1_V8_EVENT_SCHEMA_VERSION,
  simulateM1V8MedicalPhases, type M1V8Event } from './m1-v8-medical-phases.js';
import { SeededRng, RNG_VERSION } from './rng.js';

/**
 * Immutable interrupted v8 observation, never a match result or permission
 * to resume, repeat, award points, or post a career fixture.
 */
export const M1_V8_INTERRUPTION_SCHEMA_VERSION = 1 as const;
export interface M1V8InterruptedPrefix {
  readonly schemaVersion: typeof M1_V8_INTERRUPTION_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly status: 'interrupted-awaiting-ruling';
  readonly fixtureId: string;
  readonly interruptedAtSeconds: number;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly events: readonly M1V8Event[];
  readonly provisionalScore: Readonly<{ home: number; away: number }>;
  readonly offFieldAtInterruption: readonly string[];
  readonly onFieldAtInterruption: Readonly<{
    home: readonly string[];
    away: readonly string[];
  }>;
}
export type M1V8InterruptedResult =
  | Readonly<{ ok: true; prefix: M1V8InterruptedPrefix }>
  | Readonly<{ ok: false; error:
    'INVALID_INTERRUPTION' | 'FUTURE_ACTION' | 'INVALID_MATCH_SOURCE' }>;
const fail = (error: 'INVALID_INTERRUPTION' | 'FUTURE_ACTION' |
  'INVALID_MATCH_SOURCE'): M1V8InterruptedResult => ({ ok: false, error });
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Do not admit future-revealing sources, including an unobserved restart. */
function historicalOnly(items: unknown, cutoff: number, medical: boolean): boolean {
  return Array.isArray(items) && items.every(item =>
    record(item) && Number.isSafeInteger(item.elapsedSeconds) &&
    (item.elapsedSeconds as number) >= 0 &&
    (item.elapsedSeconds as number) < cutoff &&
    (!medical || item.kind !== 'treatment-exit' ||
      (Number.isSafeInteger(item.restartAtRunningSeconds) &&
        (item.restartAtRunningSeconds as number) < cutoff)));
}

/**
 * The existing pure v8 replay checks the entire already-known command
 * history. It computes the bounded synthetic future as an internal validation
 * step only, then discards ALL simulated future events and full-time totals.
 * Since no future commands, decisions, or medical actions are accepted, its
 * final physical XI equals the one observed at the cutoff. That property
 * does NOT authenticate referee actions or make future results authoritative.
 */
export function snapshotM1V8InterruptedMatch(
  prematch: unknown, policy: unknown, commands: unknown,
  trustedDecisions: unknown, medicalActions: unknown,
  interruptedAtSeconds: unknown,
): M1V8InterruptedResult {
  if (!Number.isSafeInteger(interruptedAtSeconds) ||
      (interruptedAtSeconds as number) < M1_CLOCK_STEP_SECONDS ||
      (interruptedAtSeconds as number) >= M1_CLOCK_END_SECONDS ||
      (interruptedAtSeconds as number) % M1_CLOCK_STEP_SECONDS !== 0) {
    return fail('INVALID_INTERRUPTION');
  }
  // Validate serializable source streams before inspecting elapsedSeconds:
  // invoking getters on an untrusted referee/medical action is forbidden.
  if (!isPlainJsonTree(commands) ||
      !isPlainJsonTree(trustedDecisions) ||
      !isPlainJsonTree(medicalActions)) return fail('FUTURE_ACTION');
  const cutoff = interruptedAtSeconds as number;
  if (!historicalOnly(commands, cutoff, false) ||
      !historicalOnly(trustedDecisions, cutoff, false) ||
      !historicalOnly(medicalActions, cutoff, true)) {
    return fail('FUTURE_ACTION');
  }
  const simulated = simulateM1V8MedicalPhases(
    prematch, policy, commands, trustedDecisions, medicalActions,
  );
  if (!simulated.ok) return fail('INVALID_MATCH_SOURCE');
  const events = simulated.events.filter(e => e.elapsedSeconds < cutoff);
  const score = { home: 0, away: 0 };
  const homeId = (prematch as { fixture: { homeClubId: string } }).fixture.homeClubId;
  const awayId = (prematch as { fixture: { awayClubId: string } }).fixture.awayClubId;
  for (const event of events) {
    let teamId: string | null = null;
    if (event.type === 'shot' && event.outcome === 'goal') {
      teamId = event.teamId;
    } else if (event.type === 'adjudication' &&
        (event.decision.kind === 'own-goal' ||
          event.decision.outcome === 'scored')) {
      teamId = event.decision.teamId;
    }
    if (teamId === null) continue;
    if (teamId === homeId) score.home++;
    else if (teamId === awayId) score.away++;
    else return fail('INVALID_MATCH_SOURCE');
  }
  const draws = (cutoff / M1_CLOCK_STEP_SECONDS) * M1_V6_DRAWS_PER_PHASE;
  const rng = new SeededRng(simulated.rngSeed);
  for (let i = 0; i < draws; i++) rng.nextFloat();
  return { ok: true, prefix: {
    schemaVersion: M1_V8_INTERRUPTION_SCHEMA_VERSION,
    engineVersion: M1_V8_ENGINE_VERSION,
    eventSchemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    rngAlgorithmVersion: RNG_VERSION,
    status: 'interrupted-awaiting-ruling',
    fixtureId: simulated.fixtureId,
    interruptedAtSeconds: cutoff,
    rngSeed: simulated.rngSeed,
    rngState: rng.snapshot(),
    rngDraws: draws,
    events, provisionalScore: score,
    offFieldAtInterruption: simulated.offFieldAtFullTime,
    onFieldAtInterruption: simulated.onFieldAtFullTime,
  } };
}

/** Always replay against separately trusted source inputs before accepting bytes. */
export function verifyM1V8InterruptedMatch(
  prematch: unknown, policy: unknown, commands: unknown,
  trustedDecisions: unknown, medicalActions: unknown,
  interruptedAtSeconds: unknown, candidate: unknown,
): boolean {
  const replay = snapshotM1V8InterruptedMatch(
    prematch, policy, commands, trustedDecisions, medicalActions,
    interruptedAtSeconds,
  );
  return replay.ok && isPlainJsonTree(candidate) &&
    sameCanonicalValue(replay.prefix, candidate);
}
