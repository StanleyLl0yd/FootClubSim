import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import { isStableId } from './identifiers.js';
import { startM1Clock, type M1PrematchInput } from './m1-clock.js';

/**
 * Pre-match admission gate for externally authenticated match-specific bans.
 * This does NOT calculate sanctions from cards or verify the authority of JSON.
 * Each ruling states exactly which fixtures it restricts: no invented expiry.
 */
export const M1_SUSPENSION_GATE_SCHEMA_VERSION = 1 as const;
export const M1_SUSPENSION_MAX_ORDERS = 256 as const;
const RULING_KEYS = ['schemaVersion', 'rulingId', 'kind', 'clubId',
  'playerId', 'affectedFixtureIds'] as const;

export interface M1ConfirmedSuspension {
  readonly schemaVersion: typeof M1_SUSPENSION_GATE_SCHEMA_VERSION;
  readonly rulingId: string;
  readonly kind: 'match-suspension';
  readonly clubId: string;
  readonly playerId: string;
  /** Ordered, explicit fixtures covered by this separately verified decision. */
  readonly affectedFixtureIds: readonly string[];
}
export interface M1SuspensionAdmission {
  readonly ok: true;
  readonly schemaVersion: typeof M1_SUSPENSION_GATE_SCHEMA_VERSION;
  readonly fixtureId: string;
  readonly blockedHomePlayers: readonly string[];
  readonly blockedAwayPlayers: readonly string[];
}
export type M1SuspensionError = 'INVALID_PREMATCH' | 'INVALID_RULINGS' |
  'WRONG_FIXTURE' | 'DUPLICATE_RULING' | 'OVERLAPPING_RULINGS' |
  'SUSPENDED_PLAYER';
export type M1SuspensionGate =
  | M1SuspensionAdmission
  | Readonly<{ ok: false; error: M1SuspensionError; playerIds?: readonly string[] }>;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (error: M1SuspensionError): M1SuspensionGate => ({ ok: false, error });
const exact = (raw: Record<string, unknown>): boolean =>
  Object.keys(raw).length === RULING_KEYS.length &&
  RULING_KEYS.every(key => Object.hasOwn(raw, key));
function fixturesFor(input: M1PrematchInput): ReadonlyMap<string, Fixture> {
  return new Map(generateDoubleRoundRobin(input.catalog.clubs.map(c => c.id))
    .flatMap(round => round.fixtures).map(f => [f.id, f]));
}
function matchingFixture(a: Fixture, b: Fixture): boolean {
  return a.id === b.id && a.round === b.round &&
    a.homeClubId === b.homeClubId && a.awayClubId === b.awayClubId;
}

/**
 * trustedRulings must be a COMPLETE, authenticated snapshot for the fixture.
 * Empty input means an authoritative no-suspensions assertion only when the
 * caller has established completeness. Never read it from a client save.
 */
export function admitM1ConfirmedSuspensions(
  prematch: unknown, trustedRulings: unknown,
): M1SuspensionGate {
  const started = startM1Clock(prematch);
  if (!started.ok) return fail('INVALID_PREMATCH');
  const input = prematch as M1PrematchInput;
  const count = input.catalog.clubs.length;
  if (count < 2 || count > 64 || count % 2 !== 0) return fail('INVALID_PREMATCH');
  const fixtures = fixturesFor(input);
  const fixture = fixtures.get(input.fixture.id);
  if (!fixture || !matchingFixture(input.fixture, fixture)) return fail('WRONG_FIXTURE');
  if (!Array.isArray(trustedRulings) ||
      trustedRulings.length > M1_SUSPENSION_MAX_ORDERS) return fail('INVALID_RULINGS');
  const clubs = new Map(input.catalog.clubs.map(c => [c.id, new Set(c.registeredPlayerIds)]));
  const rulingIds = new Set<string>();
  const occupied = new Set<string>();
  const blockedHome = new Set<string>(), blockedAway = new Set<string>();
  for (const raw of trustedRulings) {
    if (!record(raw) || !exact(raw) ||
        raw.schemaVersion !== M1_SUSPENSION_GATE_SCHEMA_VERSION ||
        raw.kind !== 'match-suspension' ||
        !isStableId(raw.rulingId) || !isStableId(raw.clubId) ||
        !isStableId(raw.playerId) || !Array.isArray(raw.affectedFixtureIds) ||
        raw.affectedFixtureIds.length < 1 || raw.affectedFixtureIds.length > 30 ||
        !clubs.get(raw.clubId)?.has(raw.playerId as string)) return fail('INVALID_RULINGS');
    if (rulingIds.has(raw.rulingId)) return fail('DUPLICATE_RULING');
    rulingIds.add(raw.rulingId);
    const local = new Set<string>();
    for (const id of raw.affectedFixtureIds) {
      const scheduled = isStableId(id) ? fixtures.get(id) : null;
      if (!scheduled || local.has(id) ||
          (scheduled.homeClubId !== raw.clubId &&
            scheduled.awayClubId !== raw.clubId)) return fail('INVALID_RULINGS');
      local.add(id);
      const key = raw.playerId + '\u0000' + id;
      if (occupied.has(key)) return fail('OVERLAPPING_RULINGS');
      occupied.add(key);
    }
    if (local.has(fixture.id)) {
      const team = raw.clubId === fixture.homeClubId ? blockedHome : blockedAway;
      team.add(raw.playerId as string);
    }
  }
  const homeIds = [...blockedHome].sort(), awayIds = [...blockedAway].sort();
  const homeNamed = new Set([...input.homeLineup.starters, ...input.homeLineup.bench]);
  const awayNamed = new Set([...input.awayLineup.starters, ...input.awayLineup.bench]);
  const ineligible = [...homeIds.filter(id => homeNamed.has(id)),
    ...awayIds.filter(id => awayNamed.has(id))].sort();
  if (ineligible.length) {
    return { ok: false, error: 'SUSPENDED_PLAYER', playerIds: ineligible };
  }
  return {
    ok: true, schemaVersion: M1_SUSPENSION_GATE_SCHEMA_VERSION,
    fixtureId: fixture.id,
    blockedHomePlayers: homeIds, blockedAwayPlayers: awayIds,
  };
}
