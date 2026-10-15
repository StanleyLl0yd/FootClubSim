import { isStableId } from './identifiers.js';
import type { CareerActor } from './command-contracts.js';
import {
  advanceM1Clock, startM1Clock, type M1ClockState,
  M1_CLOCK_END_SECONDS, M1_CLOCK_SCHEMA_VERSION, M1_CLOCK_STEP_SECONDS,
  M1_ENGINE_VERSION,
} from './m1-clock.js';
import type { MatchLedgerReport } from './match-contracts.js';
import { validateTacticalPlan, type TacticalPlan } from './tactics.js';

/**
 * P1 control protocol is deliberately separate from the M0 event ledger and
 * the M1 clock v2 events. This module does NOT simulate football chances.
 */
export const M1_CONTROL_SCHEMA_VERSION = 1 as const;
export const M1_TACTICS_COMMAND_VERSION = 1 as const;
export const M1_MAX_TACTICAL_COMMANDS = 64 as const;
const TACTICS_KEYS = [
  'schemaVersion', 'clubId', 'formation', 'mentality', 'pressing',
  'compactness', 'defensiveLine', 'passingRisk', 'tempo',
] as const;
const CONTROL_KEYS = ['assignedActor', 'availableStaffIds'] as const;
const SIDES_KEYS = ['home', 'away'] as const;
const STATE_KEYS = [
  'schemaVersion', 'clock', 'initialTactics', 'tactics', 'authority', 'commands',
] as const;
const COMMAND_KEYS = [
  'schemaVersion', 'commandId', 'fixtureId', 'teamId', 'elapsedSeconds',
  'actor', 'kind', 'plan',
] as const;
const RECORDED_KEYS = [...COMMAND_KEYS, 'sequence'] as const;

export interface M1TeamAuthority {
  /** Actor assigned to tactical decisions. No implicit staff access. */
  readonly assignedActor: CareerActor;
  readonly availableStaffIds: readonly string[];
}
export interface M1Sides<T> {
  readonly home: T;
  readonly away: T;
}
export interface M1TacticsCommand {
  readonly schemaVersion: typeof M1_TACTICS_COMMAND_VERSION;
  readonly commandId: string;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly elapsedSeconds: number;
  readonly actor: CareerActor;
  readonly kind: 'set-tactics';
  readonly plan: TacticalPlan;
}
export interface M1RecordedCommand extends M1TacticsCommand {
  readonly sequence: number;
}
export interface M1ControlledState {
  readonly schemaVersion: typeof M1_CONTROL_SCHEMA_VERSION;
  readonly clock: M1ClockState;
  /** Original snapshots are saved so continuation can replay commands. */
  readonly initialTactics: M1Sides<TacticalPlan>;
  readonly tactics: M1Sides<TacticalPlan>;
  readonly authority: M1Sides<M1TeamAuthority>;
  readonly commands: readonly M1RecordedCommand[];
}
export type M1ControlError =
  | 'INVALID_CONTROL_CONFIG' | 'INVALID_CONTROL_STATE' | 'INVALID_COMMAND'
  | 'WRONG_FIXTURE' | 'UNKNOWN_TEAM' | 'UNAUTHORIZED'
  | 'COMMAND_CLOCK_MISMATCH' | 'MATCH_FINISHED' | 'DUPLICATE_COMMAND'
  | 'COMMAND_LIMIT';
export type M1ControlResult =
  | Readonly<{ ok: true; state: M1ControlledState; report: MatchLedgerReport | null }>
  | Readonly<{ ok: false; error: M1ControlError }>;

const fail = (error: M1ControlError): M1ControlResult => ({ ok: false, error });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keysMatch = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));

function readActor(candidate: unknown): CareerActor | null {
  if (!isRecord(candidate)) return null;
  if (candidate.kind === 'player' && keysMatch(candidate, ['kind'])) return { kind: 'player' };
  if (candidate.kind === 'staff' && keysMatch(candidate, ['kind', 'staffId']) &&
      isStableId(candidate.staffId)) {
    return { kind: 'staff', staffId: candidate.staffId };
  }
  return null;
}
function sameActor(a: CareerActor, b: CareerActor): boolean {
  return a.kind === b.kind && (a.kind === 'player' ||
    (b.kind === 'staff' && a.staffId === b.staffId));
}
function readAuthority(candidate: unknown): M1TeamAuthority | null {
  if (!isRecord(candidate) || !keysMatch(candidate, CONTROL_KEYS) ||
      !Array.isArray(candidate.availableStaffIds) ||
      candidate.availableStaffIds.length > 32) return null;
  const assignedActor = readActor(candidate.assignedActor);
  if (!assignedActor) return null;
  const availableStaffIds: string[] = [];
  for (const id of candidate.availableStaffIds) {
    if (!isStableId(id) || availableStaffIds.includes(id)) return null;
    availableStaffIds.push(id);
  }
  if (assignedActor.kind === 'staff' && !availableStaffIds.includes(assignedActor.staffId)) {
    return null;
  }
  return { assignedActor, availableStaffIds };
}
function readPlan(candidate: unknown, expectedClubId: string): TacticalPlan | null {
  if (!isRecord(candidate) || !keysMatch(candidate, TACTICS_KEYS) ||
      validateTacticalPlan(candidate as unknown as TacticalPlan, expectedClubId).length) return null;
  return {
    schemaVersion: 1, clubId: expectedClubId,
    formation: candidate.formation as string, mentality: candidate.mentality as number,
    pressing: candidate.pressing as number, compactness: candidate.compactness as number,
    defensiveLine: candidate.defensiveLine as number,
    passingRisk: candidate.passingRisk as number, tempo: candidate.tempo as number,
  };
}
function readSides<T>(candidate: unknown, read: (value: unknown, side: 'home' | 'away') => T | null):
  M1Sides<T> | null {
  if (!isRecord(candidate) || !keysMatch(candidate, SIDES_KEYS)) return null;
  const home = read(candidate.home, 'home');
  const away = read(candidate.away, 'away');
  return home !== null && away !== null ? { home, away } : null;
}
function readCommand(candidate: unknown): M1TacticsCommand | null {
  if (!isRecord(candidate) || !keysMatch(candidate, COMMAND_KEYS) ||
      candidate.schemaVersion !== M1_TACTICS_COMMAND_VERSION ||
      candidate.kind !== 'set-tactics' || !isStableId(candidate.commandId) ||
      !isStableId(candidate.fixtureId) || !isStableId(candidate.teamId) ||
      !Number.isInteger(candidate.elapsedSeconds) || (candidate.elapsedSeconds as number) < 0 ||
      (candidate.elapsedSeconds as number) >= M1_CLOCK_END_SECONDS ||
      (candidate.elapsedSeconds as number) % M1_CLOCK_STEP_SECONDS !== 0) return null;
  const actor = readActor(candidate.actor);
  if (!actor) return null;
  const plan = readPlan(candidate.plan, candidate.teamId as string);
  if (!plan) return null;
  return {
    schemaVersion: M1_TACTICS_COMMAND_VERSION,
    commandId: candidate.commandId, fixtureId: candidate.fixtureId,
    teamId: candidate.teamId, elapsedSeconds: candidate.elapsedSeconds as number,
    actor, kind: 'set-tactics', plan,
  };
}
function sideOf(state: M1ControlledState, id: string): 'home' | 'away' | null {
  if (id === state.clock.homeClubId) return 'home';
  if (id === state.clock.awayClubId) return 'away';
  return null;
}
function copyClock(clock: M1ClockState): M1ClockState {
  return { ...clock, events: clock.events.map(event => ({ ...event })) };
}
function cloneCommand(command: M1RecordedCommand): M1RecordedCommand {
  return { ...command, actor: { ...command.actor }, plan: { ...command.plan } };
}

/**
 * Validate serialized state by replaying the entire admitted command history
 * against its initial tactics and frozen authority, not just its last result.
 * This detects inconsistent saves but is NOT cryptographic authentication.
 */
function readState(value: unknown): M1ControlledState | null {
  if (!isRecord(value) || !keysMatch(value, STATE_KEYS) ||
      value.schemaVersion !== M1_CONTROL_SCHEMA_VERSION ||
      !isRecord(value.clock) || value.clock.schemaVersion !== M1_CLOCK_SCHEMA_VERSION ||
      value.clock.engineVersion !== M1_ENGINE_VERSION ||
      !Array.isArray(value.commands) ||
      value.commands.length > M1_MAX_TACTICAL_COMMANDS) return null;
  const verifiedClock = advanceM1Clock(value.clock);
  if (!verifiedClock.ok) return null;
  // The clock validator has checked the full canonical event path.
  const clock = copyClock(value.clock as unknown as M1ClockState);
  const initialTactics = readSides(value.initialTactics, (candidate, side) =>
    readPlan(candidate, side === 'home' ? clock.homeClubId : clock.awayClubId));
  const tactics = readSides(value.tactics, (candidate, side) =>
    readPlan(candidate, side === 'home' ? clock.homeClubId : clock.awayClubId));
  const authority = readSides(value.authority, candidate => readAuthority(candidate));
  if (!initialTactics || !tactics || !authority) return null;
  let current: M1Sides<TacticalPlan> = { ...initialTactics };
  const state: M1ControlledState = {
    schemaVersion: M1_CONTROL_SCHEMA_VERSION, clock,
    initialTactics, tactics, authority, commands: [],
  };
  const commands: M1RecordedCommand[] = [];
  const seen = new Set<string>();
  let previousTime = 0;
  for (let i = 0; i < value.commands.length; i++) {
    const raw: unknown = value.commands[i];
    if (!isRecord(raw) || !keysMatch(raw, RECORDED_KEYS) || raw.sequence !== i + 1) return null;
    const candidate: Record<string, unknown> = { ...raw };
    delete candidate.sequence;
    const command = readCommand(candidate);
    if (!command || command.fixtureId !== clock.fixtureId ||
        command.elapsedSeconds > clock.elapsedSeconds ||
        command.elapsedSeconds < previousTime || seen.has(command.commandId)) return null;
    const side = sideOf(state, command.teamId);
    if (side === null || !sameActor(command.actor, authority[side].assignedActor)) return null;
    previousTime = command.elapsedSeconds;
    seen.add(command.commandId);
    current = { ...current, [side]: command.plan };
    commands.push({ ...command, sequence: i + 1 });
  }
  if (SIDES_KEYS.some(side =>
    TACTICS_KEYS.some(key => current[side][key] !== tactics[side][key]))) return null;
  return { ...state, tactics: current, commands };
}

/** Initialize two trusted tactical authority assignments at 0 virtual seconds. */
export function startM1ControlledMatch(prematch: unknown, policy: unknown): M1ControlResult {
  const start = startM1Clock(prematch);
  if (!start.ok || !isRecord(prematch)) return fail('INVALID_CONTROL_CONFIG');
  const authority = readSides(policy, candidate => readAuthority(candidate));
  const initialTactics = readSides(
    { home: prematch.homeTactics, away: prematch.awayTactics },
    (candidate, side) => readPlan(candidate,
      side === 'home' ? start.state.homeClubId : start.state.awayClubId),
  );
  if (!authority || !initialTactics) return fail('INVALID_CONTROL_CONFIG');
  return {
    ok: true,
    state: {
      schemaVersion: M1_CONTROL_SCHEMA_VERSION,
      clock: copyClock(start.state),
      initialTactics, tactics: { ...initialTactics }, authority, commands: [],
    },
    report: null,
  };
}

/** Admit a tactical order only at the current paused virtual-time checkpoint. */
export function submitM1TacticalCommand(snapshot: unknown, candidate: unknown): M1ControlResult {
  const state = readState(snapshot);
  if (!state) return fail('INVALID_CONTROL_STATE');
  if (state.clock.status === 'full-time') return fail('MATCH_FINISHED');
  const command = readCommand(candidate);
  if (!command) return fail('INVALID_COMMAND');
  if (command.fixtureId !== state.clock.fixtureId) return fail('WRONG_FIXTURE');
  const side = sideOf(state, command.teamId);
  if (side === null) return fail('UNKNOWN_TEAM');
  if (command.elapsedSeconds !== state.clock.elapsedSeconds) return fail('COMMAND_CLOCK_MISMATCH');
  if (!sameActor(command.actor, state.authority[side].assignedActor)) return fail('UNAUTHORIZED');
  if (state.commands.some(entry => entry.commandId === command.commandId)) {
    return fail('DUPLICATE_COMMAND');
  }
  if (state.commands.length >= M1_MAX_TACTICAL_COMMANDS) return fail('COMMAND_LIMIT');
  const accepted: M1RecordedCommand = { ...command, sequence: state.commands.length + 1 };
  return {
    ok: true,
    state: {
      ...state,
      tactics: { ...state.tactics, [side]: { ...command.plan } },
      commands: [...state.commands, cloneCommand(accepted)],
    },
    report: null,
  };
}

/** Advance one canonical M1 clock step; accepted tactics apply only afterwards. */
export function advanceM1ControlledMatch(snapshot: unknown): M1ControlResult {
  const state = readState(snapshot);
  if (!state) return fail('INVALID_CONTROL_STATE');
  const next = advanceM1Clock(state.clock);
  if (!next.ok) return fail('INVALID_CONTROL_STATE');
  return { ok: true, state: { ...state, clock: copyClock(next.state) }, report: next.report };
}

/** Fast forward uses exactly the same step function, no private clock shortcut. */
export function finishM1ControlledMatch(snapshot: unknown): M1ControlResult {
  let current = readState(snapshot);
  if (!current) return fail('INVALID_CONTROL_STATE');
  let report: MatchLedgerReport | null = null;
  for (let i = 0; i < M1_CLOCK_END_SECONDS / M1_CLOCK_STEP_SECONDS; i++) {
    if (current.clock.status === 'full-time') break;
    const next = advanceM1ControlledMatch(current);
    if (!next.ok) return next;
    current = next.state;
    report = next.report;
  }
  if (report === null) {
    const completed = advanceM1Clock(current.clock);
    if (!completed.ok) return fail('INVALID_CONTROL_STATE');
    report = completed.report;
  }
  return { ok: true, state: current, report };
}
