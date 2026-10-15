import type { InitialCareerSave } from './save.js';
import { validateM1MatchResultJournal } from './m1-result-journal.js';

/**
 * Read-only unranked aggregate. No real RPL points tie-break precedence and
 * no claim that this is an official 2026/27 competition table.
 */
export const M1_SYNTHETIC_STANDINGS_SCHEMA_VERSION = 1 as const;
export interface M1SyntheticClubTotals {
  readonly clubId: string;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
}
export interface M1SyntheticUnrankedTotals {
  readonly schemaVersion: typeof M1_SYNTHETIC_STANDINGS_SCHEMA_VERSION;
  readonly status: 'UNRANKED_SYNTHETIC_NOT_OFFICIAL_RPL';
  readonly careerId: string;
  readonly revision: number;
  readonly completedFixtures: number;
  /** Original source club order, not an official championship ranking. */
  readonly clubs: readonly M1SyntheticClubTotals[];
}
export type M1UnrankedTotalsResult =
  | Readonly<{ ok: true; totals: M1SyntheticUnrankedTotals }>
  | Readonly<{ ok: false; error:
    'INVALID_INITIAL_CAREER' | 'INVALID_JOURNAL' | 'INTERNAL_INVARIANT' }>;
type MutableTotals = {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};
function empty(id: string): MutableTotals {
  return {
    clubId: id, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
  };
}

/**
 * Each validated fixture is applied exactly twice to team aggregates.
 * This is a conventional synthetic 3/1/0 points experiment, without rank,
 * away-goals or any league-specific tie-breakers.
 */
export function deriveM1SyntheticUnrankedTotals(
  initialCareer: unknown, candidateJournal: unknown,
): M1UnrankedTotalsResult {
  const journal = validateM1MatchResultJournal(initialCareer, candidateJournal);
  if (!journal.ok) {
    return { ok: false, error: journal.error === 'INVALID_INITIAL_CAREER' ?
      'INVALID_INITIAL_CAREER' : 'INVALID_JOURNAL' };
  }
  const initial = initialCareer as InitialCareerSave;
  const totals = initial.catalog.clubs.map(club => empty(club.id));
  const byId = new Map(totals.map(team => [team.clubId, team]));
  let wins = 0, draws = 0;
  for (const result of journal.journal.results) {
    const home = byId.get(result.homeClubId);
    const away = byId.get(result.awayClubId);
    if (!home || !away) return { ok: false, error: 'INTERNAL_INVARIANT' };
    const homeGoals = result.report.home.goals, awayGoals = result.report.away.goals;
    home.played++;
    away.played++;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;
    if (homeGoals === awayGoals) {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
      draws++;
    } else if (homeGoals > awayGoals) {
      home.won++;
      away.lost++;
      home.points += 3;
      wins++;
    } else {
      home.lost++;
      away.won++;
      away.points += 3;
      wins++;
    }
  }
  const goalSum = totals.reduce((sum, club) => sum + club.goalsFor, 0);
  const conceded = totals.reduce((sum, club) => sum + club.goalsAgainst, 0);
  const gameSum = totals.reduce((sum, club) => sum + club.played, 0);
  const pointSum = totals.reduce((sum, club) => sum + club.points, 0);
  for (const club of totals) {
    club.goalDifference = club.goalsFor - club.goalsAgainst;
    if (club.played !== club.won + club.drawn + club.lost) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
  }
  if (gameSum !== journal.journal.results.length * 2 ||
      goalSum !== conceded ||
      pointSum !== wins * 3 + draws * 2) {
    return { ok: false, error: 'INTERNAL_INVARIANT' };
  }
  return { ok: true, totals: {
    schemaVersion: M1_SYNTHETIC_STANDINGS_SCHEMA_VERSION,
    status: 'UNRANKED_SYNTHETIC_NOT_OFFICIAL_RPL',
    careerId: journal.journal.careerId,
    revision: journal.journal.revision,
    completedFixtures: journal.journal.results.length,
    clubs: totals.map(team => ({ ...team })),
  } };
}
