import { isStableId } from './identifiers.js';
import { sameCanonicalValue } from './canonical-value.js';
import { advanceM1Availability, startM1Availability, submitM1AvailabilityAction }
  from './m1-availability.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS, type M1PrematchInput }
  from './m1-clock.js';
import type { MatchLedgerReport } from './match-contracts.js';
import { M1_V6_EVENT_SCHEMA_VERSION } from './m1-phases-v6.js';

export type M1V6Ledger =
  | Readonly<{ ok: true; report: MatchLedgerReport }>
  | Readonly<{ ok: false; error: 'INVALID_LEDGER' }>;
const SHOT_KEYS = ['schemaVersion', 'id', 'sequence', 'elapsedSeconds',
  'type', 'teamId', 'playerId', 'zone', 'focus',
  'fatigueMilli', 'xgMilli', 'outcome'] as const;
const AVAIL_KEYS = ['schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type', 'entry'] as const;
const FULL_KEYS = ['schemaVersion', 'id', 'sequence', 'elapsedSeconds', 'type'] as const;
const bad = { ok: false, error: 'INVALID_LEDGER' } as const;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const blank = () => ({ goals: 0, shots: 0, shotsOnTarget: 0, xgMilli: 0 });

/**
 * Derive score from an ordered v6 stream, replaying normal substitutions and
 * disciplinary effects before each shot to verify active player eligibility.
 * This checks structural consistency, not the claimed xorshift32 seed.
 */
export function deriveM1V6Ledger(
  prematch: unknown, policy: unknown, events: unknown,
): M1V6Ledger {
  const first = startM1Availability(prematch, policy);
  if (!first.ok || !record(prematch) || !Array.isArray(events) ||
      events.length < 1 || events.length > 93) return bad;
  const input = prematch as unknown as M1PrematchInput;
  const positions = new Map(input.catalog.players.map(p => [p.id, p.primaryPosition]));
  let state = first.state, lastSecond = -1, lastShotPhase = -1;
  const home = blank(), away = blank();
  for (let i = 0; i < events.length; i++) {
    const item: unknown = events[i];
    if (!record(item) || item.schemaVersion !== M1_V6_EVENT_SCHEMA_VERSION ||
        !isStableId(item.id) || item.sequence !== i + 1 ||
        typeof item.elapsedSeconds !== 'number' ||
        !Number.isInteger(item.elapsedSeconds) || item.elapsedSeconds < lastSecond) {
      return bad;
    }
    const second = item.elapsedSeconds;
    const checkpoint = item.type === 'shot' ?
      Math.floor(second / M1_CLOCK_STEP_SECONDS) * M1_CLOCK_STEP_SECONDS : second;
    if (checkpoint < state.substitutions.clock.elapsedSeconds ||
        checkpoint > 5400 || checkpoint % M1_CLOCK_STEP_SECONDS !== 0) return bad;
    while (state.substitutions.clock.elapsedSeconds < checkpoint) {
      const advanced = advanceM1Availability(input, policy, state);
      if (!advanced.ok) return bad;
      state = advanced.state;
    }
    lastSecond = second;
    if (item.type === 'full-time') {
      if (i !== events.length - 1 || !exact(item, FULL_KEYS) ||
          item.id !== 'm1-v6-full-time' || second !== 5400 ||
          state.status !== 'full-time') return bad;
      return { ok: true, report: { fixtureId: input.fixture.id, home, away } };
    }
    if (item.type === 'availability') {
      if (!exact(item, AVAIL_KEYS) || !record(item.entry) ||
          !record(item.entry.action) || second !== checkpoint) return bad;
      const next = submitM1AvailabilityAction(input, policy, state, item.entry.action);
      if (!next.ok) return bad;
      const recorded = next.state.timeline[next.state.timeline.length - 1];
      if (!recorded || !sameCanonicalValue(item.entry, recorded) ||
          item.id !== 'm1-v6-availability-' + recorded.sequence ||
          item.entry.action.elapsedSeconds !== second) return bad;
      state = next.state;
      continue;
    }
    if (item.type !== 'shot' || !exact(item, SHOT_KEYS) ||
        state.status !== 'playing' ||
        !isStableId(item.teamId) || !isStableId(item.playerId) ||
        typeof item.fatigueMilli !== 'number' || !Number.isInteger(item.fatigueMilli) ||
        item.fatigueMilli < 700 || item.fatigueMilli > 1000 ||
        typeof item.xgMilli !== 'number' || !Number.isInteger(item.xgMilli) ||
        item.xgMilli < 20 || item.xgMilli > 600 ||
        !['left', 'center', 'right'].includes(item.zone as string) ||
        !['balanced', 'attack', 'defend'].includes(item.focus as string) ||
        !['goal', 'saved', 'blocked', 'off-target'].includes(item.outcome as string)) {
      return bad;
    }
    const phase = Math.floor(second / M1_CLOCK_STEP_SECONDS);
    if (phase < 0 || phase >= M1_CLOCK_MAX_EVENTS || phase <= lastShotPhase ||
        second !== (phase + 1) * M1_CLOCK_STEP_SECONDS - 1 ||
        item.id !== 'm1-v6-shot-' + (phase + 1)) return bad;
    const side = item.teamId === input.fixture.homeClubId ? 'home' :
      item.teamId === input.fixture.awayClubId ? 'away' : null;
    if (side === null || !state.teams[side].active.includes(item.playerId) ||
        positions.get(item.playerId) === 'GK') return bad;
    const stats = side === 'home' ? home : away;
    stats.shots++;
    stats.xgMilli += item.xgMilli;
    if (item.outcome === 'goal') stats.goals++;
    if (item.outcome === 'goal' || item.outcome === 'saved') stats.shotsOnTarget++;
    lastShotPhase = phase;
  }
  return bad;
}
