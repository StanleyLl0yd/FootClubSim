import type {M1PrematchInput} from './m1-clock.js';
import type {AttributeKey,Catalog,Player} from './model.js';
import {recoverM1V188Condition,
  type M1V188ConditionState} from './m1-v188-condition.js';

/** Pure, non-persistent effective-match attribute projection.
 * Never edits the immutable starting catalog or the canonical prematch
 * bytes saved into the v188 source journal. Version 2 only.
 */
export function deriveM1V188ConditionedMatchInput(
  input:M1PrematchInput,
  condition:M1V188ConditionState,
):M1PrematchInput|null{
  const home=input.catalog.clubs.find(c=>
    c.id===input.fixture.homeClubId);
  const away=input.catalog.clubs.find(c=>
    c.id===input.fixture.awayClubId);
  if(!home||!away||home.id===away.id)return null;
  const players=new Map(input.catalog.players.map(p=>[p.id,p]));
  const effective=new Map<string,number>();
  for(const club of [home,away]){
    const values=recoverM1V188Condition(condition,club,players);
    if(!values)return null;
    for(const [id,value] of values){
      if(effective.has(id))return null;
      effective.set(id,value);
    }
  }
  const involved=new Set([
    ...input.homeLineup.starters,...input.homeLineup.bench,
    ...input.awayLineup.starters,...input.awayLineup.bench,
  ]);
  if(involved.size!==input.homeLineup.starters.length+
      input.homeLineup.bench.length+
      input.awayLineup.starters.length+
      input.awayLineup.bench.length||[...involved].some(id=>
        !effective.has(id)))return null;
  const adjusted:Player[]=input.catalog.players.map(player=>{
    const score=involved.has(player.id)?effective.get(player.id):100;
    if(score===undefined||score===100)return player;
    // At minimum condition (35), relevant football skills can fall by
    // at most 19.5% before integer rounding. Fitness/leadership stay
    // original, so recovery and athlete identity never self-modify.
    const factor=1-(100-score)*0.003;
    const attrs=Object.fromEntries(
      (Object.entries(player.attributes) as [AttributeKey,number][])
        .map(([key,value])=>[key,
          key==='naturalFitness'||key==='leadership'||
          key==='teamwork'||key==='aggression'?value:
            Math.max(1,Math.round(value*factor))]),
    ) as Player['attributes'];
    return{...player,attributes:attrs};
  });
  const catalog:Catalog={...input.catalog,players:adjusted};
  return{...input,catalog};
}
