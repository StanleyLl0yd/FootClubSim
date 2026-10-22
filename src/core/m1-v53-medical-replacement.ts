import { sameCanonicalValue } from './canonical-value.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { simulateM1V53OffFieldSubstitutionSource,
  type M1V8Result, type M1V8Error }
  from './m1-v8-medical-phases.js';

/**
 * IFAB 2026/27: substituting an injured player is not delayed by the
 * one-minute treatment/assessment absence. This is a replay-verified
 * *internal synthetic* event path, not external clinical/referee proof.
 */
export const M1_V53_MEDICAL_REPLACEMENT_SCHEMA = 1 as const;
export const M1_V53_MEDICAL_REPLACEMENT_RULES =
  'ifab-2026-27-off-field-injured-player-substitution' as const;

export interface M1V53MedicalReplacement {
  readonly teamId:string;
  readonly patientPlayerId:string;
  readonly enteringPlayerId:string;
  readonly medicalExitEventId:string;
  readonly substitutionEventId:string;
  readonly departureRunningSeconds:number;
  readonly substitutionRunningSeconds:number;
}
export type M1V53MedicalReplacementResult =
  | Readonly<{ok:false;error:'INVALID_INPUT'|
    'SOURCE_MATCH_REJECTED'|'NO_OFF_FIELD_REPLACEMENT';
    sourceError?:M1V8Error}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V53_MEDICAL_REPLACEMENT_SCHEMA;
    rulesId:typeof M1_V53_MEDICAL_REPLACEMENT_RULES;
    status:'SYNTHETIC_RULE_GOVERNED_REPLACEMENT_NOT_EXTERNAL_AUTHORITY';
    fixtureId:string;
    replacements:readonly M1V53MedicalReplacement[];
    source:M1V8Result;
    fullPhysicalXIReplayVerified:true;
    medicalOneMinuteReEntryNotRequiredForReplacedPlayer:true;
    realWorldMedicalAuthorityAuthenticated:false;
    externalRefereeAuthorityAuthenticated:false;
    officialRplFixtureAuthenticated:false;
  }>;

export function simulateM1V53MedicalReplacement(
  prematch:unknown,policy:unknown,plannedCommands:unknown,
  trustedDecisions:unknown,medicalActions:unknown,
):M1V53MedicalReplacementResult {
  if (![prematch,policy,plannedCommands,trustedDecisions,medicalActions]
    .every(isPlainJsonTree) ||
      prematch === null || typeof prematch !== 'object' ||
      Array.isArray(prematch) ||
      policy === null || typeof policy !== 'object' ||
      Array.isArray(policy) ||
      !Array.isArray(plannedCommands) ||
      !Array.isArray(trustedDecisions) ||
      !Array.isArray(medicalActions)) {
    return {ok:false,error:'INVALID_INPUT'};
  }
  const source=simulateM1V53OffFieldSubstitutionSource(
    prematch,policy,plannedCommands,trustedDecisions,medicalActions);
  if (!source.ok) {
    return {ok:false,error:'SOURCE_MATCH_REJECTED',sourceError:source.error};
  }
  // Only source-replayed availability/medical transitions establish which
  // specific injured player was already off field at substitution time.
  const pending=new Map<string,{teamId:string;id:string;at:number}>();
  const replacements:M1V53MedicalReplacement[]=[];
  for (const event of source.events) {
    if (event.type==='medical') {
      const action=event.action;
      if (action.kind==='treatment-exit') {
        if (pending.has(action.playerId)) {
          return {ok:false,error:'SOURCE_MATCH_REJECTED'};
        }
        pending.set(action.playerId,{
          teamId:action.teamId,id:event.id,at:event.elapsedSeconds,
        });
      } else {
        pending.delete(action.playerId);
      }
    } else if (event.type==='availability' &&
        event.source.entry.action.kind==='substitute-normal') {
      const action=event.source.entry.action;
      const patient=pending.get(action.outPlayerId);
      if (patient) {
        if (patient.teamId!==action.teamId ||
            event.elapsedSeconds<patient.at) {
          return {ok:false,error:'SOURCE_MATCH_REJECTED'};
        }
        replacements.push({
          teamId:patient.teamId,patientPlayerId:action.outPlayerId,
          enteringPlayerId:action.inPlayerId,
          medicalExitEventId:patient.id,
          substitutionEventId:event.id,
          departureRunningSeconds:patient.at,
          substitutionRunningSeconds:event.elapsedSeconds,
        });
        // Substitution ends the patient's match; it is not a return.
        pending.delete(action.outPlayerId);
      }
    }
  }
  if (replacements.length===0) {
    return {ok:false,error:'NO_OFF_FIELD_REPLACEMENT'};
  }
  return {
    ok:true,schemaVersion:M1_V53_MEDICAL_REPLACEMENT_SCHEMA,
    rulesId:M1_V53_MEDICAL_REPLACEMENT_RULES,
    status:'SYNTHETIC_RULE_GOVERNED_REPLACEMENT_NOT_EXTERNAL_AUTHORITY',
    fixtureId:source.fixtureId,replacements,source,
    fullPhysicalXIReplayVerified:true,
    medicalOneMinuteReEntryNotRequiredForReplacedPlayer:true,
    realWorldMedicalAuthorityAuthenticated:false,
    externalRefereeAuthorityAuthenticated:false,
    officialRplFixtureAuthenticated:false,
  };
}
export function verifyM1V53MedicalReplacement(
  prematch:unknown,policy:unknown,plannedCommands:unknown,
  trustedDecisions:unknown,medicalActions:unknown,candidate:unknown,
):boolean {
  if (!isPlainJsonTree(candidate)) return false;
  const replay=simulateM1V53MedicalReplacement(
    prematch,policy,plannedCommands,trustedDecisions,medicalActions);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
