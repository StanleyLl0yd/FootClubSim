import {sameCanonicalValue} from './canonical-value.js';
import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {simulateM1V23TemporaryTreatment}
  from './m1-v23-temporary-treatment.js';
import {buildM1V124GeneratedCommands}
  from './m1-v124-generated-source.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';
import {prepareM1V128ManualFictionalContinuation}
  from './m1-v128-manual-fictional-continuation.js';
import type {InitialCareerSave} from './save.js';
import type {M1V120Journal} from './m1-v120-playable-journal.js';

export const M1_V176_MEDICAL_SOURCE_SCHEMA=176 as const;

/** A fictional referee + temporary off-field treatment in ONE v105 match.
 * v23 chooses its patient and whistle from seeded in-game incidents.
 * Clinical/referee origin is never authenticated by this prototype.
 */
export function regenerateM1V176MedicalSource(
  prematch:unknown,policy:unknown,
){
  const generated=simulateM1V23TemporaryTreatment(prematch,policy);
  if(!generated.ok)
    return {ok:false as const,error:'MEDICAL_GENERATOR_REJECTED' as const};
  const plannedCommands=buildM1V124GeneratedCommands(
    generated.generatedIncidents,generated.fixtureId);
  const checkpointMedical=[...generated.syntheticTreatmentActions];
  const result=simulateM1V105SpecialGoalChronology(
    prematch,policy,plannedCommands,checkpointMedical,[],[]);
  if(!result.ok)
    return {ok:false as const,error:'MEDICAL_CHRONOLOGY_REJECTED' as const};
  return {ok:true as const,plannedCommands,checkpointMedical,result,
    fictionalIncidentCount:generated.generatedIncidents.length,
    temporaryExitCount:generated.syntheticTemporaryExitCount,
    temporaryReturnCount:generated.syntheticTemporaryReturnCount,
    sourceFixtureId:generated.fixtureId};
}

/** Independently regenerate every admitted medical/referee command; v120
 * also replays the claimed v105 score and physical-XI chronology.
 */
export function verifyM1V176MedicalSourceClaim(
  prematch:unknown,policy:unknown,planned:unknown,medical:unknown,
  fixtureId:string,careerSeed:number,
):boolean{
  if(!isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
      !isPlainJsonTree(planned)||!isPlainJsonTree(medical)||
      !Array.isArray(planned)||!Array.isArray(medical)||
      !Number.isSafeInteger(careerSeed)||careerSeed<0||
      careerSeed>0xffffffff)return false;
  const source=prematch as Record<string,unknown>;
  if(!source.fixture||typeof source.fixture!=='object'||
      (source.fixture as {id?:unknown}).id!==fixtureId||
      source.rngSeed!==deriveM1FixtureSeed(careerSeed,fixtureId))
    return false;
  const generated=regenerateM1V176MedicalSource(prematch,policy);
  return generated.ok&&generated.sourceFixtureId===fixtureId&&
    sameCanonicalValue(generated.plannedCommands,planned)&&
    sameCanonicalValue(generated.checkpointMedical,medical);
}

/** Opt-in playable source path; no historical save migration or authority
 * promotion. The caller must still use v171 admission and native CAS.
 */
export function prepareM1V176DenseMedicalMatch(
  initial:InitialCareerSave,journal:M1V120Journal,
){
  const base=prepareM1V128ManualFictionalContinuation(initial,journal);
  if(!base||!base.ok)return base;
  const generated=regenerateM1V176MedicalSource(
    base.request.prematch,base.request.policy);
  if(!generated.ok)return generated;
  return {...base,schemaVersion:M1_V176_MEDICAL_SOURCE_SCHEMA,
    status:'SOURCE_REPLAYED_FICTIONAL_REFEREE_AND_TEMPORARY_TREATMENT' as const,
    refereeAndMedicalAuthorityAuthenticated:false as const,
    clinicalClearanceAuthenticated:false as const,
    generatedMedicalDepartureAndReturnCount:
      generated.temporaryExitCount+generated.temporaryReturnCount,
    fictionalIncidentCount:generated.fictionalIncidentCount,
    request:{...base.request,
      commandId:'v176-medical-'+base.fixture.id,
      plannedCommands:generated.plannedCommands,
      checkpointMedical:generated.checkpointMedical,
      result:generated.result}};
}
