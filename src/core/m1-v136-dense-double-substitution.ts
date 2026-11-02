import {isPlainJsonTree} from './plain-json-tree.js';
import {prepareM1V132DenseManagerSubstitution,
  type M1V132SubstitutionSelection}
  from './m1-v132-dense-manager-substitution.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';
import type {M1V120Journal,M1V120Apply}
  from './m1-v120-playable-journal.js';
import type {Fixture} from './fixtures.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {InitialCareerSave} from './save.js';

export const M1_V136_DENSE_DOUBLE_SUBSTITUTION_SCHEMA=136 as const;
export type M1V136DenseDoubleSubstitution=
  | Readonly<{ok:false;error:'INVALID_SELECTION'|'INVALID_JOURNAL'|
    'UNVERIFIED_VIRTUAL_SOURCE'|'HISTORICAL_HOLD_BYPASS'|
    'NO_LEGAL_LINEUP'|'SOURCE_GENERATION_REJECTED'|
    'PREVIOUS_EXCEPTION_NOT_SUPPORTED'}>
  | Readonly<{ok:true;schemaVersion:136;
    status:'TWO_USER_SELECTED_FICTIONAL_STOPPAGE_SUBSTITUTIONS';
    fixture:Fixture;request:M1V120Apply;
    manualActionRequired:true;externalRefereeAuthorityAuthenticated:false;
    completeOpponentHistory:false;priorM0AndV8Unchanged:true}>;

/** Two distinct normal changes at one or two user-selected dense checkpoints.
 * The existing 5-replacement/3-in-play-window engine, not this adapter,
 * judges each command and replays its effects on the active XI.
 */
export function prepareM1V136DenseDoubleSubstitution(
  initial:InitialCareerSave,journal:M1V120Journal,choices:unknown,
):M1V136DenseDoubleSubstitution|null {
  if(!isPlainJsonTree(choices)||!Array.isArray(choices)||
      choices.length!==2)return {ok:false,error:'INVALID_SELECTION'};
  const [a,b]=choices as M1V132SubstitutionSelection[];
  if(!b)return {ok:false,error:'INVALID_SELECTION'};
  const first=prepareM1V132DenseManagerSubstitution(initial,journal,a);
  if(!first)return null;
  if(!first.ok)return {ok:false,error:first.error};
  const firstCommand=first.request.plannedCommands[0] as Record<string,unknown>;
  const fixtureId=first.fixture.id;
  if(b.elapsedSeconds<a!.elapsedSeconds||
      a!.outPlayerId===b.outPlayerId||
      a!.inPlayerId===b.inPlayerId)
    return {ok:false,error:'INVALID_SELECTION'};
  let secondCommand:Record<string,unknown>;
  if(b.outPlayerId===a!.inPlayerId){
    // A prior incoming substitute is now active; it may later leave
    // under the same original physical source and five-change rules.
    if(!isPlainJsonTree(b)||!b||typeof b!=='object'||
        Array.isArray(b)||Reflect.ownKeys(b).length!==3||
        typeof b.inPlayerId!=='string'||
        !Number.isSafeInteger(b.elapsedSeconds)||
        b.elapsedSeconds<300||b.elapsedSeconds>5100||
        b.elapsedSeconds%300!==0)
      return {ok:false,error:'INVALID_SELECTION'};
    const prematch=first.request.prematch as M1PrematchInput;
    const own=first.fixture.homeClubId===initial.selectedClubId?
      prematch.homeLineup:prematch.awayLineup;
    const byId=new Map(initial.catalog.players.map(p=>[p.id,p]));
    if(!own.bench.includes(b.inPlayerId)||
        byId.get(a!.inPlayerId)?.primaryPosition==='GK' !==
          (byId.get(b.inPlayerId)?.primaryPosition==='GK'))
      return {ok:false,error:'INVALID_SELECTION'};
    // Do not alias the first command's actor: source JSON must be a tree.
    secondCommand={...firstCommand,actor:{kind:'player'},
      elapsedSeconds:b.elapsedSeconds,
      stoppage:b.elapsedSeconds===2700?'half-time':'referee-authorized',
      outPlayerId:b.outPlayerId,inPlayerId:b.inPlayerId};
  }else{
    const second=prepareM1V132DenseManagerSubstitution(initial,journal,b);
    if(!second)return null;
    if(!second.ok)return {ok:false,error:second.error};
    if(first.fixture.id!==second.fixture.id)
      return {ok:false,error:'INVALID_SELECTION'};
    secondCommand=second.request.plannedCommands[0] as Record<string,unknown>;
  }
  const commands=[
    {...firstCommand,commandId:'v136-sub-'+fixtureId+'-1'},
    {...secondCommand,commandId:'v136-sub-'+fixtureId+'-2'},
  ];
  const result=simulateM1V105SpecialGoalChronology(
    first.request.prematch,first.request.policy,commands,[],[],[]);
  if(!result.ok)return {ok:false,error:'SOURCE_GENERATION_REJECTED'};
  return {ok:true,schemaVersion:M1_V136_DENSE_DOUBLE_SUBSTITUTION_SCHEMA,
    status:'TWO_USER_SELECTED_FICTIONAL_STOPPAGE_SUBSTITUTIONS',
    fixture:first.fixture,
    request:{...first.request,commandId:'v136-double-'+fixtureId,
      plannedCommands:commands,result},
    manualActionRequired:true,externalRefereeAuthorityAuthenticated:false,
    completeOpponentHistory:false,priorM0AndV8Unchanged:true};
}
