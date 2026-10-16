import { sameCanonicalValue } from './canonical-value.js';
import type { M1PrematchInput } from './m1-clock.js';
import { M1_V8_ENGINE_VERSION, M1_V8_EVENT_SCHEMA_VERSION,
  simulateM1V8MedicalPhases, type M1V8Result } from './m1-v8-medical-phases.js';

/**
 * An isolated, read-only per-player report for replay-verified v8 matches.
 * Recalculate scoring arithmetic from the generated event stream; never use
 * v7's pre-medical shot attribution or silently commit v8 into a v7 journal.
 */
export const M1_V8_GOAL_ATTRIBUTION_SCHEMA_VERSION = 1 as const;
export interface M1V8PlayerStats {
  readonly teamId: string;
  readonly playerId: string;
  readonly started: boolean;
  readonly goals: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xgMilli: number;
  readonly penaltiesTaken: number;
  readonly penaltyGoals: number;
  readonly ownGoals: number;
}
export type M1V8CreditedGoal =
  | Readonly<{ kind: 'open-play' | 'penalty'; eventId: string;
    teamId: string; scorerId: string; elapsedSeconds: number }>
  | Readonly<{ kind: 'own-goal'; eventId: string;
    teamId: string; defenderId: string; elapsedSeconds: number }>;
export interface M1V8GoalAttribution {
  readonly schemaVersion: typeof M1_V8_GOAL_ATTRIBUTION_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_MEDICAL_AWARE_NO_CAREER_POSTING';
  readonly fixtureId: string;
  readonly match: M1V8Result['report'];
  readonly goals: readonly M1V8CreditedGoal[];
  readonly players: readonly M1V8PlayerStats[];
  readonly offFieldAtFullTime: readonly string[];
  readonly onFieldAtFullTime: M1V8Result['onFieldAtFullTime'];
}
export type M1V8AttributionResult =
  | Readonly<{ ok: true; report: M1V8GoalAttribution }>
  | Readonly<{ ok: false; error: 'INVALID_MATCH_SOURCE' | 'INTERNAL_INVARIANT' }>;

type MutablePlayer = { -readonly [K in keyof M1V8PlayerStats]: M1V8PlayerStats[K] };
const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;
const emptyStats = () => ({
  goals: 0, openPlayGoals: 0, penaltiesTaken: 0, penaltyGoals: 0,
  ownGoalsFor: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0,
  xgCoverage: 'open-play-only',
} as const);
type MutableTeam = { -readonly [K in keyof ReturnType<typeof emptyStats>]:
  ReturnType<typeof emptyStats>[K] extends number ? number :
    ReturnType<typeof emptyStats>[K] };
const sorted = (values: Iterable<string>): string[] => [...values].sort();

/**
 * Source decisions, medical restarts and staff authority are claims supplied
 * by the caller, not authenticated by this function. The candidate's full
 * seeded event stream must match replay before any statistics are derived.
 */
export function deriveM1VerifiedV8GoalAttribution(
  prematch: unknown, policy: unknown, commands: unknown,
  decisions: unknown, medical: unknown, candidate: unknown,
): M1V8AttributionResult {
  const replay = simulateM1V8MedicalPhases(
    prematch, policy, commands, decisions, medical,
  );
  if (!replay.ok || !sameCanonicalValue(replay, candidate)) {
    return { ok: false, error: 'INVALID_MATCH_SOURCE' };
  }
  return projectM1V8GoalAttributionFromVerifiedReplay(
    prematch as M1PrematchInput, replay,
  );
}

/**
 * Internal projection: callers must first source-replay and compare the entire
 * candidate. The standalone public entrypoint above always does so.
 */
export function projectM1V8GoalAttributionFromVerifiedReplay(
  input: M1PrematchInput, replay: M1V8Result,
): M1V8AttributionResult {
  const ids = { home: input.fixture.homeClubId, away: input.fixture.awayClubId };
  const active = {
    home: new Set(input.homeLineup.starters),
    away: new Set(input.awayLineup.starters),
  };
  const absent = new Set<string>();
  const rows = new Map<string, MutablePlayer>();
  const goals: M1V8CreditedGoal[] = [];
  const totals: { home: MutableTeam; away: MutableTeam } = {
    home: { ...emptyStats() }, away: { ...emptyStats() },
  };
  function add(id: string, side: 'home' | 'away', started: boolean): boolean {
    if (rows.has(id)) return false;
    rows.set(id, {
      teamId: ids[side], playerId: id, started,
      goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0,
      penaltiesTaken: 0, penaltyGoals: 0, ownGoals: 0,
    });
    return true;
  }
  for (const id of active.home) if (!add(id, 'home', true)) return invariant;
  for (const id of active.away) if (!add(id, 'away', true)) return invariant;
  function participant(id: string, side: 'home' | 'away'): MutablePlayer | null {
    if (!active[side].has(id) || absent.has(id)) return null;
    const row = rows.get(id);
    return row && row.teamId === ids[side] ? row : null;
  }
  for (const event of replay.events) {
    if (event.type === 'availability') {
      const action = event.source.entry.action;
      const side = action.teamId === ids.home ? 'home' : 'away';
      if (action.kind === 'substitute-normal') {
        if (!active[side].delete(action.outPlayerId) ||
            absent.has(action.outPlayerId) || !add(action.inPlayerId, side, false)) {
          return invariant;
        }
        active[side].add(action.inPlayerId);
      } else if (event.source.entry.effect !== 'yellow') {
        if (!active[side].delete(action.playerId) || absent.has(action.playerId)) {
          return invariant;
        }
      }
      continue;
    }
    if (event.type === 'medical') {
      const action = event.action;
      const side = action.teamId === ids.home ? 'home' : 'away';
      if (!active[side].has(action.playerId)) return invariant;
      if (action.kind === 'treatment-exit') {
        if (absent.has(action.playerId)) return invariant;
        absent.add(action.playerId);
      } else if (!absent.delete(action.playerId)) return invariant;
      continue;
    }
    if (event.type === 'shot') {
      const side = event.teamId === ids.home ? 'home' : 'away';
      const row = participant(event.playerId, side);
      if (!row) return invariant;
      const team = totals[side];
      row.shots++;
      row.xgMilli += event.xgMilli;
      team.shots++;
      team.xgMilli += event.xgMilli;
      if (event.outcome === 'goal' || event.outcome === 'saved') {
        row.shotsOnTarget++;
        team.shotsOnTarget++;
      }
      if (event.outcome === 'goal') {
        row.goals++;
        team.goals++;
        team.openPlayGoals++;
        goals.push({ kind: 'open-play', eventId: event.id,
          teamId: event.teamId, scorerId: event.playerId,
          elapsedSeconds: event.elapsedSeconds });
      }
      continue;
    }
    if (event.type === 'adjudication') {
      const decision = event.decision;
      const side = decision.teamId === ids.home ? 'home' : 'away';
      const opponent = side === 'home' ? 'away' : 'home';
      const row = participant(decision.playerId,
        decision.kind === 'penalty-kick' ? side : opponent);
      if (!row) return invariant;
      const team = totals[side];
      if (decision.kind === 'own-goal') {
        row.ownGoals++;
        team.ownGoalsFor++;
        team.goals++;
        goals.push({ kind: 'own-goal', eventId: event.id,
          teamId: decision.teamId, defenderId: decision.playerId,
          elapsedSeconds: event.elapsedSeconds });
      } else {
        row.penaltiesTaken++;
        row.shots++;
        team.penaltiesTaken++;
        team.shots++;
        if (decision.outcome !== 'missed') {
          row.shotsOnTarget++;
          team.shotsOnTarget++;
        }
        if (decision.outcome === 'scored') {
          row.penaltyGoals++;
          row.goals++;
          team.penaltyGoals++;
          team.goals++;
          goals.push({ kind: 'penalty', eventId: event.id,
            teamId: decision.teamId, scorerId: decision.playerId,
            elapsedSeconds: event.elapsedSeconds });
        }
      }
    }
  }
  if (!sameCanonicalValue(totals.home, replay.report.home) ||
      !sameCanonicalValue(totals.away, replay.report.away) ||
      !sameCanonicalValue(sorted(absent), replay.offFieldAtFullTime) ||
      !sameCanonicalValue({
        home: sorted([...active.home].filter(id => !absent.has(id))),
        away: sorted([...active.away].filter(id => !absent.has(id))),
      }, replay.onFieldAtFullTime) ||
      goals.length !== totals.home.goals + totals.away.goals) return invariant;
  return { ok: true, report: {
    schemaVersion: M1_V8_GOAL_ATTRIBUTION_SCHEMA_VERSION,
    engineVersion: M1_V8_ENGINE_VERSION,
    eventSchemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_MEDICAL_AWARE_NO_CAREER_POSTING',
    fixtureId: input.fixture.id, match: replay.report, goals,
    players: [...rows.values()],
    offFieldAtFullTime: replay.offFieldAtFullTime,
    onFieldAtFullTime: replay.onFieldAtFullTime,
  } };
}
