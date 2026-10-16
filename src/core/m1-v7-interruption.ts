import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS } from './m1-clock.js';
import { M1_V6_DRAWS_PER_PHASE } from './m1-phases-v6.js';
import { M1_V7_ENGINE_VERSION, M1_V7_EVENT_SCHEMA_VERSION, simulateM1V7Phases,
  type M1V7Event } from './m1-v7-adjudications.js';
import { SeededRng, RNG_VERSION } from './rng.js';

/**
 * Read-only, replay-verified interrupted prefix. Not a finalized result and
 * NOT permission to resume, restart, or assign points without RFU decisions.
 */
export const M1_V7_INTERRUPTION_SCHEMA_VERSION = 1 as const;
export interface M1V7InterruptedPrefix {
  readonly schemaVersion: typeof M1_V7_INTERRUPTION_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_V7_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly status: 'interrupted-awaiting-ruling';
  readonly fixtureId: string;
  readonly interruptedAtSeconds: number;
  readonly rngSeed: number;
  /** PRNG at this checkpoint only. Never expose full-time continuation. */
  readonly rngState: number;
  readonly rngDraws: number;
  readonly events: readonly M1V7Event[];
  /** Only goals observed before interruption, not awarded final score. */
  readonly provisionalScore: Readonly<{ home: number; away: number }>;
}
export type M1V7InterruptedResult =
  | Readonly<{ ok: true; prefix: M1V7InterruptedPrefix }>
  | Readonly<{ ok: false; error:
    'INVALID_INTERRUPTION' | 'FUTURE_ACTION' | 'INVALID_MATCH_SOURCE' }>;
const fail = (error: 'INVALID_INTERRUPTION' | 'FUTURE_ACTION' |
  'INVALID_MATCH_SOURCE'): M1V7InterruptedResult => ({ ok: false, error });
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

function beforeStop(items: unknown, cutoff: number): boolean {
  return Array.isArray(items) && items.every(item =>
    record(item) && Number.isInteger(item.elapsedSeconds) &&
    (item.elapsedSeconds as number) >= 0 && (item.elapsedSeconds as number) < cutoff);
}

/**
 * The existing full-match deterministic evaluator verifies every supplied
 * historical action, but only the already-played prefix is returned. No event,
 * goal, PRNG state or outcome after the stop is exposed or committed.
 * Callers must supply ONLY commands and rulings known before interruption.
 */
export function snapshotM1V7InterruptedMatch(
  prematch: unknown, policy: unknown, commands: unknown,
  trustedDecisions: unknown, interruptedAtSeconds: unknown,
): M1V7InterruptedResult {
  if (!Number.isInteger(interruptedAtSeconds) ||
      (interruptedAtSeconds as number) < M1_CLOCK_STEP_SECONDS ||
      (interruptedAtSeconds as number) >= M1_CLOCK_END_SECONDS ||
      (interruptedAtSeconds as number) % M1_CLOCK_STEP_SECONDS !== 0) {
    return fail('INVALID_INTERRUPTION');
  }
  const cutoff = interruptedAtSeconds as number;
  if (!beforeStop(commands, cutoff) || !beforeStop(trustedDecisions, cutoff)) {
    return fail('FUTURE_ACTION');
  }
  const simulated = simulateM1V7Phases(prematch, policy, commands, trustedDecisions);
  if (!simulated.ok) return fail('INVALID_MATCH_SOURCE');
  const events = simulated.events.filter(event => event.elapsedSeconds < cutoff);
  const score = { home: 0, away: 0 };
  const homeId = simulated.base.availability.substitutions.clock.homeClubId;
  const awayId = simulated.base.availability.substitutions.clock.awayClubId;
  for (const event of events) {
    const teamId = event.type === 'adjudication' ? event.decision.teamId :
      event.source.type === 'shot' && event.source.outcome === 'goal' ?
        event.source.teamId : null;
    if (teamId === null || (event.type === 'adjudication' &&
        event.decision.kind === 'penalty-kick' && event.decision.outcome !== 'scored')) {
      continue;
    }
    if (teamId === homeId) score.home++;
    else if (teamId === awayId) score.away++;
    else return fail('INVALID_MATCH_SOURCE');
  }
  const rng = new SeededRng(simulated.base.rngSeed);
  const draws = (cutoff / M1_CLOCK_STEP_SECONDS) * M1_V6_DRAWS_PER_PHASE;
  for (let i = 0; i < draws; i++) rng.nextFloat();
  return {
    ok: true, prefix: {
      schemaVersion: M1_V7_INTERRUPTION_SCHEMA_VERSION,
      engineVersion: M1_V7_ENGINE_VERSION,
      eventSchemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
      rngAlgorithmVersion: RNG_VERSION,
      status: 'interrupted-awaiting-ruling',
      fixtureId: simulated.report.fixtureId,
      interruptedAtSeconds: cutoff, rngSeed: simulated.base.rngSeed,
      rngState: rng.snapshot(), rngDraws: draws,
      events, provisionalScore: score,
    },
  };
}

/** Reconstruct from independently trusted source inputs before accepting bytes. */
export function verifyM1V7InterruptedMatch(
  prematch: unknown, policy: unknown, commands: unknown,
  trustedDecisions: unknown, interruptedAtSeconds: unknown, candidate: unknown,
): boolean {
  const replay = snapshotM1V7InterruptedMatch(
    prematch, policy, commands, trustedDecisions, interruptedAtSeconds,
  );
  return replay.ok && sameCanonicalValue(replay.prefix, candidate);
}
