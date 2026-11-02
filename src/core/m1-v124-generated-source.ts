import {sameCanonicalValue} from './canonical-value.js';
import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {simulateM1V19InternalReferee,
  type M1V19GeneratedIncident} from './m1-v19-internal-foul-injury.js';
import {isPlainJsonTree} from './plain-json-tree.js';

/** One source identity for v124 generation and v120 journal admission.
 * Fictional referee evidence is never an external sanction or diagnosis.
 */
export function buildM1V124GeneratedCommands(
  incidents:readonly M1V19GeneratedIncident[],fixtureId:string,
){
  return incidents.map(incident=>({
    schemaVersion:1 as const,id:incident.decisionId,
    fixtureId,teamId:incident.teamId,playerId:incident.playerId,
    elapsedSeconds:incident.elapsedSeconds,kind:incident.sanction,
    origin:incident.sanction==='injury-withdrawal'?
      'trusted-medical' as const:'trusted-referee' as const,
  }));
}
export function verifyM1V124GeneratedSourceClaim(
  prematch:unknown,policy:unknown,commands:unknown,
  fixtureId:string,careerSeed:number,
):boolean{
  if(typeof fixtureId!=='string'||!fixtureId||
      !Number.isSafeInteger(careerSeed)||careerSeed<0||
      careerSeed>0xffffffff||!isPlainJsonTree(prematch)||
      !isPlainJsonTree(policy)||!Array.isArray(commands))
    return false;
  const source=prematch as Record<string,unknown>;
  const fixture=source.fixture;
  if(!fixture||typeof fixture!=='object'||Array.isArray(fixture)||
      (fixture as Record<string,unknown>).id!==fixtureId||
      source.rngSeed!==deriveM1FixtureSeed(careerSeed,fixtureId))
    return false;
  const replay=simulateM1V19InternalReferee(prematch,policy);
  return replay.ok&&replay.fixtureId===fixtureId&&
    sameCanonicalValue(commands,buildM1V124GeneratedCommands(
      replay.generatedIncidents,fixtureId));
}
