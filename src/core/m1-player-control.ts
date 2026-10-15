import { isStableId } from './identifiers.js';
import { sameCanonicalValue } from './canonical-value.js';
import {
  advanceM1ControlledMatch, startM1ControlledMatch, submitM1TacticalCommand,
  type M1ControlledState, type M1RecordedCommand,
} from './m1-control.js';
import { M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput } from './m1-clock.js';
import type { CareerActor } from './command-contracts.js';

/**
 * Versioned individual instruction admission. P1-only, no action engine effects
 * yet. The M1 v3 shot ledger and historical M0 saves are intentionally unchanged.
 */
export const M1_PLAYER_INSTRUCTION_SCHEMA_VERSION = 1 as const;
export const M1_PLAYER_COMMAND_VERSION = 1 as const;
export const M1_MAX_PLAYER_COMMANDS = 64 as const;
export type M1PlayerFocus = 'balanced' | 'attack' | 'defend';
export interface M1PlayerInstruction {
  readonly teamId: string;
  readonly playerId: string;
  readonly focus: M1PlayerFocus;
}
export interface M1PlayerInstructionCommand {
  readonly schemaVersion: typeof M1_PLAYER_COMMAND_VERSION;
  readonly commandId: string;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly elapsedSeconds: number;
  readonly actor: CareerActor;
  readonly kind: 'set-player-focus';
  readonly focus: M1PlayerFocus;
}
export interface M1RecordedPlayerInstruction extends M1PlayerInstructionCommand {
  readonly sequence: number;
}
export interface M1PlayerControlState {
  readonly schemaVersion: typeof M1_PLAYER_INSTRUCTION_SCHEMA_VERSION;
  readonly controlled: M1ControlledState;
  readonly instructions: readonly M1PlayerInstruction[];
  readonly commands: readonly M1RecordedPlayerInstruction[];
}
export type M1PlayerCommandError =
  | 'INVALID_PREMATCH' | 'INVALID_STATE' | 'INVALID_COMMAND'
  | 'WRONG_FIXTURE' | 'UNKNOWN_TEAM' | 'INACTIVE_PLAYER'
  | 'GOALKEEPER' | 'UNAUTHORIZED' | 'COMMAND_CLOCK_MISMATCH'
  | 'DUPLICATE_COMMAND' | 'COMMAND_LIMIT' | 'MATCH_FINISHED';
export type M1PlayerControlResult =
  | Readonly<{ ok: true; state: M1PlayerControlState }>
  | Readonly<{ ok: false; error: M1PlayerCommandError }>;

const RAW_COMMAND_KEYS = [
  'schemaVersion', 'commandId', 'fixtureId', 'teamId', 'playerId',
  'elapsedSeconds', 'actor', 'kind', 'focus',
] as const;
const RAW_STATE_KEYS = ['schemaVersion', 'controlled', 'instructions', 'commands'] as const;
const FOCUS: readonly string[] = ['balanced', 'attack', 'defend'];
const fail = (error: M1PlayerCommandError): M1PlayerControlResult => ({ ok: false, error });
const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const hasKeys = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
function actorFrom(v: unknown): CareerActor | null {
  if (!isRecord(v)) return null;
  if (v.kind === 'player' && hasKeys(v, ['kind'])) return { kind: 'player' };
  if (v.kind === 'staff' && hasKeys(v, ['kind', 'staffId']) && isStableId(v.staffId)) {
    return { kind: 'staff', staffId: v.staffId };
  }
  return null;
}
function sameActor(a: CareerActor, b: CareerActor): boolean {
  return a.kind === b.kind &&
    (a.kind === 'player' || (b.kind === 'staff' && a.staffId === b.staffId));
}
function parseCommand(v: unknown): M1PlayerInstructionCommand | null {
  if (!isRecord(v) || !hasKeys(v, RAW_COMMAND_KEYS) ||
      v.schemaVersion !== M1_PLAYER_COMMAND_VERSION ||
      v.kind !== 'set-player-focus' || !isStableId(v.commandId) ||
      !isStableId(v.fixtureId) || !isStableId(v.teamId) ||
      !isStableId(v.playerId) || !FOCUS.includes(v.focus as string) ||
      !Number.isInteger(v.elapsedSeconds) ||
      (v.elapsedSeconds as number) < 0 ||
      (v.elapsedSeconds as number) >= M1_CLOCK_END_SECONDS ||
      (v.elapsedSeconds as number) % M1_CLOCK_STEP_SECONDS !== 0) return null;
  const actor = actorFrom(v.actor);
  if (!actor) return null;
  return {
    schemaVersion: M1_PLAYER_COMMAND_VERSION, commandId: v.commandId,
    fixtureId: v.fixtureId, teamId: v.teamId, playerId: v.playerId,
    elapsedSeconds: v.elapsedSeconds as number, actor,
    kind: 'set-player-focus', focus: v.focus as M1PlayerFocus,
  };
}
function stripSequence(record: M1RecordedCommand | M1RecordedPlayerInstruction):
  Record<string, unknown> {
  const copy: Record<string, unknown> = { ...record };
  delete copy.sequence;
  return copy;
}
function applyCommand(
  prematch: M1PrematchInput, state: M1PlayerControlState,
  raw: unknown,
): M1PlayerControlResult {
  if (state.controlled.clock.status === 'full-time') return fail('MATCH_FINISHED');
  const command = parseCommand(raw);
  if (!command) return fail('INVALID_COMMAND');
  if (command.fixtureId !== state.controlled.clock.fixtureId) return fail('WRONG_FIXTURE');
  const side = command.teamId === state.controlled.clock.homeClubId ? 'home' :
    command.teamId === state.controlled.clock.awayClubId ? 'away' : null;
  if (side === null) return fail('UNKNOWN_TEAM');
  if (command.elapsedSeconds !== state.controlled.clock.elapsedSeconds) {
    return fail('COMMAND_CLOCK_MISMATCH');
  }
  if (!sameActor(command.actor, state.controlled.authority[side].assignedActor)) {
    return fail('UNAUTHORIZED');
  }
  const lineup = side === 'home' ? prematch.homeLineup : prematch.awayLineup;
  if (!lineup.starters.includes(command.playerId)) return fail('INACTIVE_PLAYER');
  if (prematch.catalog.players.find(p => p.id === command.playerId)?.primaryPosition === 'GK') {
    return fail('GOALKEEPER');
  }
  if (state.commands.some(c => c.commandId === command.commandId) ||
      state.controlled.commands.some(c => c.commandId === command.commandId)) {
    return fail('DUPLICATE_COMMAND');
  }
  if (state.commands.length >= M1_MAX_PLAYER_COMMANDS) return fail('COMMAND_LIMIT');
  const recorded = { ...command, sequence: state.commands.length + 1 };
  const updated: M1PlayerInstruction = {
    teamId: command.teamId, playerId: command.playerId, focus: command.focus,
  };
  return { ok: true, state: {
    ...state,
    instructions: [...state.instructions.filter(x => x.playerId !== command.playerId), updated]
      .sort((a, b) => a.playerId.localeCompare(b.playerId, 'en')),
    commands: [...state.commands, recorded],
  } };
}

/**
 * Admit only trusted baseline and assigned staff policy. The saved authority is
 * never trusted: every player state operation reconstructs the full authorized
 * history from the original prematch and the policy supplied by its caller.
 */
export function startM1PlayerControl(
  prematch: unknown, policy: unknown,
): M1PlayerControlResult {
  const started = startM1ControlledMatch(prematch, policy);
  if (!started.ok) return fail('INVALID_PREMATCH');
  return { ok: true, state: {
    schemaVersion: M1_PLAYER_INSTRUCTION_SCHEMA_VERSION,
    controlled: started.state, instructions: [], commands: [],
  } };
}

/** Verify every prior tactical and individual command, including authority. */
function readState(
  prematch: unknown, policy: unknown, candidate: unknown,
): M1PlayerControlState | null {
  if (!isRecord(candidate) || !hasKeys(candidate, RAW_STATE_KEYS) ||
      candidate.schemaVersion !== M1_PLAYER_INSTRUCTION_SCHEMA_VERSION ||
      !isRecord(candidate.controlled) ||
      !isRecord(candidate.controlled.clock) ||
      !Number.isInteger(candidate.controlled.clock.elapsedSeconds) ||
      !Array.isArray(candidate.controlled.commands) ||
      !Array.isArray(candidate.commands) ||
      candidate.controlled.commands.length > 64 ||
      candidate.commands.length > M1_MAX_PLAYER_COMMANDS) return null;
  const admitted = startM1PlayerControl(prematch, policy);
  if (!admitted.ok) return null;
  const trustedPrematch = prematch as M1PrematchInput;
  const end = candidate.controlled.clock.elapsedSeconds as number;
  if (end < 0 || end > M1_CLOCK_END_SECONDS || end % M1_CLOCK_STEP_SECONDS !== 0) {
    return null;
  }
  let current = admitted.state, tacticalIndex = 0, playerIndex = 0;
  for (let now = 0; now <= end; now += M1_CLOCK_STEP_SECONDS) {
    while (tacticalIndex < candidate.controlled.commands.length) {
      const raw: unknown = candidate.controlled.commands[tacticalIndex];
      if (!isRecord(raw) || raw.elapsedSeconds !== now ||
          raw.sequence !== tacticalIndex + 1) break;
      const result = submitM1TacticalCommand(current.controlled,
        stripSequence(raw as unknown as M1RecordedCommand));
      if (!result.ok) return null;
      current = { ...current, controlled: result.state };
      tacticalIndex++;
    }
    while (playerIndex < candidate.commands.length) {
      const raw: unknown = candidate.commands[playerIndex];
      if (!isRecord(raw) || raw.elapsedSeconds !== now || raw.sequence !== playerIndex + 1) break;
      const next = applyCommand(trustedPrematch, current,
        stripSequence(raw as unknown as M1RecordedPlayerInstruction));
      if (!next.ok) return null;
      current = next.state;
      playerIndex++;
    }
    if (now < end) {
      const next = advanceM1ControlledMatch(current.controlled);
      if (!next.ok) return null;
      current = { ...current, controlled: next.state };
    }
  }
  if (tacticalIndex !== candidate.controlled.commands.length ||
      playerIndex !== candidate.commands.length ||
      !sameCanonicalValue(current, candidate)) return null;
  return current;
}

/** A new individual instruction is applied at the current paused boundary. */
export function submitM1PlayerInstruction(
  prematch: unknown, policy: unknown, state: unknown, command: unknown,
): M1PlayerControlResult {
  const checked = readState(prematch, policy, state);
  if (!checked) return fail('INVALID_STATE');
  return applyCommand(prematch as M1PrematchInput, checked, command);
}

/** Pausing simply retains this canonical JSON-serializable state. */
export function advanceM1PlayerControl(
  prematch: unknown, policy: unknown, state: unknown,
): M1PlayerControlResult {
  const checked = readState(prematch, policy, state);
  if (!checked) return fail('INVALID_STATE');
  const next = advanceM1ControlledMatch(checked.controlled);
  if (!next.ok) return fail('INVALID_STATE');
  return { ok: true, state: { ...checked, controlled: next.state } };
}

/** Uses exactly the same transition as interactive single-stepping. */
export function finishM1PlayerControl(
  prematch: unknown, policy: unknown, state: unknown,
): M1PlayerControlResult {
  let current = readState(prematch, policy, state);
  if (!current) return fail('INVALID_STATE');
  while (current.controlled.clock.status !== 'full-time') {
    const next = advanceM1PlayerControl(prematch, policy, current);
    if (!next.ok) return next;
    current = next.state;
  }
  return { ok: true, state: current };
}
