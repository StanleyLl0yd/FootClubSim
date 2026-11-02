/** Stable M1 fixture seed derivation shared by the ordinary proposal
 * and source-verified goal-stoppage admission. Preserve its existing
 * unsigned 32-bit mixing, including the nonzero fallback.
 */
export function deriveM1FixtureSeed(base:number,fixtureId:string):number{
  let value=base>>>0;
  for(const character of fixtureId){
    value=Math.imul(value^character.charCodeAt(0),16777619)>>>0;
  }
  return value||1;
}
