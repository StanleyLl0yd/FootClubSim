import { isStableId } from './identifiers.js';
import type { MatchLineup } from './model.js';
import { validateTacticalPlan, type TacticalPlan } from './tactics.js';

/**
 * M0 command validation boundary only. No game state is changed by this module.
 * These are future M2 command inputs, not playable match or staff AI handlers.
 */
export const CAREER_COMMAND_VERSION = 1 as const;
export type MatchResponsibility = 'lineup' | 'tactics';
export type CareerActor =
  | Readonly<{ kind: 'player' }>
  | Readonly<{ kind: 'staff'; staffId: string }>;

export type CareerCommand =
  | Readonly<{
      schemaVersion: 1;
      commandId: string;
      careerId: string;
      expectedRevision: number;
      actor: CareerActor;
      kind: 'set-lineup';
      payload: MatchLineup;
    }>
  | Readonly<{
      schemaVersion: 1;
      commandId: string;
      careerId: string;
      expectedRevision: number;
      actor: CareerActor;
      kind: 'set-tactics';
      payload: TacticalPlan;
    }>;

/**
 * Internal, already-validated career context. Missing assignment means the
 * human player remains the authority; never implicitly delegate a task.
 */
export interface CommandValidationContext {
  readonly careerId: string;
  readonly revision: number;
  readonly controlledClubId: string;
  readonly assignedActors: Readonly<Partial<Record<MatchResponsibility, CareerActor>>>;
  readonly availableStaffIds: ReadonlySet<string>;
  readonly appliedCommandIds: ReadonlySet<string>;
}

export type CareerCommandErrorCode =
  'INVALID_COMMAND' | 'INVALID_ID' | 'INVALID_REVISION' |
  'INVALID_ACTOR' | 'INVALID_PAYLOAD' | 'WRONG_CAREER' |
  'STALE_REVISION' | 'DUPLICATE_COMMAND' | 'UNAUTHORIZED' |
  'UNAVAILABLE_STAFF';

export type CareerCommandValidation =
  | Readonly<{ ok: true; command: CareerCommand }>
  | Readonly<{ ok: false; error: CareerCommandErrorCode }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const keysMatch = (value: Record<string, unknown>, names: readonly string[]): boolean =>
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));

function readActor(value: unknown): CareerActor | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'player' && keysMatch(value, ['kind'])) {
    return { kind: 'player' };
  }
  if (value.kind === 'staff' && keysMatch(value, ['kind', 'staffId']) &&
      isStableId(value.staffId)) {
    return { kind: 'staff', staffId: value.staffId };
  }
  return null;
}

function readLineup(value: unknown, clubId: string): MatchLineup | null {
  if (!isRecord(value) || !keysMatch(value, ['clubId', 'starters', 'bench']) ||
      value.clubId !== clubId || !Array.isArray(value.starters) ||
      value.starters.length !== 11 || !Array.isArray(value.bench) ||
      value.bench.length > 12) return null;

  const players: string[] = [];
  for (const id of value.starters) {
    if (!isStableId(id)) return null;
    players.push(id);
  }
  const bench: string[] = [];
  for (const id of value.bench) {
    if (!isStableId(id)) return null;
    bench.push(id);
  }
  if (new Set([...players, ...bench]).size !== players.length + bench.length) return null;
  return { clubId, starters: players, bench };
}

function readTactics(value: unknown, clubId: string): TacticalPlan | null {
  if (!isRecord(value) || !keysMatch(value, [
    'schemaVersion', 'clubId', 'formation', 'mentality', 'pressing',
    'compactness', 'defensiveLine', 'passingRisk', 'tempo',
  ]) || validateTacticalPlan(value as unknown as TacticalPlan, clubId).length) return null;

  return {
    schemaVersion: 1, clubId, formation: value.formation as string,
    mentality: value.mentality as number, pressing: value.pressing as number,
    compactness: value.compactness as number, defensiveLine: value.defensiveLine as number,
    passingRisk: value.passingRisk as number, tempo: value.tempo as number,
  };
}

/**
 * Validates one future game command against revision and delegated authority.
 * Context is canonical application state, not untrusted worker transport.
 * A successful validation is NOT authorization to commit without subsequent
 * roster/registration/budget checks and an atomic, idempotent transaction.
 */
export function validateCareerCommand(
  candidate: unknown, context: CommandValidationContext,
): CareerCommandValidation {
  if (!isRecord(candidate) || !keysMatch(candidate, [
    'schemaVersion', 'commandId', 'careerId', 'expectedRevision',
    'actor', 'kind', 'payload',
  ]) || candidate.schemaVersion !== CAREER_COMMAND_VERSION ||
      (candidate.kind !== 'set-lineup' && candidate.kind !== 'set-tactics')) {
    return { ok: false, error: 'INVALID_COMMAND' };
  }
  if (!isStableId(candidate.commandId) || !isStableId(candidate.careerId)) {
    return { ok: false, error: 'INVALID_ID' };
  }
  if (!Number.isSafeInteger(candidate.expectedRevision) || (candidate.expectedRevision as number) < 0) {
    return { ok: false, error: 'INVALID_REVISION' };
  }
  const actor = readActor(candidate.actor);
  if (!actor) return { ok: false, error: 'INVALID_ACTOR' };
  if (candidate.careerId !== context.careerId) return { ok: false, error: 'WRONG_CAREER' };
  if (candidate.expectedRevision !== context.revision) {
    return { ok: false, error: 'STALE_REVISION' };
  }
  if (context.appliedCommandIds.has(candidate.commandId)) {
    return { ok: false, error: 'DUPLICATE_COMMAND' };
  }

  const responsibility: MatchResponsibility =
    candidate.kind === 'set-lineup' ? 'lineup' : 'tactics';
  const assigned = context.assignedActors[responsibility] ?? { kind: 'player' };
  if (assigned.kind !== actor.kind ||
      (assigned.kind === 'staff' && (actor.kind !== 'staff' || actor.staffId !== assigned.staffId))) {
    return { ok: false, error: 'UNAUTHORIZED' };
  }
  if (actor.kind === 'staff' && !context.availableStaffIds.has(actor.staffId)) {
    return { ok: false, error: 'UNAVAILABLE_STAFF' };
  }

  if (candidate.kind === 'set-lineup') {
    const payload = readLineup(candidate.payload, context.controlledClubId);
    return payload
      ? { ok: true, command: {
        schemaVersion: CAREER_COMMAND_VERSION, commandId: candidate.commandId,
        careerId: candidate.careerId, expectedRevision: candidate.expectedRevision as number,
        actor, kind: 'set-lineup', payload,
      } }
      : { ok: false, error: 'INVALID_PAYLOAD' };
  }
  const payload = readTactics(candidate.payload, context.controlledClubId);
  return payload
    ? { ok: true, command: {
      schemaVersion: CAREER_COMMAND_VERSION, commandId: candidate.commandId,
      careerId: candidate.careerId, expectedRevision: candidate.expectedRevision as number,
      actor, kind: 'set-tactics', payload,
    } }
    : { ok: false, error: 'INVALID_PAYLOAD' };
}
