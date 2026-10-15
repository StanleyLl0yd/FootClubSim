import { isStableId } from './identifiers.js';
import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput } from './m1-clock.js';
import {
  advanceM1SubstitutionMatch, startM1SubstitutionMatch,
  submitM1NormalSubstitution,
  type M1SubstitutionCommand, type M1SubstitutionState,
} from './m1-substitutions.js';
import {
  M1_REFEREE_EVENT_LIMIT,
  M1_REFEREE_SCHEMA_VERSION, type M1RefereeDecision,
} from './m1-referee-decisions.js';

/**
 * First P3 integrated, headless on-field availability contract.
 * This is NOT the old isolated referee state and does not rewrite v5 shots.
 * Trusted referee/medical assertions must be authenticated by the caller.
 */
export const M1_AVAILABILITY_SCHEMA_VERSION = 1 as const;
export const M1_AVAILABILITY_RULES_ID = 'm1-2026-27-unified-limited-v1' as const;
export const M1_AVAILABILITY_MAX_DECISIONS = M1_REFEREE_EVENT_LIMIT + 10;
export type M1AvailabilityAction = M1RefereeDecision | M1SubstitutionCommand;
export type M1AvailabilityEffect =
  'substitution' | 'yellow' | 'second-yellow-red' | 'straight-red' | 'injury-withdrawn';
export interface M1AvailabilityEntry {
  readonly sequence: number;
  readonly effect: M1AvailabilityEffect;
  readonly action: M1AvailabilityAction;
}
export interface M1AvailabilityTeam {
  readonly active: readonly string[];
  readonly cautions: readonly { readonly playerId: string; readonly count: number }[];
  readonly dismissed: readonly string[];
  readonly medicalWithdrawn: readonly string[];
}
export interface M1AvailabilityState {
  readonly schemaVersion: typeof M1_AVAILABILITY_SCHEMA_VERSION;
  readonly rulesId: typeof M1_AVAILABILITY_RULES_ID;
  readonly substitutions: M1SubstitutionState;
  readonly teams: Readonly<{ home: M1AvailabilityTeam; away: M1AvailabilityTeam }>;
  readonly status: 'playing' | 'full-time' | 'awaiting-goalkeeper' | 'below-seven';
  readonly timeline: readonly M1AvailabilityEntry[];
}
export type M1AvailabilityError =
  'INVALID_PREMATCH' | 'INVALID_STATE' | 'INVALID_ACTION' | 'WRONG_FIXTURE' |
  'WRONG_TEAM' | 'CLOCK_MISMATCH' | 'DUPLICATE_ID' | 'NOT_ON_FIELD' |
  'INVALID_ORIGIN' | 'REFEREE_RULING_REQUIRED' | 'MATCH_FINISHED' |
  'SUBSTITUTION_REJECTED' | 'EVENT_LIMIT';
export type M1AvailabilityResult =
  | Readonly<{ ok: true; state: M1AvailabilityState }>
  | Readonly<{ ok: false; error: M1AvailabilityError }>;

const STATE_KEYS = ['schemaVersion', 'rulesId', 'substitutions', 'teams', 'status', 'timeline'] as const;
const REF_KEYS = ['schemaVersion', 'id', 'fixtureId', 'teamId',
  'playerId', 'elapsedSeconds', 'kind', 'origin'] as const;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const fail = (error: M1AvailabilityError): M1AvailabilityResult => ({ ok: false, error });
const ordered = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const sideFor = (state: M1AvailabilityState, teamId: string): 'home' | 'away' | null =>
  state.substitutions.clock.homeClubId === teamId ? 'home' :
    state.substitutions.clock.awayClubId === teamId ? 'away' : null;
function baseTeam(): M1AvailabilityTeam {
  return { active: [], cautions: [], dismissed: [], medicalWithdrawn: [] };
}
function syncTeam(original: M1AvailabilityTeam, source: M1SubstitutionState['teams']['home']):
  M1AvailabilityTeam {
  const out = new Set([...original.dismissed, ...original.medicalWithdrawn]);
  return { ...original, active: source.active.filter(id => !out.has(id)) };
}
function statusFor(state: M1AvailabilityState, input: M1PrematchInput):
  M1AvailabilityState['status'] {
  if (state.substitutions.clock.status === 'full-time') return 'full-time';
  if (state.teams.home.active.length < 7 || state.teams.away.active.length < 7) {
    return 'below-seven';
  }
  const positions = new Map(input.catalog.players.map(p => [p.id, p.primaryPosition]));
  if (state.teams.home.active.filter(id => positions.get(id) === 'GK').length !== 1 ||
      state.teams.away.active.filter(id => positions.get(id) === 'GK').length !== 1) {
    return 'awaiting-goalkeeper';
  }
  return 'playing';
}
function rebuild(
  current: M1AvailabilityState, source: M1SubstitutionState,
  input: M1PrematchInput, timeline: readonly M1AvailabilityEntry[] = current.timeline,
): M1AvailabilityState {
  const teams = {
    home: syncTeam(current.teams.home, source.teams.home),
    away: syncTeam(current.teams.away, source.teams.away),
  };
  const state: M1AvailabilityState = { ...current, substitutions: source, teams, timeline };
  return { ...state, status: statusFor(state, input) };
}

/** Start from the existing versioned, validated normal-substitution admission. */
export function startM1Availability(prematch: unknown, policy: unknown): M1AvailabilityResult {
  const source = startM1SubstitutionMatch(prematch, policy);
  if (!source.ok || !record(prematch)) return fail('INVALID_PREMATCH');
  const input = prematch as unknown as M1PrematchInput;
  const initial: M1AvailabilityState = {
    schemaVersion: M1_AVAILABILITY_SCHEMA_VERSION,
    rulesId: M1_AVAILABILITY_RULES_ID,
    substitutions: source.state,
    teams: {
      home: { ...baseTeam(), active: [...input.homeLineup.starters] },
      away: { ...baseTeam(), active: [...input.awayLineup.starters] },
    },
    status: 'playing', timeline: [],
  };
  return { ok: true, state: initial };
}

function refereeAction(raw: unknown): raw is M1RefereeDecision {
  return record(raw) && exact(raw, REF_KEYS) &&
    raw.schemaVersion === M1_REFEREE_SCHEMA_VERSION &&
    isStableId(raw.id) && isStableId(raw.fixtureId) &&
    isStableId(raw.teamId) && isStableId(raw.playerId) &&
    Number.isInteger(raw.elapsedSeconds) &&
    (raw.elapsedSeconds as number) >= 0 &&
    (raw.elapsedSeconds as number) < M1_CLOCK_END_SECONDS &&
    (raw.elapsedSeconds as number) % M1_CLOCK_STEP_SECONDS === 0 &&
    (raw.kind === 'caution' || raw.kind === 'direct-red' ||
      raw.kind === 'injury-withdrawal') &&
    (raw.origin === 'trusted-referee' || raw.origin === 'trusted-medical');
}

function admit(
  prematch: M1PrematchInput, policy: unknown,
  current: M1AvailabilityState, raw: unknown,
): M1AvailabilityResult {
  if (current.substitutions.clock.status === 'full-time') return fail('MATCH_FINISHED');
  if (current.status !== 'playing') return fail('REFEREE_RULING_REQUIRED');
  if (!record(raw)) return fail('INVALID_ACTION');
  const substitution = raw.kind === 'substitute-normal';
  if (!substitution && !refereeAction(raw)) return fail('INVALID_ACTION');
  const id = substitution ? raw.commandId : raw.id;
  if (!isStableId(id)) return fail('INVALID_ACTION');
  if (current.timeline.some(e =>
    (e.action.kind === 'substitute-normal' ? e.action.commandId : e.action.id) === id)) {
    return fail('DUPLICATE_ID');
  }
  if (current.timeline.length >= M1_AVAILABILITY_MAX_DECISIONS) return fail('EVENT_LIMIT');
  if (raw.fixtureId !== current.substitutions.clock.fixtureId) return fail('WRONG_FIXTURE');
  if (typeof raw.teamId !== 'string') return fail('WRONG_TEAM');
  const side = sideFor(current, raw.teamId);
  if (!side) return fail('WRONG_TEAM');
  if (raw.elapsedSeconds !== current.substitutions.clock.elapsedSeconds) {
    return fail('CLOCK_MISMATCH');
  }
  let effect: M1AvailabilityEffect;
  let next: M1AvailabilityState;
  if (substitution) {
    // Red-carded/withdrawn people may not be named as a player leaving the pitch.
    // Replacement of already withdrawn injured players is a separate unimplemented
    // procedure, not an implicit loophole in the normal-substitution checker.
    if (!current.teams[side].active.includes(raw.outPlayerId as string)) {
      return fail('NOT_ON_FIELD');
    }
    const changed = submitM1NormalSubstitution(prematch, policy, current.substitutions, raw);
    if (!changed.ok) return fail('SUBSTITUTION_REJECTED');
    next = rebuild(current, changed.state, prematch);
    effect = 'substitution';
  } else {
    const decision: M1RefereeDecision = raw as unknown as M1RefereeDecision;
    if (decision.kind === 'injury-withdrawal' ?
      decision.origin !== 'trusted-medical' : decision.origin !== 'trusted-referee') {
      return fail('INVALID_ORIGIN');
    }
    const team = current.teams[side];
    if (!team.active.includes(decision.playerId)) return fail('NOT_ON_FIELD');
    if (decision.kind === 'caution') {
      const existing = team.cautions.find(c => c.playerId === decision.playerId)?.count ?? 0;
      if (existing >= 2) return fail('NOT_ON_FIELD');
      const cautions = [...team.cautions.filter(c => c.playerId !== decision.playerId),
        { playerId: decision.playerId, count: existing + 1 }]
        .sort((a, b) => ordered(a.playerId, b.playerId));
      effect = existing === 1 ? 'second-yellow-red' : 'yellow';
      const teams = { ...current.teams,
        [side]: { ...team, cautions,
          dismissed: existing === 1 ? [...team.dismissed, decision.playerId] :
            [...team.dismissed] } };
      next = rebuild({ ...current, teams }, current.substitutions, prematch);
    } else {
      effect = decision.kind === 'direct-red' ? 'straight-red' : 'injury-withdrawn';
      const teams = { ...current.teams, [side]: {
        ...team,
        dismissed: decision.kind === 'direct-red' ?
          [...team.dismissed, decision.playerId] : [...team.dismissed],
        medicalWithdrawn: decision.kind === 'injury-withdrawal' ?
          [...team.medicalWithdrawn, decision.playerId] : [...team.medicalWithdrawn],
      } };
      next = rebuild({ ...current, teams }, current.substitutions, prematch);
    }
  }
  const action = substitution ?
    { ...raw, actor: record(raw.actor) ? { ...raw.actor } : raw.actor } as unknown as M1SubstitutionCommand :
    { ...raw } as unknown as M1RefereeDecision;
  return { ok: true, state: {
    ...next, timeline: [...next.timeline, {
      sequence: next.timeline.length + 1, effect, action,
    }],
  } };
}

/**
 * Recreate one combined causal timeline from the trusted source/policy.
 * A self-consistent forged source or fake referee origin string is NOT
 * authenticated by this pure function.
 */
function readState(prematch: unknown, policy: unknown, candidate: unknown):
  M1AvailabilityState | null {
  if (!record(candidate) || !exact(candidate, STATE_KEYS) ||
      candidate.schemaVersion !== M1_AVAILABILITY_SCHEMA_VERSION ||
      candidate.rulesId !== M1_AVAILABILITY_RULES_ID ||
      !record(candidate.substitutions) || !record(candidate.substitutions.clock) ||
      !Number.isInteger(candidate.substitutions.clock.elapsedSeconds) ||
      !Array.isArray(candidate.timeline) ||
      candidate.timeline.length > M1_AVAILABILITY_MAX_DECISIONS) return null;
  const first = startM1Availability(prematch, policy);
  if (!first.ok) return null;
  const input = prematch as M1PrematchInput;
  const end = candidate.substitutions.clock.elapsedSeconds as number;
  if (end < 0 || end > M1_CLOCK_END_SECONDS || end % M1_CLOCK_STEP_SECONDS !== 0) return null;
  let current = first.state, index = 0;
  for (let now = 0; now <= end; now += M1_CLOCK_STEP_SECONDS) {
    while (index < candidate.timeline.length) {
      const line: unknown = candidate.timeline[index];
      if (!record(line) || line.sequence !== index + 1 ||
          !record(line.action) || line.action.elapsedSeconds !== now) break;
      const next = admit(input, policy, current, line.action);
      if (!next.ok) return null;
      current = next.state;
      index++;
    }
    if (now < end) {
      if (current.status !== 'playing') return null;
      const after = advanceM1SubstitutionMatch(input, policy, current.substitutions);
      if (!after.ok) return null;
      current = rebuild(current, after.state, input);
    }
  }
  return index === candidate.timeline.length && sameCanonicalValue(current, candidate) ?
    current : null;
}

export function submitM1AvailabilityAction(
  prematch: unknown, policy: unknown, state: unknown, action: unknown,
): M1AvailabilityResult {
  const verified = readState(prematch, policy, state);
  if (!verified) return fail('INVALID_STATE');
  return admit(prematch as M1PrematchInput, policy, verified, action);
}

export function advanceM1Availability(
  prematch: unknown, policy: unknown, state: unknown,
): M1AvailabilityResult {
  const verified = readState(prematch, policy, state);
  if (!verified) return fail('INVALID_STATE');
  if (verified.status === 'full-time') return { ok: true, state: verified };
  if (verified.status !== 'playing') return fail('REFEREE_RULING_REQUIRED');
  const advanced = advanceM1SubstitutionMatch(prematch, policy, verified.substitutions);
  if (!advanced.ok) return fail('INVALID_STATE');
  return { ok: true, state: rebuild(verified, advanced.state, prematch as M1PrematchInput) };
}
