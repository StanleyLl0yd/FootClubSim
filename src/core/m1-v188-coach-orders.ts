import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {validateTacticalPlan,type TacticalPlan} from './tactics.js';
import type {M1PrematchInput} from './m1-clock.js';

export const M1_V188_COACH_ORDER_VERSION=1 as const;
type Value=Record<string,unknown>;
const rec=(x:unknown):x is Value=>
  x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x:Value,keys:readonly string[])=>
  Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const PLAN_KEYS=['schemaVersion','clubId','formation','mentality',
  'pressing','compactness','defensiveLine','passingRisk','tempo'];

/** Convert untrusted manager UI choices into team-scoped, actor-bound
 * commands at 5-minute boundaries. No arbitrary or forged clock event.
 */
export function admitM1V188CoachOrders(
  input:M1PrematchInput,selected:string,raw:unknown,
):Value[]|null{
  if(!isPlainJsonTree(raw)||!Array.isArray(raw)||raw.length>8)
    return null;
  const own=input.fixture.homeClubId===selected?
    input.homeLineup:input.fixture.awayClubId===selected?
      input.awayLineup:null;
  if(raw.length&&!own)return null;
  const eligible=new Set(own?[...own.starters,...own.bench]:[]);
  const players=new Map(input.catalog.players.map(p=>[p.id,p]));
  const commands:Value[]=[];
  const already=new Set<string>();
  let prior=-1;
  for(const [index,choice] of raw.entries()){
    if(!rec(choice)||!Number.isSafeInteger(choice.elapsedSeconds)||
        (choice.elapsedSeconds as number)<300||
        (choice.elapsedSeconds as number)>5100||
        (choice.elapsedSeconds as number)%300!==0||
        (choice.elapsedSeconds as number)<prior)return null;
    const at=choice.elapsedSeconds as number;
    prior=at;
    let command:Value;
    let key:string;
    if(choice.kind==='team-tactics'){
      if(!exact(choice,['kind','elapsedSeconds','plan'])||
          !rec(choice.plan)||!exact(choice.plan,PLAN_KEYS)||
          choice.plan.schemaVersion!==2||
          validateTacticalPlan(choice.plan as unknown as TacticalPlan,
            selected).length)return null;
      key=String(at)+'/team';
      command={schemaVersion:1,commandId:'v188-coach-'+
        input.fixture.id+'-'+index,fixtureId:input.fixture.id,
        teamId:selected,elapsedSeconds:at,actor:{kind:'player'},
        kind:'set-tactics',plan:{...choice.plan}};
    }else if(choice.kind==='player-focus'){
      if(!exact(choice,['kind','elapsedSeconds','playerId','focus'])||
          typeof choice.playerId!=='string'||
          !eligible.has(choice.playerId)||
          players.get(choice.playerId)?.primaryPosition==='GK'||
          !['balanced','attack','defend'].includes(choice.focus as string))
        return null;
      key=String(at)+'/player/'+choice.playerId;
      command={schemaVersion:1,commandId:'v188-focus-'+
        input.fixture.id+'-'+index,fixtureId:input.fixture.id,
        teamId:selected,playerId:choice.playerId,elapsedSeconds:at,
        actor:{kind:'player'},kind:'set-player-focus',
        focus:choice.focus};
    }else return null;
    if(already.has(key))return null;
    already.add(key);
    commands.push(command);
  }
  return commands;
}

/** Verify stored command identity by reconstructing every field from
 * the accepted prematch, not by trusting posted team/actor/ID claims.
 * The v8 source engine then verifies each player's physical availability.
 */
export function verifyM1V188CoachOrders(
  input:M1PrematchInput,selected:string,commands:unknown,
):boolean{
  if(!Array.isArray(commands)||commands.length<1||
      commands.length>8||commands.some(c=>!rec(c)))return false;
  const choices=commands.map(c=>{
    const item=c as Value;
    return item.kind==='set-tactics'?
      {kind:'team-tactics',elapsedSeconds:item.elapsedSeconds,plan:item.plan}:
      item.kind==='set-player-focus'?
        {kind:'player-focus',elapsedSeconds:item.elapsedSeconds,
          playerId:item.playerId,focus:item.focus}:null;
  });
  if(choices.includes(null))return false;
  const accepted=admitM1V188CoachOrders(input,selected,choices);
  return accepted!==null&&sameCanonicalValue(accepted,commands);
}
