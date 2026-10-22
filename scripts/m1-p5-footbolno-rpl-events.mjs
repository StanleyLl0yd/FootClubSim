#!/usr/bin/env node
/**
 * Offline RPL 2023/24 cross-check of the publisher-claimed CC BY 4.0
 * Footbolno league-235 matches and all-events CSV. Never downloads or
 * republishes rows, nor treats missing event coverage as zero.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

export const FOOTBOLNO_RPL_SOURCE=Object.freeze({
  publisher:'footbolno.ru',
  documentation:'https://footbolno.ru/otkrytye-dannye',
  manifest:'https://footbolno.ru/data/index.json',
  matches:'https://footbolno.ru/data/league/235-matches.csv',
  events:'https://footbolno.ru/data/bundles/all-events.csv.gz',
  leagueId:'235',
  publisherLicenseClaim:'CC BY 4.0',
  attribution:'Источник данных: footbolno.ru - https://footbolno.ru/otkrytye-dannye',
  rightsBoundary:'PUBLISHER_CC_BY_CLAIM_UPSTREAM_ORIGINS_NOT_AUDITED',
  developmentSeason:'2023/2024',
  reservedHoldout:'2024/2025',
});
const MAX_MATCH_BYTES=2_000_000;
const MAX_EVENT_GZIP_BYTES=20_000_000;
const MAX_EVENT_PLAIN_BYTES=120_000_000;
const MATCH_COLUMNS=['match_id','league_id','league','season','date_utc',
  'date_msk','time_confirmed','round','home_id','home','away_id','away',
  'home_goals','away_goals','home_pens','away_pens','status','venue',
  'venue_ru','city','city_ru','attendance'];
const EVENT_COLUMNS=['match_id','league_id','minute','kind',
  'team_id','player_id','player'];
const EVENT_KINDS=['goal','own','penalty','yellow','red','shootout'];
const EXPECTED_MATCHES=240;
const validInt=value=>typeof value==='string'&&/^(?:0|[1-9]\d*)$/.test(value)&&
  Number.isSafeInteger(+value);
const int=value=>validInt(value)?Number(value):null;

/** Strict RFC4180-style parser: quoted CRLF/newlines and escaped quotes. */
export function parseFootbolnoCsv(source,expectedColumns,maxRows){
  if(typeof source!=='string'||source.length===0||
      source.length>MAX_EVENT_PLAIN_BYTES||
      source.includes('\0')||!Number.isSafeInteger(maxRows)||
      maxRows<1||maxRows>500_000)return null;
  let text=source.charCodeAt(0)===0xfeff?source.slice(1):source;
  const rows=[],row=[];
  let cell='',inQuotes=false,afterQuote=false,start=true;
  function pushCell(){
    if(cell.length>10000)throw Error('OVERSIZED_CSV_CELL');
    row.push(cell);cell='';afterQuote=false;start=true;
    if(row.length>32)throw Error('TOO_MANY_COLUMNS');
  }
  function pushRow(){
    if(row.length===1&&row[0]===''&&rows.length===0)return;
    if(row.length===0||row.every(x=>x===''))return;
    rows.push(row.splice(0));
    if(rows.length>maxRows+1)throw Error('EXCESSIVE_CSV_ROWS');
  }
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(inQuotes){
      if(ch==='"'){
        if(text[i+1]==='"'){cell+='"';i++;}else{
          inQuotes=false;afterQuote=true;
        }
      }else{cell+=ch;}
      if(cell.length>10000)throw Error('OVERSIZED_CSV_CELL');
    }else if(ch===',' ){pushCell();}
    else if(ch==='\n'||ch==='\r'){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      pushCell();pushRow();
    }else if(ch==='"'){
      if(!start)throw Error('INVALID_CSV_QUOTE');
      inQuotes=true;start=false;
    }else{
      if(afterQuote)throw Error('INVALID_CSV_TRAILING_TEXT');
      cell+=ch;start=false;
      if(cell.length>10000)throw Error('OVERSIZED_CSV_CELL');
    }
  }
  if(inQuotes)throw Error('UNTERMINATED_CSV_QUOTE');
  if(!start||afterQuote||row.length){pushCell();pushRow();}
  if(rows.length<1)return null;
  const header=rows.shift();
  if(header.length!==expectedColumns.length||
      expectedColumns.some((k,i)=>header[i]!==k)) {
    throw Error('UNEXPECTED_SOURCE_SCHEMA');
  }
  if(rows.some(row=>row.length!==header.length)) {
    throw Error('IRREGULAR_CSV_ROW');
  }
  return rows.map(parts=>Object.fromEntries(
    header.map((key,index)=>[key,parts[index]])));
}
const sha=data=>createHash('sha256').update(data).digest('hex');
const invalid=(why)=>{throw Error('INVALID_FOOTBOLNO_SOURCE:'+why);};
const seasons=new Set(['2023/2024','2023/24','2023-24','2023-2024']);
export function inspectFootbolnoRplDevelopment(
  matchesCsv,eventsCsv,{requiredMatches=EXPECTED_MATCHES}={},
){
  if(!Number.isSafeInteger(requiredMatches)||requiredMatches<1||
      requiredMatches>EXPECTED_MATCHES)invalid('EXPECTED_COVERAGE');
  const matches=parseFootbolnoCsv(matchesCsv,MATCH_COLUMNS,20_000);
  const events=parseFootbolnoCsv(eventsCsv,EVENT_COLUMNS,500_000);
  if(!matches||!events)invalid('EMPTY_CSV');
  const samples=new Map(),teamGames=new Map();
  const sourceId=value=>typeof value==='string'&&
    /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
  const addTeam=(club,side)=>{
    const row=teamGames.get(club)??{home:0,away:0};
    row[side]++;
    teamGames.set(club,row);
  };
  let candidateSeasonRows=0,ignoredSeasons=0,malformedSeasonLabelRows=0;
  const sourceSeasonLabels=new Set();
  const counts={matches:0,homeWins:0,draws:0,awayWins:0,
    scoreless:0,homeGoals:0,awayGoals:0,allGoals:0};
  for(const m of matches){
    if(m.league_id!==FOOTBOLNO_RPL_SOURCE.leagueId)invalid('WRONG_LEAGUE');
    if(typeof m.season!=='string'||m.season.length>40||
        /[\x00-\x1f]/.test(m.season)){
      malformedSeasonLabelRows++;
      ignoredSeasons++;
      continue; // unknown calendar classification, never count as a zero game
    }
    sourceSeasonLabels.add(m.season);
    if(sourceSeasonLabels.size>64)invalid('EXCESSIVE_SEASON_LABELS');
    if(!seasons.has(m.season)){ignoredSeasons++;continue;}
    candidateSeasonRows++;
    if(m.status!=='finished')continue;
    if(!sourceId(m.match_id)||!sourceId(m.home_id)||
        !sourceId(m.away_id)||
        m.home_id===m.away_id||
        !validInt(m.home_goals)||!validInt(m.away_goals)||
        +m.home_goals>30||+m.away_goals>30||
        samples.has(m.match_id))invalid('BAD_COMPLETED_MATCH');
    const home=int(m.home_goals),away=int(m.away_goals);
    const scores={matchId:m.match_id,homeId:m.home_id,awayId:m.away_id,
      goals:home+away,events:0,kindTotals:Object.fromEntries(
        EVENT_KINDS.map(k=>[k,0]))};
    samples.set(m.match_id,scores);
    addTeam(m.home_id,'home');addTeam(m.away_id,'away');
    counts.matches++;
    counts.homeWins+=Number(home>away);
    counts.draws+=Number(home===away);
    counts.awayWins+=Number(home<away);
    counts.scoreless+=Number(home===0&&away===0);
    counts.homeGoals+=home;counts.awayGoals+=away;
    counts.allGoals+=home+away;
  }
  if(counts.matches!==counts.homeWins+counts.draws+counts.awayWins||
      counts.homeGoals+counts.awayGoals!==counts.allGoals) {
    invalid('INCONSISTENT_SCORES');
  }
  const fullSeasonResultCoverage=counts.matches===EXPECTED_MATCHES&&
    teamGames.size===16&&
    [...teamGames.values()].every(t=>t.home===15&&t.away===15);
  // An incomplete source is research evidence, not a parse error. Fail
  // closed for acceptance, but show exact missingness instead of hiding it.
  const expectedScopeCovered=counts.matches===requiredMatches;
  let foreignEventRows=0,eventsForSeason=0,invalidEventRows=0;
  for(const event of events){
    if(event.league_id!==FOOTBOLNO_RPL_SOURCE.leagueId){
      foreignEventRows++;continue;
    }
    const match=samples.get(event.match_id);
    if(!match)continue; // other RPL seasons may share this event bundle
    if(!EVENT_KINDS.includes(event.kind)||
        !/^(?:[0-9]{1,3})(?:\+[0-9]{1,2})?$/.test(event.minute)||
        Number(event.minute.split('+')[0])>150||
        (event.team_id!==''&&event.team_id!==match.homeId&&
          event.team_id!==match.awayId)){
      invalidEventRows++;
      continue; // record coverage failure, never infer a zero event count
    }
    match.events++;
    match.kindTotals[event.kind]++;
    eventsForSeason++;
  }
  if(invalidEventRows>0)invalid('INVALID_SEASON_EVENT_ROWS');
  const eventCounts=Object.fromEntries(EVENT_KINDS.map(k=>[k,0]));
  let matchesWithAnyEvent=0,matchesWithCards=0,matchesWithTaggedGoals=0;
  for(const row of samples.values()){
    matchesWithAnyEvent+=Number(row.events>0);
    matchesWithCards+=Number(row.kindTotals.yellow+row.kindTotals.red>0);
    matchesWithTaggedGoals+=Number(
      row.kindTotals.goal+row.kindTotals.own+row.kindTotals.penalty>0);
    for(const kind of EVENT_KINDS)eventCounts[kind]+=row.kindTotals[kind];
  }
  const matchedEventCoverage=counts.matches>0&&
    matchesWithAnyEvent===counts.matches;
  const scopeComplete=expectedScopeCovered&&
    (requiredMatches!==EXPECTED_MATCHES||fullSeasonResultCoverage);
  return {
    schemaVersion:1,
    status:scopeComplete?
      'CC_BY_PUBLISHER_CLAIMED_RPL_DEVELOPMENT_OBSERVATION_NOT_CALIBRATED':
      'INCOMPLETE_RPL_DEVELOPMENT_SAMPLE_NOT_CALIBRATED',
    source:FOOTBOLNO_RPL_SOURCE,
    sample:{requiredMatches,finishedMatches:counts.matches,
      sourceSeasonRows:candidateSeasonRows,otherSeasonMatchRows:ignoredSeasons,
      sourceSeasonLabels:[...sourceSeasonLabels].sort(),
      malformedSeasonLabelRows,
      distinctSeasonClubs:teamGames.size,
      missingExpectedFinishedMatches:Math.max(0,requiredMatches-counts.matches),
      processedEventRows:events.length,otherLeagueEventRows:foreignEventRows,
      matchedSeasonEventRows:eventsForSeason,
      matchesWithAnyEvent,matchesWithoutEventRows:
        counts.matches-matchesWithAnyEvent,
      matchesWithCardEvent:matchesWithCards,
      matchesWithGoalTaggedEvent:matchesWithTaggedGoals},
    fullSeasonResultCoverage,expectedScopeCovered,
    eligibleForAnyCalibration: false,
    completeMatchEventCoverageClaim:false,
    observedResultCounts:counts,
    observedEventKindCounts:eventCounts,
    perFinishedMatch:{
      goals:counts.matches?counts.allGoals/counts.matches:null,
      homeWinRate:counts.matches?counts.homeWins/counts.matches:null,
      drawRate:counts.matches?counts.draws/counts.matches:null,
      awayWinRate:counts.matches?counts.awayWins/counts.matches:null,
      yellow:matchedEventCoverage?eventCounts.yellow/counts.matches:null,
      red:matchedEventCoverage?eventCounts.red/counts.matches:null,
    },
    eventMetricsComparableToSynthetic:
      'UNKNOWN_UNTIL_PROVEN_FULL_EVENT_COVERAGE_AND_DEFINITION_ALIGNMENT',
    unsupported:{shots:null,xg:null,clinicalInjuries:null,
      medicalClearance:null,originalUpstreamEventRights:null},
    reservedHoldoutUsed:false,externalModelAcceptance:null,
    licenceProvenanceAuditComplete:false,
  };
}
export function inspectFootbolnoLocalBytes(matchBytes,eventGzipBytes,
  options={}) {
  if(!(matchBytes instanceof Uint8Array)||
      !(eventGzipBytes instanceof Uint8Array)||
      matchBytes.length<20||matchBytes.length>MAX_MATCH_BYTES||
      eventGzipBytes.length<20||
      eventGzipBytes.length>MAX_EVENT_GZIP_BYTES)invalid('BYTE_BOUNDARY');
  let unpacked;
  try{
    unpacked=gunzipSync(eventGzipBytes,{
      maxOutputLength:MAX_EVENT_PLAIN_BYTES,
    });
  }catch{invalid('EVENT_GZIP_CORRUPT_OR_OVERSIZE');}
  const decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
  const result=inspectFootbolnoRplDevelopment(
    decode(matchBytes),decode(unpacked),options);
  return {...result,snapshot:{
    matchCsvSha256:sha(matchBytes),eventGzipSha256:sha(eventGzipBytes),
    matchesBytes:matchBytes.length,eventsGzipBytes:eventGzipBytes.length,
    eventPlainBytes:unpacked.length,
    classification:'CALLER_LOCAL_RAW_BYTES_NOT_SELF_AUTHENTICATING',
  }};
}
// Only two fixed local basenames, never user-supplied filesystem paths.
function main(){
  const check=(filename,max)=>{
    const stat=statSync(filename);
    if(!stat.isFile()||stat.size<20||stat.size>max)
      throw Error('SOURCE_FILE_SIZE');
    return readFileSync(filename);
  };
  const output=inspectFootbolnoLocalBytes(
    check('matches.csv',MAX_MATCH_BYTES),
    check('events.csv.gz',MAX_EVENT_GZIP_BYTES));
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{main();}catch(e){
    process.stderr.write('P5_FOOTBOLNO_FAIL:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
