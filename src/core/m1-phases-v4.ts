import { isStableId } from './identifiers.js';
import {
  advanceM1PlayerControl, startM1PlayerControl,
  submitM1PlayerInstruction, submitM1TeamTacticsWithPlayerControl,
  type M1PlayerControlState, type M1PlayerFocus,
} from './m1-player-control.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput } from './m1-clock.js';
import { deriveM1SyntheticLedger, type M1SyntheticEvent } from './m1-phases.js';
import type { MatchLedgerReport, ShotOutcome } from './match-contracts.js';
import type { Player } from './model.js';
import { RNG_VERSION, SeededRng } from './rng.js';

/**
 * Isolated experimental v4 football-action schema.
 * Versioned separately: NEVER reinterpret old M0 or M1 v3 match ledgers.
 */
export const M1_V4_ENGINE_VERSION = '3' as const;
export const M1_V4_EVENT_SCHEMA_VERSION = 4 as const;
export const M1_V4_DRAWS_PER_PHASE = 5 as const;
export type M1AttackZone = 'left' | 'center' | 'right';
export interface M1V4Shot {
  readonly schemaVersion: typeof M1_V4_EVENT_SCHEMA_VERSION;
  readonly id: string;
  readonly sequence: number;
  readonly elapsedSeconds: number;
  readonly type: 'shot';
  readonly teamId: string;
  readonly playerId: string;
  readonly zone: M1AttackZone;
  readonly focus: M1PlayerFocus;
  /** Synthetic, not externally calibrated: 700..1000, lower means more fatigued. */
  readonly fatigueMilli: number;
  readonly xgMilli: number;
  readonly outcome: ShotOutcome;
}
export interface M1V4FullTime {
  readonly schemaVersion: typeof M1_V4_EVENT_SCHEMA_VERSION;
  readonly id: 'm1-v4-full-time';
  readonly sequence: number;
  readonly elapsedSeconds: 5400;
  readonly type: 'full-time';
}
export type M1V4Event = M1V4Shot | M1V4FullTime;
export interface M1V4Report {
  readonly ok: true;
  readonly engineVersion: typeof M1_V4_ENGINE_VERSION;
  readonly schemaVersion: typeof M1_V4_EVENT_SCHEMA_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly controlled: M1PlayerControlState;
  readonly events: readonly M1V4Event[];
  readonly report: MatchLedgerReport;
}
export type M1V4Failure = Readonly<{ ok: false; error:
  'INVALID_PREMATCH' | 'INVALID_SCHEDULE' | 'REJECTED_COMMAND' |
  'INVALID_EVENT' | 'INVALID_TRANSITION' }>;
export type M1V4Result = M1V4Report | M1V4Failure;

const SHOT_KEYS = [
  'schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type',
  'teamId', 'playerId', 'zone', 'focus', 'fatigueMilli', 'xgMilli', 'outcome',
] as const;
const END_KEYS = ['schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type'] as const;
const ZONES: readonly string[] = ['left', 'center', 'right'];
const FOCUS: readonly string[] = ['balanced', 'attack', 'defend'];
const OUTCOMES: readonly string[] = ['goal', 'saved', 'blocked', 'off-target'];
const rec = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const ownKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Strict v4 structural replay, then reuse independent historical v3 arithmetic.
 * This does not prove a seed produced the shots: a complete checkpoint replay
 * still needs the trusted seed+command history.
 */
export function deriveM1V4Ledger(
  prematch: unknown, events: unknown,
): Readonly<{ ok: true; report: MatchLedgerReport }> |
    Readonly<{ ok: false; error: 'INVALID_EVENT' }> {
  if (!Array.isArray(events) || events.length < 1 ||
      events.length > M1_CLOCK_MAX_EVENTS + 1) {
    return { ok: false, error: 'INVALID_EVENT' };
  }
  const legacy: M1SyntheticEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const item: unknown = events[i];
    if (!rec(item) || item.schemaVersion !== M1_V4_EVENT_SCHEMA_VERSION ||
        item.sequence !== i + 1) return { ok: false, error: 'INVALID_EVENT' };
    if (item.type === 'full-time') {
      if (!ownKeys(item, END_KEYS) || i !== events.length - 1 ||
          item.id !== 'm1-v4-full-time' || item.elapsedSeconds !== 5400) {
        return { ok: false, error: 'INVALID_EVENT' };
      }
      legacy.push({
        schemaVersion: 3, id: 'm1-action-full-time', sequence: i + 1,
        elapsedSeconds: 5400, type: 'full-time',
      });
      continue;
    }
    if (item.type !== 'shot' || !ownKeys(item, SHOT_KEYS) ||
        !isStableId(item.teamId) || !isStableId(item.playerId) ||
        !Number.isInteger(item.elapsedSeconds) ||
        !Number.isInteger(item.xgMilli) ||
        !Number.isInteger(item.fatigueMilli) ||
        (item.fatigueMilli as number) < 700 || (item.fatigueMilli as number) > 1000 ||
        !ZONES.includes(item.zone as string) || !FOCUS.includes(item.focus as string) ||
        !OUTCOMES.includes(item.outcome as string)) return { ok: false, error: 'INVALID_EVENT' };
    const phase = Math.floor((item.elapsedSeconds as number) / M1_CLOCK_STEP_SECONDS);
    if (phase < 0 || phase >= M1_CLOCK_MAX_EVENTS ||
        item.elapsedSeconds !== (phase + 1) * M1_CLOCK_STEP_SECONDS - 1 ||
        item.id !== 'm1-v4-shot-' + (phase + 1)) {
      return { ok: false, error: 'INVALID_EVENT' };
    }
    legacy.push({
      schemaVersion: 3, id: 'm1-action-shot-' + (phase + 1),
      sequence: i + 1, elapsedSeconds: item.elapsedSeconds as number,
      type: 'shot', teamId: item.teamId, playerId: item.playerId,
      xgMilli: item.xgMilli as number, outcome: item.outcome as ShotOutcome,
    });
  }
  const report = deriveM1SyntheticLedger(prematch, legacy);
  return report.ok ? report : { ok: false, error: 'INVALID_EVENT' };
}

function avg(
  ids: readonly string[], players: ReadonlyMap<string, Player>, key: 'shortPassing' | 'decisions' | 'marking',
): number {
  let total = 0;
  for (const id of ids) total += players.get(id)!.attributes[key];
  return total / ids.length;
}
function focusFor(state: M1PlayerControlState, id: string): M1PlayerFocus {
  return state.instructions.find(x => x.playerId === id)?.focus ?? 'balanced';
}
function playerWeight(p: Player, focus: M1PlayerFocus): number {
  const position = p.primaryPosition === 'ST' ? 4 :
    p.primaryPosition.startsWith('AM') ? 2.5 :
      ['MC', 'ML', 'MR'].includes(p.primaryPosition) ? 1.5 : 1;
  const focusFactor = focus === 'attack' ? 1.55 : focus === 'defend' ? 0.65 : 1;
  return position * focusFactor *
    (20 + p.attributes.finishing + p.attributes.offBallMovement / 2);
}
function chooseShooter(
  ids: readonly string[], players: ReadonlyMap<string, Player>,
  state: M1PlayerControlState, draw: number,
): Player {
  const active = ids.map(id => players.get(id)!).filter(p => p.primaryPosition !== 'GK');
  const total = active.reduce((sum, p) => sum + playerWeight(p, focusFor(state, p.id)), 0);
  let portion = draw * total;
  for (const player of active) {
    portion -= playerWeight(player, focusFor(state, player.id));
    if (portion < 0) return player;
  }
  return active[active.length - 1]!;
}
function fatigueMilli(phase: number, player: Player, pressing: number): number {
  const drain = 160 + (100 - player.attributes.stamina) * 1.3 + (pressing - 50) * 0.6;
  return Math.round(clamp(1000 - (phase / 17) * drain, 700, 1000));
}
function shotOutcome(xgMilli: number, player: Player, draw: number): ShotOutcome {
  const p = xgMilli / 1000;
  const save = (1 - p) * clamp(0.38 + (player.attributes.finishing - 50) / 350, 0.2, 0.56);
  const blocked = (1 - p - save) * 0.45;
  if (draw < p) return 'goal';
  if (draw < p + save) return 'saved';
  if (draw < p + save + blocked) return 'blocked';
  return 'off-target';
}

/** Pure bounded experimental 90-minute generator; not an RPL rules implementation. */
export function simulateM1V4Phases(
  prematch: unknown, policy: unknown, plannedCommands: unknown = [],
): M1V4Result {
  const start = startM1PlayerControl(prematch, policy);
  if (!start.ok || !rec(prematch)) return { ok: false, error: 'INVALID_PREMATCH' };
  if (!Array.isArray(plannedCommands) || plannedCommands.length > 128) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const input = prematch as unknown as M1PrematchInput;
  const players = new Map(input.catalog.players.map(p => [p.id, p]));
  const rng = new SeededRng(input.rngSeed);
  const homePass = avg(input.homeLineup.starters, players, 'shortPassing');
  const awayPass = avg(input.awayLineup.starters, players, 'shortPassing');
  const homeDec = avg(input.homeLineup.starters, players, 'decisions');
  const awayDec = avg(input.awayLineup.starters, players, 'decisions');
  const homeMark = avg(input.homeLineup.starters, players, 'marking');
  const awayMark = avg(input.awayLineup.starters, players, 'marking');
  let state = start.state, cursor = 0;
  const events: M1V4Event[] = [];
  for (let phase = 0; phase < M1_CLOCK_MAX_EVENTS; phase++) {
    const now = phase * M1_CLOCK_STEP_SECONDS;
    while (cursor < plannedCommands.length) {
      const command: unknown = plannedCommands[cursor];
      if (!rec(command) || !Number.isInteger(command.elapsedSeconds)) {
        return { ok: false, error: 'INVALID_SCHEDULE' };
      }
      if ((command.elapsedSeconds as number) > now) break;
      if ((command.elapsedSeconds as number) < now) {
        return { ok: false, error: 'INVALID_SCHEDULE' };
      }
      const accepted = command.kind === 'set-player-focus' ?
        submitM1PlayerInstruction(input, policy, state, command) :
        command.kind === 'set-tactics' ?
          submitM1TeamTacticsWithPlayerControl(input, policy, state, command) :
          null;
      if (!accepted?.ok) return { ok: false, error: 'REJECTED_COMMAND' };
      state = accepted.state;
      cursor++;
    }
    // Exactly five draws even when there is no shot, preserving deterministic indexing.
    const possession = rng.nextFloat();
    const chanceDraw = rng.nextFloat();
    const playerDraw = rng.nextFloat();
    const qualityDraw = rng.nextFloat();
    const outcomeDraw = rng.nextFloat();
    const homeTactics = state.controlled.tactics.home;
    const awayTactics = state.controlled.tactics.away;
    const homePossession = clamp(
      0.535 + (homePass - awayPass) / 500 + (homeDec - awayDec) / 900 +
      (homeTactics.mentality - awayTactics.mentality) * 0.017, 0.27, 0.73,
    );
    const home = possession < homePossession;
    const attack = home ? homeTactics : awayTactics;
    const lineup = home ? input.homeLineup : input.awayLineup;
    const teamId = home ? input.fixture.homeClubId : input.fixture.awayClubId;
    const offense = home ? homePass : awayPass;
    const defense = home ? awayMark : homeMark;
    const attackingFocus = state.instructions.filter(
      x => x.teamId === teamId && x.focus === 'attack',
    ).length;
    const defendingFocus = state.instructions.filter(
      x => x.teamId === teamId && x.focus === 'defend',
    ).length;
    const chance = clamp(
      0.40 + (attack.tempo - 50) * 0.003 +
      (attack.passingRisk - 50) * 0.001 +
      attack.mentality * 0.028 +
      (offense - defense) / 400 + (home ? 0.025 : 0) +
      (attackingFocus - defendingFocus) * 0.012 - phase * 0.002,
      0.08, 0.75,
    );
    if (chanceDraw < chance) {
      const player = chooseShooter(lineup.starters, players, state, playerDraw);
      const focus = focusFor(state, player.id);
      const opposition = home ? input.awayLineup : input.homeLineup;
      const keeper = players.get(opposition.starters.find(
        id => players.get(id)!.primaryPosition === 'GK',
      )!)!;
      const zoneIndex = Math.min(2, Math.floor(qualityDraw * 3));
      const zone: M1AttackZone = zoneIndex === 0 ? 'left' :
        zoneIndex === 1 ? 'center' : 'right';
      const quality = qualityDraw * 3 - zoneIndex;
      const fatigue = fatigueMilli(phase, player, attack.pressing);
      const zoneBonus = zone === 'center' ? 18 : -8;
      const focusBonus = focus === 'attack' ? 22 : focus === 'defend' ? -18 : 0;
      const xgMilli = Math.round(clamp(
        (74 + (player.attributes.finishing - 50) * 2 +
          (player.attributes.composure - 50) * 1.2 -
          (keeper.attributes.reflexes - 50) * 0.9 +
          quality * 220 + zoneBonus + focusBonus) * fatigue / 1000,
        20, 600,
      ));
      events.push({
        schemaVersion: M1_V4_EVENT_SCHEMA_VERSION,
        id: 'm1-v4-shot-' + (phase + 1),
        sequence: events.length + 1,
        elapsedSeconds: (phase + 1) * M1_CLOCK_STEP_SECONDS - 1,
        type: 'shot', teamId, playerId: player.id, zone, focus,
        fatigueMilli: fatigue, xgMilli,
        outcome: shotOutcome(xgMilli, player, outcomeDraw),
      });
    }
    const advanced = advanceM1PlayerControl(input, policy, state);
    if (!advanced.ok) return { ok: false, error: 'INVALID_TRANSITION' };
    state = advanced.state;
  }
  if (cursor !== plannedCommands.length) return { ok: false, error: 'INVALID_SCHEDULE' };
  events.push({
    schemaVersion: M1_V4_EVENT_SCHEMA_VERSION,
    id: 'm1-v4-full-time', sequence: events.length + 1,
    elapsedSeconds: 5400, type: 'full-time',
  });
  const ledger = deriveM1V4Ledger(input, events);
  if (!ledger.ok) return { ok: false, error: 'INVALID_EVENT' };
  return {
    ok: true,
    engineVersion: M1_V4_ENGINE_VERSION, schemaVersion: M1_V4_EVENT_SCHEMA_VERSION,
    rngAlgorithmVersion: RNG_VERSION, rngSeed: input.rngSeed,
    rngState: rng.snapshot(), rngDraws: M1_CLOCK_MAX_EVENTS * M1_V4_DRAWS_PER_PHASE,
    controlled: state, events, report: ledger.report,
  };
}
