import { isStableId } from './identifiers.js';
import { startM1Clock, type M1PrematchInput } from './m1-clock.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * IFAB 2026/27 Law 5 exception-claim inspection. This is NOT a referee
 * decision, medical diagnosis or permission to keep/re-enter a player.
 * Match events and saved careers are never changed by this function.
 */
export const M1_MEDICAL_EXCEPTION_SCHEMA = 1 as const;
export const M1_MEDICAL_EXCEPTION_RULES =
  'ifab-2026-27-law5-claimed-exceptions-only' as const;
export type M1MedicalExceptionKind =
  'goalkeeper-injury' | 'keeper-outfield-collision' |
  'same-team-collision' | 'severe-injury' |
  'opponent-cautioned-or-sent-off' | 'injured-penalty-taker';
export interface M1MedicalExceptionClaim {
  readonly schemaVersion: 1;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly kind: M1MedicalExceptionKind;
  readonly relatedTeamId: string | null;
  readonly relatedPlayerId: string | null;
  readonly opponentCard: 'yellow' | 'red' | null;
  readonly severeInjuryDeclared: boolean;
  readonly penaltyAwardedDeclared: boolean;
  readonly penaltyTakerDeclared: boolean;
}
export type M1MedicalExceptionError =
  'INVALID_PREMATCH' | 'INVALID_CLAIM' | 'WRONG_FIXTURE' |
  'UNKNOWN_TEAM' | 'UNSUPPORTED_PLAYER_HISTORY' |
  'EXCEPTION_FACTS_INCONSISTENT';
export type M1MedicalExceptionResult =
  | Readonly<{ok: false; error: M1MedicalExceptionError}>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_MEDICAL_EXCEPTION_SCHEMA;
    rulesId: typeof M1_MEDICAL_EXCEPTION_RULES;
    fixtureId: string;
    teamId: string;
    playerId: string;
    exceptionKind: M1MedicalExceptionKind;
    status: 'CLAIM_MATCHES_NARROW_LAW5_EXCEPTION_NOT_AUTHENTICATED';
    refereeAuthorityAuthenticated: false;
    medicalAuthorityAuthenticated: false;
    currentPhysicalPresenceVerified: false;
    playerLeaveOrReturnAuthorized: false;
  }>;
const fields = [
  'schemaVersion', 'fixtureId', 'teamId', 'playerId', 'kind',
  'relatedTeamId', 'relatedPlayerId', 'opponentCard',
  'severeInjuryDeclared', 'penaltyAwardedDeclared',
  'penaltyTakerDeclared',
] as const;
const kinds: readonly M1MedicalExceptionKind[] = [
  'goalkeeper-injury', 'keeper-outfield-collision',
  'same-team-collision', 'severe-injury',
  'opponent-cautioned-or-sent-off', 'injured-penalty-taker',
];
const fail = (error: M1MedicalExceptionError): M1MedicalExceptionResult =>
  ({ok: false, error});
const optionalId = (value: unknown): value is string | null =>
  value === null || isStableId(value);
const hasRelated = (claim: M1MedicalExceptionClaim): boolean =>
  claim.relatedTeamId !== null && claim.relatedPlayerId !== null;

export function inspectM1MedicalExceptionClaim(
  prematch: unknown, candidate: unknown,
): M1MedicalExceptionResult {
  if (!isPlainJsonTree(prematch)) return fail('INVALID_PREMATCH');
  const clock = startM1Clock(prematch);
  if (!clock.ok) return fail('INVALID_PREMATCH');
  if (!isPlainJsonTree(candidate) || candidate === null ||
      typeof candidate !== 'object' || Array.isArray(candidate)) {
    return fail('INVALID_CLAIM');
  }
  const raw = candidate as Record<string, unknown>;
  if (Object.keys(raw).length !== fields.length ||
      fields.some(k => !Object.hasOwn(raw, k)) ||
      raw.schemaVersion !== M1_MEDICAL_EXCEPTION_SCHEMA ||
      !isStableId(raw.fixtureId) || !isStableId(raw.teamId) ||
      !isStableId(raw.playerId) ||
      !kinds.includes(raw.kind as M1MedicalExceptionKind) ||
      !optionalId(raw.relatedTeamId) || !optionalId(raw.relatedPlayerId) ||
      ((raw.relatedTeamId === null) !== (raw.relatedPlayerId === null)) ||
      ![null, 'yellow', 'red'].includes(raw.opponentCard as string | null) ||
      typeof raw.severeInjuryDeclared !== 'boolean' ||
      typeof raw.penaltyAwardedDeclared !== 'boolean' ||
      typeof raw.penaltyTakerDeclared !== 'boolean') {
    return fail('INVALID_CLAIM');
  }
  const claim = raw as unknown as M1MedicalExceptionClaim;
  const input = prematch as M1PrematchInput;
  if (claim.fixtureId !== input.fixture.id) return fail('WRONG_FIXTURE');
  const clubs = {home: input.fixture.homeClubId, away: input.fixture.awayClubId};
  const side = claim.teamId === clubs.home ? 'home' :
    claim.teamId === clubs.away ? 'away' : null;
  if (!side) return fail('UNKNOWN_TEAM');
  // Only the initial XI is provable without the live, replayed substitution
  // chronology. Neither a claimed bench entrant nor dismissal is trusted.
  const starting = {
    home: new Set(input.homeLineup.starters),
    away: new Set(input.awayLineup.starters),
  };
  if (!starting[side].has(claim.playerId)) {
    return fail('UNSUPPORTED_PLAYER_HISTORY');
  }
  const positions = new Map(input.catalog.players.map(p =>
    [p.id, p.primaryPosition]));
  const keeper = positions.get(claim.playerId) === 'GK';
  const related = hasRelated(claim);
  const otherSide = claim.relatedTeamId === clubs.home ? 'home' :
    claim.relatedTeamId === clubs.away ? 'away' : null;
  if (related && (!otherSide ||
      claim.relatedPlayerId === claim.playerId ||
      !starting[otherSide].has(claim.relatedPlayerId!))) {
    return fail('UNSUPPORTED_PLAYER_HISTORY');
  }
  const otherKeeper = related && positions.get(claim.relatedPlayerId!) === 'GK';
  const noRelated = !related;
  const noCard = claim.opponentCard === null;
  const noMedical = !claim.severeInjuryDeclared;
  const noPenalty = !claim.penaltyAwardedDeclared &&
    !claim.penaltyTakerDeclared;
  let matches = false;
  switch (claim.kind) {
    case 'goalkeeper-injury':
      matches = keeper && noRelated && noCard && noMedical && noPenalty;
      break;
    case 'keeper-outfield-collision':
      matches = related && (keeper !== otherKeeper) &&
        noCard && noMedical && noPenalty;
      break;
    case 'same-team-collision':
      matches = related && otherSide === side &&
        noCard && noMedical && noPenalty;
      break;
    case 'severe-injury':
      matches = noRelated && noCard &&
        claim.severeInjuryDeclared && noPenalty;
      break;
    case 'opponent-cautioned-or-sent-off':
      matches = related && otherSide !== side &&
        !noCard && noMedical && noPenalty;
      break;
    case 'injured-penalty-taker':
      matches = noRelated && noCard && noMedical &&
        claim.penaltyAwardedDeclared && claim.penaltyTakerDeclared;
      break;
  }
  if (!matches) return fail('EXCEPTION_FACTS_INCONSISTENT');
  return {
    ok: true, schemaVersion: M1_MEDICAL_EXCEPTION_SCHEMA,
    rulesId: M1_MEDICAL_EXCEPTION_RULES,
    fixtureId: claim.fixtureId, teamId: claim.teamId,
    playerId: claim.playerId, exceptionKind: claim.kind,
    status: 'CLAIM_MATCHES_NARROW_LAW5_EXCEPTION_NOT_AUTHENTICATED',
    refereeAuthorityAuthenticated: false,
    medicalAuthorityAuthenticated: false,
    currentPhysicalPresenceVerified: false,
    playerLeaveOrReturnAuthorized: false,
  };
}
