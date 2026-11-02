import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {simulateM1V105SpecialGoalChronology}
  from './m1-v105-special-goal-chronology.js';

/** Only a seed-generated goal directly before a 300s boundary
 * creates this fictional in-play substitution opportunity.
 * Earlier substitutions are replayed before testing later stops.
 */
export function verifyM1V158GeneratedGoalStops(
  prematch:unknown,policy:unknown,commands:unknown,
):boolean{
  if(![prematch,policy,commands].every(isPlainJsonTree)||
      !Array.isArray(commands)||commands.length<3||
      commands.length>5)return false;
  const changes=commands as unknown[];
  const times=new Set<number>();
  for(const raw of changes){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
    const at=(raw as Record<string,unknown>).elapsedSeconds;
    if(!Number.isSafeInteger(at)||(at as number)<300||
        (at as number)>5100||(at as number)%300!==0)return false;
    if(at!==2700)times.add(at as number);
  }
  for(const time of times){
    const prefix=changes.filter(c=>
      (c as {elapsedSeconds:number}).elapsedSeconds<time);
    const run=simulateM1V105SpecialGoalChronology(
      prematch,policy,prefix,[],[],[]);
    if(!run.ok||!run.events.some(event=>
      event.type==='source'&&event.source.type==='shot'&&
      event.source.outcome==='goal'&&
      event.elapsedSeconds===time-1))return false;
  }
  return true;
}

/** Canonical v158 claim identity, verified before v120 CAS persistence.
 * This is a fictional, source-generated whistle, never external authority.
 */
export function verifyM1V158SourceClaim(
  prematch:unknown,policy:unknown,commands:unknown,
  fixtureId:string,selectedTeamId:string,fixtureSeedBase:number,
):boolean{
  if(typeof fixtureId!=='string'||typeof selectedTeamId!=='string'||
      !Number.isSafeInteger(fixtureSeedBase)||
      fixtureSeedBase<0||fixtureSeedBase>0xffffffff||
      !prematch||typeof prematch!=='object'||
      (prematch as {rngSeed?:unknown}).rngSeed!==
        deriveM1FixtureSeed(fixtureSeedBase,fixtureId)||
      !verifyM1V158GeneratedGoalStops(prematch,policy,commands)||
      !Array.isArray(commands))return false;
  const names=new Set<string>(),outs=new Set<string>(),
    ins=new Set<string>();
  let last=-1;
  for(let i=0;i<commands.length;i++){
    const c=commands[i] as Record<string,unknown>;
    const t=c.elapsedSeconds;
    if(Reflect.ownKeys(c).length!==10||c.schemaVersion!==1||
        c.kind!=='substitute-normal'||
        c.commandId!=='v158-sub-'+fixtureId+'-'+i||
        c.fixtureId!==fixtureId||c.teamId!==selectedTeamId||
        typeof c.outPlayerId!=='string'||
        typeof c.inPlayerId!=='string'||
        outs.has(c.outPlayerId)||ins.has(c.inPlayerId)||
        !c.actor||typeof c.actor!=='object'||Array.isArray(c.actor)||
        Reflect.ownKeys(c.actor).length!==1||
        (c.actor as Record<string,unknown>).kind!=='player'||
        (t as number)<last||
        c.stoppage!==(t===2700?'half-time':'referee-authorized'))
      return false;
    outs.add(c.outPlayerId);ins.add(c.inPlayerId);
    names.add(c.commandId as string);
    last=t as number;
  }
  return names.size===commands.length;
}
