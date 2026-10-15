import { sameCanonicalValue } from './canonical-value.js';
import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import { importSyntheticCatalog } from './import.js';
import { isStableId } from './identifiers.js';
import {
  M1_V5_ENGINE_VERSION, M1_V5_EVENT_SCHEMA_VERSION,
  simulateM1V5Phases, type M1V5Result,
} from './m1-phases-v5.js';
import type { MatchLedgerReport } from './match-contracts.js';
import type { Catalog } from './model.js';
import { RNG_VERSION } from './rng.js';
import type { InitialCareerSave } from './save.js';

/**
 * Versioned standalone M1 result journal, NOT an upgrade of M0 save v1.
 * A trusted career storage layer must compare-and-swap this whole value.
 */
export const M1_RESULT_JOURNAL_SCHEMA_VERSION = 1 as const;
export const M1_APPLY_COMMAND_SCHEMA_VERSION = 1 as const;
const INITIAL_KEYS = [
  'saveSchemaVersion', 'careerId', 'revision', 'engineVersion',
  'rngAlgorithmVersion', 'rngState', 'basePackId', 'basePackVersion',
  'selectedClubId', 'catalog',
] as const;
const JOURNAL_KEYS = [
  'schemaVersion', 'careerId', 'controlledClubId', 'basePackId',
  'basePackVersion', 'revision', 'results',
] as const;
const RESULT_KEYS = [
  'commandId', 'fixtureId', 'round', 'homeClubId', 'awayClubId',
  'report', 'engineVersion', 'eventSchemaVersion', 'rngSeed',
  'rngState', 'eventCount',
] as const;
const APPLY_KEYS = [
  'schemaVersion', 'commandId', 'careerId', 'expectedRevision',
  'prematch', 'policy', 'plannedCommands', 'result',
] as const;
export interface M1AppliedFixture {
  readonly commandId: string;
  readonly fixtureId: string;
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly report: MatchLedgerReport;
  readonly engineVersion: typeof M1_V5_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V5_EVENT_SCHEMA_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly eventCount: number;
}
export interface M1MatchResultJournal {
  readonly schemaVersion: typeof M1_RESULT_JOURNAL_SCHEMA_VERSION;
  readonly careerId: string;
  readonly controlledClubId: string;
  readonly basePackId: string;
  readonly basePackVersion: string;
  readonly revision: number;
  readonly results: readonly M1AppliedFixture[];
}
export interface M1MatchApplyRequest {
  readonly schemaVersion: typeof M1_APPLY_COMMAND_SCHEMA_VERSION;
  readonly commandId: string;
  readonly careerId: string;
  readonly expectedRevision: number;
  readonly prematch: unknown;
  readonly policy: unknown;
  readonly plannedCommands: unknown;
  readonly result: M1V5Result;
}
export type M1MatchJournalError =
  | 'INVALID_INITIAL_CAREER' | 'INVALID_JOURNAL' | 'INVALID_APPLY_COMMAND'
  | 'WRONG_CAREER' | 'STALE_REVISION' | 'DUPLICATE_COMMAND'
  | 'DUPLICATE_FIXTURE' | 'UNKNOWN_FIXTURE' | 'UNTRUSTED_PACK'
  | 'INVALID_MATCH_RESULT' | 'REVISION_LIMIT';
export type M1MatchJournalResult =
  | Readonly<{ ok: true; journal: M1MatchResultJournal }>
  | Readonly<{ ok: false; error: M1MatchJournalError }>;
const fail = (error: M1MatchJournalError): M1MatchJournalResult => ({ ok: false, error });
const rec = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const int = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

function trustedInitial(candidate: unknown): InitialCareerSave | null {
  if (!rec(candidate) || !own(candidate, INITIAL_KEYS) ||
      candidate.saveSchemaVersion !== 1 || candidate.revision !== 0 ||
      candidate.engineVersion !== '0' ||
      candidate.rngAlgorithmVersion !== RNG_VERSION ||
      !int(candidate.rngState, 1, 0xffffffff) ||
      !isStableId(candidate.careerId) ||
      !isStableId(candidate.basePackId) ||
      !isStableId(candidate.basePackVersion) ||
      !isStableId(candidate.selectedClubId)) return null;
  if (!rec(candidate.catalog)) return null;
  let json: string;
  try { json = JSON.stringify(candidate.catalog); }
  catch { return null; }
  const validated = importSyntheticCatalog(json);
  if (!validated.ok || !sameCanonicalValue(candidate.catalog, validated.value) ||
      validated.value.packId !== candidate.basePackId ||
      validated.value.packVersion !== candidate.basePackVersion ||
      !validated.value.clubs.some(club => club.id === candidate.selectedClubId)) return null;
  return candidate as unknown as InitialCareerSave;
}
function fixtureMap(catalog: Catalog): ReadonlyMap<string, Fixture> {
  return new Map(generateDoubleRoundRobin(catalog.clubs.map(club => club.id))
    .flatMap(round => round.fixtures).map(fixture => [fixture.id, fixture]));
}
function readScore(value: unknown, fixtureId: string): MatchLedgerReport | null {
  if (!rec(value) || !own(value, ['fixtureId', 'home', 'away']) ||
      value.fixtureId !== fixtureId || !rec(value.home) || !rec(value.away)) return null;
  for (const side of ['home', 'away'] as const) {
    const stats = value[side] as Record<string, unknown>;
    if (!own(stats, ['goals', 'shots', 'shotsOnTarget', 'xgMilli']) ||
        !int(stats.goals, 0, 18) || !int(stats.shots, 0, 18) ||
        !int(stats.shotsOnTarget, 0, 18) ||
        !int(stats.xgMilli, 0, 18000) ||
        stats.goals > stats.shotsOnTarget || stats.shotsOnTarget > stats.shots) return null;
  }
  return value as unknown as MatchLedgerReport;
}
function readJournal(candidate: unknown, original: InitialCareerSave):
  M1MatchResultJournal | null {
  if (!rec(candidate) || !own(candidate, JOURNAL_KEYS) ||
      candidate.schemaVersion !== M1_RESULT_JOURNAL_SCHEMA_VERSION ||
      candidate.careerId !== original.careerId ||
      candidate.controlledClubId !== original.selectedClubId ||
      candidate.basePackId !== original.basePackId ||
      candidate.basePackVersion !== original.basePackVersion ||
      !Array.isArray(candidate.results) ||
      !int(candidate.revision, 0, 240) ||
      candidate.results.length !== candidate.revision) return null;
  const fixtures = fixtureMap(original.catalog);
  const ids = new Set<string>(), commands = new Set<string>();
  const copied: M1AppliedFixture[] = [];
  for (const item of candidate.results) {
    if (!rec(item) || !own(item, RESULT_KEYS) ||
        !isStableId(item.commandId) || !isStableId(item.fixtureId) ||
        commands.has(item.commandId) || ids.has(item.fixtureId) ||
        !int(item.round, 1, 30) ||
        !int(item.rngSeed, 1, 0xffffffff) ||
        !int(item.rngState, 1, 0xffffffff) ||
        !int(item.eventCount, 1, 29) ||
        item.engineVersion !== M1_V5_ENGINE_VERSION ||
        item.eventSchemaVersion !== M1_V5_EVENT_SCHEMA_VERSION) return null;
    const fixture = fixtures.get(item.fixtureId);
    if (!fixture || fixture.round !== item.round ||
        fixture.homeClubId !== item.homeClubId ||
        fixture.awayClubId !== item.awayClubId) return null;
    const report = readScore(item.report, fixture.id);
    if (!report) return null;
    ids.add(fixture.id);
    commands.add(item.commandId);
    copied.push({
      commandId: item.commandId,
      fixtureId: fixture.id, round: fixture.round,
      homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId,
      report: {
        fixtureId: fixture.id,
        home: { ...report.home }, away: { ...report.away },
      },
      engineVersion: M1_V5_ENGINE_VERSION,
      eventSchemaVersion: M1_V5_EVENT_SCHEMA_VERSION,
      rngSeed: item.rngSeed, rngState: item.rngState, eventCount: item.eventCount,
    });
  }
  return {
    schemaVersion: M1_RESULT_JOURNAL_SCHEMA_VERSION,
    careerId: original.careerId, controlledClubId: original.selectedClubId,
    basePackId: original.basePackId, basePackVersion: original.basePackVersion,
    revision: candidate.revision as number, results: copied,
  };
}

/** Initialize a distinct M1 prototype journal without migrating M0 bytes. */
export function startM1MatchResultJournal(initialCareer: unknown): M1MatchJournalResult {
  const original = trustedInitial(initialCareer);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  return { ok: true, journal: {
    schemaVersion: M1_RESULT_JOURNAL_SCHEMA_VERSION,
    careerId: original.careerId, controlledClubId: original.selectedClubId,
    basePackId: original.basePackId, basePackVersion: original.basePackVersion,
    revision: 0, results: [],
  } };
}

/**
 * Pure transaction proposal. No storage write is performed.
 * External persistence MUST atomically CAS revision+careerId or a second
 * concurrent writer could lose data despite these local checks.
 */
export function applyM1MatchResult(
  initialCareer: unknown, journalCandidate: unknown, candidate: unknown,
): M1MatchJournalResult {
  const original = trustedInitial(initialCareer);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const current = readJournal(journalCandidate, original);
  if (!current) return fail('INVALID_JOURNAL');
  if (!rec(candidate) || !own(candidate, APPLY_KEYS) ||
      candidate.schemaVersion !== M1_APPLY_COMMAND_SCHEMA_VERSION ||
      !isStableId(candidate.commandId) || !isStableId(candidate.careerId) ||
      !int(candidate.expectedRevision, 0, 240) ||
      !rec(candidate.prematch) || !Array.isArray(candidate.plannedCommands) ||
      candidate.plannedCommands.length > 138 || !rec(candidate.result)) {
    return fail('INVALID_APPLY_COMMAND');
  }
  if (candidate.careerId !== current.careerId) return fail('WRONG_CAREER');
  if (current.results.some(item => item.commandId === candidate.commandId)) {
    return fail('DUPLICATE_COMMAND');
  }
  const fixture = (candidate.prematch as Record<string, unknown>).fixture;
  if (!rec(fixture) || !isStableId(fixture.id)) return fail('INVALID_APPLY_COMMAND');
  if (current.results.some(item => item.fixtureId === fixture.id)) {
    return fail('DUPLICATE_FIXTURE');
  }
  if (candidate.expectedRevision !== current.revision) return fail('STALE_REVISION');
  if (current.revision >= 240) return fail('REVISION_LIMIT');
  const canon = fixtureMap(original.catalog).get(fixture.id);
  if (!canon || !sameCanonicalValue(fixture, canon)) return fail('UNKNOWN_FIXTURE');
  if (!sameCanonicalValue(candidate.prematch.catalog, original.catalog)) {
    return fail('UNTRUSTED_PACK');
  }
  const simulated = simulateM1V5Phases(
    candidate.prematch, candidate.policy, candidate.plannedCommands,
  );
  if (!simulated.ok || !sameCanonicalValue(simulated, candidate.result)) {
    return fail('INVALID_MATCH_RESULT');
  }
  const result: M1AppliedFixture = {
    commandId: candidate.commandId,
    fixtureId: canon.id, round: canon.round,
    homeClubId: canon.homeClubId, awayClubId: canon.awayClubId,
    report: {
      fixtureId: canon.id,
      home: { ...simulated.report.home },
      away: { ...simulated.report.away },
    },
    engineVersion: M1_V5_ENGINE_VERSION,
    eventSchemaVersion: M1_V5_EVENT_SCHEMA_VERSION,
    rngSeed: simulated.rngSeed, rngState: simulated.rngState,
    eventCount: simulated.events.length,
  };
  return { ok: true, journal: {
    ...current, revision: current.revision + 1,
    results: [...current.results, result],
  } };
}
