import { isStableId } from './identifiers.js';
import { sameCanonicalValue } from './canonical-value.js';
import { startM1Clock, advanceM1Clock, M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS,
  type M1ClockState, type M1PrematchInput } from './m1-clock.js';

/** IFAB 2026/27 Laws 3 and 12: intentionally narrow, referee-admitted subset. */
export const M1_REFEREE_SCHEMA_VERSION = 1 as const;
export const M1_REFEREE_RULES_ID = 'ifab-2026-27-laws-3-12-limited' as const;
export const M1_REFEREE_EVENT_LIMIT = 64 as const;

export type M1RefereeKind = 'caution' | 'direct-red' | 'injury-withdrawal';
export interface M1RefereeDecision {
  readonly schemaVersion: typeof M1_REFEREE_SCHEMA_VERSION;
  readonly id: string;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly elapsedSeconds: number;
  readonly kind: M1RefereeKind;
  /** The host must establish source authenticity; this string is not a signature. */
  readonly origin: 'trusted-referee' | 'trusted-medical';
}
export interface M1RefereeRecord extends M1RefereeDecision {
  readonly sequence: number;
  readonly effect: 'yellow' | 'second-yellow-red' | 'straight-red' | 'injury-withdrawn';
}
export interface M1RefereeTeam {
  readonly onField: readonly string[];
  readonly cautions: readonly { readonly playerId: string; readonly count: number }[];
  readonly dismissed: readonly string[];
  readonly injuredWithdrawn: readonly string[];
}
export interface M1RefereeState {
  readonly schemaVersion: typeof M1_REFEREE_SCHEMA_VERSION;
  readonly rulesId: typeof M1_REFEREE_RULES_ID;
  readonly clock: M1ClockState;
  readonly teams: Readonly<{ home: M1RefereeTeam; away: M1RefereeTeam }>;
  /** No synthetic forfeit is awarded from an incomplete referee ruling. */
  readonly status: 'playing' | 'full-time' | 'awaiting-goalkeeper' | 'below-seven';
  readonly decisions: readonly M1RefereeRecord[];
}
export type M1RefereeError =
  | 'INVALID_PREMATCH' | 'INVALID_STATE' | 'INVALID_DECISION'
  | 'WRONG_FIXTURE' | 'UNKNOWN_TEAM' | 'INELIGIBLE_PLAYER'
  | 'WRONG_CLOCK' | 'DUPLICATE_ID' | 'UNSUPPORTED_AUTHORITY'
  | 'MATCH_FINISHED' | 'REFEREE_RULING_REQUIRED' | 'EVENT_LIMIT';
export type M1RefereeResult =
  | Readonly<{ ok: true; state: M1RefereeState }>
  | Readonly<{ ok: false; error: M1RefereeError }>;

const STATE_KEYS = ['schemaVersion', 'rulesId', 'clock', 'teams', 'status', 'decisions'] as const;
const DECISION_KEYS = [
  'schemaVersion', 'id', 'fixtureId', 'teamId', 'playerId', 'elapsedSeconds',
  'kind', 'origin',
] as const;
const fail = (error: M1RefereeError): M1RefereeResult => ({ ok: false, error });
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const ordered = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function validDecision(v: unknown): v is M1RefereeDecision {
  return record(v) && exact(v, DECISION_KEYS) &&
    v.schemaVersion === M1_REFEREE_SCHEMA_VERSION &&
    isStableId(v.id) && isStableId(v.fixtureId) &&
    isStableId(v.teamId) && isStableId(v.playerId) &&
    Number.isInteger(v.elapsedSeconds) &&
    (v.elapsedSeconds as number) >= 0 && (v.elapsedSeconds as number) < M1_CLOCK_END_SECONDS &&
    (v.elapsedSeconds as number) % M1_CLOCK_STEP_SECONDS === 0 &&
    (v.kind === 'caution' || v.kind === 'direct-red' || v.kind === 'injury-withdrawal') &&
    (v.origin === 'trusted-referee' || v.origin === 'trusted-medical');
}

function teamStatus(team: M1RefereeTeam, input: M1PrematchInput): 'playing' | 'awaiting-goalkeeper' | 'below-seven' {
  if (team.onField.length < 7) return 'below-seven';
  const positions = new Map(input.catalog.players.map(p => [p.id, p.primaryPosition]));
  if (team.onField.filter(id => positions.get(id) === 'GK').length !== 1) return 'awaiting-goalkeeper';
  return 'playing';
}
function statusAfter(teams: M1RefereeState['teams'], input: M1PrematchInput):
  M1RefereeState['status'] {
  for (const side of ['home', 'away'] as const) {
    if (teamStatus(teams[side], input) === 'below-seven') return 'below-seven';
  }
  for (const side of ['home', 'away'] as const) {
    if (teamStatus(teams[side], input) === 'awaiting-goalkeeper') return 'awaiting-goalkeeper';
  }
  return 'playing';
}

export function startM1RefereeState(prematch: unknown): M1RefereeResult {
  const started = startM1Clock(prematch);
  if (!started.ok || !record(prematch)) return fail('INVALID_PREMATCH');
  const input = prematch as unknown as M1PrematchInput;
  const team = (starters: readonly string[]): M1RefereeTeam =>
    ({ onField: [...starters], cautions: [], dismissed: [], injuredWithdrawn: [] });
  return { ok: true, state: {
    schemaVersion: M1_REFEREE_SCHEMA_VERSION,
    rulesId: M1_REFEREE_RULES_ID,
    clock: started.state,
    teams: { home: team(input.homeLineup.starters), away: team(input.awayLineup.starters) },
    status: 'playing', decisions: [],
  } };
}

function apply(input: M1PrematchInput, current: M1RefereeState, candidate: unknown):
  M1RefereeResult {
  if (current.clock.status === 'full-time') return fail('MATCH_FINISHED');
  if (current.status !== 'playing') return fail('REFEREE_RULING_REQUIRED');
  if (!validDecision(candidate)) return fail('INVALID_DECISION');
  if (candidate.fixtureId !== current.clock.fixtureId) return fail('WRONG_FIXTURE');
  const side = candidate.teamId === current.clock.homeClubId ? 'home' :
    candidate.teamId === current.clock.awayClubId ? 'away' : null;
  if (side === null) return fail('UNKNOWN_TEAM');
  if (candidate.elapsedSeconds !== current.clock.elapsedSeconds) return fail('WRONG_CLOCK');
  if (current.decisions.some(e => e.id === candidate.id)) return fail('DUPLICATE_ID');
  if (current.decisions.length >= M1_REFEREE_EVENT_LIMIT) return fail('EVENT_LIMIT');
  if (candidate.kind === 'injury-withdrawal' && candidate.origin !== 'trusted-medical' ||
      candidate.kind !== 'injury-withdrawal' && candidate.origin !== 'trusted-referee') {
    return fail('UNSUPPORTED_AUTHORITY');
  }
  const team = current.teams[side];
  if (!team.onField.includes(candidate.playerId)) return fail('INELIGIBLE_PLAYER');

  let updated: M1RefereeTeam, effect: M1RefereeRecord['effect'];
  if (candidate.kind === 'caution') {
    const prev = team.cautions.find(c => c.playerId === candidate.playerId)?.count ?? 0;
    if (prev >= 2) return fail('INELIGIBLE_PLAYER');
    const cautions = [
      ...team.cautions.filter(c => c.playerId !== candidate.playerId),
      { playerId: candidate.playerId, count: prev + 1 },
    ].sort((a, b) => ordered(a.playerId, b.playerId));
    effect = prev === 1 ? 'second-yellow-red' : 'yellow';
    updated = {
      ...team, cautions,
      onField: prev === 1 ? team.onField.filter(id => id !== candidate.playerId) : [...team.onField],
      dismissed: prev === 1 ? [...team.dismissed, candidate.playerId] : [...team.dismissed],
    };
  } else if (candidate.kind === 'direct-red') {
    effect = 'straight-red';
    updated = { ...team,
      onField: team.onField.filter(id => id !== candidate.playerId),
      dismissed: [...team.dismissed, candidate.playerId],
    };
  } else {
    effect = 'injury-withdrawn';
    updated = { ...team,
      onField: team.onField.filter(id => id !== candidate.playerId),
      injuredWithdrawn: [...team.injuredWithdrawn, candidate.playerId],
    };
  }
  const teams = { ...current.teams, [side]: updated };
  const decision: M1RefereeRecord = {
    ...candidate, sequence: current.decisions.length + 1, effect,
  };
  return { ok: true, state: {
    ...current, teams, status: statusAfter(teams, input),
    decisions: [...current.decisions, decision],
  } };
}

/** Validate every serialized byte-equivalent semantic field against the source match. */
function replay(prematch: unknown, candidate: unknown): M1RefereeState | null {
  if (!record(candidate) || !exact(candidate, STATE_KEYS) ||
      candidate.schemaVersion !== M1_REFEREE_SCHEMA_VERSION ||
      candidate.rulesId !== M1_REFEREE_RULES_ID ||
      !record(candidate.clock) || !Number.isInteger(candidate.clock.elapsedSeconds) ||
      !Array.isArray(candidate.decisions) ||
      candidate.decisions.length > M1_REFEREE_EVENT_LIMIT) return null;
  const start = startM1RefereeState(prematch);
  if (!start.ok) return null;
  const input = prematch as M1PrematchInput;
  const end = candidate.clock.elapsedSeconds as number;
  if (end < 0 || end > M1_CLOCK_END_SECONDS ||
      end % M1_CLOCK_STEP_SECONDS !== 0) return null;
  let current = start.state;
  let index = 0;
  for (let second = 0; second <= end; second += M1_CLOCK_STEP_SECONDS) {
    while (index < candidate.decisions.length) {
      const row: unknown = candidate.decisions[index];
      if (!record(row) || row.elapsedSeconds !== second || row.sequence !== index + 1) break;
      const bare: Record<string, unknown> = { ...row };
      delete bare.sequence;
      delete bare.effect;
      const result = apply(input, current, bare);
      if (!result.ok) return null;
      current = result.state;
      index++;
    }
    if (second < end) {
      if (current.status !== 'playing') return null;
      const next = advanceM1Clock(current.clock);
      if (!next.ok) return null;
      current = { ...current, clock: next.state,
        status: next.state.status === 'full-time' ? 'full-time' : current.status };
    }
  }
  return index === candidate.decisions.length && sameCanonicalValue(current, candidate) ?
    current : null;
}

export function submitM1RefereeDecision(
  prematch: unknown, state: unknown, decision: unknown,
): M1RefereeResult {
  const current = replay(prematch, state);
  if (!current) return fail('INVALID_STATE');
  return apply(prematch as M1PrematchInput, current, decision);
}
export function advanceM1RefereeState(prematch: unknown, state: unknown): M1RefereeResult {
  const current = replay(prematch, state);
  if (!current) return fail('INVALID_STATE');
  if (current.status === 'full-time') return { ok: true, state: current };
  if (current.status !== 'playing') return fail('REFEREE_RULING_REQUIRED');
  const next = advanceM1Clock(current.clock);
  if (!next.ok) return fail('INVALID_STATE');
  return { ok: true, state: {
    ...current, clock: next.state,
    status: next.state.status === 'full-time' ? 'full-time' : current.status,
  } };
}
