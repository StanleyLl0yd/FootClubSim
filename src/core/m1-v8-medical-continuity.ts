import { validateM1V8MatchJournal } from './m1-v8-result-journal.js';

/**
 * Read-only review of medical withdrawal provenance across completed v8
 * fixtures. Being withdrawn during ONE match does not prove an injury
 * duration, a medical ban or the absence of a subsequent clearance.
 */
export const M1_V8_MEDICAL_CONTINUITY_SCHEMA_VERSION = 1 as const;
export interface M1V8PermanentWithdrawal {
  readonly fixtureId: string;
  readonly round: number;
  readonly clubId: string;
  readonly playerId: string;
}
export interface M1V8LaterMedicalListing {
  /** Most recent recorded earlier withdrawal, not a medical ban. */
  readonly precedingWithdrawalFixtureId: string;
  readonly precedingWithdrawalRound: number;
  readonly fixtureId: string;
  readonly round: number;
  readonly clubId: string;
  readonly playerId: string;
  readonly listing: 'starter' | 'used-substitute' | 'unused-substitute';
}
export interface M1V8MedicalContinuityReport {
  readonly schemaVersion: typeof M1_V8_MEDICAL_CONTINUITY_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_MEDICAL_HISTORY_REVIEW_NOT_ELIGIBILITY';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly examinedCompletedFixtures: number;
  readonly permanentWithdrawals: readonly M1V8PermanentWithdrawal[];
  readonly laterMatchdayListings: readonly M1V8LaterMedicalListing[];
}
export type M1V8MedicalContinuityResult =
  | Readonly<{ ok: true; report: M1V8MedicalContinuityReport }>
  | Readonly<{ ok: false; error: 'INVALID_JOURNAL' | 'INTERNAL_INVARIANT' }>;

const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;
const key = (clubId: string, playerId: string) => clubId + '\u0000' + playerId;
const chronological = (a: { round: number; fixtureId: string },
  b: { round: number; fixtureId: string }): number =>
  a.round - b.round || a.fixtureId.localeCompare(b.fixtureId);

/**
 * An existing v8 journal is source-replayed and validated first. Inspection
 * follows fixture round, NOT the order in which results were committed.
 * All entries remain observations; no auto-injury, ban, recovery date,
 * clearance token or next-match eligibility is invented.
 */
export function deriveM1VerifiedV8MedicalContinuity(
  initial: unknown, journal: unknown,
): M1V8MedicalContinuityResult {
  const checked = validateM1V8MatchJournal(initial, journal);
  if (!checked.ok) return { ok: false, error: 'INVALID_JOURNAL' };
  const latest = new Map<string, M1V8PermanentWithdrawal>();
  const permanentWithdrawals: M1V8PermanentWithdrawal[] = [];
  const laterMatchdayListings: M1V8LaterMedicalListing[] = [];
  const fixtures = [...checked.journal.results].sort(chronological);
  for (const fixture of fixtures) {
    const { dossier } = fixture;
    // An earlier finding in the SAME match must never become a new
    // inter-fixture listing. Both teams have at most one fixture per round.
    for (const side of ['home', 'away'] as const) {
      const clubId = side === 'home' ?
        fixture.homeClubId : fixture.awayClubId;
      const matchday = dossier.teams[side];
      if (matchday.teamId !== clubId) return invariant;
      const named = new Set(matchday.namedPlayerIds);
      if (named.size !== matchday.namedPlayerIds.length) return invariant;
      for (const playerId of named) {
        const prior = latest.get(key(clubId, playerId));
        if (!prior || prior.round >= fixture.round) continue;
        const listing = matchday.starters.includes(playerId) ? 'starter' :
          matchday.unusedBench.includes(playerId) ?
            'unused-substitute' : matchday.participants.includes(playerId) ?
              'used-substitute' : null;
        if (listing === null) return invariant;
        laterMatchdayListings.push({
          precedingWithdrawalFixtureId: prior.fixtureId,
          precedingWithdrawalRound: prior.round,
          fixtureId: fixture.fixtureId, round: fixture.round,
          clubId, playerId, listing,
        });
      }
    }
    for (const player of dossier.players) {
      if (!player.permanentlyMedicallyWithdrawn) continue;
      const clubId = player.teamId;
      const side = clubId === fixture.homeClubId ? 'home' :
        clubId === fixture.awayClubId ? 'away' : null;
      if (side === null ||
          !dossier.teams[side].namedPlayerIds.includes(player.playerId) ||
          !dossier.teams[side].participants.includes(player.playerId)) {
        return invariant;
      }
      const row: M1V8PermanentWithdrawal = {
        fixtureId: fixture.fixtureId, round: fixture.round,
        clubId, playerId: player.playerId,
      };
      permanentWithdrawals.push(row);
      latest.set(key(clubId, player.playerId), row);
    }
  }
  permanentWithdrawals.sort(chronological);
  laterMatchdayListings.sort(chronological);
  return { ok: true, report: {
    schemaVersion: M1_V8_MEDICAL_CONTINUITY_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_MEDICAL_HISTORY_REVIEW_NOT_ELIGIBILITY',
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    examinedCompletedFixtures: fixtures.length,
    permanentWithdrawals, laterMatchdayListings,
  } };
}
