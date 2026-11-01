import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import type { M1V8MatchJournal } from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';

export const M1_V115_ELIGIBILITY_SCHEMA = 115 as const;
export type M1V115ExclusionReason =
  'unresolved-medical-withdrawal' | 'unresolved-direct-red' |
  'second-yellow-one-fixture' | 'four-simple-cautions-one-fixture';

export type M1V115Exclusion = Readonly<{
  clubId: string;
  playerId: string;
  sourceFixtureId: string;
  reason: M1V115ExclusionReason;
}>;

export type M1V115Eligibility =
  | Readonly<{ ok: false; error:
    'MISSING_CONTROLLED_CLUB_HISTORY' | 'HISTORICAL_ELIGIBILITY_CONFLICT';
    affectedFixtureId?: string; affectedPlayerId?: string }>
  | Readonly<{ ok: true; schemaVersion: typeof M1_V115_ELIGIBILITY_SCHEMA;
    exclusions: readonly M1V115Exclusion[];
    allKnownMedicalAndDirectRedHoldsEnforced: true;
    selectedClubAutomaticBansVerified: true;
    opponentFullHistoryVerified: false;
    externalRecoveryOrKdkDecisionAuthenticated: false }>;

type Pending = Readonly<{
  sourceFixtureId: string;
  reason: Extract<M1V115ExclusionReason,
    'second-yellow-one-fixture' | 'four-simple-cautions-one-fixture'>;
}>;

/**
 * Internal projection from an *already replay-validated* v8 journal.
 * No clearance is manufactured: known medical withdrawal and straight red
 * remain excluded without a separately authenticated resolution. The
 * controlled club's complete fixture sequence permits ordinary one-game
 * second-yellow/four-caution sanctions to expire after the next club match.
 * Opponent fixture histories are incomplete in this controlled-club playtest.
 */
export function projectM1V115KnownEligibility(
  initial: InitialCareerSave, journal: M1V8MatchJournal,
  fixture: Fixture,
): M1V115Eligibility {
  const all = generateDoubleRoundRobin(initial.catalog.clubs.map(c => c.id))
    .flatMap(round => round.fixtures);
  const byId = new Map(journal.results.map(item => [item.fixtureId, item]));
  const selectedId = initial.selectedClubId;
  const selectedHistory = all.filter(item =>
    (item.homeClubId === selectedId || item.awayClubId === selectedId) &&
    item.round < fixture.round);
  for (const past of selectedHistory) {
    if (!byId.has(past.id)) return {
      ok: false, error: 'MISSING_CONTROLLED_CLUB_HISTORY',
      affectedFixtureId: past.id,
    };
  }
  const exclusions = new Map<string, M1V115Exclusion>();
  const pending = new Map<string, Pending>();
  const cautions = new Map<string, number>();
  const excludedKey = (clubId: string, playerId: string) =>
    JSON.stringify([clubId, playerId]);
  for (const past of selectedHistory) {
    const item = byId.get(past.id)!;
    const side = past.homeClubId === selectedId ? 'home' : 'away';
    const own = item.source.prematch[side + 'Lineup'] as
      { starters: readonly string[]; bench: readonly string[] };
    const named = new Set([...own.starters, ...own.bench]);
    for (const player of pending.keys()) {
      if (named.has(player)) return {
        ok: false, error: 'HISTORICAL_ELIGIBILITY_CONFLICT',
        affectedFixtureId: past.id, affectedPlayerId: player,
      };
    }
    for (const hold of exclusions.values()) {
      if (hold.clubId === selectedId && named.has(hold.playerId)) return {
        ok: false, error: 'HISTORICAL_ELIGIBILITY_CONFLICT',
        affectedFixtureId: past.id, affectedPlayerId: hold.playerId,
      };
    }
    // A one-match ban is served by a fully recorded fixture, even if the
    // player was not selected. Never clear unresolved medical/KDK holds.
    pending.clear();
    for (const row of item.dossier.players) {
      if (row.teamId !== selectedId) continue;
      if (row.permanentlyMedicallyWithdrawn) {
        exclusions.set(excludedKey(selectedId, row.playerId), {
          clubId: selectedId, playerId: row.playerId,
          sourceFixtureId: past.id, reason: 'unresolved-medical-withdrawal',
        });
      }
      if (row.dismissal === 'straight-red') {
        exclusions.set(excludedKey(selectedId, row.playerId), {
          clubId: selectedId, playerId: row.playerId,
          sourceFixtureId: past.id, reason: 'unresolved-direct-red',
        });
      }
      if (row.dismissal === 'second-yellow') {
        pending.set(row.playerId, {
          sourceFixtureId: past.id, reason: 'second-yellow-one-fixture',
        });
      } else if (row.dismissal === null && row.yellowCards === 1) {
        const count = (cautions.get(row.playerId) ?? 0) + 1;
        if (count === 4) {
          pending.set(row.playerId, {
            sourceFixtureId: past.id, reason: 'four-simple-cautions-one-fixture',
          });
          cautions.set(row.playerId, 0);
        } else {
          cautions.set(row.playerId, count);
        }
      }
    }
  }

  // Known adverse events involving an opponent are still excluded on the
  // next encounter, but we cannot infer that opponent's missing club matches
  // served a one-game ban, so never claim full opponent sanction coverage.
  const opponents = new Set([fixture.homeClubId, fixture.awayClubId]);
  opponents.delete(selectedId);
  for (const item of journal.results) {
    const past = all.find(entry => entry.id === item.fixtureId);
    if (!past || past.round >= fixture.round) continue;
    for (const row of item.dossier.players) {
      if (!opponents.has(row.teamId)) continue;
      if (row.permanentlyMedicallyWithdrawn ||
          row.dismissal === 'straight-red') {
        const key = excludedKey(row.teamId, row.playerId);
        exclusions.set(key, {
          clubId: row.teamId, playerId: row.playerId,
          sourceFixtureId: past.id,
          reason: row.permanentlyMedicallyWithdrawn ?
            'unresolved-medical-withdrawal' : 'unresolved-direct-red',
        });
      }
    }
  }
  for (const [playerId, ban] of pending) {
    exclusions.set(excludedKey(selectedId, playerId), {
      clubId: selectedId, playerId,
      sourceFixtureId: ban.sourceFixtureId, reason: ban.reason,
    });
  }
  return {
    ok: true, schemaVersion: M1_V115_ELIGIBILITY_SCHEMA,
    exclusions: [...exclusions.values()].sort((a, b) =>
      a.clubId.localeCompare(b.clubId) || a.playerId.localeCompare(b.playerId)),
    allKnownMedicalAndDirectRedHoldsEnforced: true,
    selectedClubAutomaticBansVerified: true,
    opponentFullHistoryVerified: false,
    externalRecoveryOrKdkDecisionAuthenticated: false,
  };
}
