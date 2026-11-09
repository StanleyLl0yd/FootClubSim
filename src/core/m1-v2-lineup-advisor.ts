import type {Player} from './model.js';
import {inspectM1V2FormationFit,m1V2FitForBuckets,
  m1V2FormationTargets,m1V2PositionGroup,
  type M1V2FormationFit,type M1V2PositionBuckets}
  from './m1-v2-formation-fit.js';

export interface M1V2SuggestedXI {
  readonly starters:readonly string[];
  readonly fit:M1V2FormationFit;
}
type Group=keyof M1V2PositionBuckets;
const PRIORITY:Readonly<Record<Group,number>>={
  defenders:0,holding:1,midfield:2,advanced:3,strikers:4,
};
function fieldQuality(player:Player,group:Group):number{
  const a=player.attributes;
  if(group==='defenders')return a.tackling+a.marking+
    a.defensivePositioning+a.shortPassing;
  if(group==='holding')return a.tackling+a.shortPassing+
    a.decisions+a.defensivePositioning;
  if(group==='midfield')return a.shortPassing+a.decisions+
    a.vision+a.workRate;
  return a.finishing+a.offBallMovement+a.dribbling+a.decisions;
}
interface FieldCandidate{
  readonly id:string;readonly group:Group;readonly foreigner:boolean;
  readonly quality:number;readonly retained:boolean;readonly order:number;
}
/** A deliberate, opt-in suggestion, never an automatic edit of a saved XI.
 * Exhaustive bounded search (max 20 outfielders in the current preview):
 * 1) minimize EXACT v2 formation mismatch;
 * 2) maximize football skill score; 3) retain prior selected players.
 * The engine still has no per-shirt-slot assignments, so do not pretend
 * this suggestion allocates precise left/right roles.
 */
export function suggestM1V2FormationXI(
  formation:string,eligibleIds:readonly string[],
  players:ReadonlyMap<string,Player>,currentXI:readonly string[]=[],
):M1V2SuggestedXI|null{
  const expected=m1V2FormationTargets(formation);
  if(!expected||eligibleIds.length>23||
      new Set(eligibleIds).size!==eligibleIds.length)return null;
  const keep=new Set(currentXI);
  const keepers:string[]=[];
  const candidates:FieldCandidate[]=[];
  for(const [order,id] of eligibleIds.entries()){
    const p=players.get(id);
    if(!p)return null;
    const group=m1V2PositionGroup(p.primaryPosition);
    if(!group){keepers.push(id);continue;}
    candidates.push({id,group,foreigner:p.foreignerForCompetition,
      quality:fieldQuality(p,group),retained:keep.has(id),order});
  }
  if(!keepers.length||candidates.length<10||candidates.length>22)return null;
  const counts={defenders:0,holding:0,midfield:0,advanced:0,strikers:0};
  let best:{mismatch:number;quality:number;retained:number;
    keeper:string;members:readonly FieldCandidate[]}|null=null;
  for(const keeperId of keepers){
    const keeper=players.get(keeperId)!;
    const keeperForeign=Number(keeper.foreignerForCompetition);
    const keeperQuality=keeper.attributes.reflexes+
      keeper.attributes.handling+keeper.attributes.oneOnOnes+
      keeper.attributes.aerialCommand;
    const selected:FieldCandidate[]=[];
    function search(index:number,foreigners:number,
      quality:number,retained:number):void{
      if(foreigners>7)return;
      if(selected.length===10){
        const mismatch=m1V2FitForBuckets(expected!,counts).mismatch;
        const totalQuality=quality+keeperQuality;
        const kept=retained+Number(keep.has(keeperId));
        if(!best||mismatch<best.mismatch||
            mismatch===best.mismatch&&(
              totalQuality>best.quality||
              totalQuality===best.quality&&kept>best.retained)){
          best={mismatch,quality:totalQuality,retained:kept,
            keeper:keeperId,members:[...selected]};
        }
        return;
      }
      if(index>=candidates.length||
          candidates.length-index<10-selected.length)return;
      const candidate=candidates[index]!;
      selected.push(candidate);
      counts[candidate.group]++;
      search(index+1,foreigners+Number(candidate.foreigner),
        quality+candidate.quality,retained+Number(candidate.retained));
      counts[candidate.group]--;
      selected.pop();
      search(index+1,foreigners,quality,retained);
    }
    search(0,keeperForeign,0,0);
  }
  if(!best)return null;
  // Names appear in intuitive defense→midfield→attack order on the
  // existing schematic pitch, but there are still no assigned slots.
  const winner=best as {keeper:string;members:readonly FieldCandidate[]};
  const starters=[winner.keeper,...[...winner.members].sort(
    (a,b)=>PRIORITY[a.group]-PRIORITY[b.group]||a.order-b.order)
    .map(p=>p.id)];
  const fit=inspectM1V2FormationFit(formation,starters,players);
  return fit?{starters,fit}:null;
}
