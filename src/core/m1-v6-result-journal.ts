import { sameCanonicalValue } from './canonical-value.js';
import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import { isStableId } from './identifiers.js';
import { deriveM1VerifiedV6AppearanceReport, type M1V6GoalAttribution,
  type M1V6AppearanceReport } from './m1-v6-appearance-report.js';
import { M1_V6_ENGINE_VERSION, M1_V6_EVENT_SCHEMA_VERSION } from './m1-phases-v6.js';
import { startM1MatchResultJournal } from './m1-result-journal.js';
import type { MatchLedgerReport } from './match-contracts.js';
import type { Catalog } from './model.js';
import type { InitialCareerSave } from './save.js';

/** Separate v6 pure commit proposal: never reinterpret M0 or v5 journal bytes. */
export const M1_V6_JOURNAL_SCHEMA_VERSION = 2 as const;
export const M1_V6_APPLY_SCHEMA_VERSION = 2 as const;
const JOURNAL_KEYS = ['schemaVersion', 'careerId', 'controlledClubId', 'basePackId',
  'basePackVersion', 'revision', 'results'] as const;
const ITEM_KEYS = ['commandId', 'fixtureId', 'round', 'homeClubId', 'awayClubId',
  'engineVersion', 'eventSchemaVersion', 'rngSeed', 'rngState', 'eventCount',
  'report', 'discipline', 'goals'] as const;
const APPLY_KEYS = ['schemaVersion', 'commandId', 'careerId', 'expectedRevision',
  'prematch', 'policy', 'plannedCommands', 'result'] as const;
const SCORE_KEYS = ['goals', 'shots', 'shotsOnTarget', 'xgMilli'] as const;
const TEAM_KEYS = ['yellowCards', 'dismissals', 'medicalWithdrawals',
  'normalSubstitutions', 'playedSeconds'] as const;
const GOAL_KEYS = ['eventId', 'teamId', 'scorerId', 'elapsedSeconds', 'kind'] as const;

type TeamTotals = M1V6AppearanceReport['teams']['home'];
export interface M1V6AppliedFixture {
  readonly commandId: string;
  readonly fixtureId: string;
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly engineVersion: typeof M1_V6_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V6_EVENT_SCHEMA_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly eventCount: number;
  readonly report: MatchLedgerReport;
  readonly discipline: Readonly<{ home: TeamTotals; away: TeamTotals }>;
  readonly goals: readonly M1V6GoalAttribution[];
}
export interface M1V6MatchJournal {
  readonly schemaVersion: typeof M1_V6_JOURNAL_SCHEMA_VERSION;
  readonly careerId: string;
  readonly controlledClubId: string;
  readonly basePackId: string;
  readonly basePackVersion: string;
  readonly revision: number;
  readonly results: readonly M1V6AppliedFixture[];
}
export type M1V6JournalError = 'INVALID_INITIAL_CAREER' | 'INVALID_JOURNAL' |
  'INVALID_APPLY_COMMAND' | 'WRONG_CAREER' | 'STALE_REVISION' |
  'DUPLICATE_COMMAND' | 'DUPLICATE_FIXTURE' | 'UNKNOWN_FIXTURE' |
  'UNTRUSTED_PACK' | 'INVALID_MATCH_RESULT' | 'REVISION_LIMIT' | 'INVALID_BATCH';
export type M1V6JournalResult =
  | Readonly<{ ok: true; journal: M1V6MatchJournal }>
  | Readonly<{ ok: false; error: M1V6JournalError }>;
const fail = (error: M1V6JournalError): M1V6JournalResult => ({ ok: false, error });
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const int = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function fixtureMap(catalog: Catalog): ReadonlyMap<string, Fixture> {
  return new Map(generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
    .flatMap(r => r.fixtures).map(f => [f.id, f]));
}
function validScore(v: unknown): boolean {
  if (!rec(v) || !own(v, SCORE_KEYS) || !int(v.goals, 0, 18) ||
      !int(v.shots, 0, 18) || !int(v.shotsOnTarget, 0, 18) ||
      !int(v.xgMilli, 0, 18000)) return false;
  return v.goals <= v.shotsOnTarget && v.shotsOnTarget <= v.shots;
}
function validTeam(v: unknown): boolean {
  return rec(v) && own(v, TEAM_KEYS) && int(v.yellowCards, 0, 90) &&
    int(v.dismissals, 0, 11) && int(v.medicalWithdrawals, 0, 11) &&
    int(v.normalSubstitutions, 0, 5) && int(v.playedSeconds, 0, 59400) &&
    v.dismissals + v.medicalWithdrawals <= 11;
}
/** Validate stored summary structure; past-result provenance requires trusted CAS. */
function validItem(v: unknown, fixture: Fixture, catalog: Catalog): boolean {
  if (!rec(v) || !own(v, ITEM_KEYS) || !isStableId(v.commandId) ||
      v.fixtureId !== fixture.id || v.round !== fixture.round ||
      v.homeClubId !== fixture.homeClubId || v.awayClubId !== fixture.awayClubId ||
      v.engineVersion !== M1_V6_ENGINE_VERSION ||
      v.eventSchemaVersion !== M1_V6_EVENT_SCHEMA_VERSION ||
      !int(v.rngSeed, 1, 0xffffffff) || !int(v.rngState, 1, 0xffffffff) ||
      !int(v.eventCount, 1, 93) ||
      !rec(v.report) || !own(v.report, ['fixtureId', 'home', 'away']) ||
      v.report.fixtureId !== fixture.id || !validScore(v.report.home) ||
      !validScore(v.report.away) ||
      !rec(v.discipline) || !own(v.discipline, ['home', 'away']) ||
      !validTeam(v.discipline.home) || !validTeam(v.discipline.away) ||
      !Array.isArray(v.goals) || v.goals.length > 18) return false;
  const score = v.report as unknown as MatchLedgerReport;
  if (v.goals.length !== score.home.goals + score.away.goals) return false;
  const roster = new Map(catalog.clubs.map(c => [c.id, new Set(c.registeredPlayerIds)]));
  const used = new Set<string>();
  let homeGoals = 0, awayGoals = 0;
  for (const g of v.goals) {
    if (!rec(g) || !own(g, GOAL_KEYS) || !isStableId(g.scorerId) ||
        !isStableId(g.eventId) || g.kind !== 'synthetic-open-play-shot' ||
        !int(g.elapsedSeconds, 299, 5399) ||
        (g.elapsedSeconds + 1) % 300 !== 0 ||
        g.eventId !== 'm1-v6-shot-' + ((g.elapsedSeconds + 1) / 300) ||
        used.has(g.eventId) || !roster.get(g.teamId as string)?.has(g.scorerId)) return false;
    used.add(g.eventId);
    if (g.teamId === fixture.homeClubId) homeGoals++;
    else if (g.teamId === fixture.awayClubId) awayGoals++;
    else return false;
  }
  return homeGoals === score.home.goals && awayGoals === score.away.goals;
}
function trusted(initial: unknown): InitialCareerSave | null {
  const checked = startM1MatchResultJournal(initial);
  return checked.ok ? initial as InitialCareerSave : null;
}
function readJournal(raw: unknown, original: InitialCareerSave): M1V6MatchJournal | null {
  if (!rec(raw) || !own(raw, JOURNAL_KEYS) ||
      raw.schemaVersion !== M1_V6_JOURNAL_SCHEMA_VERSION ||
      raw.careerId !== original.careerId ||
      raw.controlledClubId !== original.selectedClubId ||
      raw.basePackId !== original.basePackId ||
      raw.basePackVersion !== original.basePackVersion ||
      !int(raw.revision, 0, 240) || !Array.isArray(raw.results) ||
      raw.results.length !== raw.revision) return null;
  const fixtures = fixtureMap(original.catalog);
  const ids = new Set<string>(), commands = new Set<string>();
  const results: M1V6AppliedFixture[] = [];
  for (const value of raw.results) {
    if (!rec(value) || !isStableId(value.fixtureId)) return null;
    const fixture = fixtures.get(value.fixtureId);
    if (!fixture || !validItem(value, fixture, original.catalog) ||
        ids.has(value.fixtureId) || commands.has(value.commandId as string)) return null;
    ids.add(value.fixtureId);
    commands.add(value.commandId as string);
    const item = value as unknown as M1V6AppliedFixture;
    results.push({
      ...item, report: { fixtureId: fixture.id,
        home: { ...item.report.home }, away: { ...item.report.away } },
      discipline: { home: { ...item.discipline.home }, away: { ...item.discipline.away } },
      goals: item.goals.map(g => ({ ...g })),
    });
  }
  return {
    schemaVersion: M1_V6_JOURNAL_SCHEMA_VERSION,
    careerId: original.careerId, controlledClubId: original.selectedClubId,
    basePackId: original.basePackId, basePackVersion: original.basePackVersion,
    revision: raw.revision as number, results,
  };
}
export function startM1V6MatchJournal(initial: unknown): M1V6JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  return { ok: true, journal: {
    schemaVersion: M1_V6_JOURNAL_SCHEMA_VERSION, careerId: original.careerId,
    controlledClubId: original.selectedClubId, basePackId: original.basePackId,
    basePackVersion: original.basePackVersion, revision: 0, results: [],
  } };
}
export function validateM1V6MatchJournal(
  initial: unknown, candidate: unknown,
): M1V6JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const journal = readJournal(candidate, original);
  return journal ? { ok: true, journal } : fail('INVALID_JOURNAL');
}
/** Only a proposal. Persist with an external atomic careerId+revision CAS. */
export function applyM1V6MatchResult(
  initial: unknown, journalCandidate: unknown, candidate: unknown,
): M1V6JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const current = readJournal(journalCandidate, original);
  if (!current) return fail('INVALID_JOURNAL');
  if (!rec(candidate) || !own(candidate, APPLY_KEYS) ||
      candidate.schemaVersion !== M1_V6_APPLY_SCHEMA_VERSION ||
      !isStableId(candidate.commandId) || !isStableId(candidate.careerId) ||
      !int(candidate.expectedRevision, 0, 240) || !rec(candidate.prematch) ||
      !Array.isArray(candidate.plannedCommands) ||
      candidate.plannedCommands.length > 212 || !rec(candidate.result)) {
    return fail('INVALID_APPLY_COMMAND');
  }
  if (candidate.careerId !== current.careerId) return fail('WRONG_CAREER');
  if (current.results.some(r => r.commandId === candidate.commandId)) {
    return fail('DUPLICATE_COMMAND');
  }
  const claimed = candidate.prematch.fixture;
  if (!rec(claimed) || !isStableId(claimed.id)) return fail('INVALID_APPLY_COMMAND');
  if (current.results.some(r => r.fixtureId === claimed.id)) return fail('DUPLICATE_FIXTURE');
  if (candidate.expectedRevision !== current.revision) return fail('STALE_REVISION');
  if (current.revision >= 240) return fail('REVISION_LIMIT');
  const fixture = fixtureMap(original.catalog).get(claimed.id);
  if (!fixture || !sameCanonicalValue(fixture, claimed)) return fail('UNKNOWN_FIXTURE');
  if (!sameCanonicalValue(original.catalog, candidate.prematch.catalog)) {
    return fail('UNTRUSTED_PACK');
  }
  const verified = deriveM1VerifiedV6AppearanceReport(
    candidate.prematch, candidate.policy, candidate.plannedCommands, candidate.result,
  );
  if (!verified.ok) return fail('INVALID_MATCH_RESULT');
  const report = verified.report;
  const item: M1V6AppliedFixture = {
    commandId: candidate.commandId, fixtureId: fixture.id, round: fixture.round,
    homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId,
    engineVersion: M1_V6_ENGINE_VERSION, eventSchemaVersion: M1_V6_EVENT_SCHEMA_VERSION,
    rngSeed: report.rngSeed, rngState: report.rngState,
    eventCount: (candidate.result.events as unknown[]).length,
    report: { fixtureId: fixture.id,
      home: { ...report.match.home }, away: { ...report.match.away } },
    discipline: { home: { ...report.teams.home }, away: { ...report.teams.away } },
    goals: report.goals.map(g => ({ ...g })),
  };
  if (!validItem(item, fixture, original.catalog)) return fail('INVALID_MATCH_RESULT');
  return { ok: true, journal: {
    ...current, revision: current.revision + 1, results: [...current.results, item],
  } };
}
/** All-or-nothing, bounded in-memory batch; no intermediate state exposed. */
export function applyM1V6MatchResultBatch(
  initial: unknown, journal: unknown, requests: unknown,
): M1V6JournalResult {
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > 16) {
    return fail('INVALID_BATCH');
  }
  let current: unknown = journal;
  for (const request of requests) {
    const updated = applyM1V6MatchResult(initial, current, request);
    if (!updated.ok) return updated;
    current = updated.journal;
  }
  return { ok: true, journal: current as M1V6MatchJournal };
}
