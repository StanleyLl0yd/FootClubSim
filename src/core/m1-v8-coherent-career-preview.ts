import { deriveM1VerifiedV8FixtureCoverage,
  type M1V8FixtureCoverageReport } from './m1-v8-fixture-coverage.js';
import { applyM1V8MatchResultBatch,
  type M1V8JournalError, type M1V8MatchJournal }
  from './m1-v8-result-journal.js';
import { deriveM1VerifiedV8SeasonStats,
  type M1V8SeasonStatsReport } from './m1-v8-season-statistics.js';
import { deriveM1VerifiedV8UnrankedPoints,
  type M1V8UnrankedPointsPreview } from './m1-v8-unranked-points.js';

/**
 * One pure, all-or-nothing v8 domain proposal plus coherent read-only views.
 * Does not write the browser career, authenticate referee rulings, or award
 * official league points. Use a separate revision-CAS persistence operation.
 */
export const M1_V8_CAREER_PREVIEW_SCHEMA_VERSION = 1 as const;
export interface M1V8CoherentCareerPreview {
  readonly schemaVersion: typeof M1_V8_CAREER_PREVIEW_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_COHERENT_PREVIEW_NO_CAREER_POSTING';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly completedFixtures: number;
  readonly fixtureCoverage: M1V8FixtureCoverageReport;
  readonly seasonStatistics: M1V8SeasonStatsReport;
  readonly unrankedPoints: M1V8UnrankedPointsPreview;
}
export type M1V8CoherentCareerBatchResult =
  | Readonly<{ ok: true; journal: M1V8MatchJournal;
    preview: M1V8CoherentCareerPreview }>
  | Readonly<{ ok: false; error: M1V8JournalError | 'INTERNAL_INVARIANT' }>;
const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;

/**
 * Domain admission runs first. If any proposed match fails, no next journal
 * or partial preview is exposed. Independent projection replay is deliberate:
 * all three public selectors retain their own untrusted-input validation.
 *
 * This correctness-first M1 prototype replays long histories repeatedly;
 * full-season UI latency and authenticated career posting are NOT accepted.
 */
export function applyM1V8CoherentCareerPreviewBatch(
  initial: unknown, priorJournal: unknown, requests: unknown,
): M1V8CoherentCareerBatchResult {
  const applied = applyM1V8MatchResultBatch(initial, priorJournal, requests);
  if (!applied.ok) return applied;
  const journal = applied.journal;
  const coverage = deriveM1VerifiedV8FixtureCoverage(initial, journal);
  const season = deriveM1VerifiedV8SeasonStats(initial, journal);
  const points = deriveM1VerifiedV8UnrankedPoints(initial, journal);
  if (!coverage.ok || !season.ok || !points.ok) return invariant;
  const count = journal.results.length;
  const checks = [coverage.report, season.report, points.preview];
  if (checks.some(view => view.careerId !== journal.careerId ||
      view.journalRevision !== journal.revision ||
      view.completedFixtures !== count) ||
      coverage.report.pendingFixtures + count !==
        coverage.report.expectedFixtures ||
      season.report.teams.length !== points.preview.clubs.length ||
      points.preview.clubs.length !== coverage.report.clubs.length) {
    return invariant;
  }
  const stats = new Map(season.report.teams.map(row => [row.clubId, row]));
  const schedules = new Map(coverage.report.clubs.map(row => [row.clubId, row]));
  if (stats.size !== season.report.teams.length ||
      schedules.size !== coverage.report.clubs.length) return invariant;
  for (const club of points.preview.clubs) {
    const team = stats.get(club.clubId);
    const schedule = schedules.get(club.clubId);
    if (!team || !schedule ||
        club.played !== team.completedFixtures ||
        club.played !== schedule.completedHome + schedule.completedAway ||
        club.goalsFor !== team.goalsFor ||
        club.goalsAgainst !== team.goalsAgainst ||
        club.goalDifference !== team.goalsFor - team.goalsAgainst) return invariant;
    stats.delete(club.clubId);
    schedules.delete(club.clubId);
  }
  if (stats.size || schedules.size) return invariant;
  return { ok: true, journal, preview: {
    schemaVersion: M1_V8_CAREER_PREVIEW_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_COHERENT_PREVIEW_NO_CAREER_POSTING',
    careerId: journal.careerId,
    journalRevision: journal.revision,
    completedFixtures: count,
    fixtureCoverage: coverage.report,
    seasonStatistics: season.report,
    unrankedPoints: points.preview,
  } };
}
