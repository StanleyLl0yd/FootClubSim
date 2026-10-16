import { generateDoubleRoundRobin } from './fixtures.js';
import type { M1V8CreditedGoal } from './m1-v8-goal-attribution.js';
import { validateM1V8MatchJournal } from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';

/**
 * A round-specific matchday scorecard built only from fully replay-verified
 * schema-4 v8 career history and the canonical synthetic M0 schedule.
 * It neither posts standings points nor decides disputed fixtures.
 */
export const M1_V8_ROUND_RECAP_SCHEMA_VERSION = 1 as const;
export interface M1V8RoundRecapMatch {
  readonly fixtureId: string;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly status: 'pending' | 'completed';
  /** Pending fixtures have no score, not a fabricated 0-0. */
  readonly score: Readonly<{ home: number; away: number }> | null;
  readonly goalAttributions: readonly M1V8CreditedGoal[] | null;
  readonly yellowCards: Readonly<{ home: number; away: number }> | null;
  readonly dismissals: Readonly<{ home: number; away: number }> | null;
  readonly eventCount: number | null;
}
export interface M1V8RoundRecap {
  readonly schemaVersion: typeof M1_V8_ROUND_RECAP_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_SOURCE_REPLAY_ROUND_NO_STANDINGS';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly round: number;
  readonly expectedFixtures: number;
  readonly completedFixtures: number;
  readonly pendingFixtures: number;
  readonly complete: boolean;
  readonly matches: readonly M1V8RoundRecapMatch[];
}
export type M1V8RoundRecapResult =
  | Readonly<{ ok: true; recap: M1V8RoundRecap }>
  | Readonly<{ ok: false; error:
    'INVALID_ROUND' | 'INVALID_JOURNAL' | 'INTERNAL_INVARIANT' }>;
const fail = (error: 'INVALID_ROUND' | 'INVALID_JOURNAL' |
  'INTERNAL_INVARIANT'): M1V8RoundRecapResult => ({ ok: false, error });

/** Read-only source replay; fixture rows always follow the original calendar. */
export function deriveM1VerifiedV8RoundRecap(
  initial: unknown, journal: unknown, roundNumber: unknown,
): M1V8RoundRecapResult {
  if (!Number.isSafeInteger(roundNumber) || (roundNumber as number) < 1) {
    return fail('INVALID_ROUND');
  }
  const checked = validateM1V8MatchJournal(initial, journal);
  if (!checked.ok) return fail('INVALID_JOURNAL');
  const original = initial as InitialCareerSave;
  const schedule = generateDoubleRoundRobin(
    original.catalog.clubs.map(club => club.id));
  const chosen = schedule.find(round => round.number === roundNumber);
  if (!chosen) return fail('INVALID_ROUND');
  const results = new Map(checked.journal.results.map(row =>
    [row.fixtureId, row]));
  const matches: M1V8RoundRecapMatch[] = [];
  let completed = 0;
  for (const fixture of chosen.fixtures) {
    const row = results.get(fixture.id);
    if (!row) {
      matches.push({
        fixtureId: fixture.id, homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId, status: 'pending',
        score: null, goalAttributions: null, yellowCards: null,
        dismissals: null, eventCount: null,
      });
      continue;
    }
    if (row.round !== chosen.number ||
        row.homeClubId !== fixture.homeClubId ||
        row.awayClubId !== fixture.awayClubId ||
        row.dossier.fixtureId !== fixture.id) return fail('INTERNAL_INVARIANT');
    completed++;
    matches.push({
      fixtureId: fixture.id, homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId, status: 'completed',
      score: { home: row.dossier.match.home.goals,
        away: row.dossier.match.away.goals },
      goalAttributions: row.dossier.goalAttributions,
      yellowCards: { home: row.dossier.teams.home.yellowCards,
        away: row.dossier.teams.away.yellowCards },
      dismissals: { home: row.dossier.teams.home.dismissals,
        away: row.dossier.teams.away.dismissals },
      eventCount: row.eventCount,
    });
  }
  return { ok: true, recap: {
    schemaVersion: M1_V8_ROUND_RECAP_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_SOURCE_REPLAY_ROUND_NO_STANDINGS',
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    round: chosen.number,
    expectedFixtures: chosen.fixtures.length,
    completedFixtures: completed,
    pendingFixtures: chosen.fixtures.length - completed,
    complete: completed === chosen.fixtures.length,
    matches,
  } };
}
