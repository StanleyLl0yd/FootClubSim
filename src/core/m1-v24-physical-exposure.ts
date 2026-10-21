import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_END_SECONDS, type M1PrematchInput } from './m1-clock.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { simulateM1V29CausalMedical,
  type M1V29CausalMedicalRun } from './m1-v29-causal-medical.js';
import { simulateM1V23TemporaryTreatment,
  type M1V23CoachRun } from './m1-v23-temporary-treatment.js';

/** Read-only v24 accounting derived from ONE live-XI v23 game result. */
export const M1_V24_EXPOSURE_SCHEMA = 1 as const;
export const M1_V24_EXPOSURE_RULES =
  'm1-source-derived-physical-exposure-cards-substitutions' as const;
type Game = Extract<M1V23CoachRun, { ok: true }>;
type Side = 'home' | 'away';
export interface M1V24PlayerExposure {
  readonly playerId: string;
  readonly teamId: string;
  /** Modelled actual physical time, not registered bench time. */
  readonly physicalSeconds: number;
  readonly shots: number;
  readonly goals: number;
  readonly firstYellowCards: number;
  readonly secondYellowDismissals: number;
  readonly straightRedDismissals: number;
  readonly permanentInjuryWithdrawals: number;
  readonly temporaryTreatmentExits: number;
  readonly temporaryTreatmentReturns: number;
  readonly substitutionsIn: number;
  readonly substitutionsOut: number;
  readonly onFieldAtFullTime: boolean;
}
export type M1V24ExposureError = 'INVALID_SOURCE' |
  'SOURCE_MATCH_REJECTED' | 'EXPOSURE_INVARIANT_FAILED';
export type M1V24ExposureRun =
  | Readonly<{ ok: false; error: M1V24ExposureError }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V24_EXPOSURE_SCHEMA;
    rulesId: typeof M1_V24_EXPOSURE_RULES;
    status: 'SOURCE_DERIVED_EXPOSURE_NOT_FATIGUE_CALIBRATION';
    fixtureId: string;
    playingSeconds: typeof M1_CLOCK_END_SECONDS;
    teamPhysicalPlayerSeconds: Readonly<{ home: number; away: number }>;
    playerRows: readonly M1V24PlayerExposure[];
    aggregatedEvents: Readonly<{
      shots: number; goals: number; firstYellows: number;
      secondYellowDismissals: number; directRedDismissals: number;
      irreversibleWithdrawals: number; temporaryExits: number;
      temporaryReturns: number; substitutedIn: number; substitutedOut: number;
    }>;
    match: Game;
    fatigueDeltasCalibrated: false;
    crossFixtureSanctionAuthorityAuthenticated: false;
    injuryDiagnosisAvailable: false;
    medicalReturnAuthorityAuthenticated: false;
  }>;
const fail = (error: M1V24ExposureError): M1V24ExposureRun =>
  ({ ok: false, error });
type MutableRow = { -readonly [K in keyof M1V24PlayerExposure]:
  M1V24PlayerExposure[K] };
const sort = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export function deriveM1V24PhysicalExposure(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown = [],
  inPlayCommands: unknown = [],
): M1V24ExposureRun {
  if (!isPlainJsonTree(prematch) || !isPlainJsonTree(policy) ||
      !isPlainJsonTree(halfTimeCommands) ||
      !isPlainJsonTree(inPlayCommands)) return fail('INVALID_SOURCE');
  const match = simulateM1V23TemporaryTreatment(
    prematch, policy, halfTimeCommands, inPlayCommands);
  if (!match.ok) return fail('SOURCE_MATCH_REJECTED');
  return projectPhysicalExposure(prematch as M1PrematchInput, match);
}

/** Called only after the source simulator has replay-validated its own match. */
function projectPhysicalExposure(
  input: M1PrematchInput, match: Game,
): M1V24ExposureRun {
  const clubs = {
    home: input.fixture.homeClubId,
    away: input.fixture.awayClubId,
  };
  const sequence = match.match.events;
  const first = sequence[0];
  if (!first || first.kind !== 'kickoff' ||
      first.runningSeconds !== 0 ||
      sequence.at(-1)?.kind !== 'full-time' ||
      sequence.at(-1)?.runningSeconds !== M1_CLOCK_END_SECONDS ||
      match.fixtureId !== input.fixture.id) {
    return fail('EXPOSURE_INVARIANT_FAILED');
  }
  const ledger = new Map<string, MutableRow>();
  const key = (side: Side, id: string): string => side + ':' + id;
  function get(side: Side, id: string): MutableRow {
    const ref = key(side, id);
    let row = ledger.get(ref);
    if (!row) {
      row = {
        playerId: id, teamId: clubs[side], physicalSeconds: 0,
        shots: 0, goals: 0, firstYellowCards: 0,
        secondYellowDismissals: 0, straightRedDismissals: 0,
        permanentInjuryWithdrawals: 0,
        temporaryTreatmentExits: 0, temporaryTreatmentReturns: 0,
        substitutionsIn: 0, substitutionsOut: 0,
        onFieldAtFullTime: false,
      };
      ledger.set(ref, row);
    }
    return row;
  }
  let previous = 0;
  let active = first.onField;
  const physical = {home: 0, away: 0};
  const counts = {
    shots: 0, goals: 0, firstYellows: 0, secondYellowDismissals: 0,
    directRedDismissals: 0, irreversibleWithdrawals: 0,
    temporaryExits: 0, temporaryReturns: 0,
    substitutedIn: 0, substitutedOut: 0,
  };
  for (const [index, event] of sequence.entries()) {
    if (event.sequence !== index + 1 ||
        event.runningSeconds < previous ||
        event.runningSeconds > M1_CLOCK_END_SECONDS) {
      return fail('EXPOSURE_INVARIANT_FAILED');
    }
    const duration = event.runningSeconds - previous;
    for (const side of ['home', 'away'] as const) {
      if (active[side].length < 7 || active[side].length > 11 ||
          new Set(active[side]).size !== active[side].length) {
        return fail('EXPOSURE_INVARIANT_FAILED');
      }
      physical[side] += duration * active[side].length;
      for (const id of active[side]) get(side, id).physicalSeconds += duration;
      for (const id of event.onField[side]) get(side, id);
    }
    previous = event.runningSeconds;
    active = event.onField;
    const side: Side | null = event.teamId === clubs.home ? 'home' :
      event.teamId === clubs.away ? 'away' : null;
    if (event.kind === 'shot' || event.kind === 'goal-whistle' ||
        event.kind === 'caution' ||
        event.kind === 'second-yellow-dismissal' ||
        event.kind === 'straight-red-dismissal' ||
        event.kind === 'injury-withdrawal' ||
        event.kind === 'treatment-exit' ||
        event.kind === 'treatment-return' ||
        event.kind === 'substitution-applied' ||
        event.kind === 'half-time-substitution') {
      if (!side || !event.playerId) return fail('EXPOSURE_INVARIANT_FAILED');
      const row = ledger.get(key(side, event.playerId));
      if (!row) return fail('EXPOSURE_INVARIANT_FAILED');
      if (event.kind === 'shot') { row.shots++; counts.shots++; }
      else if (event.kind === 'goal-whistle') { row.goals++; counts.goals++; }
      else if (event.kind === 'caution') {
        row.firstYellowCards++; counts.firstYellows++;
      } else if (event.kind === 'second-yellow-dismissal') {
        row.secondYellowDismissals++; counts.secondYellowDismissals++;
      } else if (event.kind === 'straight-red-dismissal') {
        row.straightRedDismissals++; counts.directRedDismissals++;
      } else if (event.kind === 'injury-withdrawal') {
        row.permanentInjuryWithdrawals++; counts.irreversibleWithdrawals++;
      } else if (event.kind === 'treatment-exit') {
        row.temporaryTreatmentExits++; counts.temporaryExits++;
      } else if (event.kind === 'treatment-return') {
        row.temporaryTreatmentReturns++; counts.temporaryReturns++;
      } else {
        if (!event.replacedByPlayerId ||
            !event.onField[side].includes(event.replacedByPlayerId) ||
            event.onField[side].includes(event.playerId)) {
          return fail('EXPOSURE_INVARIANT_FAILED');
        }
        row.substitutionsOut++; counts.substitutedOut++;
        get(side, event.replacedByPlayerId).substitutionsIn++;
        counts.substitutedIn++;
      }
    }
  }
  if (previous !== M1_CLOCK_END_SECONDS ||
      counts.goals !== match.match.finalScore.home +
        match.match.finalScore.away ||
      counts.temporaryExits !== match.syntheticTemporaryExitCount ||
      counts.temporaryReturns !== match.syntheticTemporaryReturnCount ||
      counts.firstYellows !== match.match.sourceRefereeEffects.yellow ||
      counts.secondYellowDismissals !==
        match.match.sourceRefereeEffects.secondYellowRed ||
      counts.directRedDismissals !==
        match.match.sourceRefereeEffects.straightRed ||
      counts.irreversibleWithdrawals !==
        match.match.sourceRefereeEffects.injuryWithdrawn ||
      counts.substitutedIn !== counts.substitutedOut) {
    return fail('EXPOSURE_INVARIANT_FAILED');
  }
  for (const side of ['home', 'away'] as const) {
    for (const id of match.match.finalOnField[side]) {
      const row = ledger.get(key(side, id));
      if (!row) return fail('EXPOSURE_INVARIANT_FAILED');
      row.onFieldAtFullTime = true;
    }
  }
  return {
    ok: true, schemaVersion: M1_V24_EXPOSURE_SCHEMA,
    rulesId: M1_V24_EXPOSURE_RULES,
    status: 'SOURCE_DERIVED_EXPOSURE_NOT_FATIGUE_CALIBRATION',
    fixtureId: match.fixtureId, playingSeconds: M1_CLOCK_END_SECONDS,
    teamPhysicalPlayerSeconds: physical,
    playerRows: [...ledger.values()].sort((a,b) =>
      sort(a.teamId,b.teamId) || sort(a.playerId,b.playerId)),
    aggregatedEvents: counts, match,
    fatigueDeltasCalibrated: false,
    crossFixtureSanctionAuthorityAuthenticated: false,
    injuryDiagnosisAvailable: false,
    medicalReturnAuthorityAuthenticated: false,
  };
}
export function verifyM1V24PhysicalExposure(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown,
  inPlayCommands: unknown, candidate: unknown,
): boolean {
  if (!isPlainJsonTree(candidate)) return false;
  const replay = deriveM1V24PhysicalExposure(
    prematch, policy, halfTimeCommands, inPlayCommands);
  return replay.ok && sameCanonicalValue(replay, candidate);
}

/**
 * v31 reuses the v24 physical-time arithmetic against the ACTUAL v29
 * medical decision/source event stream. Historical v24 has no behavior or
 * schema change. On-field synthetic assessments do not remove playing time.
 */
export const M1_V31_CAUSAL_EXPOSURE_SCHEMA = 1 as const;
export const M1_V31_CAUSAL_EXPOSURE_RULES =
  'm1-v29-causal-medical-source-derived-physical-exposure' as const;
type PhysicalGood = Extract<M1V24ExposureRun,{ok:true}>;
type CausalGood = Extract<M1V29CausalMedicalRun,{ok:true}>;
export type M1V31CausalExposureRun =
  | Readonly<{ok:false;error:M1V24ExposureError |
      Extract<M1V29CausalMedicalRun,{ok:false}>['error']}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V31_CAUSAL_EXPOSURE_SCHEMA;
    rulesId:typeof M1_V31_CAUSAL_EXPOSURE_RULES;
    status:'SYNTHETIC_CAUSAL_MEDICAL_PHYSICAL_EXPOSURE_NOT_CALIBRATED';
    fixtureId:string;
    source:CausalGood;
    physical:Readonly<{
      playingSeconds:typeof M1_CLOCK_END_SECONDS;
      teamPhysicalPlayerSeconds:PhysicalGood['teamPhysicalPlayerSeconds'];
      playerRows:PhysicalGood['playerRows'];
      aggregatedEvents:PhysicalGood['aggregatedEvents'];
    }>;
    replayBoundPhysicalTime:true;
    realWorldInjuryAuthenticated:false;
    externalRefereeAuthorityAuthenticated:false;
    externalMedicalAuthorityAuthenticated:false;
    crossFixtureFitnessAndSanctionsCalibrated:false;
    careerJournalIntegrated:false;
  }>;

export function deriveM1V31CausalPhysicalExposure(
  prematch:unknown, policy:unknown, halfTimeCommands:unknown=[],
  inPlayCommands:unknown=[],
):M1V31CausalExposureRun {
  if(!isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
      !isPlainJsonTree(halfTimeCommands)||
      !isPlainJsonTree(inPlayCommands))return fail('INVALID_SOURCE');
  const source=simulateM1V29CausalMedical(
    prematch,policy,halfTimeCommands,inPlayCommands);
  if(!source.ok)return {ok:false,error:source.error};
  const projected=projectPhysicalExposure(
    prematch as M1PrematchInput,source.source);
  if(!projected.ok)return projected;
  return {
    ok:true,schemaVersion:M1_V31_CAUSAL_EXPOSURE_SCHEMA,
    rulesId:M1_V31_CAUSAL_EXPOSURE_RULES,
    status:'SYNTHETIC_CAUSAL_MEDICAL_PHYSICAL_EXPOSURE_NOT_CALIBRATED',
    fixtureId:source.fixtureId,
    source,
    physical:{
      playingSeconds:projected.playingSeconds,
      teamPhysicalPlayerSeconds:projected.teamPhysicalPlayerSeconds,
      playerRows:projected.playerRows,
      aggregatedEvents:projected.aggregatedEvents,
    },
    replayBoundPhysicalTime:true,
    realWorldInjuryAuthenticated:false,
    externalRefereeAuthorityAuthenticated:false,
    externalMedicalAuthorityAuthenticated:false,
    crossFixtureFitnessAndSanctionsCalibrated:false,
    careerJournalIntegrated:false,
  };
}

export function verifyM1V31CausalPhysicalExposure(
  prematch:unknown,policy:unknown,halfTimeCommands:unknown,
  inPlayCommands:unknown,candidate:unknown,
):boolean {
  if(!isPlainJsonTree(candidate))return false;
  const replay=deriveM1V31CausalPhysicalExposure(
    prematch,policy,halfTimeCommands,inPlayCommands);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
