import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import type { M1V8MatchJournal } from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';
import { deriveM1V118InternalRecovery, M1_V118_MODELLED_RECOVERY_SCHEMA,
  type M1V118ModelledRecovery } from './m1-v118-modelled-recovery.js';

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

export type M1V118Eligibility =
  | Extract<M1V115Eligibility, { ok: false }>
  | Readonly<{ ok: true; schemaVersion: typeof M1_V118_MODELLED_RECOVERY_SCHEMA;
      exclusions: readonly M1V115Exclusion[];
      modelledRecoveries: readonly M1V118ModelledRecovery[];
      allKnownNonModelledMedicalAndDirectRedHoldsEnforced: true;
      selectedClubAutomaticBansVerified: true;
      opponentFullHistoryVerified: false;
      fictionalRecoveryNotClinicalClearance: true;
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
function deriveKnownEligibility(
  initial: InitialCareerSave, journal: M1V8MatchJournal,
  fixture: Fixture, internalRecovery: boolean,
): M1V115Eligibility | M1V118Eligibility {
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
  const recoveryDue = new Map<string, Readonly<{
    releaseAtIndex: number; recovery: M1V118ModelledRecovery;
  }>>();
  const modelledRecoveries: M1V118ModelledRecovery[] = [];
  const excludedKey = (clubId: string, playerId: string) =>
    JSON.stringify([clubId, playerId]);
  const releaseModelled = (index: number): void => {
    for (const [playerId, due] of recoveryDue) {
      if (index < due.releaseAtIndex) continue;
      const key = excludedKey(selectedId, playerId);
      const hold = exclusions.get(key);
      if (hold?.reason === 'unresolved-medical-withdrawal' &&
          hold.sourceFixtureId === due.recovery.sourceFixtureId) {
        exclusions.delete(key);
        modelledRecoveries.push(due.recovery);
      }
      recoveryDue.delete(playerId);
    }
  };
  for (let index = 0; index < selectedHistory.length; index++) {
    const past = selectedHistory[index]!;
    releaseModelled(index);
    const item = byId.get(past.id)!;
    const internal = internalRecovery ?
      deriveM1V118InternalRecovery(initial, item).filter(entry =>
        entry.clubId === selectedId) : [];
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
        const generated = internal.find(entry => entry.playerId === row.playerId);
        if (generated) recoveryDue.set(row.playerId, {
          releaseAtIndex: index + 1 + generated.missedCompleteClubFixtures,
          recovery: generated,
        });
        else recoveryDue.delete(row.playerId);
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

  releaseModelled(selectedHistory.length);

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
  const validRecoveries = modelledRecoveries.filter(entry =>
    !exclusions.has(excludedKey(entry.clubId, entry.playerId)));
  const common = {
    ok: true as const,
    exclusions: [...exclusions.values()].sort((a, b) =>
      a.clubId.localeCompare(b.clubId) || a.playerId.localeCompare(b.playerId)),
    selectedClubAutomaticBansVerified: true as const,
    opponentFullHistoryVerified: false as const,
    externalRecoveryOrKdkDecisionAuthenticated: false as const,
  };
  return internalRecovery ? {
    ...common, schemaVersion: M1_V118_MODELLED_RECOVERY_SCHEMA,
    modelledRecoveries: validRecoveries,
    allKnownNonModelledMedicalAndDirectRedHoldsEnforced: true,
    fictionalRecoveryNotClinicalClearance: true,
  } : {
    ...common, schemaVersion: M1_V115_ELIGIBILITY_SCHEMA,
    allKnownMedicalAndDirectRedHoldsEnforced: true,
  };
}
export function projectM1V115KnownEligibility(
  initial: InitialCareerSave, journal: M1V8MatchJournal, fixture: Fixture,
): M1V115Eligibility {
  return deriveKnownEligibility(initial, journal, fixture, false) as
    M1V115Eligibility;
}
export function projectM1V118FictionalRecoveryEligibility(
  initial: InitialCareerSave, journal: M1V8MatchJournal, fixture: Fixture,
): M1V118Eligibility {
  return deriveKnownEligibility(initial, journal, fixture, true) as
    M1V118Eligibility;
}
