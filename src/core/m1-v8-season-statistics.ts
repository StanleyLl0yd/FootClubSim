import { validateM1V8MatchJournal }
  from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';

/**
 * Read-only v8 source-replayed season accumulation.
 * No standings, points, fixture awards, automatic sanctions or condition.
 */
export const M1_V8_SEASON_STATS_SCHEMA_VERSION = 1 as const;
export interface M1V8TeamSeasonStats {
  readonly clubId: string;
  readonly completedFixtures: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly openPlayGoals: number;
  readonly penaltyGoals: number;
  readonly ownGoalsFor: number;
  readonly penaltiesTaken: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly openPlayXgMilli: number;
  readonly yellowCards: number;
  readonly dismissals: number;
  readonly permanentMedicalWithdrawals: number;
  readonly namedBenchSlots: number;
  readonly usedSubstituteAppearances: number;
  readonly unusedBenchSlots: number;
  readonly registeredPhasePersonSeconds: number;
  readonly physicalPhasePersonSeconds: number;
  readonly temporarilyAbsentPhasePersonSeconds: number;
}
export interface M1V8PlayerSeasonStats {
  readonly clubId: string;
  readonly playerId: string;
  readonly namedMatchdaySheets: number;
  readonly startingAppearances: number;
  readonly substituteAppearances: number;
  readonly unusedBenchListings: number;
  readonly goals: number;
  readonly ownGoals: number;
  readonly penaltyGoals: number;
  readonly penaltiesTaken: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly openPlayXgMilli: number;
  readonly yellowCards: number;
  readonly secondYellowDismissals: number;
  readonly straightRedDismissals: number;
  readonly permanentMedicalWithdrawals: number;
  readonly registeredPhaseSeconds: number;
  readonly physicalPhaseSeconds: number;
  readonly temporarilyAbsentPhaseSeconds: number;
}
export interface M1V8SeasonStatsReport {
  readonly schemaVersion: typeof M1_V8_SEASON_STATS_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_REPLAY_AGGREGATE_NO_STANDINGS';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly completedFixtures: number;
  readonly teams: readonly M1V8TeamSeasonStats[];
  readonly players: readonly M1V8PlayerSeasonStats[];
}
export type M1V8SeasonStatsResult =
  | Readonly<{ ok: true; report: M1V8SeasonStatsReport }>
  | Readonly<{ ok: false; error: 'INVALID_JOURNAL' | 'INTERNAL_INVARIANT' }>;
type MutableTeam = { -readonly [K in keyof M1V8TeamSeasonStats]: M1V8TeamSeasonStats[K] };
type MutablePlayer = {
  -readonly [K in keyof M1V8PlayerSeasonStats]: M1V8PlayerSeasonStats[K]
};
const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;
function team(clubId: string): MutableTeam {
  return {
    clubId, completedFixtures: 0, goalsFor: 0, goalsAgainst: 0,
    openPlayGoals: 0, penaltyGoals: 0, ownGoalsFor: 0,
    penaltiesTaken: 0, shots: 0, shotsOnTarget: 0, openPlayXgMilli: 0,
    yellowCards: 0, dismissals: 0, permanentMedicalWithdrawals: 0,
    namedBenchSlots: 0, usedSubstituteAppearances: 0, unusedBenchSlots: 0,
    registeredPhasePersonSeconds: 0, physicalPhasePersonSeconds: 0,
    temporarilyAbsentPhasePersonSeconds: 0,
  };
}
function player(clubId: string, playerId: string): MutablePlayer {
  return {
    clubId, playerId, namedMatchdaySheets: 0, startingAppearances: 0,
    substituteAppearances: 0, unusedBenchListings: 0,
    goals: 0, ownGoals: 0, penaltyGoals: 0, penaltiesTaken: 0,
    shots: 0, shotsOnTarget: 0, openPlayXgMilli: 0,
    yellowCards: 0, secondYellowDismissals: 0, straightRedDismissals: 0,
    permanentMedicalWithdrawals: 0, registeredPhaseSeconds: 0,
    physicalPhaseSeconds: 0, temporarilyAbsentPhaseSeconds: 0,
  };
}
/**
 * Validates and fully replays the complete schema-4 v8 source journal
 * before using any stored numeric aggregate. Counts are synthetic phase
 * seconds, not real continuous playing time or fatigue.
 */
export function deriveM1VerifiedV8SeasonStats(
  initial: unknown, journal: unknown,
): M1V8SeasonStatsResult {
  const checked = validateM1V8MatchJournal(initial, journal);
  if (!checked.ok) return { ok: false, error: 'INVALID_JOURNAL' };
  const original = initial as InitialCareerSave;
  const clubs = new Map(original.catalog.clubs.map(club =>
    [club.id, new Set(club.registeredPlayerIds)]));
  const teams = new Map(original.catalog.clubs.map(club =>
    [club.id, team(club.id)]));
  const players = new Map<string, MutablePlayer>();
  function participant(clubId: string, playerId: string): MutablePlayer | null {
    if (!clubs.get(clubId)?.has(playerId)) return null;
    const key = clubId + '\u0000' + playerId;
    let row = players.get(key);
    if (!row) { row = player(clubId, playerId); players.set(key, row); }
    return row;
  }
  for (const fixture of checked.journal.results) {
    const dossier = fixture.dossier;
    const finish = dossier.match;
    for (const side of ['home', 'away'] as const) {
      const clubId = side === 'home' ? fixture.homeClubId : fixture.awayClubId;
      const own = teams.get(clubId);
      if (!own || dossier.teams[side].teamId !== clubId) return invariant;
      const opponents = side === 'home' ? finish.away : finish.home;
      const stats = finish[side];
      const matchday = dossier.teams[side];
      own.completedFixtures++;
      own.goalsFor += stats.goals;
      own.goalsAgainst += opponents.goals;
      own.openPlayGoals += stats.openPlayGoals;
      own.penaltyGoals += stats.penaltyGoals;
      own.ownGoalsFor += stats.ownGoalsFor;
      own.penaltiesTaken += stats.penaltiesTaken;
      own.shots += stats.shots;
      own.shotsOnTarget += stats.shotsOnTarget;
      own.openPlayXgMilli += stats.xgMilli;
      own.yellowCards += matchday.yellowCards;
      own.dismissals += matchday.dismissals;
      own.permanentMedicalWithdrawals += matchday.permanentMedicalWithdrawals;
      own.namedBenchSlots += matchday.benchNamed.length;
      own.unusedBenchSlots += matchday.unusedBench.length;
      own.usedSubstituteAppearances +=
        matchday.participants.filter(id => !matchday.starters.includes(id)).length;
      const played = new Map(dossier.players.filter(row =>
        row.teamId === clubId).map(row => [row.playerId, row]));
      if (played.size !== matchday.participants.length ||
          !matchday.participants.every(id => played.has(id))) return invariant;
      for (const id of matchday.namedPlayerIds) {
        const row = participant(clubId, id);
        if (!row) return invariant;
        row.namedMatchdaySheets++;
        if (matchday.unusedBench.includes(id)) row.unusedBenchListings++;
      }
      for (const matchRow of played.values()) {
        const row = participant(clubId, matchRow.playerId);
        if (!row || !matchday.namedPlayerIds.includes(matchRow.playerId)) {
          return invariant;
        }
        if (matchRow.started) row.startingAppearances++;
        else row.substituteAppearances++;
        row.goals += matchRow.goals;
        row.ownGoals += matchRow.ownGoals;
        row.penaltyGoals += matchRow.penaltyGoals;
        row.penaltiesTaken += matchRow.penaltiesTaken;
        row.shots += matchRow.shots;
        row.shotsOnTarget += matchRow.shotsOnTarget;
        row.openPlayXgMilli += matchRow.xgMilli;
        row.yellowCards += matchRow.yellowCards;
        row.secondYellowDismissals += Number(matchRow.dismissal === 'second-yellow');
        row.straightRedDismissals += Number(matchRow.dismissal === 'straight-red');
        row.permanentMedicalWithdrawals +=
          Number(matchRow.permanentlyMedicallyWithdrawn);
        row.registeredPhaseSeconds += matchRow.registeredPhaseSeconds;
        row.physicalPhaseSeconds += matchRow.physicalPhaseSeconds;
        row.temporarilyAbsentPhaseSeconds +=
          matchRow.temporarilyAbsentPhaseSeconds;
        own.registeredPhasePersonSeconds += matchRow.registeredPhaseSeconds;
        own.physicalPhasePersonSeconds += matchRow.physicalPhaseSeconds;
        own.temporarilyAbsentPhasePersonSeconds +=
          matchRow.temporarilyAbsentPhaseSeconds;
      }
      if (own.registeredPhasePersonSeconds !==
          own.physicalPhasePersonSeconds + own.temporarilyAbsentPhasePersonSeconds) {
        return invariant;
      }
    }
  }
  const teamRows = [...teams.values()].sort((a, b) => a.clubId.localeCompare(b.clubId));
  const playerRows = [...players.values()].sort((a, b) =>
    a.clubId.localeCompare(b.clubId) || a.playerId.localeCompare(b.playerId));
  const teamGoals = teamRows.reduce((sum, row) => sum + row.goalsFor, 0);
  const conceded = teamRows.reduce((sum, row) => sum + row.goalsAgainst, 0);
  const sum = (key: 'goals' | 'ownGoals' | 'shots' | 'shotsOnTarget' |
    'openPlayXgMilli' | 'yellowCards') =>
    playerRows.reduce((total, row) => total + row[key], 0);
  if (teamGoals !== conceded ||
      teamGoals !== sum('goals') + sum('ownGoals') ||
      teamRows.reduce((a, b) => a + b.shots, 0) !== sum('shots') ||
      teamRows.reduce((a, b) => a + b.shotsOnTarget, 0) !== sum('shotsOnTarget') ||
      teamRows.reduce((a, b) => a + b.openPlayXgMilli, 0) !==
        sum('openPlayXgMilli') ||
      teamRows.reduce((a, b) => a + b.yellowCards, 0) !== sum('yellowCards') ||
      teamRows.reduce((a, b) => a + b.completedFixtures, 0) !==
        checked.journal.results.length * 2) return invariant;
  return { ok: true, report: {
    schemaVersion: M1_V8_SEASON_STATS_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_REPLAY_AGGREGATE_NO_STANDINGS',
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    completedFixtures: checked.journal.results.length,
    teams: teamRows, players: playerRows,
  } };
}
