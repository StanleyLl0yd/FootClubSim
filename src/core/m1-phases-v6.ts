import { isStableId } from './identifiers.js';
import { advanceM1Availability, startM1Availability, submitM1AvailabilityAction,
  type M1AvailabilityState, type M1AvailabilityEntry } from './m1-availability.js';
import { advanceM1PlayerControl, startM1PlayerControl, submitM1PlayerInstruction,
  submitM1TeamTacticsWithPlayerControl, type M1PlayerControlState } from './m1-player-control.js';
import { computeM1V5PhaseShot, type M1V5Shot } from './m1-phases-v5.js';
import { deriveM1V6Ledger } from './m1-v6-ledger.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput } from './m1-clock.js';
import { RNG_VERSION, SeededRng } from './rng.js';
import type { MatchLedgerReport } from './match-contracts.js';

export const M1_V6_ENGINE_VERSION = '5' as const;
export const M1_V6_EVENT_SCHEMA_VERSION = 6 as const;
export const M1_V6_DRAWS_PER_PHASE = 5 as const;
export interface M1V6Shot extends Omit<M1V5Shot, 'schemaVersion' | 'id'> {
  readonly schemaVersion: typeof M1_V6_EVENT_SCHEMA_VERSION;
  readonly id: string;
}
export interface M1V6AvailabilityEvent {
  readonly schemaVersion: typeof M1_V6_EVENT_SCHEMA_VERSION;
  readonly id: string;
  readonly sequence: number;
  readonly elapsedSeconds: number;
  readonly type: 'availability';
  readonly entry: M1AvailabilityEntry;
}
export interface M1V6FullTime {
  readonly schemaVersion: typeof M1_V6_EVENT_SCHEMA_VERSION;
  readonly id: 'm1-v6-full-time';
  readonly sequence: number;
  readonly elapsedSeconds: 5400;
  readonly type: 'full-time';
}
export type M1V6Event = M1V6Shot | M1V6AvailabilityEvent | M1V6FullTime;
export interface M1V6Result {
  readonly ok: true;
  readonly engineVersion: typeof M1_V6_ENGINE_VERSION;
  readonly schemaVersion: typeof M1_V6_EVENT_SCHEMA_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly controlled: M1PlayerControlState;
  readonly availability: M1AvailabilityState;
  readonly events: readonly M1V6Event[];
  readonly report: MatchLedgerReport;
}
export type M1V6Failure = Readonly<{ ok: false; error:
  'INVALID_PREMATCH' | 'INVALID_SCHEDULE' | 'REJECTED_COMMAND' |
  'REFEREE_RULING_REQUIRED' | 'INVALID_TRANSITION' | 'INVALID_LEDGER' }>;
export type M1V6Run = M1V6Result | M1V6Failure;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** v6 only: no old saved ledger is reinterpreted as a referee-aware match. */
export function simulateM1V6Phases(
  prematch: unknown, policy: unknown, plannedCommands: unknown = [],
): M1V6Run {
  const initial = startM1PlayerControl(prematch, policy);
  const started = startM1Availability(prematch, policy);
  if (!initial.ok || !started.ok || !record(prematch)) {
    return { ok: false, error: 'INVALID_PREMATCH' };
  }
  if (!Array.isArray(plannedCommands) || plannedCommands.length > 212) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const input = prematch as unknown as M1PrematchInput;
  const players = new Map(input.catalog.players.map(p => [p.id, p]));
  const rng = new SeededRng(input.rngSeed);
  let controlled = initial.state, availability = started.state, index = 0;
  const seen = new Set<string>();
  const events: M1V6Event[] = [];
  for (let phase = 0; phase < M1_CLOCK_MAX_EVENTS; phase++) {
    const second = phase * M1_CLOCK_STEP_SECONDS;
    while (index < plannedCommands.length) {
      const action: unknown = plannedCommands[index];
      if (!record(action) || !Number.isInteger(action.elapsedSeconds)) {
        return { ok: false, error: 'INVALID_SCHEDULE' };
      }
      if ((action.elapsedSeconds as number) > second) break;
      if ((action.elapsedSeconds as number) < second) {
        return { ok: false, error: 'INVALID_SCHEDULE' };
      }
      const id = action.kind === 'caution' || action.kind === 'direct-red' ||
        action.kind === 'injury-withdrawal' ? action.id : action.commandId;
      if (!isStableId(id) || seen.has(id)) return { ok: false, error: 'REJECTED_COMMAND' };
      if (action.kind === 'set-tactics' || action.kind === 'set-player-focus') {
        const admitted = action.kind === 'set-tactics' ?
          submitM1TeamTacticsWithPlayerControl(input, policy, controlled, action) :
          submitM1PlayerInstruction(input, policy, controlled, action);
        if (!admitted.ok) return { ok: false, error: 'REJECTED_COMMAND' };
        if (action.kind === 'set-player-focus') {
          const side = action.teamId === input.fixture.homeClubId ? 'home' :
            action.teamId === input.fixture.awayClubId ? 'away' : null;
          if (!side || !availability.teams[side].active.includes(action.playerId as string)) {
            return { ok: false, error: 'REJECTED_COMMAND' };
          }
        }
        controlled = admitted.state;
      } else {
        const admitted = submitM1AvailabilityAction(input, policy, availability, action);
        if (!admitted.ok) return { ok: false, error: 'REJECTED_COMMAND' };
        availability = admitted.state;
        const entry = availability.timeline[availability.timeline.length - 1]!;
        events.push({
          schemaVersion: M1_V6_EVENT_SCHEMA_VERSION,
          id: 'm1-v6-availability-' + entry.sequence,
          sequence: events.length + 1, elapsedSeconds: second,
          type: 'availability', entry,
        });
      }
      seen.add(id);
      index++;
    }
    if (availability.status !== 'playing') {
      return { ok: false, error: 'REFEREE_RULING_REQUIRED' };
    }
    // Exactly the same five seeded draws as the old v5 phase algorithm.
    const shot = computeM1V5PhaseShot(input, controlled, players, {
      home: availability.teams.home.active, away: availability.teams.away.active,
    }, phase, rng, events.length + 1);
    if (shot !== null) {
      events.push({
        ...shot, schemaVersion: M1_V6_EVENT_SCHEMA_VERSION,
        id: 'm1-v6-shot-' + (phase + 1),
      });
    }
    const nextPlayers = advanceM1PlayerControl(input, policy, controlled);
    const nextAvailability = advanceM1Availability(input, policy, availability);
    if (!nextPlayers.ok || !nextAvailability.ok) {
      return { ok: false, error: 'INVALID_TRANSITION' };
    }
    controlled = nextPlayers.state;
    availability = nextAvailability.state;
  }
  if (index !== plannedCommands.length) return { ok: false, error: 'INVALID_SCHEDULE' };
  events.push({
    schemaVersion: M1_V6_EVENT_SCHEMA_VERSION,
    id: 'm1-v6-full-time', sequence: events.length + 1,
    elapsedSeconds: 5400, type: 'full-time',
  });
  const ledger = deriveM1V6Ledger(input, policy, events);
  if (!ledger.ok) return { ok: false, error: 'INVALID_LEDGER' };
  return {
    ok: true, engineVersion: M1_V6_ENGINE_VERSION,
    schemaVersion: M1_V6_EVENT_SCHEMA_VERSION,
    rngAlgorithmVersion: RNG_VERSION, rngSeed: input.rngSeed,
    rngState: rng.snapshot(),
    rngDraws: M1_CLOCK_MAX_EVENTS * M1_V6_DRAWS_PER_PHASE,
    controlled, availability, events, report: ledger.report,
  };
}
