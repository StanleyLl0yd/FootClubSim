import { validateM1V6MatchJournal } from './m1-v6-result-journal.js';
import type { InitialCareerSave } from './save.js';

/**
 * Read-only synthetic v6 season aggregates. Not an officially ranked RPL
 * table; no adjudications, sanctions, head-to-head or player condition.
 */
export const M1_V6_TOTALS_SCHEMA_VERSION = 1 as const;
export interface M1V6TeamTotals {
  readonly clubId: string;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly points: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xgMilli: number;
  readonly yellowCards: number;
  readonly dismissals: number;
  readonly confirmedMedicalWithdrawals: number;
  readonly normalSubstitutions: number;
  readonly playedSeconds: number;
}
export interface M1V6UnrankedTotals {
  readonly schemaVersion: typeof M1_V6_TOTALS_SCHEMA_VERSION;
  readonly status: 'UNRANKED_SYNTHETIC_V6_NO_CAREER_SANCTIONS';
  readonly careerId: string;
  readonly revision: number;
  readonly completedFixtures: number;
  /** Original trusted pack order, never an RPL ranking. */
  readonly clubs: readonly M1V6TeamTotals[];
}
export type M1V6SeasonTotalsResult =
  | Readonly<{ ok: true; totals: M1V6UnrankedTotals }>
  | Readonly<{ ok: false; error:
    'INVALID_INITIAL_CAREER' | 'INVALID_JOURNAL' | 'INTERNAL_INVARIANT' }>;

function empty(clubId: string): M1V6TeamTotals {
  return {
    clubId, played: 0, won: 0, drawn: 0, lost: 0, points: 0,
    goalsFor: 0, goalsAgainst: 0, goalDifference: 0, shots: 0,
    shotsOnTarget: 0, xgMilli: 0, yellowCards: 0, dismissals: 0,
    confirmedMedicalWithdrawals: 0, normalSubstitutions: 0, playedSeconds: 0,
  };
}

/**
 * Only validated source summaries count. The additive v6 report never
 * reinterprets old v5 journals or creates actual suspension durations.
 */
export function deriveM1V6UnrankedSeasonTotals(
  initial: unknown, candidate: unknown,
): M1V6SeasonTotalsResult {
  const checked = validateM1V6MatchJournal(initial, candidate);
  if (!checked.ok) {
    return { ok: false, error: checked.error === 'INVALID_INITIAL_CAREER' ?
      'INVALID_INITIAL_CAREER' : 'INVALID_JOURNAL' };
  }
  const original = initial as InitialCareerSave;
  const clubs = original.catalog.clubs.map(c => ({ ...empty(c.id) }));
  const byId = new Map(clubs.map(c => [c.clubId, c]));
  let wins = 0, draws = 0, scorerGoals = 0, homeAwayGoals = 0;
  for (const item of checked.journal.results) {
    const home = byId.get(item.homeClubId);
    const away = byId.get(item.awayClubId);
    if (!home || !away || home === away) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
    home.played++;
    away.played++;
    home.goalsFor += item.report.home.goals;
    home.goalsAgainst += item.report.away.goals;
    away.goalsFor += item.report.away.goals;
    away.goalsAgainst += item.report.home.goals;
    if (item.report.home.goals === item.report.away.goals) {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
      draws++;
    } else if (item.report.home.goals > item.report.away.goals) {
      home.won++;
      away.lost++;
      home.points += 3;
      wins++;
    } else {
      away.won++;
      home.lost++;
      away.points += 3;
      wins++;
    }
    for (const [team, stat, discipline] of [
      [home, item.report.home, item.discipline.home],
      [away, item.report.away, item.discipline.away],
    ] as const) {
      team.shots += stat.shots;
      team.shotsOnTarget += stat.shotsOnTarget;
      team.xgMilli += stat.xgMilli;
      team.yellowCards += discipline.yellowCards;
      team.dismissals += discipline.dismissals;
      team.confirmedMedicalWithdrawals += discipline.medicalWithdrawals;
      team.normalSubstitutions += discipline.normalSubstitutions;
      team.playedSeconds += discipline.playedSeconds;
    }
    scorerGoals += item.goals.length;
    homeAwayGoals += item.report.home.goals + item.report.away.goals;
  }
  for (const club of clubs) {
    club.goalDifference = club.goalsFor - club.goalsAgainst;
    if (club.played !== club.won + club.drawn + club.lost ||
        club.goalsFor < 0 || club.goalsAgainst < 0 ||
        club.shotsOnTarget > club.shots || club.goalsFor > club.shotsOnTarget) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
  }
  const sum = (key: keyof M1V6TeamTotals) =>
    clubs.reduce((n, club) => n + (club[key] as number), 0);
  if (sum('played') !== checked.journal.results.length * 2 ||
      sum('goalsFor') !== sum('goalsAgainst') ||
      sum('goalsFor') !== scorerGoals || scorerGoals !== homeAwayGoals ||
      sum('points') !== wins * 3 + draws * 2 ||
      sum('normalSubstitutions') > checked.journal.results.length * 10 ||
      sum('playedSeconds') > checked.journal.results.length * 118800) {
    return { ok: false, error: 'INTERNAL_INVARIANT' };
  }
  return { ok: true, totals: {
    schemaVersion: M1_V6_TOTALS_SCHEMA_VERSION,
    status: 'UNRANKED_SYNTHETIC_V6_NO_CAREER_SANCTIONS',
    careerId: checked.journal.careerId,
    revision: checked.journal.revision,
    completedFixtures: checked.journal.results.length,
    clubs,
  } };
}
