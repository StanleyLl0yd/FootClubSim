import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {simulateM1V19InternalReferee} from './m1-v19-internal-foul-injury.js';
import {buildM1V124GeneratedCommands}
  from './m1-v124-generated-source.js';
import {verifyM1V158SourceClaim,verifyM1V158CommandShape}
  from './m1-v158-generated-goal-stops.js';
import {verifyM1V124GeneratedSourceClaim}
  from './m1-v124-generated-source.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';

type Command=Readonly<Record<string,unknown>>;

/** The referee orders at a shared second precede manager changes.
 * Stable manager command order is retained for same-window substitutions.
 */
export function orderM1V166CombinedCommands(
  referee:readonly Command[],substitutions:readonly Command[],
):Command[]{
  return [...referee,...substitutions].sort((a,b)=>
    (a.elapsedSeconds as number)-(b.elapsedSeconds as number)||
    Number(a.kind==='substitute-normal')-
      Number(b.kind==='substitute-normal'));
}

/** One fictional referee + manager source, never official evidence.
 * Every simulated whistle is checked against prior combined actions.
 */
export function verifyM1V166CombinedSourceClaim(
  prematch:unknown,policy:unknown,commands:unknown,
  fixtureId:string,selectedClubId:string,careerSeed:number,
):boolean{
  if(!isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
     !isPlainJsonTree(commands)||!Array.isArray(commands)||
     commands.length>275||
     typeof fixtureId!=='string'||!fixtureId)return false;
  const generated=simulateM1V19InternalReferee(prematch,policy);
  if(!generated.ok||generated.fixtureId!==fixtureId)return false;
  const referee=buildM1V124GeneratedCommands(
    generated.generatedIncidents,fixtureId);
  const substitutions=(commands as Command[]).filter(
    c=>c?.kind==='substitute-normal');
  const identityOk=substitutions.length===0?
    verifyM1V124GeneratedSourceClaim(prematch,policy,referee,
      fixtureId,careerSeed):
    verifyM1V158SourceClaim(prematch,policy,substitutions,
      fixtureId,selectedClubId,careerSeed);
  if(!identityOk)return false;
  const expected=orderM1V166CombinedCommands(referee,substitutions);
  if(!sameCanonicalValue(commands,expected))return false;
  for(const stop of new Set(substitutions.map(c=>
    c.elapsedSeconds as number).filter(t=>t!==2700))){
    const prior=expected.filter(c=>(c.elapsedSeconds as number)<stop);
    const replay=simulateM1V105SpecialGoalChronology(
      prematch,policy,prior,[],[],[]);
    if(!replay.ok||!replay.events.some(e=>
      e.type==='source'&&e.source.type==='shot'&&
      e.source.outcome==='goal'&&e.elapsedSeconds===stop-1))
      return false;
  }
  return simulateM1V105SpecialGoalChronology(
    prematch,policy,expected,[],[],[]).ok;
}

/** A fictional generated caution/red/injury whistle permits a manager
 * substitution at the identical checkpoint. A claimed text stoppage alone
 * cannot authorize it. Half-time remains an ordinary allowed interval.
 */
export function verifyM1V180RefereeStoppageSourceClaim(
  prematch:unknown,policy:unknown,commands:unknown,
  fixtureId:string,selectedClubId:string,careerSeed:number,
):boolean{
  if(!isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
     !isPlainJsonTree(commands)||!Array.isArray(commands)||
     commands.length>275||!fixtureId)return false;
  const generated=simulateM1V19InternalReferee(prematch,policy);
  if(!generated.ok||generated.fixtureId!==fixtureId)return false;
  const referee=buildM1V124GeneratedCommands(
    generated.generatedIncidents,fixtureId);
  if(!verifyM1V124GeneratedSourceClaim(
      prematch,policy,referee,fixtureId,careerSeed))return false;
  const subs=(commands as Command[]).filter(
    command=>command?.kind==='substitute-normal');
  if(subs.length===0||subs.length>5||
      !verifyM1V158CommandShape(
        prematch,policy,subs,fixtureId,selectedClubId,careerSeed))
    return false;
  const generatedStops=new Set(
    generated.generatedIncidents.map(incident=>incident.elapsedSeconds));
  if(!subs.some(sub=>sub.elapsedSeconds!==2700)||
      !subs.every(sub=>sub.elapsedSeconds===2700||
        generatedStops.has(sub.elapsedSeconds as number)))return false;
  const expected=orderM1V166CombinedCommands(referee,subs);
  return sameCanonicalValue(commands,expected)&&
    simulateM1V105SpecialGoalChronology(
      prematch,policy,expected,[],[],[]).ok;
}
