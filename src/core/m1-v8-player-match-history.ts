import { isStableId } from './identifiers.js';
import type { M1V8DossierPlayer } from './m1-v8-match-dossier.js';
import { validateM1V8MatchJournal } from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';

/**
 * Source-replayed synthetic v8 player matchday history. Being unlisted or
 * medically withdrawn does not prove injury duration or eligibility status.
 */
export const M1_V8_PLAYER_MATCH_HISTORY_SCHEMA_VERSION = 1 as const;
export type M1V8PlayerListing =
  'starter' | 'used-substitute' | 'unused-substitute' | 'not-named';
export interface M1V8PlayerMatchEntry {
  readonly fixtureId: string;
  readonly round: number;
  readonly clubId: string;
  readonly opponentClubId: string;
  readonly venue: 'home' | 'away';
  readonly score: Readonly<{ home: number; away: number }>;
  readonly listing: M1V8PlayerListing;
  /** Null for an unused substitute or a player not named on that sheet. */
  readonly participation: M1V8DossierPlayer | null;
}
export interface M1V8PlayerMatchHistory {
  readonly schemaVersion: typeof M1_V8_PLAYER_MATCH_HISTORY_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_REPLAY_PLAYER_LOG_NOT_ELIGIBILITY';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly playerId: string;
  readonly clubId: string;
  readonly completedClubFixtures: number;
  readonly startingAppearances: number;
  readonly substituteAppearances: number;
  readonly unusedBenchListings: number;
  readonly notNamedSheets: number;
  readonly matches: readonly M1V8PlayerMatchEntry[];
}
export type M1V8PlayerMatchHistoryResult =
  | Readonly<{ ok: true; history: M1V8PlayerMatchHistory }>
  | Readonly<{ ok: false; error:
    'INVALID_JOURNAL' | 'UNKNOWN_PLAYER' | 'INTERNAL_INVARIANT' }>;
const fail = (error: 'INVALID_JOURNAL' | 'UNKNOWN_PLAYER' |
  'INTERNAL_INVARIANT'): M1V8PlayerMatchHistoryResult => ({ ok: false, error });

/**
 * Reads all completed matches of the player\'s registered M0 club in
 * chronological round order, independent of journal insertion order.
 * Does not infer unused-bench playing time or generate missing fixtures.
 */
export function deriveM1VerifiedV8PlayerMatchHistory(
  initial: unknown, journal: unknown, playerId: unknown,
): M1V8PlayerMatchHistoryResult {
  if (!isStableId(playerId)) return fail('UNKNOWN_PLAYER');
  const checked = validateM1V8MatchJournal(initial, journal);
  if (!checked.ok) return fail('INVALID_JOURNAL');
  const original = initial as InitialCareerSave;
  if (!original.catalog.players.some(player => player.id === playerId)) {
    return fail('UNKNOWN_PLAYER');
  }
  const clubs = original.catalog.clubs.filter(club =>
    club.registeredPlayerIds.includes(playerId));
  if (clubs.length !== 1) return fail('INTERNAL_INVARIANT');
  const clubId = clubs[0]!.id;
  const history: M1V8PlayerMatchEntry[] = [];
  const matches = [...checked.journal.results].filter(row =>
    row.homeClubId === clubId || row.awayClubId === clubId)
    .sort((a, b) => a.round - b.round ||
      a.fixtureId.localeCompare(b.fixtureId));
  let startingAppearances = 0, substituteAppearances = 0;
  let unusedBenchListings = 0, notNamedSheets = 0;
  for (const fixture of matches) {
    const venue = fixture.homeClubId === clubId ? 'home' : 'away';
    const side = fixture.dossier.teams[venue];
    if (side.teamId !== clubId) return fail('INTERNAL_INVARIANT');
    const named = side.namedPlayerIds.includes(playerId);
    const started = side.starters.includes(playerId);
    const unused = side.unusedBench.includes(playerId);
    const participation = fixture.dossier.players.find(row =>
      row.playerId === playerId && row.teamId === clubId) ?? null;
    let listing: M1V8PlayerListing;
    if (started) {
      if (!named || unused || !participation || !participation.started) {
        return fail('INTERNAL_INVARIANT');
      }
      listing = 'starter';
      startingAppearances++;
    } else if (unused) {
      if (!named || participation ||
          !side.benchNamed.includes(playerId)) return fail('INTERNAL_INVARIANT');
      listing = 'unused-substitute';
      unusedBenchListings++;
    } else if (participation !== null) {
      if (!named || participation.started ||
          !side.benchNamed.includes(playerId)) return fail('INTERNAL_INVARIANT');
      listing = 'used-substitute';
      substituteAppearances++;
    } else {
      if (named) return fail('INTERNAL_INVARIANT');
      listing = 'not-named';
      notNamedSheets++;
    }
    history.push({
      fixtureId: fixture.fixtureId, round: fixture.round, clubId,
      opponentClubId: venue === 'home' ?
        fixture.awayClubId : fixture.homeClubId,
      venue, score: {
        home: fixture.dossier.match.home.goals,
        away: fixture.dossier.match.away.goals,
      },
      listing, participation,
    });
  }
  if (startingAppearances + substituteAppearances +
      unusedBenchListings + notNamedSheets !== matches.length) {
    return fail('INTERNAL_INVARIANT');
  }
  return { ok: true, history: {
    schemaVersion: M1_V8_PLAYER_MATCH_HISTORY_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_REPLAY_PLAYER_LOG_NOT_ELIGIBILITY',
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    playerId, clubId, completedClubFixtures: matches.length,
    startingAppearances, substituteAppearances,
    unusedBenchListings, notNamedSheets,
    matches: history,
  } };
}
