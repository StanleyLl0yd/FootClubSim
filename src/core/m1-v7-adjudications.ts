import { sameCanonicalValue } from './canonical-value.js';
import { isStableId } from './identifiers.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput }
  from './m1-clock.js';
import { simulateM1V6Phases, type M1V6Event, type M1V6Result }
  from './m1-phases-v6.js';
import type { MatchLedgerReport } from './match-contracts.js';

/**
 * A new, isolated contract for externally adjudicated special goals.
 * Decisions MUST be supplied by a separately trusted referee controller.
 * Neither a decision ID nor a caller-provided JSON object authenticates one.
 * v6 (including its PRNG draws, ledger and existing journals) is unchanged.
 */
export const M1_V7_ENGINE_VERSION = '6' as const;
export const M1_V7_EVENT_SCHEMA_VERSION = 7 as const;
export const M1_V7_DECISION_SCHEMA_VERSION = 1 as const;
export const M1_V7_MAX_DECISIONS = M1_CLOCK_MAX_EVENTS as number;

interface DecisionBase {
  readonly schemaVersion: typeof M1_V7_DECISION_SCHEMA_VERSION;
  readonly decisionId: string;
  readonly fixtureId: string;
  readonly elapsedSeconds: number;
  /** Scoring/beneficiary club, not the defender's club for an own goal. */
  readonly teamId: string;
  readonly playerId: string;
}
export type M1V7Decision =
  | (DecisionBase & Readonly<{
    kind: 'penalty-kick';
    /** Final referee-confirmed result only. Retakes/infringements are excluded. */
    outcome: 'scored' | 'saved' | 'missed';
  }>)
  | (DecisionBase & Readonly<{ kind: 'own-goal'; outcome?: never }>);

export type M1V7Event =
  | Readonly<{
    schemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
    id: string; sequence: number; elapsedSeconds: number;
    type: 'v6-event'; source: M1V6Event;
  }>
  | Readonly<{
    schemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
    id: string; sequence: number; elapsedSeconds: number;
    type: 'adjudication'; decision: M1V7Decision;
  }>;

export interface M1V7TeamReport {
  readonly goals: number;
  readonly openPlayGoals: number;
  readonly penaltiesTaken: number;
  readonly penaltyGoals: number;
  readonly ownGoalsFor: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xgMilli: number;
}
export interface M1V7Report {
  readonly fixtureId: string;
  readonly home: M1V7TeamReport;
  readonly away: M1V7TeamReport;
}
export interface M1V7Result {
  readonly ok: true;
  readonly engineVersion: typeof M1_V7_ENGINE_VERSION;
  readonly schemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
  readonly base: M1V6Result;
  readonly events: readonly M1V7Event[];
  readonly report: M1V7Report;
}
export type M1V7Error = 'INVALID_BASE_MATCH' | 'INVALID_DECISIONS' |
  'REJECTED_DECISION' | 'REFEREE_RULING_REQUIRED';
export type M1V7Run = M1V7Result | Readonly<{ ok: false; error: M1V7Error }>;
const BASE_KEYS = ['schemaVersion', 'decisionId', 'fixtureId',
  'elapsedSeconds', 'teamId', 'playerId', 'kind'] as const;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (error: M1V7Error): M1V7Run => ({ ok: false, error });
function readDecision(value: unknown): M1V7Decision | null {
  if (!record(value) || value.schemaVersion !== M1_V7_DECISION_SCHEMA_VERSION ||
      !isStableId(value.decisionId) || !isStableId(value.fixtureId) ||
      !isStableId(value.teamId) || !isStableId(value.playerId) ||
      !Number.isInteger(value.elapsedSeconds) ||
      (value.elapsedSeconds as number) < 0 ||
      (value.elapsedSeconds as number) >= 5400 ||
      (value.elapsedSeconds as number) % M1_CLOCK_STEP_SECONDS !== 0) return null;
  const fields = value.kind === 'penalty-kick' ? [...BASE_KEYS, 'outcome'] :
    value.kind === 'own-goal' ? BASE_KEYS : null;
  if (!fields || Object.keys(value).length !== fields.length ||
      fields.some(key => !Object.hasOwn(value, key))) return null;
  if (value.kind === 'penalty-kick' &&
      !['scored', 'saved', 'missed'].includes(value.outcome as string)) return null;
  return value as unknown as M1V7Decision;
}
type MutableTeamReport = { -readonly [K in keyof M1V7TeamReport]: M1V7TeamReport[K] };
function teamReport(source: MatchLedgerReport['home']): MutableTeamReport {
  return {
    ...source, openPlayGoals: source.goals,
    penaltiesTaken: 0, penaltyGoals: 0, ownGoalsFor: 0,
  };
}

/**
 * For each five-minute checkpoint, v6's verified substitutions/cards are
 * applied BEFORE a new referee decision and BEFORE that phase's open-play shot.
 * These two source streams are never silently converted into each other.
 */
export function simulateM1V7Phases(
  prematch: unknown, policy: unknown,
  plannedCommands: unknown = [], trustedDecisions: unknown = [],
): M1V7Run {
  const base = simulateM1V6Phases(prematch, policy, plannedCommands);
  if (!base.ok) return fail('INVALID_BASE_MATCH');
  if (!record(prematch) || !Array.isArray(trustedDecisions) ||
      trustedDecisions.length > M1_V7_MAX_DECISIONS) return fail('INVALID_DECISIONS');
  const input = prematch as unknown as M1PrematchInput;
  const parsed: M1V7Decision[] = [];
  const seen = new Set<string>();
  if (Array.isArray(plannedCommands)) {
    for (const command of plannedCommands) {
      if (!record(command)) return fail('INVALID_BASE_MATCH');
      seen.add(String(command.kind === 'caution' || command.kind === 'direct-red' ||
        command.kind === 'injury-withdrawal' ? command.id : command.commandId));
    }
  }
  let last = -1;
  for (const raw of trustedDecisions) {
    const decision = readDecision(raw);
    if (!decision) return fail('INVALID_DECISIONS');
    if (decision.fixtureId !== input.fixture.id ||
        decision.elapsedSeconds <= last || seen.has(decision.decisionId)) {
      return fail('REJECTED_DECISION');
    }
    last = decision.elapsedSeconds;
    seen.add(decision.decisionId);
    parsed.push({ ...decision });
  }

  const active = {
    home: new Set(input.homeLineup.starters),
    away: new Set(input.awayLineup.starters),
  };
  const totals = {
    home: teamReport(base.report.home),
    away: teamReport(base.report.away),
  };
  const events: M1V7Event[] = [];
  let sourceIndex = 0, decisionIndex = 0;
  function appendBase(source: M1V6Event): void {
    events.push({
      schemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
      id: 'm1-v7-base-' + source.id, sequence: events.length + 1,
      elapsedSeconds: source.elapsedSeconds, type: 'v6-event', source,
    });
  }
  function appendDecision(decision: M1V7Decision): boolean {
    const side = decision.teamId === input.fixture.homeClubId ? 'home' :
      decision.teamId === input.fixture.awayClubId ? 'away' : null;
    if (!side) return false;
    const opponent = side === 'home' ? 'away' : 'home';
    if (decision.kind === 'penalty-kick' ?
      !active[side].has(decision.playerId) : !active[opponent].has(decision.playerId)) {
      return false;
    }
    const team = totals[side];
    if (decision.kind === 'penalty-kick') {
      team.penaltiesTaken++;
      if (decision.outcome === 'scored') {
        team.goals++;
        team.penaltyGoals++;
      }
    } else {
      team.goals++;
      team.ownGoalsFor++;
    }
    events.push({
      schemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
      id: 'm1-v7-decision-' + decision.decisionId,
      sequence: events.length + 1, elapsedSeconds: decision.elapsedSeconds,
      type: 'adjudication', decision,
    });
    return true;
  }
  for (let phase = 0; phase < M1_CLOCK_MAX_EVENTS; phase++) {
    const second = phase * M1_CLOCK_STEP_SECONDS;
    while (base.events[sourceIndex]?.type === 'availability' &&
        base.events[sourceIndex]?.elapsedSeconds === second) {
      const event = base.events[sourceIndex]!;
      if (event.type !== 'availability') return fail('INVALID_BASE_MATCH');
      const action = event.entry.action;
      const side = action.teamId === input.fixture.homeClubId ? 'home' : 'away';
      if (action.kind === 'substitute-normal') {
        active[side].delete(action.outPlayerId);
        active[side].add(action.inPlayerId);
      } else if (event.entry.effect !== 'yellow') {
        active[side].delete(action.playerId);
      }
      appendBase(event);
      sourceIndex++;
    }
    if (parsed[decisionIndex]?.elapsedSeconds === second) {
      if (!appendDecision(parsed[decisionIndex]!)) return fail('REJECTED_DECISION');
      decisionIndex++;
    }
    if (base.events[sourceIndex]?.type === 'shot' &&
        base.events[sourceIndex]?.elapsedSeconds === second + M1_CLOCK_STEP_SECONDS - 1) {
      appendBase(base.events[sourceIndex]!);
      sourceIndex++;
    }
  }
  if (decisionIndex !== parsed.length || sourceIndex !== base.events.length - 1 ||
      base.events[sourceIndex]?.type !== 'full-time') return fail('INVALID_BASE_MATCH');
  appendBase(base.events[sourceIndex]!);
  return {
    ok: true, engineVersion: M1_V7_ENGINE_VERSION,
    schemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
    base, events, report: { fixtureId: input.fixture.id, home: totals.home, away: totals.away },
  };
}

/** Reconstruct the entire v7 result from independent trusted inputs. */
export function verifyM1V7Result(
  prematch: unknown, policy: unknown, plannedCommands: unknown,
  trustedDecisions: unknown, candidate: unknown,
): boolean {
  const replay = simulateM1V7Phases(prematch, policy, plannedCommands, trustedDecisions);
  return replay.ok && sameCanonicalValue(replay, candidate);
}
