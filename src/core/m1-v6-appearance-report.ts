import { sameCanonicalValue } from './canonical-value.js';
import { simulateM1V6Phases, M1_V6_ENGINE_VERSION,
  M1_V6_EVENT_SCHEMA_VERSION, type M1V6Result } from './m1-phases-v6.js';
import type { M1PrematchInput } from './m1-clock.js';
import type { MatchLedgerReport } from './match-contracts.js';

/** Read-only, source-verified v6 player projection. No career-save mutation. */
export const M1_V6_APPEARANCE_SCHEMA_VERSION = 1 as const;
export interface M1V6Appearance {
  readonly teamId: string;
  readonly playerId: string;
  readonly started: boolean;
  readonly enteredAtSeconds: number;
  readonly leftAtSeconds: number;
  readonly playedSeconds: number;
  readonly yellowCards: number;
  readonly dismissal: 'none' | 'second-yellow' | 'straight-red';
  readonly medicalWithdrawn: boolean;
  readonly goals: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xgMilli: number;
}
export interface M1V6GoalAttribution {
  readonly eventId: string;
  readonly teamId: string;
  readonly scorerId: string;
  readonly elapsedSeconds: number;
  readonly kind: 'synthetic-open-play-shot';
}
export interface M1V6AppearanceReport {
  readonly schemaVersion: typeof M1_V6_APPEARANCE_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V6_EVENTS_ONLY_NO_DISCIPLINARY_SANCTIONS';
  readonly engineVersion: typeof M1_V6_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V6_EVENT_SCHEMA_VERSION;
  readonly fixtureId: string;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly match: MatchLedgerReport;
  readonly goals: readonly M1V6GoalAttribution[];
  readonly appearances: readonly M1V6Appearance[];
  readonly teams: Readonly<{
    home: { readonly yellowCards: number; readonly dismissals: number;
      readonly medicalWithdrawals: number; readonly normalSubstitutions: number;
      readonly playedSeconds: number };
    away: { readonly yellowCards: number; readonly dismissals: number;
      readonly medicalWithdrawals: number; readonly normalSubstitutions: number;
      readonly playedSeconds: number };
  }>;
}
export type M1V6AppearanceResult =
  | Readonly<{ ok: true; report: M1V6AppearanceReport }>
  | Readonly<{ ok: false; error: 'INVALID_MATCH_SOURCE' | 'INTERNAL_INVARIANT' }>;

type MutableAppearance = {
  teamId: string; playerId: string; started: boolean;
  enteredAtSeconds: number; leftAtSeconds: number;
  yellowCards: number; dismissal: M1V6Appearance['dismissal'];
  medicalWithdrawn: boolean;
  goals: number; shots: number; shotsOnTarget: number; xgMilli: number;
};
const error = { ok: false, error: 'INTERNAL_INVARIANT' } as const;

/**
 * Refuse a claimed result unless the *whole* game reproduces from trusted
 * source, seed, staff policy, and exact mixed action chronology.
 */
export function deriveM1VerifiedV6AppearanceReport(
  prematch: unknown, policy: unknown, commands: unknown, candidate: unknown,
): M1V6AppearanceResult {
  const replay = simulateM1V6Phases(prematch, policy, commands);
  if (!replay.ok || !sameCanonicalValue(replay, candidate)) {
    return { ok: false, error: 'INVALID_MATCH_SOURCE' };
  }
  const input = prematch as M1PrematchInput;
  const match: M1V6Result = replay;
  const rows: MutableAppearance[] = [];
  const byId = new Map<string, MutableAppearance>();
  function add(teamId: string, playerId: string, at: number, started: boolean): boolean {
    if (byId.has(playerId)) return false;
    const appearance: MutableAppearance = {
      teamId, playerId, started, enteredAtSeconds: at, leftAtSeconds: 5400,
      yellowCards: 0, dismissal: 'none', medicalWithdrawn: false,
      goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0,
    };
    byId.set(playerId, appearance);
    rows.push(appearance);
    return true;
  }
  for (const id of input.homeLineup.starters) {
    if (!add(input.fixture.homeClubId, id, 0, true)) return error;
  }
  for (const id of input.awayLineup.starters) {
    if (!add(input.fixture.awayClubId, id, 0, true)) return error;
  }
  const goals: M1V6GoalAttribution[] = [];
  for (const event of match.events) {
    if (event.type === 'availability') {
      const action = event.entry.action;
      if (event.entry.effect === 'substitution') {
        if (action.kind !== 'substitute-normal') return error;
        const departing = byId.get(action.outPlayerId);
        if (!departing || departing.teamId !== action.teamId ||
            departing.leftAtSeconds !== 5400 ||
            event.elapsedSeconds < departing.enteredAtSeconds ||
            !add(action.teamId, action.inPlayerId, event.elapsedSeconds, false)) return error;
        departing.leftAtSeconds = event.elapsedSeconds;
      } else {
        if (action.kind === 'substitute-normal') return error;
        const player = byId.get(action.playerId);
        if (!player || player.teamId !== action.teamId ||
            event.elapsedSeconds < player.enteredAtSeconds ||
            event.elapsedSeconds >= player.leftAtSeconds) return error;
        if (event.entry.effect === 'yellow') player.yellowCards++;
        else if (event.entry.effect === 'second-yellow-red') {
          player.yellowCards++;
          player.dismissal = 'second-yellow';
          player.leftAtSeconds = event.elapsedSeconds;
        } else if (event.entry.effect === 'straight-red') {
          player.dismissal = 'straight-red';
          player.leftAtSeconds = event.elapsedSeconds;
        } else if (event.entry.effect === 'injury-withdrawn') {
          player.medicalWithdrawn = true;
          player.leftAtSeconds = event.elapsedSeconds;
        } else return error;
      }
      continue;
    }
    if (event.type !== 'shot') continue;
    const player = byId.get(event.playerId);
    if (!player || player.teamId !== event.teamId ||
        event.elapsedSeconds < player.enteredAtSeconds ||
        event.elapsedSeconds >= player.leftAtSeconds) return error;
    player.shots++;
    player.xgMilli += event.xgMilli;
    if (event.outcome === 'goal' || event.outcome === 'saved') player.shotsOnTarget++;
    if (event.outcome === 'goal') {
      player.goals++;
      goals.push({
        eventId: event.id, teamId: event.teamId, scorerId: event.playerId,
        elapsedSeconds: event.elapsedSeconds, kind: 'synthetic-open-play-shot',
      });
    }
  }
  const appearances: M1V6Appearance[] = rows.map(p => ({
    ...p, playedSeconds: p.leftAtSeconds - p.enteredAtSeconds,
  }));
  function aggregate(teamId: string) {
    const group = appearances.filter(p => p.teamId === teamId);
    const stats = {
      goals: group.reduce((n, p) => n + p.goals, 0),
      shots: group.reduce((n, p) => n + p.shots, 0),
      shotsOnTarget: group.reduce((n, p) => n + p.shotsOnTarget, 0),
      xgMilli: group.reduce((n, p) => n + p.xgMilli, 0),
    };
    const playedSeconds = group.reduce((n, p) => n + p.playedSeconds, 0);
    const yellowCards = group.reduce((n, p) => n + p.yellowCards, 0);
    const dismissals = group.filter(p => p.dismissal !== 'none').length;
    const medicalWithdrawals = group.filter(p => p.medicalWithdrawn).length;
    const normalSubstitutions = group.filter(p => !p.started).length;
    const expected = 11 * 5400 -
      group.filter(p => p.dismissal !== 'none' || p.medicalWithdrawn)
        .reduce((n, p) => n + 5400 - p.leftAtSeconds, 0);
    if (playedSeconds !== expected) return null;
    return { stats, summary: {
      yellowCards, dismissals, medicalWithdrawals,
      normalSubstitutions, playedSeconds,
    } };
  }
  const h = aggregate(input.fixture.homeClubId);
  const a = aggregate(input.fixture.awayClubId);
  if (!h || !a || !sameCanonicalValue(h.stats, match.report.home) ||
      !sameCanonicalValue(a.stats, match.report.away) ||
      goals.length !== h.stats.goals + a.stats.goals) return error;
  return { ok: true, report: {
    schemaVersion: M1_V6_APPEARANCE_SCHEMA_VERSION,
    status: 'SYNTHETIC_V6_EVENTS_ONLY_NO_DISCIPLINARY_SANCTIONS',
    engineVersion: M1_V6_ENGINE_VERSION,
    eventSchemaVersion: M1_V6_EVENT_SCHEMA_VERSION,
    fixtureId: input.fixture.id, rngSeed: match.rngSeed, rngState: match.rngState,
    match: match.report, goals, appearances,
    teams: { home: h.summary, away: a.summary },
  } };
}
