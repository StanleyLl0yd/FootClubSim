import { sameCanonicalValue } from './canonical-value.js';
import { isStableId } from './identifiers.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput }
  from './m1-clock.js';
import { admitM1OffFieldMedicalReturn, type M1OffFieldReturn,
  type M1MedicalReturnError } from './m1-medical-return.js';
import { M1_V7_EVENT_SCHEMA_VERSION, simulateM1V7Phases,
  type M1V7Event } from './m1-v7-adjudications.js';

/**
 * Read-only P3 medical presence replay over a complete *existing* v7 match.
 * This does NOT make v6/v7 shot generation medical-aware: if a precomputed
 * event names a temporarily absent player it fails closed, not rerolls.
 * The controller must authenticate actual treatment, restart and referee signals.
 */
export const M1_V7_TEMPORARY_MEDICAL_SCHEMA_VERSION = 1 as const;
const MAX_ACTIONS = M1_CLOCK_MAX_EVENTS * 2;
interface MedicalBase {
  readonly schemaVersion: typeof M1_V7_TEMPORARY_MEDICAL_SCHEMA_VERSION;
  readonly id: string;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly elapsedSeconds: number;
}
export type M1V7TemporaryMedicalAction =
  | (MedicalBase & Readonly<{
    kind: 'treatment-exit';
    reason: M1OffFieldReturn['reason'];
    restartAtRunningSeconds: number;
  }>)
  | (MedicalBase & Readonly<{
    kind: 'treatment-return';
    returnContext: M1OffFieldReturn['returnContext'];
    ballInPlay: boolean;
    entryBoundary: M1OffFieldReturn['entryBoundary'];
    refereeSignalId: string;
  }>);
export interface M1V7TemporaryMedicalReplay {
  readonly schemaVersion: typeof M1_V7_TEMPORARY_MEDICAL_SCHEMA_VERSION;
  readonly v7EventSchemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
  readonly status: 'MEDICAL_PRESENCE_VERIFIED_NO_SHOT_REGENERATION';
  readonly fixtureId: string;
  readonly actions: readonly M1V7TemporaryMedicalAction[];
  readonly offFieldAtFullTime: readonly string[];
  readonly onFieldAtFullTime: Readonly<{ home: readonly string[]; away: readonly string[] }>;
}
export type M1V7TemporaryMedicalError =
  'INVALID_MATCH_SOURCE' | 'INVALID_ACTIONS' | 'DUPLICATE_ID' |
  'WRONG_FIXTURE' | 'WRONG_TEAM' | 'NOT_ON_FIELD' | 'ALREADY_ABSENT' |
  'NOT_ABSENT' | 'EXCEPTION_RULING_REQUIRED' | 'PARTICIPANT_OFF_FIELD' |
  'MEDICAL_RETURN_REJECTED';
export type M1V7TemporaryMedicalResult =
  | Readonly<{ ok: true; replay: M1V7TemporaryMedicalReplay }>
  | Readonly<{ ok: false; error: M1V7TemporaryMedicalError;
    medicalError?: M1MedicalReturnError }>;

const BASE = ['schemaVersion', 'id', 'fixtureId', 'teamId', 'playerId',
  'elapsedSeconds'] as const;
const EXIT = [...BASE, 'kind', 'reason', 'restartAtRunningSeconds'];
const RETURN = [...BASE, 'kind', 'returnContext', 'ballInPlay',
  'entryBoundary', 'refereeSignalId'];
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(v).length === fields.length && fields.every(k => Object.hasOwn(v, k));
const fail = (error: M1V7TemporaryMedicalError,
  medicalError?: M1MedicalReturnError): M1V7TemporaryMedicalResult =>
  medicalError ? { ok: false, error, medicalError } : { ok: false, error };
const sortIds = (items: Iterable<string>): string[] => [...items].sort();

/** Shared strict validator for versioned treatment actions; no source authentication. */
export function readM1V7TemporaryMedicalAction(raw: unknown):
  M1V7TemporaryMedicalAction | null {
  if (!record(raw) ||
      !exact(raw, raw.kind === 'treatment-exit' ? EXIT :
        raw.kind === 'treatment-return' ? RETURN : []) ||
      raw.schemaVersion !== M1_V7_TEMPORARY_MEDICAL_SCHEMA_VERSION ||
      !isStableId(raw.id) || !isStableId(raw.fixtureId) ||
      !isStableId(raw.teamId) || !isStableId(raw.playerId) ||
      !Number.isSafeInteger(raw.elapsedSeconds) ||
      (raw.elapsedSeconds as number) < 0 ||
      (raw.elapsedSeconds as number) >= 5400 ||
      (raw.elapsedSeconds as number) % M1_CLOCK_STEP_SECONDS !== 0) return null;
  if (raw.kind === 'treatment-exit') {
    if (!['injury-stopped-play', 'medical-staff-entered',
      'requested-on-field-attention'].includes(raw.reason as string) ||
      !Number.isSafeInteger(raw.restartAtRunningSeconds) ||
      (raw.restartAtRunningSeconds as number) < (raw.elapsedSeconds as number) ||
      (raw.restartAtRunningSeconds as number) >= 5400) return null;
  } else if (!['running-clock', 'half-time'].includes(raw.returnContext as string) ||
      typeof raw.ballInPlay !== 'boolean' ||
      !['touchline', 'goal-line'].includes(raw.entryBoundary as string) ||
      !isStableId(raw.refereeSignalId)) return null;
  return raw as unknown as M1V7TemporaryMedicalAction;
}

/** Recompute v7 and replay only strictly ordered, independently asserted treatment actions. */
export function replayM1V7TemporaryMedicalPresence(
  prematch: unknown, policy: unknown, commands: unknown,
  decisions: unknown, medicalActions: unknown,
): M1V7TemporaryMedicalResult {
  const v7 = simulateM1V7Phases(prematch, policy, commands, decisions);
  if (!v7.ok) return fail('INVALID_MATCH_SOURCE');
  if (!Array.isArray(medicalActions) || medicalActions.length > MAX_ACTIONS) {
    return fail('INVALID_ACTIONS');
  }
  const input = prematch as M1PrematchInput;
  const existing = new Set<string>();
  for (const event of v7.events) {
    if (event.type === 'adjudication') existing.add(event.decision.decisionId);
    else if (event.source.type === 'availability') {
      const action = event.source.entry.action;
      existing.add(action.kind === 'substitute-normal' ? action.commandId : action.id);
    }
  }
  const actions: M1V7TemporaryMedicalAction[] = [];
  let last = -1;
  for (const raw of medicalActions) {
    const action = readM1V7TemporaryMedicalAction(raw);
    if (!action) return fail('INVALID_ACTIONS');
    if (existing.has(action.id)) return fail('DUPLICATE_ID');
    if (action.elapsedSeconds <= last) return fail('INVALID_ACTIONS');
    if (action.fixtureId !== input.fixture.id) return fail('WRONG_FIXTURE');
    if (action.teamId !== input.fixture.homeClubId &&
        action.teamId !== input.fixture.awayClubId) return fail('WRONG_TEAM');
    existing.add(action.id);
    last = action.elapsedSeconds;
    actions.push({ ...action });
  }
  const active = {
    home: new Set(input.homeLineup.starters),
    away: new Set(input.awayLineup.starters),
  };
  const starters = new Set([...input.homeLineup.starters, ...input.awayLineup.starters]);
  const positions = new Map(input.catalog.players.map(p => [p.id, p.primaryPosition]));
  const absent = new Map<string, Extract<M1V7TemporaryMedicalAction,
    { kind: 'treatment-exit' }>>();
  let index = 0, medicalIndex = 0;
  function applyAvailability(event: M1V7Event): M1V7TemporaryMedicalError | null {
    if (event.type !== 'v6-event' || event.source.type !== 'availability') {
      return 'INVALID_MATCH_SOURCE';
    }
    const entry = event.source.entry;
    const action = entry.action;
    const side = action.teamId === input.fixture.homeClubId ? 'home' : 'away';
    if (action.kind === 'substitute-normal') {
      if (absent.has(action.outPlayerId)) return 'EXCEPTION_RULING_REQUIRED';
      active[side].delete(action.outPlayerId);
      active[side].add(action.inPlayerId);
    } else if (entry.effect !== 'yellow') {
      if (absent.has(action.playerId)) return 'EXCEPTION_RULING_REQUIRED';
      active[side].delete(action.playerId);
    }
    return null;
  }
  for (let phase = 0; phase < M1_CLOCK_MAX_EVENTS; phase++) {
    const second = phase * M1_CLOCK_STEP_SECONDS;
    while (true) {
      const pending = v7.events[index];
      if (!pending || pending.type !== 'v6-event' ||
          pending.elapsedSeconds !== second || pending.source.type !== 'availability') break;
      const rejected = applyAvailability(pending);
      if (rejected) return fail(rejected);
      index++;
    }
    if (actions[medicalIndex]?.elapsedSeconds === second) {
      const action = actions[medicalIndex]!;
      const side = action.teamId === input.fixture.homeClubId ? 'home' : 'away';
      if (!active[side].has(action.playerId)) return fail('NOT_ON_FIELD');
      if (action.kind === 'treatment-exit') {
        if (!starters.has(action.playerId) || positions.get(action.playerId) === 'GK') {
          return fail('EXCEPTION_RULING_REQUIRED');
        }
        if (absent.has(action.playerId)) return fail('ALREADY_ABSENT');
        absent.set(action.playerId, action);
      } else {
        const exited = absent.get(action.playerId);
        if (!exited) return fail('NOT_ABSENT');
        const decision: M1OffFieldReturn = {
          schemaVersion: 1, fixtureId: action.fixtureId,
          teamId: action.teamId, playerId: action.playerId, reason: exited.reason,
          offFieldAtRunningSeconds: exited.elapsedSeconds,
          restartAtRunningSeconds: exited.restartAtRunningSeconds,
          requestedAtRunningSeconds: action.elapsedSeconds,
          returnContext: action.returnContext, ballInPlay: action.ballInPlay,
          entryBoundary: action.entryBoundary, refereeSignalId: action.refereeSignalId,
        };
        const admitted = admitM1OffFieldMedicalReturn(input, decision);
        if (!admitted.ok) return fail('MEDICAL_RETURN_REJECTED', admitted.error);
        absent.delete(action.playerId);
      }
      medicalIndex++;
    }
    if (v7.events[index]?.type === 'adjudication' &&
        v7.events[index]?.elapsedSeconds === second) {
      const event = v7.events[index]!;
      if (event.type !== 'adjudication') return fail('INVALID_MATCH_SOURCE');
      if (absent.has(event.decision.playerId)) return fail('PARTICIPANT_OFF_FIELD');
      index++;
    }
    if (v7.events[index]?.type === 'v6-event' &&
        v7.events[index]?.elapsedSeconds === second + M1_CLOCK_STEP_SECONDS - 1) {
      const event = v7.events[index]!;
      if (event.type !== 'v6-event' || event.source.type !== 'shot') {
        return fail('INVALID_MATCH_SOURCE');
      }
      if (absent.has(event.source.playerId)) return fail('PARTICIPANT_OFF_FIELD');
      index++;
    }
  }
  const ending = v7.events[index];
  if (medicalIndex !== actions.length || index !== v7.events.length - 1 ||
      !ending || ending.type !== 'v6-event' ||
      ending.source.type !== 'full-time') return fail('INVALID_MATCH_SOURCE');
  return { ok: true, replay: {
    schemaVersion: M1_V7_TEMPORARY_MEDICAL_SCHEMA_VERSION,
    v7EventSchemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
    status: 'MEDICAL_PRESENCE_VERIFIED_NO_SHOT_REGENERATION',
    fixtureId: input.fixture.id, actions,
    offFieldAtFullTime: sortIds(absent.keys()),
    onFieldAtFullTime: {
      home: sortIds([...active.home].filter(id => !absent.has(id))),
      away: sortIds([...active.away].filter(id => !absent.has(id))),
    },
  } };
}

/** A caller-held report is never trusted: recompute all independently supplied inputs. */
export function verifyM1V7TemporaryMedicalPresence(
  prematch: unknown, policy: unknown, commands: unknown,
  decisions: unknown, medicalActions: unknown, candidate: unknown,
): boolean {
  const result = replayM1V7TemporaryMedicalPresence(
    prematch, policy, commands, decisions, medicalActions,
  );
  return result.ok && sameCanonicalValue(result.replay, candidate);
}
