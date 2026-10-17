import { sameCanonicalValue } from './canonical-value.js';
import { isStableId } from './identifiers.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput }
  from './m1-clock.js';
import { admitM1OffFieldMedicalReturn, type M1OffFieldReturn,
  type M1MedicalReturnError } from './m1-medical-return.js';
import { advanceM1PlayerControl, startM1PlayerControl,
  submitM1PlayerInstruction, submitM1TeamTacticsWithPlayerControl }
  from './m1-player-control.js';
import { computeM1V5PhaseShot, type M1V5Shot } from './m1-phases-v5.js';
import { M1_V6_DRAWS_PER_PHASE, type M1V6AvailabilityEvent }
  from './m1-phases-v6.js';
import { M1_V7_EVENT_SCHEMA_VERSION, simulateM1V7Phases,
  type M1V7Decision, type M1V7TeamReport } from './m1-v7-adjudications.js';
import { readM1V7TemporaryMedicalAction,
  type M1V7TemporaryMedicalAction } from './m1-v7-temporary-medical.js';
import { SeededRng, RNG_VERSION } from './rng.js';

/**
 * New v8-only headless medical-aware shot experiment.
 * Five deterministic draws per phase as before, but physical on-field XI
 * excludes medically absent players BEFORE weighted shooter selection.
 * It never mutates/reinterprets v6 or v7 records or prior saved careers.
 */
export const M1_V8_ENGINE_VERSION = '7' as const;
export const M1_V8_EVENT_SCHEMA_VERSION = 8 as const;
export type M1V8Event =
  | Readonly<{ schemaVersion: 8; id: string; sequence: number;
    elapsedSeconds: number; type: 'availability'; source: M1V6AvailabilityEvent }>
  | Readonly<{ schemaVersion: 8; id: string; sequence: number;
    elapsedSeconds: number; type: 'medical'; action: M1V7TemporaryMedicalAction }>
  | Readonly<{ schemaVersion: 8; id: string; sequence: number;
    elapsedSeconds: number; type: 'adjudication'; decision: M1V7Decision }>
  | Readonly<(Omit<M1V5Shot, 'schemaVersion'> & { schemaVersion: 8 })>
  | Readonly<{ schemaVersion: 8; id: 'm1-v8-full-time'; sequence: number;
    elapsedSeconds: 5400; type: 'full-time' }>;
export interface M1V8Result {
  readonly ok: true;
  readonly schemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly v7DecisionSchemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly fixtureId: string;
  readonly events: readonly M1V8Event[];
  readonly report: Readonly<{ fixtureId: string; home: M1V7TeamReport; away: M1V7TeamReport }>;
  readonly offFieldAtFullTime: readonly string[];
  readonly onFieldAtFullTime: Readonly<{ home: readonly string[]; away: readonly string[] }>;
}
export type M1V8Error = 'INVALID_MATCH_SOURCE' | 'INVALID_MEDICAL_SCHEDULE' |
  'DUPLICATE_ID' | 'NOT_ON_FIELD' | 'NOT_ABSENT' | 'ALREADY_ABSENT' |
  'EXCEPTION_RULING_REQUIRED' | 'MEDICAL_RETURN_REJECTED' |
  'COMMAND_FOR_ABSENT_PLAYER' | 'REFEREE_RULING_REQUIRED' | 'INVALID_TRANSITION';
export type M1V8Run = M1V8Result | Readonly<{ ok: false; error: M1V8Error;
  medicalError?: M1MedicalReturnError }>;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (error: M1V8Error, medicalError?: M1MedicalReturnError): M1V8Run =>
  medicalError ? { ok: false, error, medicalError } : { ok: false, error };
const sorted = (ids: Iterable<string>): string[] => [...ids].sort();
const blank = (): M1V7TeamReport => ({
  goals: 0, openPlayGoals: 0, penaltiesTaken: 0, penaltyGoals: 0,
  ownGoalsFor: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0, xgCoverage: 'open-play-only',
});
type MutableStats = { -readonly [K in keyof M1V7TeamReport]: M1V7TeamReport[K] };

function scoreShot(stats: MutableStats, shot: M1V5Shot): void {
  stats.shots++;
  stats.xgMilli += shot.xgMilli;
  if (shot.outcome === 'goal') {
    stats.goals++;
    stats.openPlayGoals++;
  }
  if (shot.outcome === 'goal' || shot.outcome === 'saved') stats.shotsOnTarget++;
}
function scoreDecision(stats: MutableStats, decision: M1V7Decision): void {
  if (decision.kind === 'own-goal') {
    stats.goals++;
    stats.ownGoalsFor++;
    return;
  }
  stats.penaltiesTaken++;
  stats.shots++;
  if (decision.outcome !== 'missed') stats.shotsOnTarget++;
  if (decision.outcome === 'scored') {
    stats.goals++;
    stats.penaltyGoals++;
  }
}

/**
 * Validate all original v7 referee/coach sources; then re-run only phase shots
 * against the real physically present XI using a new schema-8 event stream.
 * Input restart times and referee signatures need external authority.
 */
export function simulateM1V8MedicalPhases(
  prematch: unknown, policy: unknown, plannedCommands: unknown = [],
  trustedDecisions: unknown = [], medicalActions: unknown = [],
): M1V8Run {
  const baseline = simulateM1V7Phases(prematch, policy, plannedCommands, trustedDecisions);
  if (!baseline.ok || !Array.isArray(plannedCommands)) return fail('INVALID_MATCH_SOURCE');
  if (!Array.isArray(medicalActions) ||
      medicalActions.length > M1_CLOCK_MAX_EVENTS * 2) return fail('INVALID_MEDICAL_SCHEDULE');
  const started = startM1PlayerControl(prematch, policy);
  if (!started.ok) return fail('INVALID_MATCH_SOURCE');
  const input = prematch as M1PrematchInput;
  const seen = new Set<string>();
  for (const raw of plannedCommands) {
    if (!record(raw)) return fail('INVALID_MATCH_SOURCE');
    const id = raw.kind === 'caution' || raw.kind === 'direct-red' ||
      raw.kind === 'injury-withdrawal' ? raw.id : raw.commandId;
    if (!isStableId(id)) return fail('INVALID_MATCH_SOURCE');
    seen.add(id);
  }
  const decisions = baseline.events.filter(e => e.type === 'adjudication')
    .map(e => e.type === 'adjudication' ? e.decision : null)
    .filter((decision): decision is M1V7Decision => decision !== null);
  decisions.forEach(decision => seen.add(decision.decisionId));
  const medical: M1V7TemporaryMedicalAction[] = [];
  let previous = -1;
  for (const raw of medicalActions) {
    const action = readM1V7TemporaryMedicalAction(raw);
    if (!action || action.fixtureId !== input.fixture.id ||
        (action.teamId !== input.fixture.homeClubId &&
          action.teamId !== input.fixture.awayClubId) ||
        action.elapsedSeconds < previous) return fail('INVALID_MEDICAL_SCHEDULE');
    if (seen.has(action.id)) return fail('DUPLICATE_ID');
    seen.add(action.id);
    previous = action.elapsedSeconds;
    medical.push({ ...action });
  }
  const teams = { home: [...input.homeLineup.starters], away: [...input.awayLineup.starters] };
  const starters = new Set([...teams.home, ...teams.away]);
  const players = new Map(input.catalog.players.map(p => [p.id, p]));
  const absent = new Map<string, Extract<M1V7TemporaryMedicalAction,
    { kind: 'treatment-exit' }>>();
  const availability = baseline.base.events.filter(e => e.type === 'availability');
  const totals: { home: MutableStats; away: MutableStats } = { home: blank(), away: blank() };
  const rng = new SeededRng(input.rngSeed);
  let controlled = started.state, commandIndex = 0, availabilityIndex = 0;
  let medicalIndex = 0, decisionIndex = 0;
  const events: M1V8Event[] = [];
  function append(item: M1V8Event extends infer T ? T extends M1V8Event ? Omit<T, 'sequence'> : never : never): void {
    events.push({ ...item, sequence: events.length + 1 } as M1V8Event);
  }
  for (let phase = 0; phase < M1_CLOCK_MAX_EVENTS; phase++) {
    const second = phase * M1_CLOCK_STEP_SECONDS;
    while (commandIndex < plannedCommands.length) {
      const raw: unknown = plannedCommands[commandIndex];
      if (!record(raw) || raw.elapsedSeconds !== second) break;
      if (raw.kind === 'set-tactics' || raw.kind === 'set-player-focus') {
        if (raw.kind === 'set-player-focus' && absent.has(raw.playerId as string)) {
          return fail('COMMAND_FOR_ABSENT_PLAYER');
        }
        const next = raw.kind === 'set-tactics' ?
          submitM1TeamTacticsWithPlayerControl(input, policy, controlled, raw) :
          submitM1PlayerInstruction(input, policy, controlled, raw);
        if (!next.ok) return fail('INVALID_TRANSITION');
        controlled = next.state;
      } else {
        const next = availability[availabilityIndex++];
        if (!next || !sameCanonicalValue(next.entry.action, raw)) {
          return fail('INVALID_MATCH_SOURCE');
        }
        const action = next.entry.action;
        const side = action.teamId === input.fixture.homeClubId ? 'home' : 'away';
        if (action.kind === 'substitute-normal') {
          if (absent.has(action.outPlayerId)) return fail('EXCEPTION_RULING_REQUIRED');
          const index = teams[side].indexOf(action.outPlayerId);
          if (index < 0) return fail('INVALID_TRANSITION');
          teams[side][index] = action.inPlayerId;
        } else if (next.entry.effect !== 'yellow') {
          if (absent.has(action.playerId)) return fail('EXCEPTION_RULING_REQUIRED');
          teams[side] = teams[side].filter(id => id !== action.playerId);
        }
        append({ schemaVersion: 8, id: 'm1-v8-av-' + next.entry.sequence,
          elapsedSeconds: second, type: 'availability', source: next });
      }
      commandIndex++;
    }
    // Different players may have independent treatment actions at one checkpoint.
    // Preserve source order; previously admitted strictly spaced histories are unchanged.
    while (medical[medicalIndex]?.elapsedSeconds === second) {
      const medicalAction = medical[medicalIndex]!;
      const side = medicalAction.teamId === input.fixture.homeClubId ? 'home' : 'away';
      if (!teams[side].includes(medicalAction.playerId)) return fail('NOT_ON_FIELD');
      if (medicalAction.kind === 'treatment-exit') {
        if (!starters.has(medicalAction.playerId) ||
            players.get(medicalAction.playerId)?.primaryPosition === 'GK') {
          return fail('EXCEPTION_RULING_REQUIRED');
        }
        if (absent.has(medicalAction.playerId)) return fail('ALREADY_ABSENT');
        absent.set(medicalAction.playerId, medicalAction);
      } else {
        const departure = absent.get(medicalAction.playerId);
        if (!departure) return fail('NOT_ABSENT');
        const candidate: M1OffFieldReturn = {
          schemaVersion: 1, fixtureId: medicalAction.fixtureId,
          teamId: medicalAction.teamId, playerId: medicalAction.playerId,
          reason: departure.reason, offFieldAtRunningSeconds: departure.elapsedSeconds,
          restartAtRunningSeconds: departure.restartAtRunningSeconds,
          requestedAtRunningSeconds: second,
          returnContext: medicalAction.returnContext,
          ballInPlay: medicalAction.ballInPlay,
          entryBoundary: medicalAction.entryBoundary,
          refereeSignalId: medicalAction.refereeSignalId,
        };
        const admitted = admitM1OffFieldMedicalReturn(input, candidate);
        if (!admitted.ok) return fail('MEDICAL_RETURN_REJECTED', admitted.error);
        absent.delete(medicalAction.playerId);
      }
      append({ schemaVersion: 8, id: 'm1-v8-med-' + medicalAction.id,
        elapsedSeconds: second, type: 'medical', action: medicalAction });
      medicalIndex++;
    }
    const present = {
      home: teams.home.filter(id => !absent.has(id)),
      away: teams.away.filter(id => !absent.has(id)),
    };
    if (present.home.length < 7 || present.away.length < 7 ||
        !present.home.some(id => players.get(id)?.primaryPosition === 'GK') ||
        !present.away.some(id => players.get(id)?.primaryPosition === 'GK')) {
      return fail('REFEREE_RULING_REQUIRED');
    }
    const decision = decisions[decisionIndex];
    if (decision?.elapsedSeconds === second) {
      const side = decision.teamId === input.fixture.homeClubId ? 'home' : 'away';
      const participantSide = decision.kind === 'penalty-kick' ? side :
        side === 'home' ? 'away' : 'home';
      if (!present[participantSide].includes(decision.playerId)) {
        return fail('NOT_ON_FIELD');
      }
      scoreDecision(totals[side], decision);
      append({ schemaVersion: 8, id: 'm1-v8-decision-' + decision.decisionId,
        elapsedSeconds: second, type: 'adjudication', decision });
      decisionIndex++;
    }
    const shot = computeM1V5PhaseShot(input, controlled, players, present,
      phase, rng, events.length + 1);
    if (shot) {
      const side = shot.teamId === input.fixture.homeClubId ? 'home' : 'away';
      if (!present[side].includes(shot.playerId)) return fail('INVALID_TRANSITION');
      scoreShot(totals[side], shot);
      append({ ...shot, schemaVersion: 8, id: 'm1-v8-shot-' + (phase + 1) });
    }
    const next = advanceM1PlayerControl(input, policy, controlled);
    if (!next.ok) return fail('INVALID_TRANSITION');
    controlled = next.state;
  }
  if (commandIndex !== plannedCommands.length ||
      availabilityIndex !== availability.length ||
      medicalIndex !== medical.length || decisionIndex !== decisions.length) {
    return fail('INVALID_MATCH_SOURCE');
  }
  append({ schemaVersion: 8, id: 'm1-v8-full-time', elapsedSeconds: 5400,
    type: 'full-time' });
  return {
    ok: true, schemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    engineVersion: M1_V8_ENGINE_VERSION,
    v7DecisionSchemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
    rngAlgorithmVersion: RNG_VERSION, rngSeed: input.rngSeed,
    rngState: rng.snapshot(), rngDraws: M1_CLOCK_MAX_EVENTS * M1_V6_DRAWS_PER_PHASE,
    fixtureId: input.fixture.id, events,
    report: { fixtureId: input.fixture.id, home: totals.home, away: totals.away },
    offFieldAtFullTime: sorted(absent.keys()),
    onFieldAtFullTime: {
      home: sorted(teams.home.filter(id => !absent.has(id))),
      away: sorted(teams.away.filter(id => !absent.has(id))),
    },
  };
}

export function verifyM1V8MedicalResult(
  prematch: unknown, policy: unknown, plannedCommands: unknown,
  trustedDecisions: unknown, medicalActions: unknown, candidate: unknown,
): boolean {
  const replay = simulateM1V8MedicalPhases(
    prematch, policy, plannedCommands, trustedDecisions, medicalActions,
  );
  return replay.ok && sameCanonicalValue(replay, candidate);
}
