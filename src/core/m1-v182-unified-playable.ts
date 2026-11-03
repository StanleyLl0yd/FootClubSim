import {isPlainJsonTree} from './plain-json-tree.js';
import {prepareM1V128ManualFictionalContinuation}
  from './m1-v128-manual-fictional-continuation.js';
import {regenerateM1V182UnifiedSource,
  regenerateM1V184CausalSource,verifyM1V182UnifiedSourceClaim,
  verifyM1V184CausalSourceClaim}
  from './m1-v182-unified-source.js';
import type {InitialCareerSave} from './save.js';
import type {M1V120Journal} from './m1-v120-playable-journal.js';

export const M1_V182_UNIFIED_SCHEMA=182 as const;
export const M1_V184_CAUSAL_SCHEMA=184 as const;
type Choice=Readonly<{
  outPlayerId:string;inPlayerId:string;elapsedSeconds:number;
}>;
function validChoices(input:unknown):input is readonly Choice[]{
  if(!isPlainJsonTree(input)||!Array.isArray(input)||input.length>5)
    return false;
  const out=new Set<string>(),incoming=new Set<string>();
  let last=0;
  for(const raw of input){
    if(raw===null||typeof raw!=='object'||Array.isArray(raw)||
        Reflect.ownKeys(raw).length!==3)return false;
    const c=raw as Record<string,unknown>,t=c.elapsedSeconds;
    if(typeof c.outPlayerId!=='string'||!c.outPlayerId||
        typeof c.inPlayerId!=='string'||!c.inPlayerId||
        c.outPlayerId===c.inPlayerId||
        out.has(c.outPlayerId)||incoming.has(c.inPlayerId)||
        !Number.isSafeInteger(t)||(t as number)<300||
        (t as number)>5100||(t as number)%300!==0||
        (t as number)<last)return false;
    out.add(c.outPlayerId);incoming.add(c.inPlayerId);
    last=t as number;
  }
  return true;
}

function commandsFor(choices:readonly Choice[],fixtureId:string,
  teamId:string,version:182|184){
  return choices.map((c,i)=>({
    schemaVersion:1,commandId:'v'+version+'-sub-'+fixtureId+'-'+i,
    fixtureId,teamId,
    elapsedSeconds:c.elapsedSeconds,kind:'substitute-normal' as const,
    actor:{kind:'player' as const},
    stoppage:c.elapsedSeconds===2700?'half-time' as const:
      'referee-authorized' as const,
    outPlayerId:c.outPlayerId,inPlayerId:c.inPlayerId,
  }));
}

/** Automatic and user-selected changes take one causal source.
 * The v23+v105 replay, not an independent v132/136/138 match,
 * decides live XI legality, generated whistles and later shooter eligibility.
 */
export function prepareM1V182UnifiedMatch(
  initial:InitialCareerSave,journal:M1V120Journal,choices:unknown=[],
){
  if(!validChoices(choices))
    return {ok:false as const,error:'INVALID_SELECTION' as const};
  const base=prepareM1V128ManualFictionalContinuation(initial,journal);
  if(!base||!base.ok)return base;
  const fixtureId=base.fixture.id;
  const substitutions=commandsFor(choices,fixtureId,
    initial.selectedClubId,182);
  const generated=regenerateM1V182UnifiedSource(
    base.request.prematch,base.request.policy,substitutions);
  if(!generated.ok)
    return {ok:false as const,error:generated.error};
  if(!verifyM1V182UnifiedSourceClaim(
      base.request.prematch,base.request.policy,
      generated.plannedCommands,generated.checkpointMedical,
      fixtureId,initial.selectedClubId,initial.rngState))
    return {ok:false as const,error:'UNIFIED_SOURCE_REJECTED' as const};
  return {...base,schemaVersion:M1_V182_UNIFIED_SCHEMA,
    status:'ONE_SOURCE_FICTIONAL_REFEREE_MEDICAL_MANAGER' as const,
    automatic:choices.length===0,
    fictionalIncidentCount:generated.generatedIncidents.length,
    modelledMedicalDepartures:generated.temporaryExitCount,
    modelledMedicalReturns:generated.temporaryReturnCount,
    refereeAndMedicalAuthorityAuthenticated:false as const,
    completeOpponentHistoryAvailable:false as const,
    request:{...base.request,
      commandId:'v182-unified-'+fixtureId,
      plannedCommands:generated.plannedCommands,
      checkpointMedical:generated.checkpointMedical,
      result:generated.result}};
}

/** Source-bound fictional victim/referee chronology; no clinical clearance. */
export function prepareM1V184CausalMatch(
  initial:InitialCareerSave,journal:M1V120Journal,choices:unknown=[],
){
  if(!validChoices(choices))
    return {ok:false as const,error:'INVALID_SELECTION' as const};
  const base=prepareM1V128ManualFictionalContinuation(initial,journal);
  if(!base||!base.ok)return base;
  const fixtureId=base.fixture.id;
  const substitutions=commandsFor(choices,fixtureId,
    initial.selectedClubId,184);
  const generated=regenerateM1V184CausalSource(
    base.request.prematch,base.request.policy,substitutions);
  if(!generated.ok)
    return {ok:false as const,error:generated.error};
  if(!verifyM1V184CausalSourceClaim(
      base.request.prematch,base.request.policy,
      generated.plannedCommands,generated.checkpointMedical,
      fixtureId,initial.selectedClubId,initial.rngState))
    return {ok:false as const,error:'UNIFIED_SOURCE_REJECTED' as const};
  return {...base,schemaVersion:M1_V184_CAUSAL_SCHEMA,
    status:'CAUSAL_SYNTHETIC_REFEREE_MEDICAL_MANAGER' as const,
    automatic:choices.length===0,
    fictionalIncidentCount:generated.generatedIncidents.length,
    modelledMedicalDepartures:generated.temporaryExitCount,
    modelledMedicalReturns:generated.temporaryReturnCount,
    causalAssessments:generated.causalAssessments,
    refereeAndMedicalAuthorityAuthenticated:false as const,
    completeOpponentHistoryAvailable:false as const,
    request:{...base.request,
      commandId:'v184-causal-'+fixtureId,
      plannedCommands:generated.plannedCommands,
      checkpointMedical:generated.checkpointMedical,
      result:generated.result}};
}
