import { isStableId } from './identifiers.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { inspectM1V25GeneratedFoulLaw5Evidence }
  from './m1-v25-law5-generated-foul-evidence.js';
import { simulateM1V23TemporaryTreatment }
  from './m1-v23-temporary-treatment.js';
import type { M1MedicalExceptionClaim }
  from './m1-medical-exceptions.js';

/**
 * v27 is separate from v25: admits a NAMED bench player only after
 * independent replay proves the substitution and physical foul whistle.
 * Neither a foul nor a substitution authenticates a victim's injury.
 */
export const M1_V27_LAW5_BENCH_SCHEMA = 1 as const;
export const M1_V27_LAW5_BENCH_RULES =
  'ifab-2026-27-generated-foul-named-bench-replay-evidence-only' as const;
export type M1V27Law5BenchError =
  'CLAIM_REJECTED' | 'SOURCE_MATCH_REJECTED' | 'UNKNOWN_GENERATED_FOUL' |
  'FOUL_RELATION_MISMATCH' | 'FOUL_CHRONOLOGY_MISMATCH' |
  'PLAYER_NOT_PRESENT_AT_WHISTLE' | 'BENCH_ENTRY_NOT_REPLAYED';
export type M1V27Law5BenchResult =
  | Readonly<{ok: false; error: M1V27Law5BenchError}>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V27_LAW5_BENCH_SCHEMA;
    rulesId: typeof M1_V27_LAW5_BENCH_RULES;
    status: 'MODEL_FOUL_AND_BENCH_ENTRY_REPLAYED_INJURY_NOT_PROVED';
    fixtureId: string;
    incidentId: string;
    injuredPlayerId: string;
    offenderPlayerId: string;
    foulWhistleEventId: string;
    foulRestartEventId: string;
    offenderSourceEventId: string;
    victimSubstitutionEventId: string | null;
    offenderSubstitutionEventId: string | null;
    modelPhysicalPresenceAtWhistleVerified: true;
    actualInjuryAuthenticated: false;
    externalRefereeAuthorityAuthenticated: false;
    externalMedicalAuthorityAuthenticated: false;
    physicalLeaveOrReturnAuthorized: false;
  }>;
const fail = (error: M1V27Law5BenchError): M1V27Law5BenchResult =>
  ({ok: false, error});
const fields = ['schemaVersion', 'fixtureId', 'teamId', 'playerId', 'kind',
  'relatedTeamId', 'relatedPlayerId', 'opponentCard',
  'physicalOffenceDeclared', 'bothPlayersNeedAttentionDeclared',
  'severeInjuryDeclared', 'penaltyAwardedDeclared', 'penaltyTakerDeclared'];
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
type Side = 'home' | 'away';
type Named = Readonly<{starters: readonly string[]; bench: readonly string[]}>;
type Input = Readonly<{
  fixture: Readonly<{id: string; homeClubId: string; awayClubId: string}>;
  homeLineup: Named; awayLineup: Named;
}>;
function namedBenchClaim(
  prematch: Input, candidate: unknown,
): candidate is M1MedicalExceptionClaim {
  if (!isPlainJsonTree(candidate) || !record(candidate) ||
      Object.keys(candidate).length !== fields.length ||
      fields.some(k => !Object.hasOwn(candidate, k)) ||
      candidate.schemaVersion !== 1 ||
      candidate.fixtureId !== prematch.fixture.id ||
      candidate.kind !== 'opponent-cautioned-or-sent-off' ||
      !isStableId(candidate.playerId) ||
      !isStableId(candidate.relatedPlayerId) ||
      !['yellow', 'red'].includes(candidate.opponentCard as string) ||
      candidate.physicalOffenceDeclared !== true ||
      candidate.bothPlayersNeedAttentionDeclared !== false ||
      candidate.severeInjuryDeclared !== false ||
      candidate.penaltyAwardedDeclared !== false ||
      candidate.penaltyTakerDeclared !== false) return false;
  const clubs = prematch.fixture;
  const victim: Side | null =
    candidate.teamId === clubs.homeClubId ? 'home' :
    candidate.teamId === clubs.awayClubId ? 'away' : null;
  if (!victim) return false;
  const other: Side = victim === 'home' ? 'away' : 'home';
  if (candidate.relatedTeamId !==
      (other === 'home' ? clubs.homeClubId : clubs.awayClubId)) return false;
  const a = victim === 'home' ? prematch.homeLineup : prematch.awayLineup;
  const b = other === 'home' ? prematch.homeLineup : prematch.awayLineup;
  const victimNamed = [...a.starters, ...a.bench].includes(candidate.playerId as string);
  const offenderNamed = [...b.starters, ...b.bench]
    .includes(candidate.relatedPlayerId as string);
  return victimNamed && offenderNamed &&
    (a.bench.includes(candidate.playerId as string) ||
      b.bench.includes(candidate.relatedPlayerId as string));
}

/** Source replays cannot turn a caller's claimed injury into a diagnosis. */
export function inspectM1V27NamedSubstituteFoulEvidence(
  prematch: unknown, policy: unknown, claim: unknown, incidentId: unknown,
  halfTimeCommands: unknown = [], inPlayCommands: unknown = [],
): M1V27Law5BenchResult {
  const strict = inspectM1V25GeneratedFoulLaw5Evidence(
    prematch, policy, claim, incidentId, halfTimeCommands, inPlayCommands);
  // The existing v25 initial-XI contract stays untouched. This v27
  // experiment applies ONLY when its history gate rejects a named entrant.
  if (strict.ok || strict.error !== 'CLAIM_REJECTED' ||
      strict.claimError !== 'UNSUPPORTED_PLAYER_HISTORY' ||
      !record(prematch) ||
      !namedBenchClaim(prematch as unknown as Input, claim) ||
      !isStableId(incidentId)) return fail('CLAIM_REJECTED');
  const input = prematch as unknown as Input;
  const asserted = claim;
  const source = simulateM1V23TemporaryTreatment(
    prematch, policy, halfTimeCommands, inPlayCommands);
  if (!source.ok) return fail('SOURCE_MATCH_REJECTED');
  const incident = source.generatedIncidents.find(i => i.id === incidentId);
  if (!incident || incident.sanction === 'injury-withdrawal') {
    return fail('UNKNOWN_GENERATED_FOUL');
  }
  if (asserted.relatedTeamId !== incident.teamId ||
      asserted.relatedPlayerId !== incident.playerId ||
      !['reckless-challenge', 'serious-foul-play'].includes(incident.offence)) {
    return fail('FOUL_RELATION_MISMATCH');
  }
  const events = source.match.events;
  const decision = events.find(e => e.id === incident.sourceEventId);
  const whistle = events.find(e => e.kind === 'synthetic-foul-whistle' &&
    e.sourceEventId === decision?.sourceEventId);
  const restart = events.find(e => e.kind === 'synthetic-foul-restart' &&
    e.sourceEventId === decision?.sourceEventId);
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
  const side: Side = asserted.teamId === input.fixture.homeClubId ?
    'home' : 'away';
  const offenderSide: Side = side === 'home' ? 'away' : 'home';
  if (!whistle.onField[side].includes(asserted.playerId) ||
      !whistle.onField[offenderSide].includes(incident.playerId)) {
    return fail('PLAYER_NOT_PRESENT_AT_WHISTLE');
  }
  function entry(
    playerId: string, teamId: string, playerSide: Side,
  ): string | null | undefined {
    const lineup = playerSide === 'home' ?
      input.homeLineup : input.awayLineup;
    if (lineup.starters.includes(playerId)) return null;
    // Only a source event that actually applied the entering player before
    // this very whistle may admit a named bench member.
    return events.find(e =>
      e.sequence < whistle.sequence &&
      (e.kind === 'half-time-substitution' ||
        e.kind === 'substitution-applied') &&
      e.teamId === teamId &&
      e.replacedByPlayerId === playerId)?.id;
  }
  const victimEntry = entry(asserted.playerId, asserted.teamId, side);
  const offenderEntry = entry(incident.playerId, incident.teamId, offenderSide);
  if (victimEntry === undefined || offenderEntry === undefined) {
    return fail('BENCH_ENTRY_NOT_REPLAYED');
  }
  return {
    ok: true, schemaVersion: M1_V27_LAW5_BENCH_SCHEMA,
    rulesId: M1_V27_LAW5_BENCH_RULES,
    status: 'MODEL_FOUL_AND_BENCH_ENTRY_REPLAYED_INJURY_NOT_PROVED',
    fixtureId: input.fixture.id, incidentId: incident.id,
    injuredPlayerId: asserted.playerId, offenderPlayerId: incident.playerId,
    foulWhistleEventId: whistle.id, foulRestartEventId: restart.id,
    offenderSourceEventId: decision.id,
    victimSubstitutionEventId: victimEntry,
    offenderSubstitutionEventId: offenderEntry,
    modelPhysicalPresenceAtWhistleVerified: true,
    actualInjuryAuthenticated: false,
    externalRefereeAuthorityAuthenticated: false,
    externalMedicalAuthorityAuthenticated: false,
    physicalLeaveOrReturnAuthorized: false,
  };
}
