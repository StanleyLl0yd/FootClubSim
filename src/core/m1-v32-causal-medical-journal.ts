import { sameCanonicalValue } from './canonical-value.js';
import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import { isStableId } from './identifiers.js';
import { startM1MatchResultJournal } from './m1-result-journal.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { deriveM1V31CausalPhysicalExposure, M1_V31_CAUSAL_EXPOSURE_RULES,
  type M1V31CausalExposureRun } from './m1-v24-physical-exposure.js';
import type { Catalog } from './model.js';
import type { InitialCareerSave } from './save.js';

/**
 * Experimental v32 schema-6 causal medical journal. Full source replay is required on EVERY
 * untrusted read. No sanction, fatigue, legal authority or league points
 * are inferred from deterministic modelled physical exposure.
 */
export const M1_V32_JOURNAL_SCHEMA = 6 as const;
export const M1_V32_APPLY_SCHEMA = 6 as const;
const MAX_FIXTURES = 240, MAX_BATCH = 16;
const MAX_ITEM_BYTES = 250_000, MAX_JOURNAL_BYTES = 16_000_000;
const JOURNAL_KEYS = ['schemaVersion', 'careerId', 'controlledClubId',
  'basePackId', 'basePackVersion', 'revision', 'results'];
const ITEM_KEYS = ['commandId', 'fixtureId', 'source', 'facts'];
const SOURCE_KEYS = ['prematch', 'policy', 'halfTimeCommands', 'inPlayCommands'];
const APPLY_KEYS = ['schemaVersion', 'commandId', 'careerId',
  'expectedRevision', 'prematch', 'policy', 'halfTimeCommands',
  'inPlayCommands', 'result'];

type Good = Extract<M1V31CausalExposureRun, { ok: true }>;
export interface M1V32Source {
  readonly prematch: Readonly<Record<string, unknown>>;
  readonly policy: unknown;
  readonly halfTimeCommands: readonly unknown[];
  readonly inPlayCommands: readonly unknown[];
}
export interface M1V32Facts {
  readonly rulesId: typeof M1_V31_CAUSAL_EXPOSURE_RULES;
  readonly score: Readonly<{home: number; away: number}>;
  readonly eventCount: number;
  readonly teamPhysicalPlayerSeconds: Good['physical']['teamPhysicalPlayerSeconds'];
  readonly playerRows: Good['physical']['playerRows'];
  readonly aggregatedEvents: Good['physical']['aggregatedEvents'];
  readonly refereeRngState: number;
  readonly refereeRngDraws: number;
  readonly treatmentRngState: number;
  readonly treatmentRngDraws: number;
  readonly causalAssessments: Good['source']['assessments'];
  readonly syntheticMedicalDecisionCount: number;
  readonly status: 'SYNTHETIC_CAUSAL_EXPOSURE_NOT_AUTHENTICATED_OR_CALIBRATED';
  readonly fatigueDeltasCalibrated: false;
  readonly medicalAuthorityAuthenticated: false;
  readonly sanctionsAuthenticated: false;
  readonly medicalNeedAuthenticated: false;
  readonly officialLeaguePointsAwarded: false;
}
export interface M1V32AppliedFixture {
  readonly commandId: string;
  readonly fixtureId: string;
  readonly source: M1V32Source;
  readonly facts: M1V32Facts;
}
export interface M1V32Journal {
  readonly schemaVersion: typeof M1_V32_JOURNAL_SCHEMA;
  readonly careerId: string;
  readonly controlledClubId: string;
  readonly basePackId: string;
  readonly basePackVersion: string;
  readonly revision: number;
  readonly results: readonly M1V32AppliedFixture[];
}
export type M1V32JournalError = 'INVALID_INITIAL_CAREER' |
  'INVALID_JOURNAL' | 'INVALID_BATCH' | 'INVALID_APPLY_COMMAND' |
  'WRONG_CAREER' | 'DUPLICATE_COMMAND' | 'DUPLICATE_FIXTURE' |
  'STALE_REVISION' | 'REVISION_LIMIT' | 'UNKNOWN_FIXTURE' |
  'UNTRUSTED_PACK' | 'INVALID_MATCH_RESULT' | 'CAS_REVISION_MISMATCH';
export type M1V32JournalResult =
  | Readonly<{ok: true; journal: M1V32Journal}>
  | Readonly<{ok: false; error: M1V32JournalError}>;
const fail = (error: M1V32JournalError): M1V32JournalResult =>
  ({ok: false, error});
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const int = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function copy<T>(v: unknown, limit: number): T | null {
  try {
    if (!isPlainJsonTree(v)) return null;
    const text = JSON.stringify(v);
    if (text.length > limit) return null;
    const parsed: unknown = JSON.parse(text);
    return sameCanonicalValue(v, parsed) ? parsed as T : null;
  } catch { return null; }
}
const initialCareer = (v: unknown): InitialCareerSave | null =>
  startM1MatchResultJournal(v).ok ? v as InitialCareerSave : null;
const fixturesFor = (catalog: Catalog): ReadonlyMap<string, Fixture> =>
  new Map(generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
    .flatMap(round => round.fixtures).map(f => [f.id, f]));
const deriveFacts = (v: Good): M1V32Facts => ({
  rulesId: M1_V31_CAUSAL_EXPOSURE_RULES,
  score: v.source.source.match.finalScore,
  eventCount: v.source.source.match.events.length,
  teamPhysicalPlayerSeconds: v.physical.teamPhysicalPlayerSeconds,
  playerRows: v.physical.playerRows,
  aggregatedEvents: v.physical.aggregatedEvents,
  refereeRngState: v.source.source.refereeRngState,
  refereeRngDraws: v.source.source.refereeRngDraws,
  treatmentRngState: v.source.source.treatmentRngState,
  treatmentRngDraws: v.source.source.treatmentRngDraws,
  causalAssessments: v.source.assessments,
  syntheticMedicalDecisionCount: v.source.assessments.length,
  status: 'SYNTHETIC_CAUSAL_EXPOSURE_NOT_AUTHENTICATED_OR_CALIBRATED',
  fatigueDeltasCalibrated: false, medicalAuthorityAuthenticated: false,
  sanctionsAuthenticated: false, medicalNeedAuthenticated: false,
  officialLeaguePointsAwarded: false,
});
function sourceFrom(raw: Record<string, unknown>): M1V32Source | null {
  if (!rec(raw.prematch) || !isPlainJsonTree(raw.prematch) ||
      !Array.isArray(raw.halfTimeCommands) ||
      !Array.isArray(raw.inPlayCommands) ||
      raw.halfTimeCommands.length > 10 || raw.inPlayCommands.length > 10) {
    return null;
  }
  const {catalog, ...prematch} = raw.prematch;
  if (!rec(catalog)) return null;
  return copy<M1V32Source>({
    prematch, policy: raw.policy,
    halfTimeCommands: raw.halfTimeCommands,
    inPlayCommands: raw.inPlayCommands,
  }, MAX_ITEM_BYTES);
}
function itemFrom(
  original: InitialCareerSave, fixture: Fixture, id: string,
  source: M1V32Source, claimedResult?: unknown,
): M1V32AppliedFixture | null {
  if (!rec(source.prematch) ||
      Object.hasOwn(source.prematch, 'catalog') ||
      !sameCanonicalValue(source.prematch.fixture, fixture)) return null;
  const run = deriveM1V31CausalPhysicalExposure(
    {...source.prematch, catalog: original.catalog}, source.policy,
    source.halfTimeCommands, source.inPlayCommands);
  if (!run.ok || (claimedResult !== undefined &&
      (!isPlainJsonTree(claimedResult) ||
      !sameCanonicalValue(run, claimedResult)))) return null;
  const item: M1V32AppliedFixture = {
    commandId: id, fixtureId: fixture.id, source,
    facts: deriveFacts(run),
  };
  return copy<M1V32AppliedFixture>(item, MAX_ITEM_BYTES);
}
function read(
  candidate: unknown, original: InitialCareerSave,
  fixtures: ReadonlyMap<string, Fixture>,
): M1V32Journal | null {
  const raw = copy<Record<string, unknown>>(candidate, MAX_JOURNAL_BYTES);
  if (!rec(raw) || !exact(raw, JOURNAL_KEYS) ||
      raw.schemaVersion !== M1_V32_JOURNAL_SCHEMA ||
      raw.careerId !== original.careerId ||
      raw.controlledClubId !== original.selectedClubId ||
      raw.basePackId !== original.basePackId ||
      raw.basePackVersion !== original.basePackVersion ||
      !int(raw.revision, 0, MAX_FIXTURES) ||
      !Array.isArray(raw.results) || raw.results.length !== raw.revision) {
    return null;
  }
  const commands = new Set<string>(), played = new Set<string>();
  const results: M1V32AppliedFixture[] = [];
  for (const row of raw.results) {
    if (!rec(row) || !exact(row, ITEM_KEYS) ||
        !isStableId(row.commandId) || !isStableId(row.fixtureId) ||
        commands.has(row.commandId) || played.has(row.fixtureId) ||
        !rec(row.source) || !exact(row.source, SOURCE_KEYS) ||
        !copy<M1V32Source>(row.source, MAX_ITEM_BYTES)) return null;
    const fixture = fixtures.get(row.fixtureId);
    if (!fixture || !sameCanonicalValue(row,
      itemFrom(original, fixture, row.commandId,
        row.source as unknown as M1V32Source))) return null;
    commands.add(row.commandId); played.add(row.fixtureId);
    results.push(row as unknown as M1V32AppliedFixture);
  }
  return {
    schemaVersion: M1_V32_JOURNAL_SCHEMA, careerId: original.careerId,
    controlledClubId: original.selectedClubId,
    basePackId: original.basePackId,
    basePackVersion: original.basePackVersion,
    revision: raw.revision, results,
  };
}
export function startM1V32ExposureJournal(initial: unknown): M1V32JournalResult {
  const original = initialCareer(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  return {ok: true, journal: {
    schemaVersion: M1_V32_JOURNAL_SCHEMA, careerId: original.careerId,
    controlledClubId: original.selectedClubId,
    basePackId: original.basePackId,
    basePackVersion: original.basePackVersion, revision: 0, results: [],
  }};
}
export function validateM1V32ExposureJournal(
  initial: unknown, candidate: unknown,
): M1V32JournalResult {
  const original = initialCareer(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const journal = read(candidate, original, fixturesFor(original.catalog));
  return journal ? {ok: true, journal} : fail('INVALID_JOURNAL');
}
function applyOne(
  original: InitialCareerSave, current: M1V32Journal,
  candidate: unknown, fixtures: ReadonlyMap<string, Fixture>,
): M1V32JournalResult {
  if (!rec(candidate) || !exact(candidate, APPLY_KEYS) ||
      candidate.schemaVersion !== M1_V32_APPLY_SCHEMA ||
      !isStableId(candidate.commandId) ||
      !isStableId(candidate.careerId) ||
      !int(candidate.expectedRevision, 0, MAX_FIXTURES) ||
      !rec(candidate.prematch) || !isPlainJsonTree(candidate.prematch) ||
      !isPlainJsonTree(candidate.result)) return fail('INVALID_APPLY_COMMAND');
  if (candidate.careerId !== current.careerId) return fail('WRONG_CAREER');
  if (current.results.some(r => r.commandId === candidate.commandId)) {
    return fail('DUPLICATE_COMMAND');
  }
  const claimedFixture = candidate.prematch.fixture;
  if (!rec(claimedFixture) || !isStableId(claimedFixture.id)) {
    return fail('INVALID_APPLY_COMMAND');
  }
  if (current.results.some(r => r.fixtureId === claimedFixture.id)) {
    return fail('DUPLICATE_FIXTURE');
  }
  if (candidate.expectedRevision !== current.revision) return fail('STALE_REVISION');
  if (current.revision >= MAX_FIXTURES) return fail('REVISION_LIMIT');
  const fixture = fixtures.get(claimedFixture.id);
  if (!fixture || !sameCanonicalValue(fixture, claimedFixture)) {
    return fail('UNKNOWN_FIXTURE');
  }
  if (!sameCanonicalValue(original.catalog, candidate.prematch.catalog)) {
    return fail('UNTRUSTED_PACK');
  }
  const source = sourceFrom(candidate);
  if (!source) return fail('INVALID_APPLY_COMMAND');
  const item = itemFrom(original, fixture, candidate.commandId,
    source, candidate.result);
  if (!item) return fail('INVALID_MATCH_RESULT');
  return {ok: true, journal: {...current,
    revision: current.revision + 1, results: [...current.results, item]}};
}
/** Atomic in-process batch only; durable multi-writer CAS is NOT implemented. */
export function applyM1V32ExposureBatch(
  initial: unknown, journalCandidate: unknown, requests: unknown,
  expectedRevision?: number,
): M1V32JournalResult {
  const original = initialCareer(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const fixtures = fixturesFor(original.catalog);
  const current = read(journalCandidate, original, fixtures);
  if (!current) return fail('INVALID_JOURNAL');
  if (expectedRevision !== undefined && current.revision !== expectedRevision) {
    return fail('CAS_REVISION_MISMATCH');
  }
  if (!Array.isArray(requests) || requests.length < 1 ||
      requests.length > MAX_BATCH) return fail('INVALID_BATCH');
  let next = current;
  for (const request of requests) {
    const applied = applyOne(original, next, request, fixtures);
    if (!applied.ok) return applied;
    next = applied.journal;
  }
  return {ok: true, journal: next};
}
