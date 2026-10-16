import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput }
  from './m1-clock.js';
import { M1_V8_ENGINE_VERSION, M1_V8_EVENT_SCHEMA_VERSION,
  simulateM1V8MedicalPhases, type M1V8Result } from './m1-v8-medical-phases.js';

/**
 * Read-only v8 person-second accounting at the synthetic 300-second phase
 * resolution. Not actual ball-in-play time, fatigue, or a medical ruling.
 */
export const M1_V8_PHASE_PRESENCE_SCHEMA_VERSION = 1 as const;
export interface M1V8PhasePlayer {
  readonly teamId: string;
  readonly playerId: string;
  readonly started: boolean;
  /** Remains legally in the active XI, even when out for treatment. */
  readonly registeredPhaseSeconds: number;
  /** Physically on the pitch at these synthetic phase checkpoints. */
  readonly physicalPhaseSeconds: number;
  /** Only temporary off-field treatment, not dismissal or substitution. */
  readonly temporarilyAbsentPhaseSeconds: number;
}
export interface M1V8PhaseTeam {
  readonly registeredPhasePersonSeconds: number;
  readonly physicalPhasePersonSeconds: number;
  readonly temporarilyAbsentPhasePersonSeconds: number;
  readonly minPhysicallyPresent: number;
  readonly maxPhysicallyPresent: number;
}
export interface M1V8PhasePresenceReport {
  readonly schemaVersion: typeof M1_V8_PHASE_PRESENCE_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_PHASE_SECONDS_NOT_REAL_RUNNING_CLOCK';
  readonly fixtureId: string;
  readonly completedPhases: number;
  readonly players: readonly M1V8PhasePlayer[];
  readonly teams: Readonly<{ home: M1V8PhaseTeam; away: M1V8PhaseTeam }>;
  readonly offFieldAtFullTime: M1V8Result['offFieldAtFullTime'];
  readonly onFieldAtFullTime: M1V8Result['onFieldAtFullTime'];
}
export type M1V8PhasePresenceResult =
  | Readonly<{ ok: true; report: M1V8PhasePresenceReport }>
  | Readonly<{ ok: false; error: 'INVALID_MATCH_SOURCE' | 'INTERNAL_INVARIANT' }>;
type MutablePlayer = { -readonly [K in keyof M1V8PhasePlayer]: M1V8PhasePlayer[K] };
type MutableTeam = { -readonly [K in keyof M1V8PhaseTeam]: M1V8PhaseTeam[K] };
const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;
const empty = (): MutableTeam => ({
  registeredPhasePersonSeconds: 0,
  physicalPhasePersonSeconds: 0,
  temporarilyAbsentPhasePersonSeconds: 0,
  minPhysicallyPresent: 11,
  maxPhysicallyPresent: 0,
});
const ordered = (ids: Iterable<string>): string[] => [...ids].sort();

/** Caller must separately authenticate origin of referee and medical facts. */
export function deriveM1VerifiedV8PhasePresence(
  prematch: unknown, policy: unknown, commands: unknown,
  decisions: unknown, medical: unknown, candidate: unknown,
): M1V8PhasePresenceResult {
  const replay = simulateM1V8MedicalPhases(
    prematch, policy, commands, decisions, medical,
  );
  if (!replay.ok || !sameCanonicalValue(replay, candidate)) {
    return { ok: false, error: 'INVALID_MATCH_SOURCE' };
  }
  const input = prematch as M1PrematchInput;
  const clubs = { home: input.fixture.homeClubId, away: input.fixture.awayClubId };
  const active = {
    home: new Set(input.homeLineup.starters),
    away: new Set(input.awayLineup.starters),
  };
  const absent = new Set<string>();
  const rows = new Map<string, MutablePlayer>();
  const teams = { home: empty(), away: empty() };
  function add(playerId: string, side: 'home' | 'away', started: boolean): boolean {
    if (rows.has(playerId)) return false;
    rows.set(playerId, {
      teamId: clubs[side], playerId, started, registeredPhaseSeconds: 0,
      physicalPhaseSeconds: 0, temporarilyAbsentPhaseSeconds: 0,
    });
    return true;
  }
  for (const id of active.home) if (!add(id, 'home', true)) return invariant;
  for (const id of active.away) if (!add(id, 'away', true)) return invariant;
  for (let phase = 0; phase < M1_CLOCK_MAX_EVENTS; phase++) {
    const second = phase * M1_CLOCK_STEP_SECONDS;
    for (const event of replay.events) {
      if (event.elapsedSeconds !== second) continue;
      if (event.type === 'availability') {
        const action = event.source.entry.action;
        const side = action.teamId === clubs.home ? 'home' : 'away';
        if (action.kind === 'substitute-normal') {
          if (!active[side].delete(action.outPlayerId) ||
              absent.has(action.outPlayerId) ||
              !add(action.inPlayerId, side, false)) return invariant;
          active[side].add(action.inPlayerId);
        } else if (event.source.entry.effect !== 'yellow') {
          if (!active[side].delete(action.playerId) ||
              absent.has(action.playerId)) return invariant;
        } else if (!active[side].has(action.playerId)) return invariant;
      } else if (event.type === 'medical') {
        const action = event.action;
        const side = action.teamId === clubs.home ? 'home' : 'away';
        if (!active[side].has(action.playerId)) return invariant;
        if (action.kind === 'treatment-exit') {
          if (absent.has(action.playerId)) return invariant;
          absent.add(action.playerId);
        } else if (!absent.delete(action.playerId)) return invariant;
      }
    }
    for (const side of ['home', 'away'] as const) {
      let presentCount = 0;
      const group = teams[side];
      for (const id of active[side]) {
        const row = rows.get(id);
        if (!row || row.teamId !== clubs[side]) return invariant;
        row.registeredPhaseSeconds += M1_CLOCK_STEP_SECONDS;
        group.registeredPhasePersonSeconds += M1_CLOCK_STEP_SECONDS;
        if (absent.has(id)) {
          row.temporarilyAbsentPhaseSeconds += M1_CLOCK_STEP_SECONDS;
          group.temporarilyAbsentPhasePersonSeconds += M1_CLOCK_STEP_SECONDS;
        } else {
          row.physicalPhaseSeconds += M1_CLOCK_STEP_SECONDS;
          group.physicalPhasePersonSeconds += M1_CLOCK_STEP_SECONDS;
          presentCount++;
        }
      }
      group.minPhysicallyPresent = Math.min(group.minPhysicallyPresent, presentCount);
      group.maxPhysicallyPresent = Math.max(group.maxPhysicallyPresent, presentCount);
      if (presentCount < 7 || presentCount > 11) return invariant;
    }
  }
  if (!sameCanonicalValue(ordered(absent), replay.offFieldAtFullTime) ||
      !sameCanonicalValue({
        home: ordered([...active.home].filter(id => !absent.has(id))),
        away: ordered([...active.away].filter(id => !absent.has(id))),
      }, replay.onFieldAtFullTime)) return invariant;
  for (const row of rows.values()) {
    if (row.registeredPhaseSeconds !==
        row.physicalPhaseSeconds + row.temporarilyAbsentPhaseSeconds) {
      return invariant;
    }
  }
  return { ok: true, report: {
    schemaVersion: M1_V8_PHASE_PRESENCE_SCHEMA_VERSION,
    engineVersion: M1_V8_ENGINE_VERSION,
    eventSchemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    status: 'SYNTHETIC_PHASE_SECONDS_NOT_REAL_RUNNING_CLOCK',
    fixtureId: input.fixture.id,
    completedPhases: M1_CLOCK_MAX_EVENTS,
    players: [...rows.values()], teams,
    offFieldAtFullTime: replay.offFieldAtFullTime,
    onFieldAtFullTime: replay.onFieldAtFullTime,
  } };
}
