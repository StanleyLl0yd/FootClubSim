import { sameCanonicalValue } from './canonical-value.js';
import { admitM1ConfirmedSuspensions, type M1ConfirmedSuspension }
  from './m1-confirmed-suspensions.js';
import type { M1PrematchInput } from './m1-clock.js';
import { validateM1V8MatchJournal } from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';

/**
 * Read-only reconciliation of a complete EXTERNALLY authenticated sanction
 * snapshot with the new verified v8 matchday bench/history. No invented
 * automatic bans, KDK rulings, appeals or retroactive score rewriting.
 */
export const M1_V8_SANCTION_REVIEW_SCHEMA_VERSION = 1 as const;
export interface M1V8HistoricalSanctionConflict {
  readonly fixtureId: string;
  readonly playerId: string;
  readonly listing: 'starter' | 'used-substitute' | 'unused-substitute';
}
export interface M1V8SanctionReview {
  readonly schemaVersion: typeof M1_V8_SANCTION_REVIEW_SCHEMA_VERSION;
  readonly careerId: string;
  readonly journalRevision: number;
  readonly fixtureId: string;
  readonly examinedCompletedFixtures: number;
  readonly rulingCount: number;
  readonly blockedHomePlayers: readonly string[];
  readonly blockedAwayPlayers: readonly string[];
}
export type M1V8SanctionReviewError =
  'INVALID_JOURNAL' | 'INVALID_PREMATCH' | 'INVALID_RULINGS' |
  'ALREADY_COMMITTED_FIXTURE' | 'CURRENT_LINEUP_BLOCKED' |
  'HISTORICAL_MATCHDAY_SHEET_CONFLICT';
export type M1V8SanctionReviewResult =
  | Readonly<{ ok: true; review: M1V8SanctionReview }>
  | Readonly<{ ok: false; error: M1V8SanctionReviewError;
    affectedFixtureIds?: readonly string[];
    affectedPlayerIds?: readonly string[];
    historicalConflicts?: readonly M1V8HistoricalSanctionConflict[] }>;
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = (error: M1V8SanctionReviewError):
  M1V8SanctionReviewResult => ({ ok: false, error });
const compare = (a: M1V8HistoricalSanctionConflict,
  b: M1V8HistoricalSanctionConflict): number =>
  a.fixtureId.localeCompare(b.fixtureId) ||
  a.playerId.localeCompare(b.playerId) ||
  a.listing.localeCompare(b.listing);

/**
 * A missing player in the COMPLETE historical matchday XI+bench is
 * demonstrably unlisted (unlike the ambiguous old v7 appearance-only
 * record). Ruling authenticity, completeness and revocation are external.
 */
export function reconcileM1V8ConfirmedSanctions(
  initial: unknown, journal: unknown, prematch: unknown,
  confirmedRulings: unknown,
): M1V8SanctionReviewResult {
  const checked = validateM1V8MatchJournal(initial, journal);
  if (!checked.ok) return fail('INVALID_JOURNAL');
  if (!rec(initial) || !rec(prematch) ||
      !sameCanonicalValue((initial as unknown as InitialCareerSave).catalog,
        prematch.catalog)) return fail('INVALID_PREMATCH');
  const admitted = admitM1ConfirmedSuspensions(prematch, confirmedRulings);
  if (!admitted.ok && admitted.error !== 'SUSPENDED_PLAYER') {
    return fail(admitted.error === 'INVALID_PREMATCH' ||
      admitted.error === 'WRONG_FIXTURE' ?
      'INVALID_PREMATCH' : 'INVALID_RULINGS');
  }
  const input = prematch as unknown as M1PrematchInput;
  if (checked.journal.results.some(row => row.fixtureId === input.fixture.id)) {
    return fail('ALREADY_COMMITTED_FIXTURE');
  }
  // The admission validator has already checked complete order structure,
  // duplicate IDs, overlapping bans, registered players and fixture scope.
  const orders = confirmedRulings as readonly M1ConfirmedSuspension[];
  const historical: M1V8HistoricalSanctionConflict[] = [];
  const occupied = new Set<string>();
  for (const played of checked.journal.results) {
    for (const order of orders) {
      if (!order.affectedFixtureIds.includes(played.fixtureId)) continue;
      const side = played.homeClubId === order.clubId ? 'home' :
        played.awayClubId === order.clubId ? 'away' : null;
      if (!side) return fail('INVALID_RULINGS');
      const team = played.dossier.teams[side];
      if (!team.namedPlayerIds.includes(order.playerId)) continue;
      const key = played.fixtureId + '\u0000' + order.playerId;
      if (occupied.has(key)) return fail('INVALID_RULINGS');
      occupied.add(key);
      const listing = team.starters.includes(order.playerId) ? 'starter' :
        team.unusedBench.includes(order.playerId) ?
          'unused-substitute' : 'used-substitute';
      historical.push({ fixtureId: played.fixtureId,
        playerId: order.playerId, listing });
    }
  }
  if (historical.length) {
    historical.sort(compare);
    return { ok: false, error: 'HISTORICAL_MATCHDAY_SHEET_CONFLICT',
      affectedFixtureIds: [...new Set(historical.map(c => c.fixtureId))].sort(),
      affectedPlayerIds: [...new Set(historical.map(c => c.playerId))].sort(),
      historicalConflicts: historical };
  }
  if (!admitted.ok) {
    return { ok: false, error: 'CURRENT_LINEUP_BLOCKED',
      affectedFixtureIds: [input.fixture.id],
      affectedPlayerIds: admitted.playerIds ?? [] };
  }
  return { ok: true, review: {
    schemaVersion: M1_V8_SANCTION_REVIEW_SCHEMA_VERSION,
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    fixtureId: admitted.fixtureId,
    examinedCompletedFixtures: checked.journal.results.length,
    rulingCount: orders.length,
    blockedHomePlayers: admitted.blockedHomePlayers,
    blockedAwayPlayers: admitted.blockedAwayPlayers,
  } };
}
