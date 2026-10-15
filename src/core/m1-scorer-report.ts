import { sameCanonicalValue } from './canonical-value.js';
import { simulateM1V5Phases, M1_V5_ENGINE_VERSION,
  M1_V5_EVENT_SCHEMA_VERSION, type M1V5Result } from './m1-phases-v5.js';
import type { M1PrematchInput } from './m1-clock.js';
import type { MatchLedgerReport } from './match-contracts.js';

/** Read-only M1-P4 projection, not a schema upgrade of M0 saved careers. */
export const M1_SCORER_REPORT_SCHEMA_VERSION = 1 as const;
export interface M1PlayerAppearance {
  readonly teamId: string;
  readonly playerId: string;
  readonly started: boolean;
  readonly enteredAtSeconds: number;
  readonly leftAtSeconds: number;
  readonly playedSeconds: number;
  readonly goals: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xgMilli: number;
}
export interface M1GoalEntry {
  readonly eventId: string;
  readonly teamId: string;
  readonly scorerId: string;
  readonly elapsedSeconds: number;
  readonly kind: 'synthetic-open-play-shot';
}
export interface M1ScorerReport {
  readonly schemaVersion: typeof M1_SCORER_REPORT_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V5_OPEN_PLAY_ONLY';
  readonly actionEngineVersion: typeof M1_V5_ENGINE_VERSION;
  readonly actionSchemaVersion: typeof M1_V5_EVENT_SCHEMA_VERSION;
  readonly fixtureId: string;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly match: MatchLedgerReport;
  readonly goals: readonly M1GoalEntry[];
  readonly players: readonly M1PlayerAppearance[];
}
export type M1ScorerReportResult =
  | Readonly<{ ok: true; report: M1ScorerReport }>
  | Readonly<{ ok: false; error: 'INVALID_MATCH_INPUT' | 'INTERNAL_INVARIANT' }>;

type MutableAppearance = {
  teamId: string; playerId: string; started: boolean;
  enteredAtSeconds: number; leftAtSeconds: number;
  goals: number; shots: number; shotsOnTarget: number; xgMilli: number;
};

/**
 * The public boundary never trusts externally provided final goals/participants:
 * recompute the entire canonical v5 seed+commands from original prematch and
 * policy, and only project an exactly matching generated result.
 */
export function deriveM1VerifiedScorerReport(
  prematch: unknown, policy: unknown, commands: unknown, candidate: unknown,
): M1ScorerReportResult {
  const valid = simulateM1V5Phases(prematch, policy, commands);
  if (!valid.ok || !sameCanonicalValue(valid, candidate)) {
    return { ok: false, error: 'INVALID_MATCH_INPUT' };
  }
  const source = prematch as M1PrematchInput;
  const match: M1V5Result = valid;
  const appearances: MutableAppearance[] = [];
  const byId = new Map<string, MutableAppearance>();
  const add = (teamId: string, playerId: string, enteredAtSeconds: number,
    started: boolean): boolean => {
    if (byId.has(playerId)) return false;
    const row: MutableAppearance = {
      teamId, playerId, started, enteredAtSeconds, leftAtSeconds: 5400,
      goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0,
    };
    appearances.push(row);
    byId.set(playerId, row);
    return true;
  };
  for (const id of source.homeLineup.starters) {
    if (!add(source.fixture.homeClubId, id, 0, true)) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
  }
  for (const id of source.awayLineup.starters) {
    if (!add(source.fixture.awayClubId, id, 0, true)) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
  }
  const goals: M1GoalEntry[] = [];
  for (const event of match.events) {
    if (event.type === 'substitution') {
      const leaving = byId.get(event.command.outPlayerId);
      if (!leaving || leaving.teamId !== event.command.teamId ||
          leaving.leftAtSeconds !== 5400 ||
          event.elapsedSeconds < leaving.enteredAtSeconds ||
          !add(event.command.teamId, event.command.inPlayerId, event.elapsedSeconds, false)) {
        return { ok: false, error: 'INTERNAL_INVARIANT' };
      }
      leaving.leftAtSeconds = event.elapsedSeconds;
      continue;
    }
    if (event.type !== 'shot') continue;
    const player = byId.get(event.playerId);
    if (!player || player.teamId !== event.teamId ||
        event.elapsedSeconds < player.enteredAtSeconds ||
        event.elapsedSeconds >= player.leftAtSeconds) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
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
  const players = appearances.map(p => ({
    teamId: p.teamId, playerId: p.playerId, started: p.started,
    enteredAtSeconds: p.enteredAtSeconds, leftAtSeconds: p.leftAtSeconds,
    playedSeconds: p.leftAtSeconds - p.enteredAtSeconds,
    goals: p.goals, shots: p.shots, shotsOnTarget: p.shotsOnTarget, xgMilli: p.xgMilli,
  }));
  const totals = (teamId: string) => {
    const side = players.filter(x => x.teamId === teamId);
    return {
      goals: side.reduce((n, x) => n + x.goals, 0),
      shots: side.reduce((n, x) => n + x.shots, 0),
      shotsOnTarget: side.reduce((n, x) => n + x.shotsOnTarget, 0),
      xgMilli: side.reduce((n, x) => n + x.xgMilli, 0),
      playedSeconds: side.reduce((n, x) => n + x.playedSeconds, 0),
    };
  };
  const home = totals(source.fixture.homeClubId);
  const away = totals(source.fixture.awayClubId);
  for (const [side, summary] of [['home', home], ['away', away]] as const) {
    const reported = match.report[side];
    if (summary.playedSeconds !== 11 * 5400 ||
        summary.goals !== reported.goals || summary.shots !== reported.shots ||
        summary.shotsOnTarget !== reported.shotsOnTarget ||
        summary.xgMilli !== reported.xgMilli) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
  }
  return { ok: true, report: {
    schemaVersion: M1_SCORER_REPORT_SCHEMA_VERSION,
    status: 'SYNTHETIC_V5_OPEN_PLAY_ONLY',
    actionEngineVersion: M1_V5_ENGINE_VERSION,
    actionSchemaVersion: M1_V5_EVENT_SCHEMA_VERSION,
    fixtureId: source.fixture.id, rngSeed: match.rngSeed, rngState: match.rngState,
    match: match.report, goals, players,
  } };
}
