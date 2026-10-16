import { sameCanonicalValue } from './canonical-value.js';
import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import { isStableId } from './identifiers.js';
import { startM1MatchResultJournal } from './m1-result-journal.js';
import { M1_V8_ENGINE_VERSION, M1_V8_EVENT_SCHEMA_VERSION,
  simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { deriveM1VerifiedV8MatchDossier, type M1V8MatchDossier }
  from './m1-v8-match-dossier.js';
import type { Catalog } from './model.js';
import type { InitialCareerSave } from './save.js';

/**
 * Source-replayable, isolated schema-4 v8 career journal proposal.
 * Unlike a trusted referee record, JSON inputs have no authenticated origin.
 * This pure contract is not durable IndexedDB CAS or league acceptance.
 */
export const M1_V8_JOURNAL_SCHEMA_VERSION = 4 as const;
export const M1_V8_APPLY_SCHEMA_VERSION = 4 as const;
const MAX_FIXTURES = 240;
const MAX_BATCH = 16;
const MAX_ITEM_BYTES = 160_000;
const MAX_JOURNAL_BYTES = 16_000_000;
const JOURNAL_KEYS = ['schemaVersion', 'careerId', 'controlledClubId',
  'basePackId', 'basePackVersion', 'revision', 'results'] as const;
const ITEM_KEYS = ['commandId', 'fixtureId', 'round', 'homeClubId',
  'awayClubId', 'engineVersion', 'eventSchemaVersion', 'rngSeed', 'rngState',
  'rngDraws', 'eventCount', 'source', 'dossier'] as const;
const SOURCE_KEYS = ['prematch', 'policy', 'plannedCommands',
  'trustedDecisions', 'medicalActions'] as const;
const APPLY_KEYS = ['schemaVersion', 'commandId', 'careerId',
  'expectedRevision', 'prematch', 'policy', 'plannedCommands',
  'trustedDecisions', 'medicalActions', 'result'] as const;

export interface M1V8JournalSource {
  /** Excludes the immutable career catalog, reconstructed on every replay. */
  readonly prematch: Readonly<Record<string, unknown>>;
  readonly policy: unknown;
  readonly plannedCommands: readonly unknown[];
  readonly trustedDecisions: readonly unknown[];
  readonly medicalActions: readonly unknown[];
}
export interface M1V8AppliedFixture {
  readonly commandId: string;
  readonly fixtureId: string;
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly eventCount: number;
  /** Replay evidence retained with a complete named matchday bench. */
  readonly source: M1V8JournalSource;
  readonly dossier: M1V8MatchDossier;
}
export interface M1V8MatchJournal {
  readonly schemaVersion: typeof M1_V8_JOURNAL_SCHEMA_VERSION;
  readonly careerId: string;
  readonly controlledClubId: string;
  readonly basePackId: string;
  readonly basePackVersion: string;
  readonly revision: number;
  readonly results: readonly M1V8AppliedFixture[];
}
export type M1V8JournalError =
  'INVALID_INITIAL_CAREER' | 'INVALID_JOURNAL' | 'INVALID_APPLY_COMMAND' |
  'WRONG_CAREER' | 'STALE_REVISION' | 'DUPLICATE_COMMAND' |
  'DUPLICATE_FIXTURE' | 'UNKNOWN_FIXTURE' | 'UNTRUSTED_PACK' |
  'INVALID_MATCH_RESULT' | 'REVISION_LIMIT' | 'INVALID_BATCH';
export type M1V8JournalResult =
  | Readonly<{ ok: true; journal: M1V8MatchJournal }>
  | Readonly<{ ok: false; error: M1V8JournalError }>;
const fail = (error: M1V8JournalError): M1V8JournalResult => ({ ok: false, error });
const rec = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const int = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;

/** Reject cycles, holes, undefined, nonfinite values, accessors and aliases. */
function strictJsonCopy<T>(value: unknown, limit: number): T | null {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string' || json.length > limit) return null;
    const copy: unknown = JSON.parse(json);
    return sameCanonicalValue(value, copy) ? copy as T : null;
  } catch {
    return null;
  }
}
function trusted(initial: unknown): InitialCareerSave | null {
  return startM1MatchResultJournal(initial).ok ? initial as InitialCareerSave : null;
}
function fixtureMap(catalog: Catalog): ReadonlyMap<string, Fixture> {
  return new Map(generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
    .flatMap(round => round.fixtures).map(fixture => [fixture.id, fixture]));
}
function sourceFromInput(raw: Record<string, unknown>): M1V8JournalSource | null {
  if (!rec(raw.prematch) || !Array.isArray(raw.plannedCommands) ||
      raw.plannedCommands.length > 212 ||
      !Array.isArray(raw.trustedDecisions) || raw.trustedDecisions.length > 18 ||
      !Array.isArray(raw.medicalActions) || raw.medicalActions.length > 36) {
    return null;
  }
  // The complete source pack must never be copied into each fixture result.
  const { catalog, ...prematch } = raw.prematch;
  if (!rec(catalog)) return null;
  return strictJsonCopy<M1V8JournalSource>({
    prematch, policy: raw.policy,
    plannedCommands: raw.plannedCommands,
    trustedDecisions: raw.trustedDecisions,
    medicalActions: raw.medicalActions,
  }, MAX_ITEM_BYTES);
}
function buildItem(
  original: InitialCareerSave, fixture: Fixture, commandId: string,
  source: M1V8JournalSource, assertedResult?: unknown,
): M1V8AppliedFixture | null {
  if (!rec(source.prematch) || Object.hasOwn(source.prematch, 'catalog') ||
      !Array.isArray(source.plannedCommands) ||
      !Array.isArray(source.trustedDecisions) ||
      !Array.isArray(source.medicalActions)) return null;
  const prematch: Record<string, unknown> = {
    ...source.prematch, catalog: original.catalog,
  };
  if (!sameCanonicalValue(fixture, prematch.fixture)) return null;
  const match = simulateM1V8MedicalPhases(
    prematch, source.policy, source.plannedCommands,
    source.trustedDecisions, source.medicalActions,
  );
  if (!match.ok || (assertedResult !== undefined &&
      !sameCanonicalValue(match, assertedResult))) return null;
  const attributed = deriveM1VerifiedV8MatchDossier(
    prematch, source.policy, source.plannedCommands,
    source.trustedDecisions, source.medicalActions, match,
  );
  if (!attributed.ok) return null;
  return {
    commandId, fixtureId: fixture.id, round: fixture.round,
    homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId,
    engineVersion: M1_V8_ENGINE_VERSION,
    eventSchemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    rngSeed: match.rngSeed, rngState: match.rngState,
    rngDraws: match.rngDraws, eventCount: match.events.length,
    source, dossier: attributed.dossier,
  };
}
function readJournal(
  candidate: unknown, original: InitialCareerSave,
  fixtures: ReadonlyMap<string, Fixture>,
): M1V8MatchJournal | null {
  const raw = strictJsonCopy<Record<string, unknown>>(
    candidate, MAX_JOURNAL_BYTES,
  );
  if (!rec(raw) || !exact(raw, JOURNAL_KEYS) ||
      raw.schemaVersion !== M1_V8_JOURNAL_SCHEMA_VERSION ||
      raw.careerId !== original.careerId ||
      raw.controlledClubId !== original.selectedClubId ||
      raw.basePackId !== original.basePackId ||
      raw.basePackVersion !== original.basePackVersion ||
      !int(raw.revision, 0, MAX_FIXTURES) ||
      !Array.isArray(raw.results) || raw.results.length !== raw.revision) return null;
  const usedCommands = new Set<string>(), usedFixtures = new Set<string>();
  const results: M1V8AppliedFixture[] = [];
  for (const row of raw.results) {
    if (!rec(row) || !exact(row, ITEM_KEYS) ||
        !isStableId(row.commandId) || !isStableId(row.fixtureId) ||
        usedCommands.has(row.commandId) || usedFixtures.has(row.fixtureId) ||
        !rec(row.source) || !exact(row.source, SOURCE_KEYS)) return null;
    const fixture = fixtures.get(row.fixtureId);
    if (!fixture ||
        // The outer strict JSON clone already checked this entire row.
        JSON.stringify(row).length > MAX_ITEM_BYTES ||
        !sameCanonicalValue(row,
          buildItem(original, fixture, row.commandId, row.source as unknown as M1V8JournalSource))) {
      return null;
    }
    usedCommands.add(row.commandId);
    usedFixtures.add(row.fixtureId);
    results.push(row as unknown as M1V8AppliedFixture);
  }
  return {
    schemaVersion: M1_V8_JOURNAL_SCHEMA_VERSION,
    careerId: original.careerId,
    controlledClubId: original.selectedClubId,
    basePackId: original.basePackId, basePackVersion: original.basePackVersion,
    revision: raw.revision, results,
  };
}
export function startM1V8MatchJournal(initial: unknown): M1V8JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  return { ok: true, journal: {
    schemaVersion: M1_V8_JOURNAL_SCHEMA_VERSION,
    careerId: original.careerId, controlledClubId: original.selectedClubId,
    basePackId: original.basePackId, basePackVersion: original.basePackVersion,
    revision: 0, results: [],
  } };
}
export function validateM1V8MatchJournal(
  initial: unknown, candidate: unknown,
): M1V8JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const current = readJournal(candidate, original, fixtureMap(original.catalog));
  return current ? { ok: true, journal: current } : fail('INVALID_JOURNAL');
}
/**
 * Pure all-or-nothing domain transition. No IndexedDB write, auto-migration,
 * league-points award, unproven sanction or authoritative match result.
 */
/**
 * Internal batch step. 'current' comes only from one successful source replay
 * or from a preceding step in this same synchronous batch. It is never an
 * externally supplied journal. Every new match is still independently replayed.
 */
function applyCheckedM1V8MatchResult(
  original: InitialCareerSave, current: M1V8MatchJournal, candidate: unknown,
  fixtures: ReadonlyMap<string, Fixture>,
): M1V8JournalResult {
  if (!rec(candidate) || !exact(candidate, APPLY_KEYS) ||
      candidate.schemaVersion !== M1_V8_APPLY_SCHEMA_VERSION ||
      !isStableId(candidate.commandId) || !isStableId(candidate.careerId) ||
      !int(candidate.expectedRevision, 0, MAX_FIXTURES) ||
      !rec(candidate.prematch) || !rec(candidate.result) ||
      !Array.isArray(candidate.plannedCommands) ||
      !Array.isArray(candidate.trustedDecisions) ||
      !Array.isArray(candidate.medicalActions)) return fail('INVALID_APPLY_COMMAND');
  if (candidate.careerId !== current.careerId) return fail('WRONG_CAREER');
  if (current.results.some(item => item.commandId === candidate.commandId)) {
    return fail('DUPLICATE_COMMAND');
  }
  const prematch = candidate.prematch;
  const claimedFixture = prematch.fixture;
  if (!rec(claimedFixture) || !isStableId(claimedFixture.id)) {
    return fail('INVALID_APPLY_COMMAND');
  }
  if (current.results.some(item => item.fixtureId === claimedFixture.id)) {
    return fail('DUPLICATE_FIXTURE');
  }
  if (candidate.expectedRevision !== current.revision) return fail('STALE_REVISION');
  if (current.revision >= MAX_FIXTURES) return fail('REVISION_LIMIT');
  const fixture = fixtures.get(claimedFixture.id);
  if (!fixture || !sameCanonicalValue(fixture, claimedFixture)) {
    return fail('UNKNOWN_FIXTURE');
  }
  if (!sameCanonicalValue(original.catalog, prematch.catalog)) {
    return fail('UNTRUSTED_PACK');
  }
  const source = sourceFromInput(candidate);
  if (!source) return fail('INVALID_APPLY_COMMAND');
  const item = buildItem(original, fixture, candidate.commandId, source, candidate.result);
  if (!item || !strictJsonCopy(item, MAX_ITEM_BYTES)) {
    return fail('INVALID_MATCH_RESULT');
  }
  return { ok: true, journal: {
    ...current, revision: current.revision + 1,
    results: [...current.results, item],
  } };
}

/**
 * Public single apply: always replay-validate an untrusted prior journal.
 * This API's observable validation/error order is intentionally unchanged.
 */
export function applyM1V8MatchResult(
  initial: unknown, journalCandidate: unknown, candidate: unknown,
): M1V8JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const fixtures = fixtureMap(original.catalog);
  const current = readJournal(journalCandidate, original, fixtures);
  if (!current) return fail('INVALID_JOURNAL');
  return applyCheckedM1V8MatchResult(original, current, candidate, fixtures);
}
export function applyM1V8MatchResultBatch(
  initial: unknown, journal: unknown, requests: unknown,
): M1V8JournalResult {
  if (!Array.isArray(requests) || requests.length < 1 ||
      requests.length > MAX_BATCH) return fail('INVALID_BATCH');
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  // Replay an externally supplied journal ONCE. No untrusted code receives
  // the internal deep JSON copy while the bounded synchronous batch runs.
  const fixtures = fixtureMap(original.catalog);
  let current = readJournal(journal, original, fixtures);
  if (!current) return fail('INVALID_JOURNAL');
  for (const request of requests) {
    const next = applyCheckedM1V8MatchResult(original, current, request, fixtures);
    if (!next.ok) return next;
    current = next.journal;
  }
  return { ok: true, journal: current };
}
