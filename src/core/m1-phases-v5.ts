import { isStableId } from './identifiers.js';
import {
  advanceM1PlayerControl, startM1PlayerControl,
  submitM1PlayerInstruction, submitM1TeamTacticsWithPlayerControl,
  type M1PlayerControlState, type M1PlayerFocus,
} from './m1-player-control.js';
import {
  advanceM1SubstitutionMatch, startM1SubstitutionMatch,
  submitM1NormalSubstitution, type M1SubstitutionCommand, type M1SubstitutionState,
} from './m1-substitutions.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput } from './m1-clock.js';
import type { MatchLedgerReport, ShotOutcome } from './match-contracts.js';
import type { Player } from './model.js';
import { RNG_VERSION, SeededRng } from './rng.js';

/**
 * v5-only bridge from approved normal substitutions to active action players.
 * The legacy M0, v3 and v4 shot ledgers are kept unchanged and independently
 * readable. Physical referee procedure and exceptional substitutions not done.
 */
export const M1_V5_ENGINE_VERSION = '4' as const;
export const M1_V5_EVENT_SCHEMA_VERSION = 5 as const;
export const M1_V5_DRAWS_PER_PHASE = 5 as const;
/** Explicit opt-in research controls; absent controls retain historical v5. */
export interface M1V104ResearchParameters {
  readonly shotOpportunityMultiplier: number;
  readonly xgMultiplier: number;
  readonly saveMultiplier: number;
}
export function validM1V104ResearchParameters(v: unknown): v is M1V104ResearchParameters {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>;
  const names = ['shotOpportunityMultiplier', 'xgMultiplier', 'saveMultiplier'];
  if (Object.keys(p).length !== 3 || !names.every(k => Object.hasOwn(p, k))) return false;
  return typeof p.shotOpportunityMultiplier === 'number' &&
    Number.isFinite(p.shotOpportunityMultiplier) &&
    p.shotOpportunityMultiplier >= 0.5 && p.shotOpportunityMultiplier <= 1.5 &&
    typeof p.xgMultiplier === 'number' && Number.isFinite(p.xgMultiplier) &&
    p.xgMultiplier >= 0.35 && p.xgMultiplier <= 1.5 &&
    typeof p.saveMultiplier === 'number' && Number.isFinite(p.saveMultiplier) &&
    p.saveMultiplier >= 0.3 && p.saveMultiplier <= 1.5;
}
export type M1V5Zone = 'left' | 'center' | 'right';
interface M1V5Base {
  readonly schemaVersion: typeof M1_V5_EVENT_SCHEMA_VERSION;
  readonly id: string;
  readonly sequence: number;
  readonly elapsedSeconds: number;
}
export interface M1V5Shot extends M1V5Base {
  readonly type: 'shot';
  readonly teamId: string;
  readonly playerId: string;
  readonly zone: M1V5Zone;
  readonly focus: M1PlayerFocus;
  readonly fatigueMilli: number;
  readonly xgMilli: number;
  readonly outcome: ShotOutcome;
}
export interface M1V5Substitution extends M1V5Base {
  readonly type: 'substitution';
  readonly command: M1SubstitutionCommand;
}
export interface M1V5FullTime extends M1V5Base {
  readonly type: 'full-time';
}
export type M1V5Event = M1V5Shot | M1V5Substitution | M1V5FullTime;
export interface M1V5Result {
  readonly ok: true;
  readonly engineVersion: typeof M1_V5_ENGINE_VERSION;
  readonly schemaVersion: typeof M1_V5_EVENT_SCHEMA_VERSION;
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly rngSeed: number;
  readonly rngState: number;
  readonly rngDraws: number;
  readonly controlled: M1PlayerControlState;
  readonly substitutions: M1SubstitutionState;
  readonly events: readonly M1V5Event[];
  readonly report: MatchLedgerReport;
}
export type M1V5Failure = Readonly<{ ok: false; error:
  'INVALID_PREMATCH' | 'INVALID_SCHEDULE' | 'REJECTED_COMMAND' |
  'INVALID_EVENT' | 'INVALID_TRANSITION' }>;
export type M1V5Run = M1V5Result | M1V5Failure;
const SHOT_KEYS = [
  'schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type',
  'teamId', 'playerId', 'zone', 'focus', 'fatigueMilli', 'xgMilli', 'outcome',
] as const;
const SUB_KEYS = [
  'schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type', 'command',
] as const;
const END_KEYS = ['schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type'] as const;
const ZONES: readonly string[] = ['left', 'center', 'right'];
const FOCUS: readonly string[] = ['balanced', 'attack', 'defend'];
const OUTCOMES: readonly string[] = ['goal', 'saved', 'blocked', 'off-target'];
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const ownKeys = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));
function blankStats() {
  return { goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 };
}

/**
 * Independent v5 arithmetic validates ordered substitutions and every shot
 * against the XI active at that virtual second. Structural coherence is NOT
 * proof the claimed seed generated the action stream.
 */
export function deriveM1V5Ledger(
  prematch: unknown, policy: unknown, candidate: unknown,
): Readonly<{ ok: true; report: MatchLedgerReport }> |
    Readonly<{ ok: false; error: 'INVALID_EVENT' }> {
  const invalid = { ok: false, error: 'INVALID_EVENT' } as const;
  const initial = startM1SubstitutionMatch(prematch, policy);
  if (!initial.ok || !rec(prematch) || !Array.isArray(candidate) ||
      candidate.length < 1 || candidate.length > 29) return invalid;
  const input = prematch as unknown as M1PrematchInput;
  const players = new Map(input.catalog.players.map(p => [p.id, p]));
  let state = initial.state, lastTime = -1, lastShotPhase = -1;
  const home = blankStats(), away = blankStats();
  for (let i = 0; i < candidate.length; i++) {
    const item: unknown = candidate[i];
    if (!rec(item) || item.schemaVersion !== M1_V5_EVENT_SCHEMA_VERSION ||
        item.sequence !== i + 1 || !isStableId(item.id) ||
        !Number.isInteger(item.elapsedSeconds) ||
        (item.elapsedSeconds as number) < lastTime) return invalid;
    const elapsed = item.elapsedSeconds as number;
    const phaseTime = item.type === 'shot' ?
      Math.floor(elapsed / M1_CLOCK_STEP_SECONDS) * M1_CLOCK_STEP_SECONDS : elapsed;
    if (phaseTime < state.clock.elapsedSeconds ||
        phaseTime > M1_CLOCK_MAX_EVENTS * M1_CLOCK_STEP_SECONDS ||
        phaseTime % M1_CLOCK_STEP_SECONDS !== 0) return invalid;
    while (state.clock.elapsedSeconds < phaseTime) {
      const tick = advanceM1SubstitutionMatch(input, policy, state);
      if (!tick.ok) return invalid;
      state = tick.state;
    }
    lastTime = elapsed;
    if (item.type === 'full-time') {
      if (i !== candidate.length - 1 || !ownKeys(item, END_KEYS) ||
          item.id !== 'm1-v5-full-time' || elapsed !== 5400) return invalid;
      return { ok: true, report: { fixtureId: input.fixture.id, home, away } };
    }
    if (item.type === 'substitution') {
      if (!ownKeys(item, SUB_KEYS) || !rec(item.command) ||
          item.id !== 'm1-v5-sub-' + item.command.commandId ||
          item.command.elapsedSeconds !== elapsed) return invalid;
      const next = submitM1NormalSubstitution(input, policy, state, item.command);
      if (!next.ok) return invalid;
      state = next.state;
      continue;
    }
    if (item.type !== 'shot' || !ownKeys(item, SHOT_KEYS) ||
        !isStableId(item.teamId) || !isStableId(item.playerId) ||
        !Number.isInteger(item.fatigueMilli) ||
        (item.fatigueMilli as number) < 700 || (item.fatigueMilli as number) > 1000 ||
        !Number.isInteger(item.xgMilli) || (item.xgMilli as number) < 20 ||
        (item.xgMilli as number) > 600 ||
        !ZONES.includes(item.zone as string) || !FOCUS.includes(item.focus as string) ||
        !OUTCOMES.includes(item.outcome as string)) return invalid;
    const phase = Math.floor(elapsed / M1_CLOCK_STEP_SECONDS);
    if (phase < 0 || phase >= M1_CLOCK_MAX_EVENTS || phase <= lastShotPhase ||
        elapsed !== (phase + 1) * M1_CLOCK_STEP_SECONDS - 1 ||
        item.id !== 'm1-v5-shot-' + (phase + 1)) return invalid;
    const side = item.teamId === input.fixture.homeClubId ? 'home' :
      item.teamId === input.fixture.awayClubId ? 'away' : null;
    if (side === null || !state.teams[side].active.includes(item.playerId) ||
        players.get(item.playerId)?.primaryPosition === 'GK') return invalid;
    const stats = side === 'home' ? home : away;
    stats.shots++;
    stats.xgMilli += item.xgMilli as number;
    if (item.outcome === 'goal') stats.goals++;
    if (item.outcome === 'goal' || item.outcome === 'saved') stats.shotsOnTarget++;
    lastShotPhase = phase;
  }
  return invalid;
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
function shotOutcome(
  xgMilli: number, player: Player, draw: number,
  research?: M1V104ResearchParameters,
): ShotOutcome {
  const p = xgMilli / 1000;
  const save = (1 - p) * clamp(0.38 + (player.attributes.finishing - 50) / 350, 0.2, 0.56);
  const effectiveSave = research ? Math.min(1 - p, save * research.saveMultiplier) : save;
  const blocked = (1 - p - effectiveSave) * 0.45;
  if (draw < p) return 'goal';
  if (draw < p + effectiveSave) return 'saved';
  if (draw < p + effectiveSave + blocked) return 'blocked';
  return 'off-target';
}


/** One validated-source *synthetic* phase. Exactly 5 RNG draws even without a shot.
 * Call with already admitted, immutable active XI and trusted tactical state.
 * No historical v5 probability or event interpretation is changed.
 */
export function computeM1V5PhaseShot(
  input: M1PrematchInput, state: M1PlayerControlState,
  players: ReadonlyMap<string, Player>,
  active: Readonly<{ home: readonly string[]; away: readonly string[] }>,
  phase: number, rng: SeededRng, sequence: number,
): M1V5Shot | null {
  return computeM1ShotKernel(input, state, players, active, phase, rng, sequence);
}
/** Never called by production/v99/v101/v103 without explicit opt-in. */
export function computeM1V104ResearchPhaseShot(
  input: M1PrematchInput, state: M1PlayerControlState,
  players: ReadonlyMap<string, Player>,
  active: Readonly<{ home: readonly string[]; away: readonly string[] }>,
  phase: number, rng: SeededRng, sequence: number,
  research: M1V104ResearchParameters,
): M1V5Shot | null {
  if (!validM1V104ResearchParameters(research)) throw Error('INVALID_V104_PARAMETERS');
  return computeM1ShotKernel(input, state, players, active, phase, rng, sequence, research);
}
function computeM1ShotKernel(
  input: M1PrematchInput, state: M1PlayerControlState,
  players: ReadonlyMap<string, Player>,
  active: Readonly<{ home: readonly string[]; away: readonly string[] }>,
  phase: number, rng: SeededRng, sequence: number,
  research?: M1V104ResearchParameters,
): M1V5Shot | null {
    // No skipped PRNG draws: five per phase for either tactical/roster state.
    const possession = rng.nextFloat();
    const chanceDraw = rng.nextFloat();
    const playerDraw = rng.nextFloat();
    const qualityDraw = rng.nextFloat();
    const outcomeDraw = rng.nextFloat();
    const homeIds = active.home, awayIds = active.away;
    const homePass = avg(homeIds, players, 'shortPassing');
    const awayPass = avg(awayIds, players, 'shortPassing');
    const homeDec = avg(homeIds, players, 'decisions');
    const awayDec = avg(awayIds, players, 'decisions');
    const homeMark = avg(homeIds, players, 'marking');
    const awayMark = avg(awayIds, players, 'marking');
    const homeTactics = state.controlled.tactics.home;
    const awayTactics = state.controlled.tactics.away;
    const homePossession = clamp(
      0.535 + (homePass - awayPass) / 500 + (homeDec - awayDec) / 900 +
      (homeTactics.mentality - awayTactics.mentality) * 0.017, 0.27, 0.73,
    );
    const homeTeam = possession < homePossession;
    const attack = homeTeam ? homeTactics : awayTactics;
    const activeIds = homeTeam ? homeIds : awayIds;
    const teamId = homeTeam ? input.fixture.homeClubId : input.fixture.awayClubId;
    const offense = homeTeam ? homePass : awayPass;
    const defense = homeTeam ? awayMark : homeMark;
    const attackFocus = state.instructions.filter(x =>
      x.teamId === teamId && activeIds.includes(x.playerId) && x.focus === 'attack').length;
    const defenseFocus = state.instructions.filter(x =>
      x.teamId === teamId && activeIds.includes(x.playerId) && x.focus === 'defend').length;
    const chance = clamp(
      0.40 + (attack.tempo - 50) * 0.003 +
      (attack.passingRisk - 50) * 0.001 +
      attack.mentality * 0.028 +
      (offense - defense) / 400 + (homeTeam ? 0.025 : 0) +
      (attackFocus - defenseFocus) * 0.012 - phase * 0.002,
      0.08, 0.75,
    );
    if (chanceDraw < (research ? clamp(chance * research.shotOpportunityMultiplier, 0, 1) : chance)) {
      const player = chooseShooter(activeIds, players, state, playerDraw);
      const focus = focusFor(state, player.id);
      const otherIds = homeTeam ? awayIds : homeIds;
      const keeper = players.get(otherIds.find(
        id => players.get(id)!.primaryPosition === 'GK',
      )!)!;
      const zoneIndex = Math.min(2, Math.floor(qualityDraw * 3));
      const zone: M1V5Zone = zoneIndex === 0 ? 'left' :
        zoneIndex === 1 ? 'center' : 'right';
      const quality = qualityDraw * 3 - zoneIndex;
      const fatigue = fatigueMilli(phase, player, attack.pressing);
      const zoneBonus = zone === 'center' ? 18 : -8;
      const focusBonus = focus === 'attack' ? 22 : focus === 'defend' ? -18 : 0;
      const xgMilli = Math.round(clamp(
        (74 + (player.attributes.finishing - 50) * 2 +
          (player.attributes.composure - 50) * 1.2 -
          (keeper.attributes.reflexes - 50) * 0.9 +
          quality * 220 + zoneBonus + focusBonus) * fatigue / 1000 *
          (research ? research.xgMultiplier : 1),
        20, 600,
      ));
      return {
        schemaVersion: M1_V5_EVENT_SCHEMA_VERSION,
        id: 'm1-v5-shot-' + (phase + 1),
        sequence,
        elapsedSeconds: (phase + 1) * M1_CLOCK_STEP_SECONDS - 1,
        type: 'shot', teamId, playerId: player.id, zone, focus,
        fatigueMilli: fatigue, xgMilli,
        outcome: shotOutcome(xgMilli, player, outcomeDraw, research),
      };
    }
    return null;
}

/**
 * End-to-end v5 prototype. A substitution becomes a ledger event and changes
 * subsequent possession, skill averages, weighted shooters and goalkeeper.
 * Stoppages must already have been admitted by a trusted referee controller;
 * a caller merely claiming 'referee-authorized' is NOT external proof.
 */
export function simulateM1V5Phases(
  prematch: unknown, policy: unknown, plannedCommands: unknown = [],
): M1V5Run {
  const started = startM1PlayerControl(prematch, policy);
  const rosterStart = startM1SubstitutionMatch(prematch, policy);
  if (!started.ok || !rosterStart.ok || !rec(prematch)) {
    return { ok: false, error: 'INVALID_PREMATCH' };
  }
  if (!Array.isArray(plannedCommands) || plannedCommands.length > 138) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  const input = prematch as unknown as M1PrematchInput;
  const players = new Map(input.catalog.players.map(p => [p.id, p]));
  const rng = new SeededRng(input.rngSeed);
  let state = started.state, roster = rosterStart.state, cursor = 0;
  const seen = new Set<string>();
  const events: M1V5Event[] = [];
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
      if (!isStableId(command.commandId) || seen.has(command.commandId)) {
        return { ok: false, error: 'REJECTED_COMMAND' };
      }
      if (command.kind === 'substitute-normal') {
        const replaced = submitM1NormalSubstitution(input, policy, roster, command);
        if (!replaced.ok) return { ok: false, error: 'REJECTED_COMMAND' };
        roster = replaced.state;
        events.push({
          schemaVersion: M1_V5_EVENT_SCHEMA_VERSION,
          id: 'm1-v5-sub-' + command.commandId,
          sequence: events.length + 1, elapsedSeconds: now, type: 'substitution',
          command: {
            schemaVersion: 1, commandId: command.commandId,
            fixtureId: command.fixtureId as string,
            teamId: command.teamId as string, elapsedSeconds: now,
            actor: { ...(command.actor as object) } as M1SubstitutionCommand['actor'],
            kind: 'substitute-normal',
            outPlayerId: command.outPlayerId as string,
            inPlayerId: command.inPlayerId as string,
            stoppage: command.stoppage as M1SubstitutionCommand['stoppage'],
          },
        });
      } else {
        // v1 individual instructions still apply to initially active starters
        // only; substituted-in bench players default to balanced.
        const accepted = command.kind === 'set-player-focus' ?
          submitM1PlayerInstruction(input, policy, state, command) :
          command.kind === 'set-tactics' ?
            submitM1TeamTacticsWithPlayerControl(input, policy, state, command) : null;
        if (!accepted?.ok) return { ok: false, error: 'REJECTED_COMMAND' };
        if (command.kind === 'set-player-focus') {
          const side = command.teamId === input.fixture.homeClubId ? 'home' :
            command.teamId === input.fixture.awayClubId ? 'away' : null;
          if (side === null || !roster.teams[side].active.includes(command.playerId as string)) {
            return { ok: false, error: 'REJECTED_COMMAND' };
          }
        }
        state = accepted.state;
      }
      seen.add(command.commandId);
      cursor++;
    }

    const shot = computeM1V5PhaseShot(
      input, state, players,
      { home: roster.teams.home.active, away: roster.teams.away.active },
      phase, rng, events.length + 1,
    );
    if (shot !== null) events.push(shot);
    const after = advanceM1PlayerControl(input, policy, state);
    const afterRoster = advanceM1SubstitutionMatch(input, policy, roster);
    if (!after.ok || !afterRoster.ok) return { ok: false, error: 'INVALID_TRANSITION' };
    state = after.state;
    roster = afterRoster.state;
  }
  if (cursor !== plannedCommands.length) return { ok: false, error: 'INVALID_SCHEDULE' };
  events.push({
    schemaVersion: M1_V5_EVENT_SCHEMA_VERSION,
    id: 'm1-v5-full-time', sequence: events.length + 1,
    elapsedSeconds: 5400, type: 'full-time',
  });
  const ledger = deriveM1V5Ledger(input, policy, events);
  if (!ledger.ok) return { ok: false, error: 'INVALID_EVENT' };
  return {
    ok: true, engineVersion: M1_V5_ENGINE_VERSION,
    schemaVersion: M1_V5_EVENT_SCHEMA_VERSION,
    rngAlgorithmVersion: RNG_VERSION, rngSeed: input.rngSeed,
    rngState: rng.snapshot(), rngDraws: M1_CLOCK_MAX_EVENTS * M1_V5_DRAWS_PER_PHASE,
    controlled: state, substitutions: roster, events, report: ledger.report,
  };
}
