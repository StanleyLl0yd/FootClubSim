import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS, M1_CLOCK_STEP_SECONDS,
  startM1Clock, type M1PrematchInput } from './m1-clock.js';
import { simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * A limited IFAB 2026/27 late substitution state machine. The outgoing
 * player leaves after >10s, the substitute remains OFF until the first
 * reported stoppage at least 60s of RUNNING PLAY after restart and a
 * referee signal. Source whistling after the restart is NOT authenticated;
 * no downstream v8 goals are reused during the short-handed interval.
 */
export const M1_V13_LATE_SUB_SCHEMA = 1 as const;
export const M1_V13_LATE_SUB_RULES =
  'ifab-2026-27-time-limited-substitution-pending-entry' as const;
export type M1V13LateError =
  'INVALID_SOURCE' | 'INVALID_PROCEDURE' | 'NO_ENGINE_GOAL_RESTART' |
  'INVALID_BENCH_OR_XI' | 'UNSUPPORTED_EXCEPTION' |
  'INVALID_STATE' | 'INVALID_ACTION' | 'RUNNING_CLOCK_REQUIRED' |
  'REFEREE_SIGNAL_REQUIRED' | 'FIRST_STOPPAGE_ONLY' |
  'NOT_YET_ELIGIBLE' | 'ALREADY_COMPLETED';
type EventKind = 'late-exit' | 'playing-short' |
  'early-stoppage' | 'entry-permitted';
export interface M1V13LateAction {
  readonly kind: 'playing' | 'stoppage';
  readonly runningSeconds: number;
  /** Only used for a stoppage, null until the eligible first one. */
  readonly refereeSignalId: string | null;
}
export interface M1V13LateEvent {
  readonly sequence: number;
  readonly kind: EventKind;
  readonly runningSeconds: number;
  readonly teamId: string;
  readonly homeCount: number;
  readonly awayCount: number;
  readonly refereeSignalId: string | null;
}
export interface M1V13LateState {
  readonly schemaVersion: typeof M1_V13_LATE_SUB_SCHEMA;
  readonly rulesId: typeof M1_V13_LATE_SUB_RULES;
  readonly status: 'PLAYING_SHORT' | 'ENTRY_REPORTED_NOT_AUTHENTICATED';
  readonly fixtureId: string;
  readonly teamId: string;
  readonly outPlayerId: string;
  readonly inPlayerId: string;
  readonly restartRunningSeconds: number;
  readonly entryEligibleAtRunningSeconds: number;
  readonly runningSeconds: number;
  readonly onField: Readonly<{home: readonly string[]; away: readonly string[]}>;
  readonly appliedActionHistory: readonly M1V13LateAction[];
  readonly events: readonly M1V13LateEvent[];
  readonly subsequentWhistleAuthorityAuthenticated: false;
  readonly refereeSignalAuthorityAuthenticated: false;
  readonly downstreamShotsRecomputedForShortHandedXI: false;
  readonly originalSubstituteLocked: true;
}
export type M1V13LateResult =
  | Readonly<{ok: true; state: M1V13LateState}>
  | Readonly<{ok: false; error: M1V13LateError}>;
const bad = (error: M1V13LateError): M1V13LateResult => ({ok:false,error});
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const sorted = (x: Iterable<string>): string[] => [...x].sort();
const keys = (r: Record<string, unknown>, list: readonly string[]) =>
  Reflect.ownKeys(r).length === list.length &&
  list.every(key => Object.hasOwn(r,key));
const PROCEDURE_KEYS = [
  'schemaVersion','fixtureId','teamId','outPlayerId','inPlayerId',
  'restartRunningSeconds','boardSignalWallSeconds','departureWallSeconds',
  'kind',
] as const;
const ACTION_KEYS = ['kind','runningSeconds','refereeSignalId'] as const;
const validSecond = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 &&
  v <= M1_CLOCK_END_SECONDS;
function actionFrom(raw: unknown): M1V13LateAction | null {
  if (!rec(raw) || !keys(raw,ACTION_KEYS) ||
      (raw.kind !== 'playing' && raw.kind !== 'stoppage') ||
      !validSecond(raw.runningSeconds) ||
      !(raw.refereeSignalId === null ||
        typeof raw.refereeSignalId === 'string' &&
        /^[A-Za-z0-9._:-]{1,96}$/.test(raw.refereeSignalId)) ||
      (raw.kind === 'playing' && raw.refereeSignalId !== null)) return null;
  return { kind:raw.kind, runningSeconds:raw.runningSeconds,
    refereeSignalId:raw.refereeSignalId };
}
function deriveInitial(prematch: unknown, policy: unknown,
  procedure: unknown): M1V13LateResult {
  if (!isPlainJsonTree(prematch) || !isPlainJsonTree(policy) ||
      !isPlainJsonTree(procedure) || !rec(procedure) ||
      !keys(procedure, PROCEDURE_KEYS)) return bad('INVALID_SOURCE');
  if (procedure.schemaVersion !== 1 ||
      procedure.kind !== 'substitute-normal' ||
      typeof procedure.fixtureId !== 'string' ||
      typeof procedure.teamId !== 'string' ||
      typeof procedure.outPlayerId !== 'string' ||
      typeof procedure.inPlayerId !== 'string' ||
      procedure.outPlayerId === procedure.inPlayerId ||
      !validSecond(procedure.restartRunningSeconds) ||
      procedure.restartRunningSeconds < M1_CLOCK_STEP_SECONDS ||
      procedure.restartRunningSeconds >= M1_CLOCK_END_SECONDS ||
      procedure.restartRunningSeconds % M1_CLOCK_STEP_SECONDS !== 0 ||
      !validSecond(procedure.boardSignalWallSeconds) ||
      !validSecond(procedure.departureWallSeconds) ||
      procedure.departureWallSeconds <= procedure.boardSignalWallSeconds + 10 ||
      procedure.departureWallSeconds >
        procedure.boardSignalWallSeconds + 120) {
    return bad('INVALID_PROCEDURE');
  }
  const validated = startM1Clock(prematch);
  if (!validated.ok) return bad('INVALID_SOURCE');
  const original = prematch as M1PrematchInput;
  if (validated.state.fixtureId !== procedure.fixtureId ||
      (procedure.teamId !== original.fixture.homeClubId &&
        procedure.teamId !== original.fixture.awayClubId)) {
    return bad('INVALID_PROCEDURE');
  }
  const side = procedure.teamId === original.fixture.homeClubId ?
    'home' : 'away';
  const lineup = side === 'home' ? original.homeLineup : original.awayLineup;
  if (!lineup.starters.includes(procedure.outPlayerId) ||
      !lineup.bench.includes(procedure.inPlayerId)) {
    return bad('INVALID_BENCH_OR_XI');
  }
  const keeper = original.catalog.players.find(p => p.id === procedure.outPlayerId);
  if (keeper?.primaryPosition === 'GK') {
    return bad('UNSUPPORTED_EXCEPTION');
  }
  // This hypothetical check is used ONLY for ordinary roster/competition
  // eligibility; its 11-player future score sequence must never be reused.
  const prospective = simulateM1V8MedicalPhases(prematch, policy, [{
    schemaVersion: 1, kind: 'substitute-normal',
    fixtureId: procedure.fixtureId,
    commandId: 'v13-prospective-eligibility',
    teamId: procedure.teamId,
    elapsedSeconds: procedure.restartRunningSeconds,
    actor: {kind:'player'},stoppage:'referee-authorized',
    outPlayerId: procedure.outPlayerId,
    inPlayerId: procedure.inPlayerId,
  }], [], []);
  if (!prospective.ok) return bad('INVALID_BENCH_OR_XI');
  const originalSeed = simulateM1V8MedicalPhases(prematch, policy, [], [], []);
  if (!originalSeed.ok) return bad('INVALID_SOURCE');
  const restartSecond = procedure.restartRunningSeconds as number;
  if (!originalSeed.events.some(e => e.type === 'shot' &&
      e.outcome === 'goal' &&
      e.elapsedSeconds === restartSecond - 1)) {
    return bad('NO_ENGINE_GOAL_RESTART');
  }
  const left = side === 'home' ?
    original.homeLineup.starters.filter(id => id !== procedure.outPlayerId) :
    original.homeLineup.starters;
  const right = side === 'away' ?
    original.awayLineup.starters.filter(id => id !== procedure.outPlayerId) :
    original.awayLineup.starters;
  if ((side === 'home' && left.length !== 10) ||
      (side === 'away' && right.length !== 10)) {
    return bad('INVALID_BENCH_OR_XI');
  }
  const time = procedure.restartRunningSeconds;
  return {ok:true,state:{
    schemaVersion:M1_V13_LATE_SUB_SCHEMA,
    rulesId:M1_V13_LATE_SUB_RULES,
    status:'PLAYING_SHORT',
    fixtureId:procedure.fixtureId,teamId:procedure.teamId,
    outPlayerId:procedure.outPlayerId,inPlayerId:procedure.inPlayerId,
    restartRunningSeconds:time,entryEligibleAtRunningSeconds:time+60,
    runningSeconds:time,
    onField:{home:sorted(left),away:sorted(right)},
    appliedActionHistory:[],
    events:[{sequence:1,kind:'late-exit',runningSeconds:time,
      teamId:procedure.teamId,homeCount:left.length,
      awayCount:right.length,refereeSignalId:null}],
    subsequentWhistleAuthorityAuthenticated:false,
    refereeSignalAuthorityAuthenticated:false,
    downstreamShotsRecomputedForShortHandedXI:false,
    originalSubstituteLocked:true,
  }};
}
function transition(state:M1V13LateState, action:M1V13LateAction):
  M1V13LateResult {
  if (state.status === 'ENTRY_REPORTED_NOT_AUTHENTICATED') {
    return bad('ALREADY_COMPLETED');
  }
  if (action.kind === 'playing') {
    if (action.runningSeconds <= state.runningSeconds ||
        action.runningSeconds > M1_CLOCK_END_SECONDS) {
      return bad('RUNNING_CLOCK_REQUIRED');
    }
    return {ok:true,state:{
      ...state,runningSeconds:action.runningSeconds,
      appliedActionHistory:[...state.appliedActionHistory,action],
      events:[...state.events,{sequence:state.events.length+1,
        kind:'playing-short',runningSeconds:action.runningSeconds,
        teamId:state.teamId,homeCount:state.onField.home.length,
        awayCount:state.onField.away.length,refereeSignalId:null}],
    }};
  }
  if (action.runningSeconds !== state.runningSeconds ||
      action.runningSeconds === M1_CLOCK_END_SECONDS) {
    return bad('INVALID_ACTION');
  }
  if (action.runningSeconds < state.entryEligibleAtRunningSeconds) {
    if (action.refereeSignalId !== null) return bad('NOT_YET_ELIGIBLE');
    return {ok:true,state:{
      ...state,appliedActionHistory:[...state.appliedActionHistory,action],
      events:[...state.events,{sequence:state.events.length+1,
        kind:'early-stoppage',runningSeconds:action.runningSeconds,
        teamId:state.teamId,homeCount:state.onField.home.length,
        awayCount:state.onField.away.length,refereeSignalId:null}],
    }};
  }
  if (action.refereeSignalId === null) return bad('REFEREE_SIGNAL_REQUIRED');
  const old = state.onField;
  const side = state.onField.home.length === 10 ? 'home' : 'away';
  const roster = sorted([...old[side],state.inPlayerId]);
  if (roster.length !== 11 || new Set(roster).size !== 11) {
    return bad('INVALID_STATE');
  }
  const onField = side === 'home' ?
    {home:roster,away:[...old.away]} :
    {home:[...old.home],away:roster};
  return {ok:true,state:{
    ...state,status:'ENTRY_REPORTED_NOT_AUTHENTICATED',
    onField,appliedActionHistory:[...state.appliedActionHistory,action],
    events:[...state.events,{sequence:state.events.length+1,
      kind:'entry-permitted',runningSeconds:action.runningSeconds,
      teamId:state.teamId,homeCount:onField.home.length,
      awayCount:onField.away.length,refereeSignalId:action.refereeSignalId}],
  }};
}
export function startM1V13LateEntry(
  prematch: unknown, policy: unknown, procedure: unknown,
): M1V13LateResult {
  return deriveInitial(prematch, policy, procedure);
}
export function advanceM1V13LateEntry(
  prematch: unknown, policy: unknown, originalProcedure: unknown,
  untrustedSnapshot: unknown, proposedStep: unknown,
): M1V13LateResult {
  if (!isPlainJsonTree(untrustedSnapshot) ||
      !isPlainJsonTree(proposedStep) ||
      !rec(untrustedSnapshot) ||
      !Array.isArray(untrustedSnapshot.appliedActionHistory) ||
      untrustedSnapshot.appliedActionHistory.length >= 32) {
    return bad('INVALID_STATE');
  }
  const next = actionFrom(proposedStep);
  if (!next) return bad('INVALID_ACTION');
  const source = deriveInitial(prematch, policy, originalProcedure);
  if (!source.ok) return source;
  let current = source.state;
  for (const step of untrustedSnapshot.appliedActionHistory) {
    const action = actionFrom(step);
    if (!action) return bad('INVALID_STATE');
    const replayed = transition(current,action);
    if (!replayed.ok) return bad('INVALID_STATE');
    current = replayed.state;
  }
  if (!sameCanonicalValue(current,untrustedSnapshot)) {
    return bad('INVALID_STATE');
  }
  return transition(current,next);
}
