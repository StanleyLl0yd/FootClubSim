import { generateDoubleRoundRobin } from './fixtures.js';
import { validateM1V8MatchJournal } from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';

/**
 * Read-only, synthetic fixture-coverage projection, sourced solely from
 * fully replay-verified v8 match history and the canonical M0 calendar.
 * This does NOT assign league points, adjudicate results or start M2.
 */
export const M1_V8_FIXTURE_COVERAGE_SCHEMA_VERSION = 1 as const;
export interface M1V8RoundCoverage {
  readonly round: number;
  readonly expectedFixtures: number;
  readonly completedFixtureIds: readonly string[];
  readonly pendingFixtureIds: readonly string[];
  readonly complete: boolean;
}
export interface M1V8ClubFixtureCoverage {
  readonly clubId: string;
  readonly completedHome: number;
  readonly completedAway: number;
  readonly pendingHome: number;
  readonly pendingAway: number;
}
export interface M1V8FixtureCoverageReport {
  readonly schemaVersion: typeof M1_V8_FIXTURE_COVERAGE_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_SOURCE_REPLAY_COVERAGE_NO_STANDINGS';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly expectedFixtures: number;
  readonly completedFixtures: number;
  readonly pendingFixtures: number;
  readonly completedRounds: number;
  readonly firstIncompleteRound: number | null;
  readonly seasonComplete: boolean;
  readonly rounds: readonly M1V8RoundCoverage[];
  readonly clubs: readonly M1V8ClubFixtureCoverage[];
}
export type M1V8FixtureCoverageResult =
  | Readonly<{ ok: true; report: M1V8FixtureCoverageReport }>
  | Readonly<{ ok: false; error: 'INVALID_JOURNAL' | 'INTERNAL_INVARIANT' }>;
type MutableClub = { -readonly [K in keyof M1V8ClubFixtureCoverage]:
  M1V8ClubFixtureCoverage[K] };
const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;

/**
 * Completion is based on schedule membership, not journal insertion order.
 * Every completed result has its entire source, RNG and dossier replayed by
 * validateM1V8MatchJournal before it contributes a single count.
 */
export function deriveM1VerifiedV8FixtureCoverage(
  initial: unknown, journal: unknown,
): M1V8FixtureCoverageResult {
  const verified = validateM1V8MatchJournal(initial, journal);
  if (!verified.ok) return { ok: false, error: 'INVALID_JOURNAL' };
  const original = initial as InitialCareerSave;
  const schedule = generateDoubleRoundRobin(
    original.catalog.clubs.map(club => club.id),
  );
  const completed = new Set(
    verified.journal.results.map(result => result.fixtureId),
  );
  if (completed.size !== verified.journal.results.length) return invariant;
  const clubs = new Map<string, MutableClub>(
    original.catalog.clubs.map(club => [club.id, {
      clubId: club.id, completedHome: 0, completedAway: 0,
      pendingHome: 0, pendingAway: 0,
    }]),
  );
  const rounds: M1V8RoundCoverage[] = [];
  let expectedFixtures = 0, completedFixtures = 0;
  for (const round of schedule) {
    const completedFixtureIds: string[] = [], pendingFixtureIds: string[] = [];
    for (const fixture of round.fixtures) {
      expectedFixtures++;
      const isCompleted = completed.has(fixture.id);
      if (isCompleted) {
        completedFixtures++;
        completedFixtureIds.push(fixture.id);
      } else {
        pendingFixtureIds.push(fixture.id);
      }
      const home = clubs.get(fixture.homeClubId);
      const away = clubs.get(fixture.awayClubId);
      if (!home || !away || home === away) return invariant;
      if (isCompleted) {
        home.completedHome++;
        away.completedAway++;
      } else {
        home.pendingHome++;
        away.pendingAway++;
      }
    }
    rounds.push({
      round: round.number,
      expectedFixtures: round.fixtures.length,
      completedFixtureIds, pendingFixtureIds,
      complete: pendingFixtureIds.length === 0,
    });
  }
  const clubRows = [...clubs.values()].sort((a, b) =>
    a.clubId.localeCompare(b.clubId));
  const homeFinished = clubRows.reduce((n, c) => n + c.completedHome, 0);
  const awayFinished = clubRows.reduce((n, c) => n + c.completedAway, 0);
  const homePending = clubRows.reduce((n, c) => n + c.pendingHome, 0);
  const awayPending = clubRows.reduce((n, c) => n + c.pendingAway, 0);
  if (completedFixtures !== completed.size ||
      completedFixtures !== verified.journal.revision ||
      homeFinished !== completedFixtures ||
      awayFinished !== completedFixtures ||
      homePending !== expectedFixtures - completedFixtures ||
      awayPending !== expectedFixtures - completedFixtures) return invariant;
  const completedRounds = rounds.filter(round => round.complete).length;
  const firstIncomplete = rounds.find(round => !round.complete);
  return { ok: true, report: {
    schemaVersion: M1_V8_FIXTURE_COVERAGE_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_SOURCE_REPLAY_COVERAGE_NO_STANDINGS',
    careerId: verified.journal.careerId,
    journalRevision: verified.journal.revision,
    expectedFixtures, completedFixtures,
    pendingFixtures: expectedFixtures - completedFixtures,
    completedRounds,
    firstIncompleteRound: firstIncomplete?.round ?? null,
    seasonComplete: completedFixtures === expectedFixtures,
    rounds, clubs: clubRows,
  } };
}
