import { validateM1V8MatchJournal }
  from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';

/**
 * Read-only conventional 3/1/0 arithmetic on replay-verified v8 outcomes.
 * Never an official RPL ranking, match award or persisted career update.
 */
export const M1_V8_UNRANKED_POINTS_SCHEMA_VERSION = 1 as const;
export interface M1V8UnrankedClubPoints {
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
export interface M1V8UnrankedPointsPreview {
  readonly schemaVersion: typeof M1_V8_UNRANKED_POINTS_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_UNRANKED_POINTS_PREVIEW_NOT_OFFICIAL';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly completedFixtures: number;
  /** The catalog order is preserved; this is NOT a league placement order. */
  readonly clubs: readonly M1V8UnrankedClubPoints[];
}
export type M1V8UnrankedPointsResult =
  | Readonly<{ ok: true; preview: M1V8UnrankedPointsPreview }>
  | Readonly<{ ok: false; error: 'INVALID_JOURNAL' | 'INTERNAL_INVARIANT' }>;
type MutableClub = { -readonly [K in keyof M1V8UnrankedClubPoints]:
  M1V8UnrankedClubPoints[K] };
const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;
const empty = (clubId: string): MutableClub => ({
  clubId, played: 0, won: 0, drawn: 0, lost: 0,
  goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
});

/**
 * Replays the complete source journal before using a single goal total.
 * Three points for a win, one per draw, none for a loss. No RPL tie-break
 * logic, KDK decision, abandonment, points sanction or league ranking.
 */
export function deriveM1VerifiedV8UnrankedPoints(
  initial: unknown, journal: unknown,
): M1V8UnrankedPointsResult {
  const checked = validateM1V8MatchJournal(initial, journal);
  if (!checked.ok) return { ok: false, error: 'INVALID_JOURNAL' };
  const original = initial as InitialCareerSave;
  const clubs = original.catalog.clubs.map(club => empty(club.id));
  const byId = new Map(clubs.map(club => [club.clubId, club]));
  let winningFixtures = 0, drawnFixtures = 0;
  for (const fixture of checked.journal.results) {
    const home = byId.get(fixture.homeClubId);
    const away = byId.get(fixture.awayClubId);
    if (!home || !away || home === away) return invariant;
    const score = fixture.dossier.match;
    const homeGoals = score.home.goals, awayGoals = score.away.goals;
    home.played++;
    away.played++;
    home.goalsFor += homeGoals;
    away.goalsAgainst += homeGoals;
    away.goalsFor += awayGoals;
    home.goalsAgainst += awayGoals;
    if (homeGoals === awayGoals) {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
      drawnFixtures++;
    } else if (homeGoals > awayGoals) {
      home.won++;
      away.lost++;
      home.points += 3;
      winningFixtures++;
    } else {
      away.won++;
      home.lost++;
      away.points += 3;
      winningFixtures++;
    }
  }
  let appearances = 0, goalsFor = 0, goalsAgainst = 0, points = 0;
  for (const club of clubs) {
    club.goalDifference = club.goalsFor - club.goalsAgainst;
    if (club.played !== club.won + club.drawn + club.lost ||
        club.points !== 3 * club.won + club.drawn) return invariant;
    appearances += club.played;
    goalsFor += club.goalsFor;
    goalsAgainst += club.goalsAgainst;
    points += club.points;
  }
  if (appearances !== checked.journal.results.length * 2 ||
      goalsFor !== goalsAgainst ||
      points !== winningFixtures * 3 + drawnFixtures * 2 ||
      winningFixtures + drawnFixtures !== checked.journal.results.length) {
    return invariant;
  }
  return { ok: true, preview: {
    schemaVersion: M1_V8_UNRANKED_POINTS_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_UNRANKED_POINTS_PREVIEW_NOT_OFFICIAL',
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    completedFixtures: checked.journal.results.length,
    clubs,
  } };
}
