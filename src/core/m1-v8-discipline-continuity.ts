import { validateM1V8MatchJournal } from './m1-v8-result-journal.js';

/**
 * Read-only dismissal history review. A sent-off player cannot continue
 * their current match, but a dismissal alone does not authenticate a future
 * competition ban, appeal decision, disciplinary case or eligibility.
 */
export const M1_V8_DISCIPLINE_CONTINUITY_SCHEMA_VERSION = 1 as const;
export type M1V8DismissalKind = 'second-yellow' | 'straight-red';
export type M1V8LaterListingKind =
  'starter' | 'used-substitute' | 'unused-substitute';
export interface M1V8RecordedDismissal {
  readonly fixtureId: string;
  readonly round: number;
  readonly clubId: string;
  readonly playerId: string;
  readonly kind: M1V8DismissalKind;
  readonly cautionsInMatch: number;
}
export interface M1V8LaterDismissalListing {
  readonly precedingDismissalFixtureId: string;
  readonly precedingDismissalRound: number;
  readonly precedingDismissalKind: M1V8DismissalKind;
  readonly fixtureId: string;
  readonly round: number;
  readonly clubId: string;
  readonly playerId: string;
  readonly listing: M1V8LaterListingKind;
}
export interface M1V8DisciplineContinuityReport {
  readonly schemaVersion: typeof M1_V8_DISCIPLINE_CONTINUITY_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_DISMISSAL_REVIEW_NOT_SUSPENSION';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly examinedCompletedFixtures: number;
  readonly dismissals: readonly M1V8RecordedDismissal[];
  readonly laterMatchdayListings: readonly M1V8LaterDismissalListing[];
}
export type M1V8DisciplineContinuityResult =
  | Readonly<{ ok: true; report: M1V8DisciplineContinuityReport }>
  | Readonly<{ ok: false; error: 'INVALID_JOURNAL' | 'INTERNAL_INVARIANT' }>;

const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;
const chron = (a: { round: number; fixtureId: string; playerId?: string },
  b: { round: number; fixtureId: string; playerId?: string }): number =>
  a.round - b.round || a.fixtureId.localeCompare(b.fixtureId) ||
  (a.playerId ?? '').localeCompare(b.playerId ?? '');
const identity = (clubId: string, playerId: string): string =>
  clubId + '\u0000' + playerId;

/**
 * Every journal item is source-replayed before any disciplinary observation
 * is considered. Fixtures are sorted by the canonical synthetic round, not
 * the order in which the career journal was committed.
 *
 * No ban period, accumulation threshold, official KDK ruling, clearance,
 * points deduction or ineligibility is inferred from these observations.
 */
export function deriveM1VerifiedV8DisciplineContinuity(
  initial: unknown, journal: unknown,
): M1V8DisciplineContinuityResult {
  const checked = validateM1V8MatchJournal(initial, journal);
  if (!checked.ok) return { ok: false, error: 'INVALID_JOURNAL' };
  const history = [...checked.journal.results].sort(chron);
  const lastDismissal = new Map<string, M1V8RecordedDismissal>();
  const dismissals: M1V8RecordedDismissal[] = [];
  const laterMatchdayListings: M1V8LaterDismissalListing[] = [];
  for (const fixture of history) {
    // Review the match sheet BEFORE recording this match's dismissals.
    // No incident in a match can trigger a "later match" warning there.
    for (const side of ['home', 'away'] as const) {
      const clubId = side === 'home' ?
        fixture.homeClubId : fixture.awayClubId;
      const team = fixture.dossier.teams[side];
      if (team.teamId !== clubId) return invariant;
      const named = new Set(team.namedPlayerIds);
      if (named.size !== team.namedPlayerIds.length) return invariant;
      for (const playerId of named) {
        const earlier = lastDismissal.get(identity(clubId, playerId));
        if (!earlier || earlier.round >= fixture.round) continue;
        const listing: M1V8LaterListingKind | null =
          team.starters.includes(playerId) ? 'starter' :
          team.unusedBench.includes(playerId) ? 'unused-substitute' :
          team.participants.includes(playerId) ? 'used-substitute' : null;
        if (listing === null) return invariant;
        laterMatchdayListings.push({
          precedingDismissalFixtureId: earlier.fixtureId,
          precedingDismissalRound: earlier.round,
          precedingDismissalKind: earlier.kind,
          fixtureId: fixture.fixtureId, round: fixture.round,
          clubId, playerId, listing,
        });
      }
    }
    for (const player of fixture.dossier.players) {
      if (player.dismissal === null) continue;
      const side = player.teamId === fixture.homeClubId ? 'home' :
        player.teamId === fixture.awayClubId ? 'away' : null;
      if (side === null) return invariant;
      const team = fixture.dossier.teams[side];
      if (!team.namedPlayerIds.includes(player.playerId) ||
          !team.participants.includes(player.playerId) ||
          (player.dismissal === 'second-yellow' && player.yellowCards < 2)) {
        return invariant;
      }
      const item: M1V8RecordedDismissal = {
        fixtureId: fixture.fixtureId, round: fixture.round,
        clubId: player.teamId, playerId: player.playerId,
        kind: player.dismissal, cautionsInMatch: player.yellowCards,
      };
      dismissals.push(item);
      lastDismissal.set(identity(player.teamId, player.playerId), item);
    }
  }
  dismissals.sort(chron);
  laterMatchdayListings.sort(chron);
  return { ok: true, report: {
    schemaVersion: M1_V8_DISCIPLINE_CONTINUITY_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_DISMISSAL_REVIEW_NOT_SUSPENSION',
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    examinedCompletedFixtures: history.length,
    dismissals, laterMatchdayListings,
  } };
}
