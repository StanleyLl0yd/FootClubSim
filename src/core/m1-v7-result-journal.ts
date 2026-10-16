import { sameCanonicalValue } from './canonical-value.js';
import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import { isStableId } from './identifiers.js';
import { deriveM1VerifiedV7AppearanceReport,
  type M1V7AppearanceReport } from './m1-v7-appearance-report.js';
import { M1_V7_ENGINE_VERSION, M1_V7_EVENT_SCHEMA_VERSION } from './m1-v7-adjudications.js';
import { startM1MatchResultJournal } from './m1-result-journal.js';
import type { Catalog } from './model.js';
import type { InitialCareerSave } from './save.js';

/** Standalone v7 domain proposal, never an implicit v6 journal migration. */
export const M1_V7_JOURNAL_SCHEMA_VERSION = 3 as const;
export const M1_V7_APPLY_SCHEMA_VERSION = 3 as const;
const JOURNAL_KEYS = ['schemaVersion', 'careerId', 'controlledClubId', 'basePackId',
  'basePackVersion', 'revision', 'results'] as const;
const ITEM_KEYS = ['commandId', 'fixtureId', 'round', 'homeClubId', 'awayClubId',
  'engineVersion', 'eventSchemaVersion', 'rngSeed', 'rngState', 'eventCount',
  'attribution'] as const;
const APPLY_KEYS = ['schemaVersion', 'commandId', 'careerId', 'expectedRevision',
  'prematch', 'policy', 'plannedCommands', 'trustedDecisions', 'result'] as const;
const ATTR_KEYS = ['schemaVersion', 'status', 'engineVersion', 'eventSchemaVersion',
  'fixtureId', 'match', 'goals', 'appearances', 'teams'] as const;
const MATCH_KEYS = ['fixtureId', 'home', 'away'] as const;
const SCORE_KEYS = ['goals', 'openPlayGoals', 'penaltiesTaken', 'penaltyGoals',
  'ownGoalsFor', 'shots', 'shotsOnTarget', 'xgMilli', 'xgCoverage'] as const;
const TEAM_KEYS = ['yellowCards', 'dismissals', 'medicalWithdrawals',
  'normalSubstitutions', 'playedSeconds'] as const;
const PLAYER_KEYS = ['teamId', 'playerId', 'started', 'enteredAtSeconds',
  'leftAtSeconds', 'playedSeconds', 'yellowCards', 'dismissal',
  'medicalWithdrawn', 'goals', 'shots', 'shotsOnTarget', 'xgMilli',
  'penaltiesTaken', 'penaltyGoals', 'ownGoals'] as const;
const GOAL_KEYS = ['kind', 'eventId', 'teamId', 'scorerId', 'elapsedSeconds'] as const;
const OWN_GOAL_KEYS = ['kind', 'eventId', 'teamId', 'defenderId', 'elapsedSeconds'] as const;

export interface M1V7AppliedFixture {
  readonly commandId: string;
  readonly fixtureId: string;
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly engineVersion: typeof M1_V7_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly eventCount: number;
  readonly attribution: M1V7AppearanceReport;
}
export interface M1V7MatchJournal {
  readonly schemaVersion: typeof M1_V7_JOURNAL_SCHEMA_VERSION;
  readonly careerId: string;
  readonly controlledClubId: string;
  readonly basePackId: string;
  readonly basePackVersion: string;
  readonly revision: number;
  readonly results: readonly M1V7AppliedFixture[];
}
export type M1V7JournalError = 'INVALID_INITIAL_CAREER' | 'INVALID_JOURNAL' |
  'INVALID_APPLY_COMMAND' | 'WRONG_CAREER' | 'STALE_REVISION' |
  'DUPLICATE_COMMAND' | 'DUPLICATE_FIXTURE' | 'UNKNOWN_FIXTURE' |
  'UNTRUSTED_PACK' | 'INVALID_MATCH_RESULT' | 'REVISION_LIMIT' | 'INVALID_BATCH';
export type M1V7JournalResult =
  | Readonly<{ ok: true; journal: M1V7MatchJournal }>
  | Readonly<{ ok: false; error: M1V7JournalError }>;

const fail = (error: M1V7JournalError): M1V7JournalResult => ({ ok: false, error });
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const int = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const sum = (rows: readonly Record<string, unknown>[], key: string): number =>
  rows.reduce((total, row) => total + (row[key] as number), 0);

function fixtureMap(catalog: Catalog): ReadonlyMap<string, Fixture> {
  return new Map(generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
    .flatMap(r => r.fixtures).map(f => [f.id, f]));
}
function teamScore(raw: unknown): raw is Record<string, unknown> {
  if (!rec(raw) || !exact(raw, SCORE_KEYS) ||
      !int(raw.goals, 0, 36) || !int(raw.openPlayGoals, 0, 18) ||
      !int(raw.penaltiesTaken, 0, 18) || !int(raw.penaltyGoals, 0, 18) ||
      !int(raw.ownGoalsFor, 0, 18) || !int(raw.shots, 0, 36) ||
      !int(raw.shotsOnTarget, 0, 36) || !int(raw.xgMilli, 0, 18000) ||
      raw.xgCoverage !== 'open-play-only') return false;
  return raw.goals === raw.openPlayGoals + raw.penaltyGoals + raw.ownGoalsFor &&
    (raw.penaltyGoals as number) <= (raw.penaltiesTaken as number) &&
    (raw.openPlayGoals as number) + (raw.penaltyGoals as number) <= raw.shotsOnTarget &&
    raw.shotsOnTarget <= raw.shots &&
    raw.penaltiesTaken <= raw.shots;
}
function validTeam(raw: unknown): raw is Record<string, unknown> {
  return rec(raw) && exact(raw, TEAM_KEYS) && int(raw.yellowCards, 0, 90) &&
    int(raw.dismissals, 0, 11) && int(raw.medicalWithdrawals, 0, 11) &&
    int(raw.normalSubstitutions, 0, 5) && int(raw.playedSeconds, 0, 59400);
}
function validAppearance(raw: unknown, fixture: Fixture,
  registered: ReadonlyMap<string, ReadonlySet<string>>): raw is Record<string, unknown> {
  if (!rec(raw) || !exact(raw, PLAYER_KEYS) ||
      !isStableId(raw.playerId) || !isStableId(raw.teamId) ||
      ![fixture.homeClubId, fixture.awayClubId].includes(raw.teamId) ||
      !registered.get(raw.teamId)?.has(raw.playerId) ||
      typeof raw.started !== 'boolean' || typeof raw.medicalWithdrawn !== 'boolean' ||
      !int(raw.enteredAtSeconds, 0, 5399) || !int(raw.leftAtSeconds, 0, 5400) ||
      !int(raw.playedSeconds, 0, 5400) ||
      raw.enteredAtSeconds + raw.playedSeconds !== raw.leftAtSeconds ||
      (raw.started && raw.enteredAtSeconds !== 0) ||
      (!raw.started && raw.enteredAtSeconds === 0) ||
      !int(raw.yellowCards, 0, 2) ||
      !['none', 'second-yellow', 'straight-red'].includes(raw.dismissal as string) ||
      (raw.dismissal === 'second-yellow' && raw.yellowCards !== 2) ||
      (raw.dismissal !== 'none' && raw.medicalWithdrawn) ||
      !int(raw.goals, 0, 36) || !int(raw.shots, 0, 36) ||
      !int(raw.shotsOnTarget, 0, 36) || !int(raw.xgMilli, 0, 18000) ||
      !int(raw.penaltiesTaken, 0, 18) || !int(raw.penaltyGoals, 0, 18) ||
      !int(raw.ownGoals, 0, 18)) return false;
  return raw.goals <= raw.shotsOnTarget && raw.shotsOnTarget <= raw.shots &&
    raw.penaltyGoals <= raw.penaltiesTaken && raw.penaltiesTaken <= raw.shots &&
    raw.penaltyGoals <= raw.goals;
}
function validAttribution(raw: unknown, fixture: Fixture, catalog: Catalog): boolean {
  if (!rec(raw) || !exact(raw, ATTR_KEYS) || raw.schemaVersion !== 1 ||
      raw.status !== 'SYNTHETIC_V7_CONFIRMED_DECISIONS_NO_CAREER_SANCTIONS' ||
      raw.engineVersion !== M1_V7_ENGINE_VERSION ||
      raw.eventSchemaVersion !== M1_V7_EVENT_SCHEMA_VERSION ||
      raw.fixtureId !== fixture.id || !rec(raw.match) ||
      !exact(raw.match, MATCH_KEYS) || raw.match.fixtureId !== fixture.id ||
      !teamScore(raw.match.home) || !teamScore(raw.match.away) ||
      !rec(raw.teams) || !exact(raw.teams, ['home', 'away']) ||
      !validTeam(raw.teams.home) || !validTeam(raw.teams.away) ||
      !Array.isArray(raw.goals) || raw.goals.length > 36 ||
      !Array.isArray(raw.appearances) || raw.appearances.length > 32) return false;
  const registered = new Map(catalog.clubs.map(c => [c.id,
    new Set(c.registeredPlayerIds)]));
  const players = new Map<string, Record<string, unknown>>();
  const grouped = { home: [] as Record<string, unknown>[],
    away: [] as Record<string, unknown>[] };
  for (const appearance of raw.appearances) {
    if (!validAppearance(appearance, fixture, registered) ||
        players.has(appearance.playerId)) return false;
    players.set(appearance.playerId, appearance);
    const side = appearance.teamId === fixture.homeClubId ? 'home' : 'away';
    grouped[side].push(appearance);
  }
  const credited = { home: 0, away: 0 };
  const open = new Map<string, number>(), penalties = new Map<string, number>();
  const own = new Map<string, number>();
  const used = new Set<string>();
  let previousSecond = -1;
  for (const goal of raw.goals) {
    if (!rec(goal) || !isStableId(goal.eventId) || !isStableId(goal.teamId) ||
        !int(goal.elapsedSeconds, 0, 5399) ||
        goal.elapsedSeconds < previousSecond || used.has(goal.eventId)) return false;
    previousSecond = goal.elapsedSeconds;
    used.add(goal.eventId);
    const side = goal.teamId === fixture.homeClubId ? 'home' :
      goal.teamId === fixture.awayClubId ? 'away' : null;
    if (!side) return false;
    credited[side]++;
    if (goal.kind === 'own-goal') {
      if (!exact(goal, OWN_GOAL_KEYS) || !isStableId(goal.defenderId) ||
          !goal.eventId.startsWith('m1-v7-decision-') ||
          goal.elapsedSeconds % 300 !== 0 ||
          players.get(goal.defenderId)?.teamId === goal.teamId ||
          !players.has(goal.defenderId)) return false;
      own.set(goal.defenderId, (own.get(goal.defenderId) ?? 0) + 1);
    } else {
      if (!exact(goal, GOAL_KEYS) || !isStableId(goal.scorerId) ||
          players.get(goal.scorerId)?.teamId !== goal.teamId) return false;
      if (goal.kind === 'open-play') {
        if ((goal.elapsedSeconds + 1) % 300 !== 0 ||
            goal.eventId !== 'm1-v7-base-m1-v6-shot-' +
              ((goal.elapsedSeconds + 1) / 300)) return false;
        open.set(goal.scorerId, (open.get(goal.scorerId) ?? 0) + 1);
      } else if (goal.kind === 'penalty') {
        if (!goal.eventId.startsWith('m1-v7-decision-') ||
            goal.elapsedSeconds % 300 !== 0) return false;
        penalties.set(goal.scorerId, (penalties.get(goal.scorerId) ?? 0) + 1);
      } else return false;
    }
  }
  for (const side of ['home', 'away'] as const) {
    const rows = grouped[side], opponents = grouped[side === 'home' ? 'away' : 'home'];
    const stats = raw.match[side] as Record<string, unknown>;
    const team = raw.teams[side] as Record<string, unknown>;
    if (credited[side] !== stats.goals ||
        sum(rows, 'goals') + sum(opponents, 'ownGoals') !== stats.goals ||
        sum(rows, 'goals') - sum(rows, 'penaltyGoals') !== stats.openPlayGoals ||
        sum(rows, 'shots') !== stats.shots ||
        sum(rows, 'shotsOnTarget') !== stats.shotsOnTarget ||
        sum(rows, 'xgMilli') !== stats.xgMilli ||
        sum(rows, 'penaltiesTaken') !== stats.penaltiesTaken ||
        sum(rows, 'penaltyGoals') !== stats.penaltyGoals ||
        sum(opponents, 'ownGoals') !== stats.ownGoalsFor ||
        sum(rows, 'yellowCards') !== team.yellowCards ||
        rows.filter(p => p.dismissal !== 'none').length !== team.dismissals ||
        rows.filter(p => p.medicalWithdrawn === true).length !== team.medicalWithdrawals ||
        rows.filter(p => p.started === false).length !== team.normalSubstitutions ||
        sum(rows, 'playedSeconds') !== team.playedSeconds) return false;
  }
  for (const [id, appearance] of players) {
    if (appearance.goals !== (open.get(id) ?? 0) + (penalties.get(id) ?? 0) ||
        appearance.penaltyGoals !== (penalties.get(id) ?? 0) ||
        appearance.ownGoals !== (own.get(id) ?? 0)) return false;
  }
  return raw.goals.length ===
    ((raw.match.home as Record<string, unknown>).goals as number) +
    ((raw.match.away as Record<string, unknown>).goals as number);
}
function validItem(raw: unknown, fixture: Fixture, catalog: Catalog): boolean {
  return rec(raw) && exact(raw, ITEM_KEYS) && isStableId(raw.commandId) &&
    raw.fixtureId === fixture.id && raw.round === fixture.round &&
    raw.homeClubId === fixture.homeClubId && raw.awayClubId === fixture.awayClubId &&
    raw.engineVersion === M1_V7_ENGINE_VERSION &&
    raw.eventSchemaVersion === M1_V7_EVENT_SCHEMA_VERSION &&
    int(raw.rngSeed, 1, 0xffffffff) && int(raw.rngState, 1, 0xffffffff) &&
    int(raw.eventCount, 1, 130) &&
    validAttribution(raw.attribution, fixture, catalog);
}
function trusted(initial: unknown): InitialCareerSave | null {
  return startM1MatchResultJournal(initial).ok ? initial as InitialCareerSave : null;
}
function readJournal(raw: unknown, initial: InitialCareerSave): M1V7MatchJournal | null {
  if (!rec(raw) || !exact(raw, JOURNAL_KEYS) ||
      raw.schemaVersion !== M1_V7_JOURNAL_SCHEMA_VERSION ||
      raw.careerId !== initial.careerId ||
      raw.controlledClubId !== initial.selectedClubId ||
      raw.basePackId !== initial.basePackId ||
      raw.basePackVersion !== initial.basePackVersion ||
      !int(raw.revision, 0, 240) || !Array.isArray(raw.results) ||
      raw.results.length !== raw.revision) return null;
  const fixtures = fixtureMap(initial.catalog);
  const commands = new Set<string>(), played = new Set<string>();
  const results: M1V7AppliedFixture[] = [];
  for (const rawItem of raw.results) {
    if (!rec(rawItem) || !isStableId(rawItem.fixtureId)) return null;
    const fixture = fixtures.get(rawItem.fixtureId);
    if (!fixture || played.has(fixture.id) || commands.has(rawItem.commandId as string) ||
        !validItem(rawItem, fixture, initial.catalog)) return null;
    played.add(fixture.id);
    commands.add(rawItem.commandId as string);
    const item = rawItem as unknown as M1V7AppliedFixture;
    results.push({
      ...item,
      attribution: {
        ...item.attribution,
        match: { ...item.attribution.match,
          home: { ...item.attribution.match.home },
          away: { ...item.attribution.match.away } },
        teams: { home: { ...item.attribution.teams.home },
          away: { ...item.attribution.teams.away } },
        goals: item.attribution.goals.map(g => ({ ...g })),
        appearances: item.attribution.appearances.map(p => ({ ...p })),
      },
    });
  }
  return {
    schemaVersion: M1_V7_JOURNAL_SCHEMA_VERSION,
    careerId: initial.careerId, controlledClubId: initial.selectedClubId,
    basePackId: initial.basePackId, basePackVersion: initial.basePackVersion,
    revision: raw.revision as number, results,
  };
}
export function startM1V7MatchJournal(initial: unknown): M1V7JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  return { ok: true, journal: {
    schemaVersion: M1_V7_JOURNAL_SCHEMA_VERSION, careerId: original.careerId,
    controlledClubId: original.selectedClubId, basePackId: original.basePackId,
    basePackVersion: original.basePackVersion, revision: 0, results: [],
  } };
}
export function validateM1V7MatchJournal(
  initial: unknown, candidate: unknown,
): M1V7JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const journal = readJournal(candidate, original);
  return journal ? { ok: true, journal } : fail('INVALID_JOURNAL');
}
/** A pure proposal. Trusted, atomic external persistence CAS is still required. */
export function applyM1V7MatchResult(
  initial: unknown, journalCandidate: unknown, candidate: unknown,
): M1V7JournalResult {
  const original = trusted(initial);
  if (!original) return fail('INVALID_INITIAL_CAREER');
  const current = readJournal(journalCandidate, original);
  if (!current) return fail('INVALID_JOURNAL');
  if (!rec(candidate) || !exact(candidate, APPLY_KEYS) ||
      candidate.schemaVersion !== M1_V7_APPLY_SCHEMA_VERSION ||
      !isStableId(candidate.commandId) || !isStableId(candidate.careerId) ||
      !int(candidate.expectedRevision, 0, 240) || !rec(candidate.prematch) ||
      !Array.isArray(candidate.plannedCommands) || candidate.plannedCommands.length > 212 ||
      !Array.isArray(candidate.trustedDecisions) ||
      candidate.trustedDecisions.length > 18 || !rec(candidate.result)) {
    return fail('INVALID_APPLY_COMMAND');
  }
  if (candidate.careerId !== current.careerId) return fail('WRONG_CAREER');
  if (current.results.some(item => item.commandId === candidate.commandId)) {
    return fail('DUPLICATE_COMMAND');
  }
  if (!rec(candidate.prematch.fixture) || !isStableId(candidate.prematch.fixture.id)) {
    return fail('INVALID_APPLY_COMMAND');
  }
  if (current.results.some(item => item.fixtureId === candidate.prematch.fixture.id)) {
    return fail('DUPLICATE_FIXTURE');
  }
  if (candidate.expectedRevision !== current.revision) return fail('STALE_REVISION');
  if (current.revision >= 240) return fail('REVISION_LIMIT');
  const claimed = candidate.prematch.fixture as Record<string, unknown>;
  const fixture = fixtureMap(original.catalog).get(claimed.id as string);
  if (!fixture || !sameCanonicalValue(fixture, claimed)) return fail('UNKNOWN_FIXTURE');
  if (!sameCanonicalValue(original.catalog, candidate.prematch.catalog)) {
    return fail('UNTRUSTED_PACK');
  }
  const verified = deriveM1VerifiedV7AppearanceReport(candidate.prematch, candidate.policy,
    candidate.plannedCommands, candidate.trustedDecisions, candidate.result);
  if (!verified.ok) return fail('INVALID_MATCH_RESULT');
  const result = candidate.result as Record<string, unknown>;
  const base = result.base as Record<string, unknown>;
  const item: M1V7AppliedFixture = {
    commandId: candidate.commandId as string, fixtureId: fixture.id, round: fixture.round,
    homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId,
    engineVersion: M1_V7_ENGINE_VERSION, eventSchemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
    rngSeed: base.rngSeed as number, rngState: base.rngState as number,
    eventCount: (result.events as unknown[]).length,
    attribution: verified.report,
  };
  if (!validItem(item, fixture, original.catalog)) return fail('INVALID_MATCH_RESULT');
  return { ok: true, journal: {
    ...current, revision: current.revision + 1, results: [...current.results, item],
  } };
}
export function applyM1V7MatchResultBatch(
  initial: unknown, journal: unknown, requests: unknown,
): M1V7JournalResult {
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > 16) {
    return fail('INVALID_BATCH');
  }
  let current: unknown = journal;
  for (const request of requests) {
    const result = applyM1V7MatchResult(initial, current, request);
    if (!result.ok) return result;
    current = result.journal;
  }
  return { ok: true, journal: current as M1V7MatchJournal };
}
