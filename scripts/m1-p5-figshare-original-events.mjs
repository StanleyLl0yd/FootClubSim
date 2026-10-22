#!/usr/bin/env node
/**
 * Offline examination of ORIGINAL Pappalardo/Massucco Figshare event exports,
 * not a repacked GitHub transformation. No source events are committed,
 * serialized or imported into playable M1.
 */
import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {isPlainJsonTree} from '../dist/core/plain-json-tree.js';
import {m1Wilson95} from '../dist/core/m1-diagnostics.js';

export const FIGSHARE_ORIGINAL_EVENTS = Object.freeze({
  doi:'10.6084/m9.figshare.7770599.v1',
  url:'https://figshare.com/articles/dataset/Events/7770599',
  publisherLicense:'CC BY 4.0',
  authorAttribution:'Luca Pappalardo and Emanuele Massucco (2019)',
  sourceSeason:'2017/18',
  sourceCompetitions:['England','France','Germany','Italy','Spain'],
  relationToRpl:'CROSS_LEAGUE_HISTORICAL_MECHANICS_ONLY',
});
const MAX_FILE_BYTES=350_000_000;
const MAX_EVENTS=1_000_000;
const MAX_MATCHES=500;
const TAG={GOAL:101,RED:1701,YELLOW:1702,SECOND_YELLOW:1703};
const NAME=new Set(['England','France','Germany','Italy','Spain']);
const rec=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>0;

export function inspectOriginalFigshareEvents(candidate,{competition,
  expectedMatches}={}) {
  if (!NAME.has(competition) ||
      !Number.isSafeInteger(expectedMatches) ||
      expectedMatches<1||expectedMatches>MAX_MATCHES ||
      !isPlainJsonTree(candidate)||!Array.isArray(candidate) ||
      candidate.length<expectedMatches||candidate.length>MAX_EVENTS) {
    throw Error('INVALID_ORIGINAL_COHORT');
  }
  const eventsSeen=new Set(),matches=new Map();
  for(const item of candidate){
    if(!rec(item)||!integer(item.id)||!integer(item.matchId)||
        !integer(item.teamId)||!Number.isSafeInteger(item.playerId)||
        item.playerId<0||
        !Number.isSafeInteger(item.eventId)||item.eventId<0||
        typeof item.eventName!=='string'||
        typeof item.subEventName!=='string'||
        !['1H','2H'].includes(item.matchPeriod)||
        typeof item.eventSec!=='number'||
        !Number.isFinite(item.eventSec)||
        item.eventSec<0||item.eventSec>5400||
        !Array.isArray(item.tags)||item.tags.length>24||
        item.tags.some(t=>!rec(t)||Object.keys(t).length!==1||
          !Number.isSafeInteger(t.id)||t.id<0||t.id>9999)||
        eventsSeen.has(item.id)){
      throw Error('INVALID_ORIGINAL_EVENT');
    }
    eventsSeen.add(item.id);
    const tags=new Set(item.tags.map(t=>t.id));
    if(tags.size!==item.tags.length)throw Error('DUPLICATE_EVENT_TAG');
    let m=matches.get(item.matchId);
    if(!m){
      m={eventCount:0,ordinaryShots:0,penaltyAttempts:0,
        directFreeKickShots:0,cardYellowTags:0,
        cardDirectRedTags:0,cardSecondYellowTags:0,
        goalTaggedAttackingActions:0,goalTaggedGoalkeeperMirrors:0};
      matches.set(item.matchId,m);
      if(matches.size>MAX_MATCHES)throw Error('UNBOUNDED_MATCHES');
    }
    m.eventCount++;
    const ordinary=item.eventName==='Shot';
    const penalty=item.eventName==='Free Kick'&&
      item.subEventName==='Penalty';
    const directFree=item.eventName==='Free Kick'&&
      item.subEventName==='Free kick shot';
    m.ordinaryShots+=Number(ordinary);
    m.penaltyAttempts+=Number(penalty);
    m.directFreeKickShots+=Number(directFree);
    m.cardYellowTags+=Number(tags.has(TAG.YELLOW));
    m.cardDirectRedTags+=Number(tags.has(TAG.RED));
    m.cardSecondYellowTags+=Number(tags.has(TAG.SECOND_YELLOW));
    m.goalTaggedAttackingActions+=Number(tags.has(TAG.GOAL)&&
      (ordinary||penalty||directFree));
    m.goalTaggedGoalkeeperMirrors+=Number(tags.has(TAG.GOAL)&&
      item.eventName==='Save attempt');
  }
  if(matches.size!==expectedMatches){
    throw Error('INCOMPLETE_MATCH_COVERAGE');
  }
  const names=['eventCount','ordinaryShots','penaltyAttempts',
    'directFreeKickShots','cardYellowTags','cardDirectRedTags',
    'cardSecondYellowTags','goalTaggedAttackingActions',
    'goalTaggedGoalkeeperMirrors'];
  const totals=Object.fromEntries(names.map(k=>[k,0]));
  const squares=Object.fromEntries(names.map(k=>[k,0]));
  const touched=new Set();
  for(const match of matches.values()){
    for(const key of names){
      if(!Number.isSafeInteger(match[key])||match[key]<0){
        throw Error('INVALID_MATCH_AGGREGATE');
      }
      totals[key]+=match[key];
      squares[key]+=match[key]*match[key];
    }
    touched.add(match.eventCount>0);
  }
  if(totals.eventCount!==candidate.length||!touched.has(true)||
      totals.goalTaggedAttackingActions>
      totals.ordinaryShots+totals.penaltyAttempts+
      totals.directFreeKickShots){
    throw Error('INVALID_COHORT_AGGREGATE');
  }
  const means=Object.fromEntries(names.map(key=>{
    const count=matches.size,sum=totals[key],mean=sum/count;
    const variance=count>1?Math.max(0,
      (squares[key]-sum*sum/count)/(count-1)):null;
    const sampleStdDev=variance===null?null:Math.sqrt(variance);
    const margin=sampleStdDev===null?null:
      1.959963984540054*sampleStdDev/Math.sqrt(count);
    return [key,{count,total:sum,mean,sampleStdDev,
      normalMean95:margin===null?null:{
        lower:mean-margin,upper:mean+margin,
      }}];
  }));
  const binaryMatchesWithYellow=[...matches.values()]
    .filter(m=>m.cardYellowTags>0).length;
  return {
    schemaVersion:1,
    status:'ORIGINAL_FIGSHARE_CROSS_LEAGUE_MECHANICS_NOT_RPL_CALIBRATION',
    publisher:FIGSHARE_ORIGINAL_EVENTS,
    competition,season:FIGSHARE_ORIGINAL_EVENTS.sourceSeason,
    sample:{matches:matches.size,events:candidate.length},
    observedPerMatch:means,
    matchesWithYellowTag:{
      count:binaryMatchesWithYellow,denominator:matches.size,
      rate:binaryMatchesWithYellow/matches.size,
      wilson95:m1Wilson95(binaryMatchesWithYellow,matches.size),
    },
    metricsUnavailable:{
      rplCurrentRates:null,shotOnTarget:null,
      independentXg:null,clinicalInjuries:null,
      liveOfficialRefereeDecisions:null,
    },
    sourceEventCoverage:{
      ordinaryShots:'SOURCE_EVENT_NAME_SHOT_NOT_ASSERTED_EQUIVALENT_TO_RPL_OPEN_PLAY',
      penalties:'SOURCE_FREE_KICK_PENALTY_EVENTS',
      directFreeKicks:'SOURCE_FREE_KICK_SHOT_EVENTS',
      cards:'SOURCE_TAGS_NOT_VERIFIED_LEAGUE_SANCTIONS',
      goals:'ATTACKING_ACTION_GOAL_TAGS_NOT_OFFICIAL_FULL_SCORE',
      goalkeeperMirrors:'COUNT_SEPARATELY_NEVER_DOUBLE_COUNT_GOALS',
    },
    rplRealismCalibrated:false,
    externalBenchmarkAccepted:false,
    gameInputsChanged:false,
  };
}
export function inspectOriginalFigshareBytes(bytes,options){
  if(!(bytes instanceof Uint8Array)||bytes.length<10||
      bytes.length>MAX_FILE_BYTES)throw Error('INVALID_FILE_SIZE');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  return {...inspectOriginalFigshareEvents(json,options),
    sourceBytes:{sha256,byteCount:bytes.length,
      classification:'CALLER_LOCAL_ORIGINAL_EXPORT_NOT_SELF_AUTHENTICATING'}};
}
async function main(args){
  if(args.length!==3||
      !args.some(a=>a.startsWith('--file='))||
      !args.some(a=>a.startsWith('--competition='))||
      !args.some(a=>a.startsWith('--expected-matches='))||
      new Set(args.map(a=>a.split('=')[0])).size!==3) {
    throw Error('Usage: --file=LOCAL_ORIGINAL_JSON --competition=England --expected-matches=380');
  }
  const get=k=>args.find(a=>a.startsWith('--'+k+'='))
    .slice(k.length+3);
  const file=get('file');
  const expectedText=get('expected-matches');
  if(!file||!/^[1-9][0-9]*$/.test(expectedText)){
    throw Error('INVALID_ARGUMENTS');
  }
  const handle=await open(file,'r');
  let bytes;
  try{
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size<10||stat.size>MAX_FILE_BYTES)
      throw Error('INVALID_FILE_SIZE');
    bytes=await handle.readFile();
  }finally{await handle.close();}
  process.stdout.write(JSON.stringify(inspectOriginalFigshareBytes(bytes,{
    competition:get('competition'),expectedMatches:Number(expectedText),
  }),null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main(process.argv.slice(2)).catch(e=>{
    process.stderr.write('M1_P5_FIGSHARE_RESEARCH_ERROR:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  });
}
