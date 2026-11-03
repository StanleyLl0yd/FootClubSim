import {isPlainJsonTree} from './plain-json-tree.js';
import {prepareM1V128ManualFictionalContinuation}
  from './m1-v128-manual-fictional-continuation.js';
import {regenerateM1V182UnifiedSource,
  verifyM1V182UnifiedSourceClaim}
  from './m1-v182-unified-source.js';
import type {InitialCareerSave} from './save.js';
import type {M1V120Journal} from './m1-v120-playable-journal.js';

export const M1_V182_UNIFIED_SCHEMA=182 as const;
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
  const substitutions=choices.map((c,i)=>({
    schemaVersion:1,commandId:'v182-sub-'+fixtureId+'-'+i,
    fixtureId,teamId:initial.selectedClubId,
    elapsedSeconds:c.elapsedSeconds,kind:'substitute-normal' as const,
    actor:{kind:'player' as const},
    stoppage:c.elapsedSeconds===2700?'half-time' as const:
      'referee-authorized' as const,
    outPlayerId:c.outPlayerId,inPlayerId:c.inPlayerId,
  }));
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
