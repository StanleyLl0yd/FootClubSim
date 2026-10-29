import {validateLineup} from './validation.js';
import type {Club,MatchLineup,MatchRosterRules,Player} from './model.js';

/**
 * Read-only proposal from a source-verified registration, never permission
 * to play. Medical and suspension exclusions must be fully source-replayed
 * before calling. Final v76 admission and CAS remain mandatory.
 */
export function selectM1V96EligibleRegisteredLineup(
  club:Club,players:ReadonlyMap<string,Player>,
  excluded:ReadonlySet<string>,rules:MatchRosterRules,
):MatchLineup|null {
  const available=club.registeredPlayerIds.filter(id=>
    !excluded.has(id)&&players.has(id));
  const keepers=available.filter(id=>
    players.get(id)?.primaryPosition==='GK');
  const field=available.filter(id=>
    players.get(id)?.primaryPosition!=='GK');
  if(field.length<rules.starterCount-1||keepers.length===0)return null;
  for(const goalkeeper of keepers){
    const current=field.slice(0,rules.starterCount-1);
    const cap=rules.maxForeignersOnField-
      Number(players.get(goalkeeper)?.foreignerForCompetition===true);
    if(cap<0)continue;
    let foreign=current.filter(id=>
      players.get(id)?.foreignerForCompetition===true).length;
    if(foreign>cap){
      // Retain the earliest registered eligible players whenever possible.
      // Replace the latest foreign outfield starters with later domestic
      // reserves. Never bypass a medical hold or automatic suspension.
      const reserves=field.slice(rules.starterCount-1).filter(id=>
        players.get(id)?.foreignerForCompetition===false);
      for(let i=current.length-1;i>=0&&foreign>cap;i--){
        if(players.get(current[i]!)?.foreignerForCompetition===true&&
            reserves.length){
          current[i]=reserves.shift()!;
          foreign--;
        }
      }
      if(foreign>cap)continue;
    }
    const starters=[goalkeeper,...current];
    if(new Set(starters).size!==rules.starterCount)continue;
    const chosen=new Set(starters);
    const result:MatchLineup={clubId:club.id,starters,
      bench:available.filter(id=>!chosen.has(id)).slice(0,rules.maxBench)};
    if(validateLineup(result,club,players,rules).length===0)
      return result;
  }
  return null;
}
