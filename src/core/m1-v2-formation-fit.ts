import type {Player,Position} from './model.js';
import type {TacticalPlan} from './tactics.js';

/** The v2 engine measures line coverage, not individual shirt-number slots.
 * Keep this arithmetic shared with the player-facing XI adviser.
 */
export interface M1V2PositionBuckets {
  readonly defenders:number;
  readonly holding:number;
  readonly midfield:number;
  readonly advanced:number;
  readonly strikers:number;
}
export interface M1V2FormationFit {
  readonly mismatch:number;
  readonly fit:number;
  readonly attack:number;
  readonly defense:number;
  readonly expected:Readonly<{
    defenders:number;holding:number;midfield:number;forwards:number;
  }>;
  readonly actual:M1V2PositionBuckets;
}
const clamp=(value:number,min:number,max:number)=>
  Math.max(min,Math.min(max,value));
export function m1V2FormationTargets(formation:string):
  M1V2FormationFit['expected']|null{
  if(!/^\d(?:-\d){1,3}$/.test(formation))return null;
  const lines=formation.split('-').map(Number);
  if(lines.some(n=>n<1)||lines.reduce((sum,n)=>sum+n,0)!==10)return null;
  const defenders=lines[0]!;
  const holding=lines.length===4?lines[1]!:0;
  const forwards=lines[lines.length-1]!;
  return{defenders,holding,midfield:10-defenders-holding-forwards,forwards};
}
/** Groups exactly mirror the v2 shot kernel's coarse position groups. */
export function m1V2PositionGroup(position:Position):
  keyof M1V2PositionBuckets|null{
  if(position==='GK')return null;
  if(['DL','DC','DR','WBL','WBR'].includes(position))return 'defenders';
  if(position==='DM')return 'holding';
  if(position==='ST')return 'strikers';
  if(position.startsWith('AM'))return 'advanced';
  return 'midfield';
}
export function m1V2FitForBuckets(
  expected:M1V2FormationFit['expected'],actual:M1V2PositionBuckets,
):M1V2FormationFit{
  const forwardCover=Math.min(actual.advanced,
    Math.max(0,expected.forwards-actual.strikers));
  const coveredFW=actual.strikers+forwardCover;
  const coveredM=actual.midfield+actual.advanced-forwardCover;
  const mismatch=Math.abs(expected.defenders-actual.defenders)+
    Math.abs(expected.holding-actual.holding)+
    Math.abs(expected.midfield-coveredM)+
    Math.abs(expected.forwards-coveredFW);
  const fit=Math.max(0,1-mismatch/20);
  return{mismatch,fit,expected,actual,
    attack:clamp((expected.forwards-2)*0.027+
      (fit-0.75)*0.032,-0.07,0.07),
    defense:clamp((expected.defenders-4)*0.023+
      (fit-0.75)*0.028,-0.07,0.07)};
}
export function inspectM1V2FormationFit(
  formation:string,starters:readonly string[],
  players:ReadonlyMap<string,Player>,
):M1V2FormationFit|null{
  const expected=m1V2FormationTargets(formation);
  if(!expected||starters.length!==11||
      new Set(starters).size!==11)return null;
  const actual={defenders:0,holding:0,midfield:0,advanced:0,strikers:0};
  let goalkeepers=0;
  for(const id of starters){
    const player=players.get(id);
    if(!player)return null;
    const group=m1V2PositionGroup(player.primaryPosition);
    if(group)actual[group]++;
    else goalkeepers++;
  }
  return goalkeepers===1?m1V2FitForBuckets(expected,actual):null;
}
export function m1V2TacticalShape(
  plan:TacticalPlan,starters:readonly string[],
  players:ReadonlyMap<string,Player>,
):Readonly<{attack:number;defense:number}>{
  if(plan.schemaVersion!==2)return{attack:0,defense:0};
  const expected=m1V2FormationTargets(plan.formation);
  if(!expected)return{attack:0,defense:0};
  // The live match kernel can have fewer than eleven active players
  // after a dismissal. Retain its exact v2 calculation for those states;
  // only the pre-match editor requires a legal eleven.
  const buckets={defenders:0,holding:0,midfield:0,advanced:0,strikers:0};
  for(const id of starters){
    const position=players.get(id)!.primaryPosition;
    const group=m1V2PositionGroup(position);
    if(group)buckets[group]++;
  }
  const fit=m1V2FitForBuckets(expected,buckets);
  return{attack:fit.attack,defense:fit.defense};
}
