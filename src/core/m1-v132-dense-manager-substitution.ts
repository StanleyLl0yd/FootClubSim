import {isPlainJsonTree} from './plain-json-tree.js';
import {prepareM1V128ManualFictionalContinuation}
  from './m1-v128-manual-fictional-continuation.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';
import type {M1V120Journal,M1V120Apply}
  from './m1-v120-playable-journal.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {Fixture} from './fixtures.js';
import type {InitialCareerSave} from './save.js';

export const M1_V132_DENSE_MANAGER_SUBSTITUTION_SCHEMA=132 as const;
export interface M1V132SubstitutionSelection {
  readonly outPlayerId:string;
  readonly inPlayerId:string;
  readonly elapsedSeconds:number;
}
export type M1V132DenseSubstitution=
  | Readonly<{ok:false;error:'INVALID_SELECTION'|'INVALID_JOURNAL'|
      'UNVERIFIED_VIRTUAL_SOURCE'|'HISTORICAL_HOLD_BYPASS'|
      'NO_LEGAL_LINEUP'|'SOURCE_GENERATION_REJECTED'|
      'PREVIOUS_EXCEPTION_NOT_SUPPORTED'}>
  | Readonly<{ok:true;schemaVersion:132;
      status:'USER_SELECTED_FICTIONAL_REFEREE_AUTHORIZED_DENSE_SUBSTITUTION';
      fixture:Fixture;request:M1V120Apply;
      manualActionRequired:true;unverifiedExternalRefereeAuthority:true;
      completeOpponentHistory:false;previousM0AndV8Unchanged:true}>;

function validSelection(value:unknown):value is M1V132SubstitutionSelection{
  if(!isPlainJsonTree(value)||!value||typeof value!=='object'||
     Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return Reflect.ownKeys(v).length===3&&
    ['outPlayerId','inPlayerId','elapsedSeconds']
      .every(k=>Object.hasOwn(v,k))&&
    typeof v.outPlayerId==='string'&&
    typeof v.inPlayerId==='string'&&
    Number.isSafeInteger(v.elapsedSeconds)&&
    (v.elapsedSeconds as number)>=300&&
    (v.elapsedSeconds as number)<=5100&&
    (v.elapsedSeconds as number)%300===0;
}

/** Replay prior source and all fictional holds *before* user-controlled
 * substitution. The precise manager IDs, time and result enter v120 CAS.
 */
export function prepareM1V132DenseManagerSubstitution(
  initial:InitialCareerSave,journal:M1V120Journal,
  selection:unknown,
):M1V132DenseSubstitution|null {
  if(!validSelection(selection))return {ok:false,error:'INVALID_SELECTION'};
  const base=prepareM1V128ManualFictionalContinuation(initial,journal);
  if(base===null)return null;
  if(!base.ok)return base;
  const prematch=base.request.prematch as M1PrematchInput;
  const side=base.fixture.homeClubId===initial.selectedClubId?'home':'away';
  const own=side==='home'?prematch.homeLineup:prematch.awayLineup;
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  if(!own.starters.includes(selection.outPlayerId)||
     !own.bench.includes(selection.inPlayerId)||
     players.get(selection.outPlayerId)?.primaryPosition==='GK' !==
       (players.get(selection.inPlayerId)?.primaryPosition==='GK'))
    return {ok:false,error:'INVALID_SELECTION'};
  const command={schemaVersion:1,commandId:'v132-sub-'+base.fixture.id,
    fixtureId:base.fixture.id,teamId:initial.selectedClubId,
    elapsedSeconds:selection.elapsedSeconds,kind:'substitute-normal',
    actor:{kind:'player'},stoppage:selection.elapsedSeconds===2700?
      'half-time':'referee-authorized',
    outPlayerId:selection.outPlayerId,inPlayerId:selection.inPlayerId};
  const result=simulateM1V105SpecialGoalChronology(
    prematch,base.request.policy,[command],[],[],[]);
  if(!result.ok)return {ok:false,error:'SOURCE_GENERATION_REJECTED'};
  return {ok:true,schemaVersion:M1_V132_DENSE_MANAGER_SUBSTITUTION_SCHEMA,
    status:'USER_SELECTED_FICTIONAL_REFEREE_AUTHORIZED_DENSE_SUBSTITUTION',
    fixture:base.fixture,
    request:{...base.request,commandId:command.commandId,
      plannedCommands:[command],result},
    manualActionRequired:true,unverifiedExternalRefereeAuthority:true,
    completeOpponentHistory:false,previousM0AndV8Unchanged:true};
}
