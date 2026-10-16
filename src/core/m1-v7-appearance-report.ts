import { sameCanonicalValue } from './canonical-value.js';
import { deriveM1VerifiedV6AppearanceReport,
  type M1V6Appearance, type M1V6AppearanceReport } from './m1-v6-appearance-report.js';
import { M1_V7_ENGINE_VERSION, M1_V7_EVENT_SCHEMA_VERSION,
  simulateM1V7Phases, type M1V7Report } from './m1-v7-adjudications.js';
import type { M1PrematchInput } from './m1-clock.js';

/**
 * Read-only v7 attribution. Keep a confirmed own goal on its defending player
 * without inventing an opposing scorer, and treat penalties as player shots.
 */
export const M1_V7_APPEARANCE_SCHEMA_VERSION = 1 as const;
export interface M1V7Appearance extends M1V6Appearance {
  /** Includes open-play goals plus confirmed successful penalty kicks. */
  readonly goals: number;
  readonly penaltiesTaken: number;
  readonly penaltyGoals: number;
  readonly ownGoals: number;
}
export type M1V7GoalAttribution =
  | Readonly<{
    kind: 'open-play' | 'penalty';
    eventId: string; teamId: string; scorerId: string; elapsedSeconds: number;
  }>
  | Readonly<{
    kind: 'own-goal'; eventId: string; teamId: string;
    defenderId: string; elapsedSeconds: number;
  }>;
export interface M1V7AppearanceReport {
  readonly schemaVersion: typeof M1_V7_APPEARANCE_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V7_CONFIRMED_DECISIONS_NO_CAREER_SANCTIONS';
  readonly engineVersion: typeof M1_V7_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
  readonly fixtureId: string;
  readonly match: M1V7Report;
  readonly goals: readonly M1V7GoalAttribution[];
  readonly appearances: readonly M1V7Appearance[];
  readonly teams: M1V6AppearanceReport['teams'];
}
export type M1V7AppearanceResult =
  | Readonly<{ ok: true; report: M1V7AppearanceReport }>
  | Readonly<{ ok: false; error: 'INVALID_MATCH_SOURCE' | 'INTERNAL_INVARIANT' }>;

interface MutableRow extends M1V7Appearance {
  goals: number; shots: number; shotsOnTarget: number;
  penaltiesTaken: number; penaltyGoals: number; ownGoals: number;
}
const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;

/** Caller MUST authenticate trustedDecisions independently of this pure API. */
export function deriveM1VerifiedV7AppearanceReport(
  prematch: unknown, policy: unknown, plannedCommands: unknown,
  trustedDecisions: unknown, candidate: unknown,
): M1V7AppearanceResult {
  const replay = simulateM1V7Phases(prematch, policy, plannedCommands, trustedDecisions);
  if (!replay.ok || !sameCanonicalValue(replay, candidate)) {
    return { ok: false, error: 'INVALID_MATCH_SOURCE' };
  }
  const base = deriveM1VerifiedV6AppearanceReport(
    prematch, policy, plannedCommands, replay.base,
  );
  if (!base.ok) return invariant;
  const input = prematch as M1PrematchInput;
  const rows: MutableRow[] = base.report.appearances.map(p => ({
    ...p, penaltiesTaken: 0, penaltyGoals: 0, ownGoals: 0,
  }));
  const byId = new Map(rows.map(p => [p.playerId, p]));
  const goals: M1V7GoalAttribution[] = [];
  const credited = { home: 0, away: 0 };
  for (const event of replay.events) {
    if (event.type === 'v6-event') {
      const source = event.source;
      if (source.type !== 'shot' || source.outcome !== 'goal') continue;
      const side = source.teamId === input.fixture.homeClubId ? 'home' : 'away';
      const player = byId.get(source.playerId);
      if (!player || player.teamId !== source.teamId) return invariant;
      credited[side]++;
      goals.push({
        kind: 'open-play', eventId: event.id, teamId: source.teamId,
        scorerId: source.playerId, elapsedSeconds: source.elapsedSeconds,
      });
      continue;
    }
    const decision = event.decision;
    const side = decision.teamId === input.fixture.homeClubId ? 'home' : 'away';
    const player = byId.get(decision.playerId);
    if (!player) return invariant;
    if (decision.kind === 'penalty-kick') {
      if (player.teamId !== decision.teamId) return invariant;
      player.penaltiesTaken++;
      player.shots++;
      if (decision.outcome !== 'missed') player.shotsOnTarget++;
      if (decision.outcome === 'scored') {
        player.penaltyGoals++;
        player.goals++;
        credited[side]++;
        goals.push({
          kind: 'penalty', eventId: event.id, teamId: decision.teamId,
          scorerId: decision.playerId, elapsedSeconds: decision.elapsedSeconds,
        });
      }
    } else {
      if (player.teamId === decision.teamId) return invariant;
      player.ownGoals++;
      credited[side]++;
      goals.push({
        kind: 'own-goal', eventId: event.id, teamId: decision.teamId,
        defenderId: decision.playerId, elapsedSeconds: decision.elapsedSeconds,
      });
    }
  }
  for (const side of ['home', 'away'] as const) {
    const teamId = side === 'home' ? input.fixture.homeClubId : input.fixture.awayClubId;
    const group = rows.filter(p => p.teamId === teamId);
    const otherId = side === 'home' ? input.fixture.awayClubId : input.fixture.homeClubId;
    const opponent = rows.filter(p => p.teamId === otherId);
    const sum = (items: readonly MutableRow[], key: keyof MutableRow) =>
      items.reduce((total, p) => total + (p[key] as number), 0);
    const stats = replay.report[side];
    if (credited[side] !== stats.goals ||
        sum(group, 'goals') + sum(opponent, 'ownGoals') !== stats.goals ||
        sum(group, 'shots') !== stats.shots ||
        sum(group, 'shotsOnTarget') !== stats.shotsOnTarget ||
        sum(group, 'xgMilli') !== stats.xgMilli ||
        sum(group, 'penaltiesTaken') !== stats.penaltiesTaken ||
        sum(group, 'penaltyGoals') !== stats.penaltyGoals ||
        sum(opponent, 'ownGoals') !== stats.ownGoalsFor) return invariant;
  }
  if (goals.length !== replay.report.home.goals + replay.report.away.goals) {
    return invariant;
  }
  return { ok: true, report: {
    schemaVersion: M1_V7_APPEARANCE_SCHEMA_VERSION,
    status: 'SYNTHETIC_V7_CONFIRMED_DECISIONS_NO_CAREER_SANCTIONS',
    engineVersion: M1_V7_ENGINE_VERSION,
    eventSchemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
    fixtureId: input.fixture.id, match: replay.report, goals, appearances: rows,
    teams: base.report.teams,
  } };
}
