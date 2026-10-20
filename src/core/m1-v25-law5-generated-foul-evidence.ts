import { isStableId } from './identifiers.js';
import { inspectM1MedicalExceptionClaim,
  type M1MedicalExceptionClaim, type M1MedicalExceptionError }
  from './m1-medical-exceptions.js';
import { simulateM1V23TemporaryTreatment }
  from './m1-v23-temporary-treatment.js';

/**
 * Replay-bound, read-only inspection of ONE Law 5 exception category.
 * A generated foul and model roster are evidence of simulation ONLY.
 * Neither the claimant's injury nor external referee/medical authority
 * can be inferred from them; this function MUST NOT change player presence.
 */
export const M1_V25_LAW5_FOUL_SCHEMA = 1 as const;
export const M1_V25_LAW5_FOUL_RULES =
  'ifab-2026-27-generated-opponent-foul-exception-evidence-only' as const;

export type M1V25Law5FoulError =
  'INVALID_INCIDENT_ID' | 'CLAIM_REJECTED' | 'UNSUPPORTED_EXCEPTION' |
  'SOURCE_MATCH_REJECTED' | 'UNKNOWN_GENERATED_FOUL' |
  'FOUL_RELATION_MISMATCH' | 'PLAYER_NOT_PRESENT_AT_WHISTLE' |
  'FOUL_CHRONOLOGY_MISMATCH';
export type M1V25Law5FoulInspection =
  | Readonly<{ ok: false; error: M1V25Law5FoulError;
    claimError?: M1MedicalExceptionError }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V25_LAW5_FOUL_SCHEMA;
    rulesId: typeof M1_V25_LAW5_FOUL_RULES;
    status: 'GENERATED_FOUL_REPLAYED_INJURY_AND_AUTHORITY_UNVERIFIED';
    fixtureId: string;
    incidentId: string;
    offenderSourceEventId: string;
    foulWhistleEventId: string;
    foulRestartEventId: string;
    runningSeconds: number;
    injuredPlayerId: string;
    offenderPlayerId: string;
    modelPhysicalPresenceAtWhistleVerified: true;
    generatedPhysicalFoulAndCardReplayed: true;
    actualInjuryAuthenticated: false;
    externalRefereeAuthorityAuthenticated: false;
    externalMedicalAuthorityAuthenticated: false;
    physicalLeaveOrReturnAuthorized: false;
  }>;
const fail = (error: M1V25Law5FoulError,
  claimError?: M1MedicalExceptionError): M1V25Law5FoulInspection =>
  claimError ? { ok: false, error, claimError } : { ok: false, error };

/**
 * Only a generated, sanctioned physical offence can currently be checked
 * against the actual v23 foul whistle, card and pre-card physical XI.
 * Other five Law 5 exception kinds need different evidence sources.
 *
 * Even a successful match of simulated facts never establishes that the
 * named opponent was genuinely injured or that treatment can occur in-place.
 */
export function inspectM1V25GeneratedFoulLaw5Evidence(
  prematch: unknown, policy: unknown, claim: unknown, incidentId: unknown,
  halfTimeCommands: unknown = [], inPlayCommands: unknown = [],
): M1V25Law5FoulInspection {
  const inspected = inspectM1MedicalExceptionClaim(prematch, claim);
  if (!inspected.ok) return fail('CLAIM_REJECTED', inspected.error);
  if (inspected.exceptionKind !== 'opponent-cautioned-or-sent-off') {
    return fail('UNSUPPORTED_EXCEPTION');
  }
  if (!isStableId(incidentId)) return fail('INVALID_INCIDENT_ID');

  const source = simulateM1V23TemporaryTreatment(
    prematch, policy, halfTimeCommands, inPlayCommands);
  if (!source.ok) return fail('SOURCE_MATCH_REJECTED');
  const asserted = claim as M1MedicalExceptionClaim;
  const incident = source.generatedIncidents.find(e => e.id === incidentId);
  if (!incident || incident.sanction === 'injury-withdrawal') {
    return fail('UNKNOWN_GENERATED_FOUL');
  }
  if (asserted.relatedTeamId !== incident.teamId ||
      asserted.relatedPlayerId !== incident.playerId ||
      asserted.teamId === incident.teamId ||
      !asserted.physicalOffenceDeclared ||
      !['reckless-challenge', 'serious-foul-play'].includes(incident.offence)) {
    return fail('FOUL_RELATION_MISMATCH');
  }

  const events = source.match.events;
  const decision = events.find(e => e.id === incident.sourceEventId);
  const whistle = events.find(e =>
    e.kind === 'synthetic-foul-whistle' &&
    e.sourceEventId === incident.sourceEventId);
  const restart = events.find(e =>
    e.kind === 'synthetic-foul-restart' &&
    e.sourceEventId === incident.sourceEventId);
  const card = decision?.kind === 'caution' ? 'yellow' :
    decision?.kind === 'second-yellow-dismissal' ||
    decision?.kind === 'straight-red-dismissal' ? 'red' : null;
  if (card !== asserted.opponentCard) return fail('FOUL_RELATION_MISMATCH');
  if (!whistle || !restart || !decision ||
      whistle.runningSeconds !== incident.elapsedSeconds ||
      decision.runningSeconds !== incident.elapsedSeconds ||
      restart.runningSeconds !== incident.elapsedSeconds ||
      whistle.playerId !== incident.playerId ||
      whistle.teamId !== asserted.teamId ||
      decision.teamId !== incident.teamId ||
      decision.playerId !== incident.playerId ||
      whistle.sequence >= decision.sequence ||
      decision.sequence >= restart.sequence) {
    return fail('FOUL_CHRONOLOGY_MISMATCH');
  }

  const fixture = source.match.fixtureId;
  const input = prematch as { fixture: {
    homeClubId: string; awayClubId: string } };
  const victimSide = asserted.teamId === input.fixture.homeClubId ?
    'home' : 'away';
  const offenderSide = victimSide === 'home' ? 'away' : 'home';
  if (!whistle.onField[victimSide].includes(asserted.playerId) ||
      !whistle.onField[offenderSide].includes(incident.playerId)) {
    return fail('PLAYER_NOT_PRESENT_AT_WHISTLE');
  }
  return {
    ok: true, schemaVersion: M1_V25_LAW5_FOUL_SCHEMA,
    rulesId: M1_V25_LAW5_FOUL_RULES,
    status: 'GENERATED_FOUL_REPLAYED_INJURY_AND_AUTHORITY_UNVERIFIED',
    fixtureId: fixture, incidentId: incident.id,
    offenderSourceEventId: decision.id,
    foulWhistleEventId: whistle.id,
    foulRestartEventId: restart.id,
    runningSeconds: whistle.runningSeconds,
    injuredPlayerId: asserted.playerId,
    offenderPlayerId: incident.playerId,
    modelPhysicalPresenceAtWhistleVerified: true,
    generatedPhysicalFoulAndCardReplayed: true,
    actualInjuryAuthenticated: false,
    externalRefereeAuthorityAuthenticated: false,
    externalMedicalAuthorityAuthenticated: false,
    physicalLeaveOrReturnAuthorized: false,
  };
}
