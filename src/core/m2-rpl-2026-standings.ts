import {isStableId} from './identifiers.js';

/**
 * Isolated, read-only Article 18 research adapter for the future M2 pack.
 * Not connected to v188 saves or to the public provisional league table.
 * All fixtures, sanctions and prior-season positions must be caller verified.
 */
export const M2_RPL_2026_STANDINGS_VERSION=1 as const;
type Phase='current'|'final';
type Row={clubId:string;played:number;wins:number;draws:number;losses:number;
  goalsFor:number;goalsAgainst:number;goalDifference:number;points:number;
  awayWins:number;awayGoals:number};
type Played={fixtureId:string;homeClubId:string;awayClubId:string;
  homeGoals:number;awayGoals:number};
type Input={phase:Phase;clubIds:readonly string[];played:readonly Played[];
  disciplinaryPoints?:Readonly<Record<string,number>>;
  previousSeasonPositions?:Readonly<Record<string,number>>};
type Unresolved='MISSING_DISCIPLINE'|'MISSING_PREVIOUS_SEASON'|
  'EXTRA_MATCH_REQUIRED';
export type M2RplStandingTier=Readonly<{position:number;
  clubIds:readonly string[];unresolved:Unresolved|null}>;
export type M2RplStandingResult=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'DUPLICATE_FIXTURE'|
    'INCOMPLETE_FINAL_CALENDAR'}>
  | Readonly<{ok:true;schemaVersion:1;
    status:'ARTICLE_18_RESEARCH_ONLY_NOT_OFFICIAL';
    phase:Phase;resolved:boolean;rows:readonly Readonly<Row>[];
    tiers:readonly M2RplStandingTier[]}>;

const record=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const score=(n:unknown)=>Number.isSafeInteger(n)&&
  typeof n==='number'&&n>=0&&n<=99;
const fail=(error:Extract<M2RplStandingResult,{ok:false}>['error']):
  M2RplStandingResult=>({ok:false,error});
function exactMap(value:unknown,ids:readonly string[],
  min:number,max:number,unique=false):Map<string,number>|null{
  if(!record(value)||Object.keys(value).length!==ids.length)return null;
  const out=new Map<string,number>();
  for(const id of ids){
    const n=value[id];
    if(typeof n!=='number'||!Number.isSafeInteger(n)||
       n<min||n>max)return null;
    out.set(id,n);
  }
  return unique&&new Set(out.values()).size!==ids.length?null:out;
}
function empty(id:string):Row{
  return {clubId:id,played:0,wins:0,draws:0,losses:0,
    goalsFor:0,goalsAgainst:0,goalDifference:0,points:0,
    awayWins:0,awayGoals:0};
}
const compare=(a:readonly number[],b:readonly number[])=>{
  for(let i=0;i<a.length;i++){
    const delta=b[i]!-a[i]!;
    if(delta)return delta;
  }
  return 0;
};

/** Do not break unresolved ties by club ID or by an invented RPL ruling. */
export function deriveM2Rpl2026ResearchStandings(
  raw:unknown,
):M2RplStandingResult{
  if(!record(raw)||!['current','final'].includes(String(raw.phase))||
     !Array.isArray(raw.clubIds)||raw.clubIds.length!==16||
     !raw.clubIds.every((x:unknown)=>typeof x==='string'&&isStableId(x))||
     new Set(raw.clubIds).size!==16||
     !Array.isArray(raw.played)||raw.played.length>240)
    return fail('INVALID_INPUT');
  const input=raw as unknown as Input;
  const phase=input.phase;
  const ids=input.clubIds;
  const discipline=input.disciplinaryPoints===undefined?null:
    exactMap(input.disciplinaryPoints,ids,0,1000);
  const previous=input.previousSeasonPositions===undefined?null:
    exactMap(input.previousSeasonPositions,ids,1,16,true);
  if(input.disciplinaryPoints!==undefined&&!discipline||
     input.previousSeasonPositions!==undefined&&!previous)
    return fail('INVALID_INPUT');
  const byId=new Map(ids.map(id=>[id,empty(id)]));
  const knownFixtures=new Set<string>(),directed=new Set<string>();
  for(const candidate of input.played){
    if(!record(candidate)||Object.keys(candidate).length!==5||
       typeof candidate.fixtureId!=='string'||
       !isStableId(candidate.fixtureId)||
       typeof candidate.homeClubId!=='string'||
       typeof candidate.awayClubId!=='string'||
       candidate.homeClubId===candidate.awayClubId||
       !byId.has(candidate.homeClubId)||!byId.has(candidate.awayClubId)||
       !score(candidate.homeGoals)||!score(candidate.awayGoals))
      return fail('INVALID_INPUT');
    const f=candidate as Played;
    const pair=JSON.stringify([f.homeClubId,f.awayClubId]);
    if(knownFixtures.has(f.fixtureId)||directed.has(pair))
      return fail('DUPLICATE_FIXTURE');
    knownFixtures.add(f.fixtureId);directed.add(pair);
    const home=byId.get(f.homeClubId)!,away=byId.get(f.awayClubId)!;
    home.played++;away.played++;
    home.goalsFor+=f.homeGoals;home.goalsAgainst+=f.awayGoals;
    away.goalsFor+=f.awayGoals;away.goalsAgainst+=f.homeGoals;
    away.awayGoals+=f.awayGoals;
    if(f.homeGoals===f.awayGoals){
      home.draws++;away.draws++;home.points++;away.points++;
    }else if(f.homeGoals>f.awayGoals){
      home.wins++;away.losses++;home.points+=3;
    }else{
      away.wins++;home.losses++;away.points+=3;away.awayWins++;
    }
  }
  if(phase==='final'&&(input.played.length!==240||
      [...byId.values()].some(r=>r.played!==30)))
    return fail('INCOMPLETE_FINAL_CALENDAR');
  for(const row of byId.values())
    row.goalDifference=row.goalsFor-row.goalsAgainst;
  const byPoints=[...byId.values()].sort((a,b)=>b.points-a.points);
  const tiers:M2RplStandingTier[]=[];
  for(let i=0;i<byPoints.length;){
    let end=i+1;
    while(end<byPoints.length&&
          byPoints[end]!.points===byPoints[i]!.points)end++;
    const tied=byPoints.slice(i,end);
    const tiedIds=new Set(tied.map(t=>t.clubId));
    const head=new Map(tied.map(t=>[t.clubId,
      {games:0,points:0,wins:0,diff:0,goals:0}]));
    for(const fixture of input.played){
      if(!tiedIds.has(fixture.homeClubId)||
         !tiedIds.has(fixture.awayClubId))continue;
      const home=head.get(fixture.homeClubId)!;
      const away=head.get(fixture.awayClubId)!;
      home.games++;away.games++;
      home.goals+=fixture.homeGoals;away.goals+=fixture.awayGoals;
      home.diff+=fixture.homeGoals-fixture.awayGoals;
      away.diff+=fixture.awayGoals-fixture.homeGoals;
      if(fixture.homeGoals===fixture.awayGoals){
        home.points++;away.points++;
      }else if(fixture.homeGoals>fixture.awayGoals){
        home.wins++;home.points+=3;
      }else{away.wins++;away.points+=3;}
    }
    // Article 18.3: do not compare head-to-head in a current table when
    // tied clubs have played unequal numbers of mutual fixtures.
    const useHead=phase==='final'||new Set(
      [...head.values()].map(h=>h.games)).size===1;
    const metric=(r:Row):number[]=>{
      const h=head.get(r.clubId)!;
      return [
        ...(useHead?[h.points,h.wins,h.diff,h.goals]:[]),
        r.wins,r.goalDifference,r.goalsFor,r.awayWins,r.awayGoals,
        ...(discipline?[-discipline.get(r.clubId)!]:[]),
        ...(discipline&&phase==='current'&&previous?
          [-previous.get(r.clubId)!]:[]),
      ];
    };
    tied.sort((a,b)=>compare(metric(a),metric(b)));
    for(let j=0;j<tied.length;){
      let k=j+1;
      while(k<tied.length&&
            compare(metric(tied[j]!),metric(tied[k]!))===0)k++;
      const equal=tied.slice(j,k);
      const unresolved:Unresolved|null=equal.length===1?null:
        !discipline?'MISSING_DISCIPLINE':
        phase==='final'?'EXTRA_MATCH_REQUIRED':
        'MISSING_PREVIOUS_SEASON';
      tiers.push({position:i+j+1,clubIds:equal.map(x=>x.clubId).sort(),
        unresolved});
      j=k;
    }
    i=end;
  }
  return {ok:true,schemaVersion:M2_RPL_2026_STANDINGS_VERSION,
    status:'ARTICLE_18_RESEARCH_ONLY_NOT_OFFICIAL',
    phase,resolved:tiers.every(t=>t.unresolved===null),
    rows:[...byId.values()].map(r=>({...r})),tiers};
}
