import {
  advanceM1ControlledMatch, startM1ControlledMatch, submitM1TacticalCommand,
  type M1ControlledState, type M1ControlError,
} from './m1-control.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput } from './m1-clock.js';
import type { MatchLedgerReport, ShotOutcome } from './match-contracts.js';
import type { Player, MatchLineup } from './model.js';
import { SeededRng, RNG_VERSION } from './rng.js';
import type { TacticalPlan } from './tactics.js';
import { isStableId } from './identifiers.js';

/** M1 P2 synthetic phase protocol. NEVER silently reinterpret the M0 v1 ledger. */
export const M1_ACTION_ENGINE_VERSION = '2' as const;
export const M1_ACTION_EVENT_SCHEMA_VERSION = 3 as const;
export const M1_ACTION_DRAW_COUNT_PER_PHASE = 5 as const;
const MAX_ACTION_EVENTS = M1_CLOCK_MAX_EVENTS + 1;
const SHOT_KEYS = [
  'schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type',
  'teamId', 'playerId', 'xgMilli', 'outcome',
] as const;
const FINAL_KEYS = ['schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type'] as const;
const OUTCOMES = ['goal', 'saved', 'blocked', 'off-target'] as const;

interface EventBase {
  readonly schemaVersion: typeof M1_ACTION_EVENT_SCHEMA_VERSION;
  readonly id: string;
  readonly sequence: number;
  readonly elapsedSeconds: number;
}
export interface M1SyntheticShot extends EventBase {
  readonly type: 'shot';
  readonly teamId: string;
  readonly playerId: string;
  readonly xgMilli: number;
  readonly outcome: ShotOutcome;
}
export interface M1SyntheticFullTime extends EventBase {
  readonly type: 'full-time';
}
export type M1SyntheticEvent = M1SyntheticShot | M1SyntheticFullTime;
export interface M1SyntheticResult {
  readonly ok: true;
  readonly engineVersion: typeof M1_ACTION_ENGINE_VERSION;
  readonly schemaVersion: typeof M1_ACTION_EVENT_SCHEMA_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly controlled: M1ControlledState;
  readonly events: readonly M1SyntheticEvent[];
  readonly report: MatchLedgerReport;
}
export type M1SyntheticFailure = Readonly<{
  ok: false;
  error: 'INVALID_PREMATCH' | 'INVALID_SCHEDULE' | 'REJECTED_COMMAND' |
    'INVALID_LEDGER' | 'INTERNAL_TRANSITION';
  detail?: M1ControlError;
}>;
export type M1SyntheticRun = M1SyntheticResult | M1SyntheticFailure;
export type M1SyntheticReplay =
  | Readonly<{ ok: true; report: MatchLedgerReport }>
  | Readonly<{ ok: false; error: 'INVALID_PREMATCH' | 'INVALID_LEDGER' }>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
function zeroTeam() {
  return { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 };
}

/**
 * Independently rebuild a bounded report from the NEW v3 action ledger.
 * This does not assert that events were generated with a particular seed.
 */
export function deriveM1SyntheticLedger(prematch: unknown, events: unknown): M1SyntheticReplay {
  if (!isRecord(prematch)) return { ok: false, error: 'INVALID_PREMATCH' };
  // Match admission is shared with the existing strict M0 baseline.
  const preflight = startM1ControlledMatch(prematch, {
    home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
    away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  });
  if (!preflight.ok) return { ok: false, error: 'INVALID_PREMATCH' };
  if (!Array.isArray(events) || events.length < 1 || events.length > MAX_ACTION_EVENTS) {
    return { ok: false, error: 'INVALID_LEDGER' };
  }
  const fixture = (prematch as unknown as M1PrematchInput).fixture;
  const homeLineup = (prematch as unknown as M1PrematchInput).homeLineup;
  const awayLineup = (prematch as unknown as M1PrematchInput).awayLineup;
  const homeActive = new Set(homeLineup.starters);
  const awayActive = new Set(awayLineup.starters);
  const goalkeeper = new Map((prematch as unknown as M1PrematchInput).catalog.players.map(p => [p.id, p.primaryPosition]));
  const home = zeroTeam(), away = zeroTeam();
  let lastPhase = -1;
  for (let i = 0; i < events.length; i++) {
    const value: unknown = events[i];
    if (!isRecord(value) ||
        value.schemaVersion !== M1_ACTION_EVENT_SCHEMA_VERSION ||
        value.sequence !== i + 1 || !isStableId(value.id)) {
      return { ok: false, error: 'INVALID_LEDGER' };
    }
    if (value.type === 'full-time') {
      if (i !== events.length - 1 || !exact(value, FINAL_KEYS) ||
          value.id !== 'm1-action-full-time' ||
          value.elapsedSeconds !== M1_CLOCK_MAX_EVENTS * M1_CLOCK_STEP_SECONDS) {
        return { ok: false, error: 'INVALID_LEDGER' };
      }
      return { ok: true, report: { fixtureId: fixture.id, home, away } };
    }
    if (value.type !== 'shot' || !exact(value, SHOT_KEYS) ||
        !Number.isInteger(value.elapsedSeconds) ||
        !Number.isInteger(value.xgMilli) ||
        (value.xgMilli as number) < 0 || (value.xgMilli as number) > 1000 ||
        !OUTCOMES.includes(value.outcome as ShotOutcome)) {
      return { ok: false, error: 'INVALID_LEDGER' };
    }
    const seconds = value.elapsedSeconds as number;
    const phase = Math.floor(seconds / M1_CLOCK_STEP_SECONDS);
    if (seconds !== (phase + 1) * M1_CLOCK_STEP_SECONDS - 1 ||
        phase <= lastPhase || phase < 0 || phase >= M1_CLOCK_MAX_EVENTS ||
        value.id !== 'm1-action-shot-' + (phase + 1)) {
      return { ok: false, error: 'INVALID_LEDGER' };
    }
    const stats = value.teamId === fixture.homeClubId ? home :
      value.teamId === fixture.awayClubId ? away : null;
    const eligible = value.teamId === fixture.homeClubId ? homeActive :
      value.teamId === fixture.awayClubId ? awayActive : null;
    if (!isStableId(value.playerId) || !stats || !eligible?.has(value.playerId) ||
        goalkeeper.get(value.playerId) === 'GK') {
      return { ok: false, error: 'INVALID_LEDGER' };
    }
    lastPhase = phase;
    stats.shots++;
    stats.xgMilli += value.xgMilli as number;
    if (value.outcome === 'goal') stats.goals++;
    if (value.outcome === 'goal' || value.outcome === 'saved') stats.shotsOnTarget++;
  }
  return { ok: false, error: 'INVALID_LEDGER' };
}

function avg(
  lineup: MatchLineup, players: ReadonlyMap<string, Player>, key: 'shortPassing' | 'decisions' | 'marking',
): number {
  let sum = 0;
  for (const id of lineup.starters) sum += players.get(id)!.attributes[key];
  return sum / lineup.starters.length;
}
function shooterWeight(p: Player): number {
  const position = p.primaryPosition === 'ST' ? 4 :
    p.primaryPosition.startsWith('AM') ? 2.5 :
      ['MC', 'ML', 'MR'].includes(p.primaryPosition) ? 1.5 : 1;
  return position * (20 + p.attributes.finishing + p.attributes.offBallMovement / 2);
}
function chooseShooter(
  ids: readonly string[], players: ReadonlyMap<string, Player>, draw: number,
): Player {
  const outfield = ids.map(id => players.get(id)!).filter(p => p.primaryPosition !== 'GK');
  const weightSum = outfield.reduce((sum, p) => sum + shooterWeight(p), 0);
  let remaining = draw * weightSum;
  for (const player of outfield) {
    remaining -= shooterWeight(player);
    if (remaining < 0) return player;
  }
  return outfield[outfield.length - 1]!;
}
function goalkeeperReflexes(ids: readonly string[], players: ReadonlyMap<string, Player>): number {
  return players.get(ids.find(id => players.get(id)!.primaryPosition === 'GK')!)!.attributes.reflexes;
}
function shotOutcome(xgMilli: number, player: Player, draw: number): ShotOutcome {
  const probability = xgMilli / 1000;
  const saveChance = (1 - probability) * clamp(
    0.38 + (player.attributes.finishing - 50) / 350, 0.2, 0.56,
  );
  const blockedChance = (1 - probability - saveChance) * 0.45;
  if (draw < probability) return 'goal';
  if (draw < probability + saveChance) return 'saved';
  if (draw < probability + saveChance + blockedChance) return 'blocked';
  return 'off-target';
}

/**
 * Internal trusted continuation window: constructed after strict prematch
 * admission, or from a fully replay-verified M1PhaseCheckpoint. This shape
 * alone does NOT authenticate storage or a user's actor/club authority.
 */
export interface M1PhaseWindow {
  readonly controlled: M1ControlledState;
  readonly events: readonly M1SyntheticEvent[];
  readonly rngState: number;
  readonly rngDraws: number;
}
export type M1PhaseWindowResult =
  | Readonly<{ ok: true; window: M1PhaseWindow }>
  | M1SyntheticFailure;

function phaseContext(input: M1PrematchInput) {
  const players = new Map(input.catalog.players.map(p => [p.id, p]));
  return {
    input, players,
    homePassing: avg(input.homeLineup, players, 'shortPassing'),
    awayPassing: avg(input.awayLineup, players, 'shortPassing'),
    homeDecisions: avg(input.homeLineup, players, 'decisions'),
    awayDecisions: avg(input.awayLineup, players, 'decisions'),
    homeMarking: avg(input.homeLineup, players, 'marking'),
    awayMarking: avg(input.awayLineup, players, 'marking'),
  };
}

/** One canonical synthetic phase; consumes exactly five xorshift32 draws. */
function makePhaseShot(
  context: ReturnType<typeof phaseContext>, state: M1ControlledState,
  rng: SeededRng, sequence: number,
): M1SyntheticShot | null {
  const { input, players, homePassing, awayPassing, homeDecisions, awayDecisions,
    homeMarking, awayMarking } = context;
  const phase = state.clock.elapsedSeconds / M1_CLOCK_STEP_SECONDS;
  const draws = [
    rng.nextFloat(), rng.nextFloat(), rng.nextFloat(), rng.nextFloat(), rng.nextFloat(),
  ];
  const homeTactics: TacticalPlan = state.tactics.home;
  const awayTactics: TacticalPlan = state.tactics.away;
  const homePossession = clamp(
    0.535 + (homePassing - awayPassing) / 500 +
    (homeDecisions - awayDecisions) / 900 +
    (homeTactics.mentality - awayTactics.mentality) * 0.017,
    0.27, 0.73,
  );
  const home = draws[0]! < homePossession;
  const attack = home ? homeTactics : awayTactics;
  const lineup = home ? input.homeLineup : input.awayLineup;
  const teamId = home ? input.fixture.homeClubId : input.fixture.awayClubId;
  const offense = home ? homePassing : awayPassing;
  const defending = home ? awayMarking : homeMarking;
  const chance = clamp(
    0.40 + (attack.tempo - 50) * 0.003 +
    (attack.passingRisk - 50) * 0.001 +
    attack.mentality * 0.028 +
    (offense - defending) / 400 + (home ? 0.025 : 0),
    0.08, 0.75,
  );
  if (draws[1]! >= chance) return null;
  const player = chooseShooter(lineup.starters, players, draws[2]!);
  const opposition = home ? input.awayLineup : input.homeLineup;
  const reflexes = goalkeeperReflexes(opposition.starters, players);
  const xgMilli = Math.round(clamp(
    75 + (player.attributes.finishing - 50) * 2 +
    (player.attributes.composure - 50) * 1.2 -
    (reflexes - 50) * 0.9 + draws[3]! * 240,
    20, 600,
  ));
  return {
    schemaVersion: M1_ACTION_EVENT_SCHEMA_VERSION,
    id: 'm1-action-shot-' + (phase + 1), sequence,
    elapsedSeconds: (phase + 1) * M1_CLOCK_STEP_SECONDS - 1,
    type: 'shot', teamId, playerId: player.id, xgMilli,
    outcome: shotOutcome(xgMilli, player, draws[4]!),
  };
}

/**
 * Continue ONLY from an already trusted/replay-verified window.
 * This routine never replays finished phases: it creates exactly the missing
 * RNG draws/events. Callers accepting serialized state MUST independently
 * replay-verify it first (see resumeM1PhaseCheckpoint).
 */
export function extendTrustedM1PhaseWindow(
  input: M1PrematchInput, previous: M1PhaseWindow,
  plannedCommands: readonly unknown[], targetPhases: number,
): M1PhaseWindowResult {
  const completed = previous.controlled.clock.elapsedSeconds / M1_CLOCK_STEP_SECONDS;
  if (!Number.isInteger(completed) || completed < 0 ||
      completed > M1_CLOCK_MAX_EVENTS || !Number.isInteger(targetPhases) ||
      targetPhases < completed || targetPhases > M1_CLOCK_MAX_EVENTS ||
      !Number.isInteger(previous.rngState) || previous.rngState < 1 ||
      previous.rngState > 0xffffffff ||
      previous.rngDraws !== completed * M1_ACTION_DRAW_COUNT_PER_PHASE ||
      !Array.isArray(plannedCommands) || plannedCommands.length > 64) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const rng = new SeededRng(previous.rngState);
  const context = phaseContext(input);
  let state = previous.controlled;
  const events: M1SyntheticEvent[] = [...previous.events];
  let index = 0;
  for (let phase = completed; phase < targetPhases; phase++) {
    const now = state.clock.elapsedSeconds;
    while (index < plannedCommands.length) {
      const command: unknown = plannedCommands[index];
      if (!isRecord(command) || !Number.isInteger(command.elapsedSeconds)) {
        return { ok: false, error: 'INVALID_SCHEDULE' };
      }
      if ((command.elapsedSeconds as number) > now) break;
      if ((command.elapsedSeconds as number) < now) {
        return { ok: false, error: 'INVALID_SCHEDULE' };
      }
      const admitted = submitM1TacticalCommand(state, command);
      if (!admitted.ok) return { ok: false, error: 'REJECTED_COMMAND', detail: admitted.error };
      state = admitted.state;
      index++;
    }
    const shot = makePhaseShot(context, state, rng, events.length + 1);
    if (shot !== null) events.push(shot);
    const advanced = advanceM1ControlledMatch(state);
    if (!advanced.ok) return { ok: false, error: 'INTERNAL_TRANSITION' };
    state = advanced.state;
  }
  if (index !== plannedCommands.length) return { ok: false, error: 'INVALID_SCHEDULE' };
  if (targetPhases === M1_CLOCK_MAX_EVENTS && completed < M1_CLOCK_MAX_EVENTS) {
    events.push({
      schemaVersion: M1_ACTION_EVENT_SCHEMA_VERSION,
      id: 'm1-action-full-time', sequence: events.length + 1,
      elapsedSeconds: M1_CLOCK_MAX_EVENTS * M1_CLOCK_STEP_SECONDS, type: 'full-time',
    });
  }
  return { ok: true, window: {
    controlled: state, events, rngState: rng.snapshot(),
    rngDraws: targetPhases * M1_ACTION_DRAW_COUNT_PER_PHASE,
  } };
}

/** Full synthetic auto-run uses exactly the same engine as true continuation. */
export function simulateM1SyntheticPhases(
  prematch: unknown, policy: unknown, plannedCommands: unknown = [],
): M1SyntheticRun {
  const start = startM1ControlledMatch(prematch, policy);
  if (!start.ok || !isRecord(prematch)) return { ok: false, error: 'INVALID_PREMATCH' };
  const input = prematch as unknown as M1PrematchInput;
  const extended = extendTrustedM1PhaseWindow(input, {
    controlled: start.state, events: [],
    rngState: input.rngSeed, rngDraws: 0,
  }, plannedCommands as readonly unknown[], M1_CLOCK_MAX_EVENTS);
  if (!extended.ok) return extended;
  const replay = deriveM1SyntheticLedger(prematch, extended.window.events);
  if (!replay.ok) return { ok: false, error: 'INVALID_LEDGER' };
  return {
    ok: true, engineVersion: M1_ACTION_ENGINE_VERSION,
    schemaVersion: M1_ACTION_EVENT_SCHEMA_VERSION,
    rngAlgorithmVersion: RNG_VERSION, rngSeed: input.rngSeed,
    rngState: extended.window.rngState,
    rngDraws: extended.window.rngDraws,
    controlled: extended.window.controlled,
    events: extended.window.events, report: replay.report,
  };
}
