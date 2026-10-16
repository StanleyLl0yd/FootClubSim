import { sameCanonicalValue } from './canonical-value.js';
import { admitM1ConfirmedSuspensions, type M1ConfirmedSuspension }
  from './m1-confirmed-suspensions.js';
import { validateM1V7MatchJournal }
  from './m1-v7-result-journal.js';
import type { M1PrematchInput } from './m1-clock.js';
import type { InitialCareerSave } from './save.js';

/**
 * Independent P3/P4 consistency check between independently confirmed
 * fixture-specific orders and immutable, previously committed v7 reports.
 * No automatic bans, appeal/revocation decisions or history rewriting.
 */
export const M1_V7_SANCTION_REVIEW_SCHEMA_VERSION = 1 as const;
export interface M1V7SanctionReview {
  readonly schemaVersion: typeof M1_V7_SANCTION_REVIEW_SCHEMA_VERSION;
  readonly careerId: string;
  readonly journalRevision: number;
  readonly fixtureId: string;
  readonly examinedCompletedFixtures: number;
  readonly rulingCount: number;
  readonly blockedHomePlayers: readonly string[];
  readonly blockedAwayPlayers: readonly string[];
}
export type M1V7SanctionReviewError = 'INVALID_JOURNAL' | 'INVALID_PREMATCH' |
  'INVALID_RULINGS' | 'CURRENT_LINEUP_BLOCKED' |
  'HISTORICAL_PARTICIPATION_CONFLICT' | 'HISTORICAL_MATCH_SHEET_REQUIRED';
export type M1V7SanctionReviewResult =
  | Readonly<{ ok: true; review: M1V7SanctionReview }>
  | Readonly<{ ok: false; error: M1V7SanctionReviewError;
    affectedFixtureIds?: readonly string[];
    affectedPlayerIds?: readonly string[] }>;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = (error: M1V7SanctionReviewError,
  fixtureIds: Iterable<string> = [], playerIds: Iterable<string> = []):
  M1V7SanctionReviewResult => {
  const fixtures = [...fixtureIds].sort(), players = [...playerIds].sort();
  return fixtures.length || players.length ? {
    ok: false, error,
    affectedFixtureIds: fixtures,
    affectedPlayerIds: players,
  } : { ok: false, error };
};

/**
 * Only a caller holding an authenticated, complete fixture-specific order
 * snapshot may use the returned admission as an actual match gate.
 * A player absent from a finalized v7 appearance report might STILL have
 * been listed on the bench, so historical ambiguity cannot be waived.
 */
export function reconcileM1V7ConfirmedSanctions(
  initial: unknown, journal: unknown, prematch: unknown,
  confirmedRulings: unknown,
): M1V7SanctionReviewResult {
  const checked = validateM1V7MatchJournal(initial, journal);
  if (!checked.ok) return fail('INVALID_JOURNAL');
  if (!record(initial) || !record(prematch) ||
      !sameCanonicalValue((initial as unknown as InitialCareerSave).catalog,
        prematch.catalog)) return fail('INVALID_PREMATCH');
  const admitted = admitM1ConfirmedSuspensions(prematch, confirmedRulings);
  if (!admitted.ok && admitted.error !== 'SUSPENDED_PLAYER') {
    return fail(admitted.error === 'INVALID_PREMATCH' ||
      admitted.error === 'WRONG_FIXTURE' ? 'INVALID_PREMATCH' : 'INVALID_RULINGS');
  }
  // Both normal admission and SUSPENDED_PLAYER have fully validated orders.
  const orders = confirmedRulings as readonly M1ConfirmedSuspension[];
  const participated = new Set<string>(), uncertain = new Set<string>();
  const conflictedPlayers = new Set<string>(), uncertainPlayers = new Set<string>();
  for (const finished of checked.journal.results) {
    for (const order of orders) {
      if (!order.affectedFixtureIds.includes(finished.fixtureId)) continue;
      const listed = finished.attribution.appearances.some(p =>
        p.playerId === order.playerId && p.teamId === order.clubId);
      if (listed) {
        participated.add(finished.fixtureId);
        conflictedPlayers.add(order.playerId);
      } else {
        // v7 summaries do not retain full unused substitute lists.
        // An absence from appearances does not prove an eligible bench.
        uncertain.add(finished.fixtureId);
        uncertainPlayers.add(order.playerId);
      }
    }
  }
  if (participated.size) {
    return fail('HISTORICAL_PARTICIPATION_CONFLICT',
      participated, conflictedPlayers);
  }
  if (uncertain.size) {
    return fail('HISTORICAL_MATCH_SHEET_REQUIRED', uncertain, uncertainPlayers);
  }
  if (!admitted.ok) {
    return { ok: false, error: 'CURRENT_LINEUP_BLOCKED',
      affectedFixtureIds: [(prematch as M1PrematchInput).fixture.id],
      affectedPlayerIds: admitted.playerIds ?? [] };
  }
  return { ok: true, review: {
    schemaVersion: M1_V7_SANCTION_REVIEW_SCHEMA_VERSION,
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    fixtureId: admitted.fixtureId,
    examinedCompletedFixtures: checked.journal.results.length,
    rulingCount: orders.length,
    blockedHomePlayers: admitted.blockedHomePlayers,
    blockedAwayPlayers: admitted.blockedAwayPlayers,
  } };
}
