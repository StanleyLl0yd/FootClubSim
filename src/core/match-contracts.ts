import type { Fixture } from './fixtures.js';
import { isStableId } from './identifiers.js';
import type { Catalog, MatchLineup, MatchRosterRules } from './model.js';
import { RNG_VERSION } from './rng.js';
import { validateTacticalPlan, type TacticalPlan } from './tactics.js';
import { validateCatalog, validateLineup, type ValidationError } from './validation.js';

/**
 * M0 ledger protocol. Only shots and full time are supported here.
 * Substitutions, cards, own goals, added time and injuries require a
 * future explicitly versioned event contract, not guessed behavior.
 */
export const MATCH_LEDGER_VERSION = 1 as const;
/** M0 derives reports only; engine version 0 explicitly means no match generator. */
export const M0_ENGINE_VERSION = '0' as const;
export const M0_RULES_PACK_ID = 'synthetic-rpl-scale' as const;
export const M0_RULES_PACK_VERSION = '1' as const;
export type ShotOutcome = 'goal' | 'saved' | 'off-target' | 'blocked';

interface EventBase {
  readonly id: string;
  readonly sequence: number;
  /** Seconds of virtual match time; monotonic, never wall-clock time. */
  readonly elapsedSeconds: number;
}
export interface ShotEvent extends EventBase {
  readonly type: 'shot';
  readonly teamId: string;
  readonly playerId: string;
  /** Fixed-point probability, 0..1000, to avoid floating-point summary drift. */
  readonly xgMilli: number;
  readonly outcome: ShotOutcome;
}
export interface FullTimeEvent extends EventBase {
  readonly type: 'full-time';
}
export type MatchLedgerEvent = ShotEvent | FullTimeEvent;

export interface MatchLedgerInput {
  readonly schemaVersion: typeof MATCH_LEDGER_VERSION;
  readonly engineVersion: typeof M0_ENGINE_VERSION;
  readonly rulesPackId: typeof M0_RULES_PACK_ID;
  readonly rulesPackVersion: typeof M0_RULES_PACK_VERSION;
  readonly fixture: Fixture;
  readonly catalog: Catalog;
  readonly homeLineup: MatchLineup;
  readonly awayLineup: MatchLineup;
  readonly homeTactics: TacticalPlan;
  readonly awayTactics: TacticalPlan;
  readonly rosterRules: MatchRosterRules;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly rngSeed: number;
  readonly events: readonly MatchLedgerEvent[];
}
export interface MatchTeamReport {
  readonly goals: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xgMilli: number;
}
export interface MatchLedgerReport {
  readonly fixtureId: string;
  readonly home: MatchTeamReport;
  readonly away: MatchTeamReport;
}
export type MatchLedgerResult =
  | { readonly ok: true; readonly report: MatchLedgerReport }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

const MAX_EVENTS = 4096;
const MAX_SECONDS = 130 * 60;
const SHOT_KEYS = ['id', 'sequence', 'elapsedSeconds', 'type', 'teamId', 'playerId', 'xgMilli', 'outcome'] as const;
const FULL_TIME_KEYS = ['id', 'sequence', 'elapsedSeconds', 'type'] as const;
const fail = (code: string, at: string): ValidationError => ({ code, at });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Bound collection work and reject sparse or malformed arrays before typed validators. */
function hasBasicMatchShape(input: MatchLedgerInput): boolean {
  const { fixture, catalog, homeLineup, awayLineup, homeTactics, awayTactics, rosterRules } = input;
  if (!isRecord(fixture) || !isRecord(catalog) ||
      !isRecord(homeLineup) || !isRecord(awayLineup) ||
      !isRecord(homeTactics) || !isRecord(awayTactics) || !isRecord(rosterRules) ||
      !Array.isArray(catalog.players) || catalog.players.length > 2048 ||
      !Array.isArray(catalog.clubs) || catalog.clubs.length > 64 ||
      !Array.isArray(homeLineup.starters) || !Array.isArray(homeLineup.bench) ||
      !Array.isArray(awayLineup.starters) || !Array.isArray(awayLineup.bench) ||
      homeLineup.starters.length > 11 || awayLineup.starters.length > 11 ||
      homeLineup.bench.length > 128 || awayLineup.bench.length > 128) return false;

  // Array.every skips holes; for..of yields undefined and catches sparse arrays.
  for (const player of catalog.players) {
    if (!isRecord(player) || typeof player.displayName !== 'string' ||
        !isRecord(player.attributes)) return false;
  }
  for (const club of catalog.clubs) {
    if (!isRecord(club) || typeof club.displayName !== 'string' ||
        !Array.isArray(club.registeredPlayerIds) ||
        club.registeredPlayerIds.length > 128) return false;
    for (const id of club.registeredPlayerIds) {
      if (!isStableId(id)) return false;
    }
  }
  return true;
}

function emptyStats(): { goals: number; shots: number; shotsOnTarget: number; xgMilli: number } {
  return { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 };
}

/**
 * Pure and bounded ledger validation/derivation; does not simulate any events,
 * read external state, or mutate the source catalog/lineups.
 */
export function deriveMatchLedger(input: MatchLedgerInput): MatchLedgerResult {
  if (!isRecord(input) || !hasBasicMatchShape(input)) {
    return { ok: false, errors: [fail('INVALID_MATCH_SHAPE', 'input')] };
  }
  const errors: ValidationError[] = [];
  const { fixture, catalog, homeLineup, awayLineup, rosterRules, events } = input;

  if (!isStableId(fixture.id) || !Number.isInteger(fixture.round) || fixture.round < 1 ||
      fixture.homeClubId === fixture.awayClubId ||
      !isStableId(fixture.homeClubId) || !isStableId(fixture.awayClubId)) {
    errors.push(fail('INVALID_FIXTURE', 'fixture'));
  }
  if (input.schemaVersion !== MATCH_LEDGER_VERSION ||
      input.engineVersion !== M0_ENGINE_VERSION ||
      input.rulesPackId !== M0_RULES_PACK_ID ||
      input.rulesPackVersion !== M0_RULES_PACK_VERSION ||
      input.rngAlgorithmVersion !== RNG_VERSION ||
      !Number.isInteger(input.rngSeed) || input.rngSeed < 1 || input.rngSeed > 0xffffffff) {
    errors.push(fail('INVALID_MATCH_VERSION_OR_SEED', 'input'));
  }
  if (!Array.isArray(events) || events.length < 1 || events.length > MAX_EVENTS) {
    return { ok: false, errors: [...errors, fail('INVALID_EVENT_COUNT', 'events')] };
  }

  errors.push(...validateTacticalPlan(input.homeTactics, fixture.homeClubId));
  errors.push(...validateTacticalPlan(input.awayTactics, fixture.awayClubId));
  const catalogErrors = validateCatalog(catalog);
  errors.push(...catalogErrors);
  const homeClub = catalog.clubs.find(club => club.id === fixture.homeClubId);
  const awayClub = catalog.clubs.find(club => club.id === fixture.awayClubId);
  if (!homeClub || !awayClub) errors.push(fail('UNKNOWN_FIXTURE_CLUB', 'fixture'));
  const players = new Map(catalog.players.map(player => [player.id, player]));
  if (homeClub) errors.push(...validateLineup(homeLineup, homeClub, players, rosterRules));
  if (awayClub) errors.push(...validateLineup(awayLineup, awayClub, players, rosterRules));
  if (errors.length) return { ok: false, errors };

  const home = emptyStats(), away = emptyStats();
  const activeHome = new Set(homeLineup.starters), activeAway = new Set(awayLineup.starters);
  const seenIds = new Set<string>();
  let previousSecond = 0;
  let hasFullTime = false;
  for (const [index, event] of events.entries()) {
    const at = 'events[' + index + ']';
    if (event === null || typeof event !== 'object' || Array.isArray(event)) {
      errors.push(fail('INVALID_EVENT_SHAPE', at));
      continue;
    }
    const fields = event.type === 'shot' ? SHOT_KEYS :
      event.type === 'full-time' ? FULL_TIME_KEYS : null;
    if (fields && (Object.keys(event).length !== fields.length ||
        fields.some(key => !Object.hasOwn(event, key)))) {
      errors.push(fail('INVALID_EVENT_SHAPE', at));
      continue;
    }
    if (!isStableId(event.id) || seenIds.has(event.id)) errors.push(fail('INVALID_EVENT_ID', at));
    seenIds.add(event.id);
    if (!Number.isInteger(event.sequence) || event.sequence !== index + 1 ||
        !Number.isInteger(event.elapsedSeconds) ||
        event.elapsedSeconds < previousSecond || event.elapsedSeconds < 0 ||
        event.elapsedSeconds > MAX_SECONDS) errors.push(fail('INVALID_EVENT_ORDER', at));
    if (Number.isInteger(event.elapsedSeconds)) previousSecond = event.elapsedSeconds;

    if (event.type === 'full-time') {
      if (hasFullTime || index !== events.length - 1 ||
          event.elapsedSeconds < 90 * 60) errors.push(fail('INVALID_FULL_TIME', at));
      hasFullTime = true;
    } else if (event.type === 'shot') {
      const team = event.teamId === fixture.homeClubId ? home :
        event.teamId === fixture.awayClubId ? away : null;
      const active = event.teamId === fixture.homeClubId ? activeHome :
        event.teamId === fixture.awayClubId ? activeAway : null;
      if (!team || !active?.has(event.playerId)) errors.push(fail('INVALID_SHOOTER', at));
      if (!Number.isInteger(event.xgMilli) || event.xgMilli < 0 || event.xgMilli > 1000 ||
          !['goal', 'saved', 'off-target', 'blocked'].includes(event.outcome)) {
        errors.push(fail('INVALID_SHOT', at));
      }
      if (team && Number.isInteger(event.xgMilli) && event.xgMilli >= 0 &&
          event.xgMilli <= 1000 && ['goal', 'saved', 'off-target', 'blocked'].includes(event.outcome)) {
        team.shots++;
        team.xgMilli += event.xgMilli;
        if (event.outcome === 'goal' || event.outcome === 'saved') team.shotsOnTarget++;
        if (event.outcome === 'goal') team.goals++;
      }
    } else {
      errors.push(fail('UNSUPPORTED_EVENT', at));
    }
  }
  if (!hasFullTime) errors.push(fail('MISSING_FULL_TIME', 'events'));
  return errors.length ? { ok: false, errors } :
    { ok: true, report: { fixtureId: fixture.id, home, away } };
}
