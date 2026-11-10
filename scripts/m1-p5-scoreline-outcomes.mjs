/** Fixture-level scoreline census only from previously verified source rows. */
export function summarizeM1P5ScorelineOutcomes(rows){
  if(!Array.isArray(rows)||rows.length<1||rows.length>10000)
    throw Error('INVALID_MATCH_OUTCOME_ROWS');
  const ids=new Set();
  let homeWins=0,draws=0,awayWins=0,scorelessDraws=0;
  let homeGoals=0,awayGoals=0;
  for(const row of rows){
    if(!Array.isArray(row)||row.length!==3||
        typeof row[0]!=='string'||!row[0]||ids.has(row[0])||
        !Number.isSafeInteger(row[1])||row[1]<0||
        !Number.isSafeInteger(row[2])||row[2]<0)
      throw Error('INVALID_MATCH_OUTCOME_ROWS');
    ids.add(row[0]);
    const home=row[1],away=row[2];
    homeGoals+=home;awayGoals+=away;
    if(home>away)homeWins++;
    else if(away>home)awayWins++;
    else{draws++;if(home===0)scorelessDraws++;}
  }
  return{matches:rows.length,homeWins,draws,awayWins,scorelessDraws,
    homeGoals,awayGoals};
}
