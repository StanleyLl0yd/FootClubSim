import { isStableId } from './identifiers.js';
import { sameCanonicalValue } from './canonical-value.js';
import {
  startM1ControlledMatch, type M1Sides, type M1TeamAuthority,
} from './m1-control.js';
import {
  advanceM1Clock, M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS,
  type M1ClockState, type M1PrematchInput,
} from './m1-clock.js';
import type { CareerActor } from './command-contracts.js';

/**
 * Narrow, sourced normal-substitution subset. RPL 2026/27 Article 8.8:
 * up to 5 normal substitutions / 3 in-play opportunities per team;
 * half-time does not consume an opportunity. IFAB 26/27 Law 3 defines
 * procedure. Concussion and referee procedural exceptions are NOT modeled.
 */
export const M1_SUBSTITUTION_SCHEMA_VERSION = 1 as const;
export const M1_RPL_NORMAL_SUBSTITUTION_RULES_ID = 'rpl-2026-27-art-8.8-normal' as const;
export const M1_NORMAL_REPLACEMENTS_LIMIT = 5 as const;
export const M1_NORMAL_OPPORTUNITY_LIMIT = 3 as const;
export const M1_MAX_SUBSTITUTION_RECORDS = 10 as const;

export interface M1SubstitutionTeam {
  readonly active: readonly string[];
  readonly bench: readonly string[];
  readonly removed: readonly string[];
  readonly normalUsed: number;
  /** Distinct in-play authorized stoppage seconds. Excludes 45-minute half-time. */
  readonly opportunityTimes: readonly number[];
}
export interface M1SubstitutionCommand {
  readonly schemaVersion: typeof M1_SUBSTITUTION_SCHEMA_VERSION;
  readonly commandId: string;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly elapsedSeconds: number;
  readonly actor: CareerActor;
  readonly kind: 'substitute-normal';
  readonly outPlayerId: string;
  readonly inPlayerId: string;
  /**
   * External referee state assertion, not fabricated by the 300-second clock.
   * Every non-half-time request requires a real stoppage-admission signal from
   * a future match ref/engine, not a client permission bypass.
   */
  readonly stoppage: 'referee-authorized' | 'half-time';
}
export interface M1RecordedSubstitution extends M1SubstitutionCommand {
  readonly sequence: number;
}
export interface M1SubstitutionState {
  readonly schemaVersion: typeof M1_SUBSTITUTION_SCHEMA_VERSION;
  readonly rulesId: typeof M1_RPL_NORMAL_SUBSTITUTION_RULES_ID;
  readonly clock: M1ClockState;
  readonly authority: M1Sides<M1TeamAuthority>;
  readonly teams: M1Sides<M1SubstitutionTeam>;
  readonly commands: readonly M1RecordedSubstitution[];
}
export type M1SubstitutionError =
  | 'INVALID_PREMATCH' | 'INVALID_STATE' | 'INVALID_COMMAND'
  | 'WRONG_FIXTURE' | 'UNKNOWN_TEAM' | 'UNAUTHORIZED'
  | 'COMMAND_CLOCK_MISMATCH' | 'MATCH_FINISHED' | 'NOT_AN_AUTHORIZED_STOPPAGE'
  | 'UNKNOWN_EXIT' | 'UNAVAILABLE_SUBSTITUTE' | 'INVALID_GOALKEEPER_COUNT'
  | 'FOREIGNER_CAP' | 'FIVE_REPLACEMENTS_USED' | 'THREE_OPPORTUNITIES_USED'
  | 'DUPLICATE_COMMAND' | 'COMMAND_LIMIT';
export type M1SubstitutionResult =
  | Readonly<{ ok: true; state: M1SubstitutionState }>
  | Readonly<{ ok: false; error: M1SubstitutionError }>;

const RAW_COMMAND = [
  'schemaVersion', 'commandId', 'fixtureId', 'teamId', 'elapsedSeconds',
  'actor', 'kind', 'outPlayerId', 'inPlayerId', 'stoppage',
] as const;
const STATE_KEYS = ['schemaVersion', 'rulesId', 'clock', 'authority', 'teams', 'commands'] as const;
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const fail = (error: M1SubstitutionError): M1SubstitutionResult => ({ ok: false, error });
function readActor(v: unknown): CareerActor | null {
  if (!rec(v)) return null;
  if (v.kind === 'player' && exact(v, ['kind'])) return { kind: 'player' };
  if (v.kind === 'staff' && exact(v, ['kind', 'staffId']) && isStableId(v.staffId)) {
    return { kind: 'staff', staffId: v.staffId };
  }
  return null;
}
function sameActor(a: CareerActor, b: CareerActor): boolean {
  return a.kind === b.kind &&
    (a.kind === 'player' || (b.kind === 'staff' && a.staffId === b.staffId));
}
function readCommand(v: unknown): M1SubstitutionCommand | null {
  if (!rec(v) || !exact(v, RAW_COMMAND) ||
      v.schemaVersion !== M1_SUBSTITUTION_SCHEMA_VERSION ||
      v.kind !== 'substitute-normal' ||
      !isStableId(v.commandId) || !isStableId(v.fixtureId) ||
      !isStableId(v.teamId) || !isStableId(v.outPlayerId) ||
      !isStableId(v.inPlayerId) ||
      v.outPlayerId === v.inPlayerId ||
      !Number.isInteger(v.elapsedSeconds) ||
      (v.elapsedSeconds as number) <= 0 ||
      (v.elapsedSeconds as number) >= M1_CLOCK_END_SECONDS ||
      (v.elapsedSeconds as number) % M1_CLOCK_STEP_SECONDS !== 0 ||
      (v.stoppage !== 'referee-authorized' && v.stoppage !== 'half-time')) return null;
  const actor = readActor(v.actor);
  if (!actor) return null;
  return {
    schemaVersion: M1_SUBSTITUTION_SCHEMA_VERSION,
    commandId: v.commandId, fixtureId: v.fixtureId, teamId: v.teamId,
    elapsedSeconds: v.elapsedSeconds as number, actor, kind: 'substitute-normal',
    outPlayerId: v.outPlayerId, inPlayerId: v.inPlayerId, stoppage: v.stoppage,
  };
}
function sideOf(state: M1SubstitutionState, teamId: string): 'home' | 'away' | null {
  return teamId === state.clock.homeClubId ? 'home' :
    teamId === state.clock.awayClubId ? 'away' : null;
}
function teamFrom(ids: readonly string[], bench: readonly string[]): M1SubstitutionTeam {
  return { active: [...ids], bench: [...bench], removed: [], normalUsed: 0, opportunityTimes: [] };
}

/** Kickoff establishes active/bench from validated synthetic pre-match data. */
export function startM1SubstitutionMatch(
  prematch: unknown, policy: unknown,
): M1SubstitutionResult {
  const start = startM1ControlledMatch(prematch, policy);
  if (!start.ok || !rec(prematch)) return fail('INVALID_PREMATCH');
  const input = prematch as unknown as M1PrematchInput;
  return { ok: true, state: {
    schemaVersion: M1_SUBSTITUTION_SCHEMA_VERSION,
    rulesId: M1_RPL_NORMAL_SUBSTITUTION_RULES_ID,
    clock: start.state.clock, authority: start.state.authority,
    teams: {
      home: teamFrom(input.homeLineup.starters, input.homeLineup.bench),
      away: teamFrom(input.awayLineup.starters, input.awayLineup.bench),
    },
    commands: [],
  } };
}

function apply(
  input: M1PrematchInput, state: M1SubstitutionState,
  candidate: unknown,
): M1SubstitutionResult {
  if (state.clock.status === 'full-time') return fail('MATCH_FINISHED');
  const command = readCommand(candidate);
  if (!command) return fail('INVALID_COMMAND');
  if (command.fixtureId !== state.clock.fixtureId) return fail('WRONG_FIXTURE');
  const side = sideOf(state, command.teamId);
  if (!side) return fail('UNKNOWN_TEAM');
  if (!sameActor(command.actor, state.authority[side].assignedActor)) {
    return fail('UNAUTHORIZED');
  }
  if (command.elapsedSeconds !== state.clock.elapsedSeconds) {
    return fail('COMMAND_CLOCK_MISMATCH');
  }
  const halfTime = command.elapsedSeconds === 2700;
  if ((halfTime && command.stoppage !== 'half-time') ||
      (!halfTime && command.stoppage !== 'referee-authorized')) {
    return fail('NOT_AN_AUTHORIZED_STOPPAGE');
  }
  if (state.commands.some(entry => entry.commandId === command.commandId)) {
    return fail('DUPLICATE_COMMAND');
  }
  if (state.commands.length >= M1_MAX_SUBSTITUTION_RECORDS) return fail('COMMAND_LIMIT');
  const team = state.teams[side];
  if (!team.active.includes(command.outPlayerId)) return fail('UNKNOWN_EXIT');
  if (!team.bench.includes(command.inPlayerId)) return fail('UNAVAILABLE_SUBSTITUTE');
  if (team.normalUsed >= M1_NORMAL_REPLACEMENTS_LIMIT) return fail('FIVE_REPLACEMENTS_USED');
  if (!halfTime &&
      !team.opportunityTimes.includes(command.elapsedSeconds) &&
      team.opportunityTimes.length >= M1_NORMAL_OPPORTUNITY_LIMIT) {
    return fail('THREE_OPPORTUNITIES_USED');
  }
  const players = new Map(input.catalog.players.map(p => [p.id, p]));
  const active = team.active.map(id =>
    id === command.outPlayerId ? command.inPlayerId : id);
  const keepers = active.filter(id => players.get(id)!.primaryPosition === 'GK').length;
  if (keepers !== 1) return fail('INVALID_GOALKEEPER_COUNT');
  const foreign = active.filter(id => players.get(id)!.foreignerForCompetition).length;
  if (foreign > input.rosterRules.maxForeignersOnField) return fail('FOREIGNER_CAP');
  const updated: M1SubstitutionTeam = {
    active, bench: team.bench.filter(id => id !== command.inPlayerId),
    removed: [...team.removed, command.outPlayerId],
    normalUsed: team.normalUsed + 1,
    opportunityTimes: halfTime || team.opportunityTimes.includes(command.elapsedSeconds) ?
      [...team.opportunityTimes] : [...team.opportunityTimes, command.elapsedSeconds],
  };
  return { ok: true, state: {
    ...state, teams: { ...state.teams, [side]: updated },
    commands: [...state.commands, { ...command, sequence: state.commands.length + 1 }],
  } };
}

/** Ignore untrusted save claims; reconstruct all normal substitutions from source. */
function verified(
  prematch: unknown, policy: unknown, unknownState: unknown,
): M1SubstitutionState | null {
  if (!rec(unknownState) || !exact(unknownState, STATE_KEYS) ||
      unknownState.schemaVersion !== M1_SUBSTITUTION_SCHEMA_VERSION ||
      unknownState.rulesId !== M1_RPL_NORMAL_SUBSTITUTION_RULES_ID ||
      !rec(unknownState.clock) || !Array.isArray(unknownState.commands) ||
      unknownState.commands.length > M1_MAX_SUBSTITUTION_RECORDS ||
      !Number.isInteger(unknownState.clock.elapsedSeconds)) return null;
  const end = unknownState.clock.elapsedSeconds as number;
  if (end < 0 || end > M1_CLOCK_END_SECONDS || end % M1_CLOCK_STEP_SECONDS !== 0) return null;
  const initial = startM1SubstitutionMatch(prematch, policy);
  if (!initial.ok) return null;
  const input = prematch as M1PrematchInput;
  let current = initial.state, index = 0;
  for (let now = 0; now <= end; now += M1_CLOCK_STEP_SECONDS) {
    while (index < unknownState.commands.length) {
      const row: unknown = unknownState.commands[index];
      if (!rec(row) || row.elapsedSeconds !== now || row.sequence !== index + 1) break;
      const command: Record<string, unknown> = { ...row };
      delete command.sequence;
      const next = apply(input, current, command);
      if (!next.ok) return null;
      current = next.state;
      index++;
    }
    if (now < end) {
      const next = advanceM1Clock(current.clock);
      if (!next.ok) return null;
      current = { ...current, clock: next.state };
    }
  }
  if (index !== unknownState.commands.length ||
      !sameCanonicalValue(current, unknownState)) return null;
  return current;
}

/** Normal substitution requires referee-authorized stoppage or half-time. */
export function submitM1NormalSubstitution(
  prematch: unknown, policy: unknown, state: unknown, command: unknown,
): M1SubstitutionResult {
  const checked = verified(prematch, policy, state);
  if (!checked) return fail('INVALID_STATE');
  return apply(prematch as M1PrematchInput, checked, command);
}
export function advanceM1SubstitutionMatch(
  prematch: unknown, policy: unknown, state: unknown,
): M1SubstitutionResult {
  const checked = verified(prematch, policy, state);
  if (!checked) return fail('INVALID_STATE');
  const advanced = advanceM1Clock(checked.clock);
  if (!advanced.ok) return fail('INVALID_STATE');
  return { ok: true, state: { ...checked, clock: advanced.state } };
}
export function finishM1SubstitutionMatch(
  prematch: unknown, policy: unknown, state: unknown,
): M1SubstitutionResult {
  let current = verified(prematch, policy, state);
  if (!current) return fail('INVALID_STATE');
  while (current.clock.status !== 'full-time') {
    const advanced = advanceM1SubstitutionMatch(prematch, policy, current);
    if (!advanced.ok) return advanced;
    current = advanced.state;
  }
  return { ok: true, state: current };
}
