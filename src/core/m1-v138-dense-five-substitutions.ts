import {isPlainJsonTree} from './plain-json-tree.js';
import {prepareM1V128ManualFictionalContinuation}
  from './m1-v128-manual-fictional-continuation.js';
import type {M1V132SubstitutionSelection}
  from './m1-v132-dense-manager-substitution.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {M1V120Apply,M1V120Journal}
  from './m1-v120-playable-journal.js';
import type {Fixture} from './fixtures.js';
import type {InitialCareerSave} from './save.js';

export const M1_V138_DENSE_FIVE_SUBSTITUTIONS_SCHEMA=138 as const;
export type M1V138DenseFiveSubstitutions=
  | Readonly<{ok:false;error:'INVALID_SELECTION'|'INVALID_JOURNAL'|
      'UNVERIFIED_VIRTUAL_SOURCE'|'HISTORICAL_HOLD_BYPASS'|
      'NO_LEGAL_LINEUP'|'SOURCE_GENERATION_REJECTED'|
      'PREVIOUS_EXCEPTION_NOT_SUPPORTED'}>
  | Readonly<{ok:true;schemaVersion:138;
      status:'USER_SELECTED_FICTIONAL_NORMAL_SUBSTITUTIONS_UP_TO_FIVE';
      fixture:Fixture;request:M1V120Apply;substitutionCount:number;
      manualActionRequired:true;externalRefereeAuthorityAuthenticated:false;
      completeOpponentHistory:false;priorM0AndV8Unchanged:true}>;

function validChoice(v:unknown):v is M1V132SubstitutionSelection{
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  const x=v as Record<string,unknown>;
  return Reflect.ownKeys(x).length===3&&
    ['outPlayerId','inPlayerId','elapsedSeconds']
      .every(k=>Object.hasOwn(x,k))&&
    typeof x.outPlayerId==='string'&&
    typeof x.inPlayerId==='string'&&
    x.outPlayerId!==x.inPlayerId&&
    Number.isSafeInteger(x.elapsedSeconds)&&
    (x.elapsedSeconds as number)>=300&&
    (x.elapsedSeconds as number)<=5100&&
    (x.elapsedSeconds as number)%300===0;
}

/** One source preflight and one dense source simulation, irrespective
 * of batch length. Repeat full admission at each command inside
 * the existing v105/v101/v8 source engine, not five entire matches.
 */
export function prepareM1V138DenseFiveSubstitutions(
  initial:InitialCareerSave,journal:M1V120Journal,choices:unknown,
):M1V138DenseFiveSubstitutions|null{
  if(!isPlainJsonTree(choices)||!Array.isArray(choices)||
      choices.length<3||choices.length>5)
    return {ok:false,error:'INVALID_SELECTION'};
  const selected=choices as unknown[];
  const outIds=new Set<string>(),inIds=new Set<string>();
  let previous=-1;
  for(const c of selected){
    if(!validChoice(c)||c.elapsedSeconds<previous||
        outIds.has(c.outPlayerId)||inIds.has(c.inPlayerId))
      return {ok:false,error:'INVALID_SELECTION'};
    previous=c.elapsedSeconds;
    outIds.add(c.outPlayerId);inIds.add(c.inPlayerId);
  }
  const base=prepareM1V128ManualFictionalContinuation(initial,journal);
  if(base===null)return null;
  if(!base.ok)return base;
  const prematch=base.request.prematch as M1PrematchInput;
  const own=base.fixture.homeClubId===initial.selectedClubId?
    prematch.homeLineup:prematch.awayLineup;
  const players=new Map(initial.catalog.players.map(p=>[p.id,p]));
  const active=new Set(own.starters),available=new Set(own.bench);
  for(const choice of selected as M1V132SubstitutionSelection[]){
    if(!active.has(choice.outPlayerId)||
        !available.has(choice.inPlayerId)||
        (players.get(choice.outPlayerId)?.primaryPosition==='GK')!==(
          players.get(choice.inPlayerId)?.primaryPosition==='GK'))
      return {ok:false,error:'INVALID_SELECTION'};
    active.delete(choice.outPlayerId);
    active.add(choice.inPlayerId);
    available.delete(choice.inPlayerId);
  }
  const fixture=base.fixture;
  const commands=(selected as M1V132SubstitutionSelection[]).map((c,i)=>({
    schemaVersion:1,commandId:'v138-sub-'+fixture.id+'-'+i,
    fixtureId:fixture.id,teamId:initial.selectedClubId,
    elapsedSeconds:c.elapsedSeconds,kind:'substitute-normal',
    actor:{kind:'player'},stoppage:c.elapsedSeconds===2700?
      'half-time':'referee-authorized',
    outPlayerId:c.outPlayerId,inPlayerId:c.inPlayerId,
  }));
  const result=simulateM1V105SpecialGoalChronology(
    prematch,base.request.policy,commands,[],[],[]);
  if(!result.ok)return {ok:false,error:'SOURCE_GENERATION_REJECTED'};
  return {ok:true,schemaVersion:M1_V138_DENSE_FIVE_SUBSTITUTIONS_SCHEMA,
    status:'USER_SELECTED_FICTIONAL_NORMAL_SUBSTITUTIONS_UP_TO_FIVE',
    fixture,substitutionCount:commands.length,
    request:{...base.request,commandId:'v138-multi-'+fixture.id,
      plannedCommands:commands,result},
    manualActionRequired:true,externalRefereeAuthorityAuthenticated:false,
    completeOpponentHistory:false,priorM0AndV8Unchanged:true};
}
