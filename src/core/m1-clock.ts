import { isStableId } from './identifiers.js';
import {
  deriveMatchLedger, M0_ENGINE_VERSION,
  M0_RULES_PACK_ID, M0_RULES_PACK_VERSION,
  type MatchLedgerInput, type MatchLedgerReport,
} from './match-contracts.js';
import { RNG_VERSION } from './rng.js';
import type { ValidationError } from './validation.js';

/**
 * M1 P1 clock/checkpoint scaffold, NOT a football outcome generator.
 * Its separate schema/version must never reinterpret M0 shot/full-time v1.
 * P2/P3 must introduce reviewed new engine/event versions for actual actions.
 */
export const M1_ENGINE_VERSION = '1' as const;
export const M1_CLOCK_SCHEMA_VERSION = 2 as const;
export const M1_CLOCK_STEP_SECONDS = 300 as const;
export const M1_CLOCK_END_SECONDS = 5400 as const;
export const M1_CLOCK_MAX_EVENTS = M1_CLOCK_END_SECONDS / M1_CLOCK_STEP_SECONDS;

export type M1PrematchInput = Omit<MatchLedgerInput, 'engineVersion' | 'events'> &
  Readonly<{ engineVersion: typeof M1_ENGINE_VERSION }>;

export interface M1ClockEvent {
  readonly schemaVersion: typeof M1_CLOCK_SCHEMA_VERSION;
  readonly id: string;
  readonly sequence: number;
  readonly elapsedSeconds: number;
  readonly type: 'checkpoint' | 'full-time';
}

/** A bounded, JSON-serializable deterministic continuation. No input object is retained. */
export interface M1ClockState {
  readonly schemaVersion: typeof M1_CLOCK_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_ENGINE_VERSION;
  readonly fixtureId: string;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly rulesPackId: typeof M0_RULES_PACK_ID;
  readonly rulesPackVersion: typeof M0_RULES_PACK_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly rngSeed: number;
  /** There are deliberately zero PRNG draws in this clock-only protocol. */
  readonly rngState: number;
  readonly elapsedSeconds: number;
  readonly status: 'running' | 'full-time';
  readonly events: readonly M1ClockEvent[];
}

type MatchClockFailure = Readonly<{ ok: false; errors: readonly ValidationError[] }>;
export type M1ClockStart = Readonly<{ ok: true; state: M1ClockState }> | MatchClockFailure;
export type M1ClockStep = Readonly<{
  ok: true;
  state: M1ClockState;
  /** P1 cannot claim a plausible score. An end-only M0 derivation is exactly 0-0. */
  report: MatchLedgerReport | null;
}> | MatchClockFailure;

const PREMATCH_KEYS = [
  'schemaVersion', 'engineVersion', 'rulesPackId', 'rulesPackVersion',
  'fixture', 'catalog', 'homeLineup', 'awayLineup', 'homeTactics', 'awayTactics',
  'rosterRules', 'rngAlgorithmVersion', 'rngSeed',
] as const;
const STATE_KEYS = [
  'schemaVersion', 'engineVersion', 'fixtureId', 'homeClubId', 'awayClubId',
  'rulesPackId', 'rulesPackVersion', 'rngAlgorithmVersion', 'rngSeed', 'rngState',
  'elapsedSeconds', 'status', 'events',
] as const;
const EVENT_KEYS = ['schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type'] as const;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const keysMatch = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const error = (code: string, at: string): MatchClockFailure =>
  ({ ok: false, errors: [{ code, at }] });

function clockEvent(sequence: number): M1ClockEvent {
  const elapsedSeconds = sequence * M1_CLOCK_STEP_SECONDS;
  return {
    schemaVersion: M1_CLOCK_SCHEMA_VERSION,
    id: 'm1-clock-' + sequence,
    sequence,
    elapsedSeconds,
    type: elapsedSeconds === M1_CLOCK_END_SECONDS ? 'full-time' : 'checkpoint',
  };
}

/** Reuse the proven M0 pre-match validator, using an end-only synthetic ledger. */
export function startM1Clock(input: unknown): M1ClockStart {
  if (!isRecord(input) || !keysMatch(input, PREMATCH_KEYS) ||
      input.engineVersion !== M1_ENGINE_VERSION) {
    return error('INVALID_M1_PREMATCH', 'input');
  }
  const preflight = deriveMatchLedger({
    ...input,
    engineVersion: M0_ENGINE_VERSION,
    events: [{ id: 'm1-preflight-end', sequence: 1, elapsedSeconds: 5400, type: 'full-time' }],
  } as unknown as MatchLedgerInput);
  if (!preflight.ok) return { ok: false, errors: preflight.errors };
  const fixture = input.fixture as MatchLedgerInput['fixture'];
  const seed = input.rngSeed as number;
  return { ok: true, state: {
    schemaVersion: M1_CLOCK_SCHEMA_VERSION,
    engineVersion: M1_ENGINE_VERSION,
    fixtureId: fixture.id, homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    rngAlgorithmVersion: RNG_VERSION, rngSeed: seed, rngState: seed,
    elapsedSeconds: 0, status: 'running', events: [],
  } };
}

/**
 * Treat serialized checkpoints as untrusted. Re-derive all 18 possible
 * clock events and reject modified event history / impossible continuations.
 */
function validState(value: unknown): value is M1ClockState {
  if (!isRecord(value) || !keysMatch(value, STATE_KEYS) ||
      value.schemaVersion !== M1_CLOCK_SCHEMA_VERSION ||
      value.engineVersion !== M1_ENGINE_VERSION ||
      !isStableId(value.fixtureId) || !isStableId(value.homeClubId) ||
      !isStableId(value.awayClubId) || value.homeClubId === value.awayClubId ||
      value.rulesPackId !== M0_RULES_PACK_ID ||
      value.rulesPackVersion !== M0_RULES_PACK_VERSION ||
      value.rngAlgorithmVersion !== RNG_VERSION ||
      !Number.isInteger(value.rngSeed) ||
      (value.rngSeed as number) < 1 || (value.rngSeed as number) > 0xffffffff ||
      value.rngState !== value.rngSeed ||
      !Number.isInteger(value.elapsedSeconds) ||
      (value.elapsedSeconds as number) < 0 ||
      (value.elapsedSeconds as number) > M1_CLOCK_END_SECONDS ||
      (value.elapsedSeconds as number) % M1_CLOCK_STEP_SECONDS !== 0 ||
      !Array.isArray(value.events) || value.events.length > M1_CLOCK_MAX_EVENTS ||
      value.events.length !== (value.elapsedSeconds as number) / M1_CLOCK_STEP_SECONDS ||
      value.status !== (value.elapsedSeconds === M1_CLOCK_END_SECONDS ? 'full-time' : 'running')) {
    return false;
  }
  for (let i = 0; i < value.events.length; i++) {
    const e: unknown = value.events[i];
    if (!isRecord(e) || !keysMatch(e, EVENT_KEYS)) return false;
    const expected = clockEvent(i + 1);
    if (EVENT_KEYS.some(k => e[k] !== expected[k])) return false;
  }
  return true;
}

function zeroReport(state: M1ClockState): MatchLedgerReport {
  return {
    fixtureId: state.fixtureId,
    home: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
    away: { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 },
  };
}

/** One virtual five-minute step. Pausing is simply retaining the returned state. */
export function advanceM1Clock(snapshot: unknown): M1ClockStep {
  if (!validState(snapshot)) return error('INVALID_M1_STATE', 'state');
  if (snapshot.status === 'full-time') {
    return { ok: true, state: snapshot, report: zeroReport(snapshot) };
  }
  const nextEvent = clockEvent(snapshot.events.length + 1);
  const status = nextEvent.type === 'full-time' ? 'full-time' : 'running';
  const state: M1ClockState = {
    ...snapshot,
    elapsedSeconds: nextEvent.elapsedSeconds,
    status,
    events: [...snapshot.events, nextEvent],
  };
  return { ok: true, state, report: status === 'full-time' ? zeroReport(state) : null };
}

/** Full auto-run uses precisely the same transition as interactive single-stepping. */
export function runM1Clock(input: unknown): M1ClockStep {
  const start = startM1Clock(input);
  if (!start.ok) return start;
  let state = start.state;
  for (let i = 0; i < M1_CLOCK_MAX_EVENTS; i++) {
    const result = advanceM1Clock(state);
    if (!result.ok) return result;
    state = result.state;
  }
  return { ok: true, state, report: zeroReport(state) };
}

/** Declared explicitly so P2 does not treat a clock-only 0-0 as a calibrated match. */
export function m1ClockIsFullMatchSimulation(): false {
  return false;
}
