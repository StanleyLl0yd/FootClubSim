import {sameCanonicalValue} from './canonical-value.js';
import {generateDoubleRoundRobin,type Fixture} from './fixtures.js';
import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from './match-contracts.js';
import {M1_ENGINE_VERSION,type M1PrematchInput} from './m1-clock.js';
import {regenerateM1V184CausalSource}
  from './m1-v182-unified-source.js';
import {projectM1V179MatchClock,type M1V179ClockResult}
  from './m1-v179-source-clock.js';
import {verifyM1V158CommandShape}
  from './m1-v158-generated-goal-stops.js';
import {startM1V120Journal} from './m1-v120-playable-journal.js';
import {selectM1V96EligibleRegisteredLineup}
  from './m1-v96-cap-safe-lineup.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {RNG_VERSION} from './rng.js';
import {defaultTacticalPlan} from './tactics.js';
import type {InitialCareerSave} from './save.js';
import type {MatchRosterRules} from './model.js';
import type {M1V105Run} from './m1-v105-special-goal-chronology.js';

export const M1_V188_LEAGUE_SCHEMA=188 as const;
const RULES:MatchRosterRules={
  starterCount:11,maxBench:12,maxForeignersOnField:7};
const POLICY={
  home:{assignedActor:{kind:'player'},availableStaffIds:[]},
  away:{assignedActor:{kind:'player'},availableStaffIds:[]}};
const LIMIT=240,MAX_BYTES=100_000_000,MAX_REQUEST=400_000;
type Good=Extract<M1V105Run,{ok:true}>;
type PhysicalClock=Extract<M1V179ClockResult,{ok:true}>;
type Incident=Extract<
  ReturnType<typeof regenerateM1V184CausalSource>,
  {ok:true}>['generatedIncidents'][number];
type Hold={clubId:string;playerId:string;sourceIndex:number;
  missedGames:number|null};
type Source={prematch:Record<string,unknown>;policy:unknown;
  plannedCommands:unknown[];checkpointMedical:unknown[];
  disciplinePolicyVersion?:2};
export type M1V188Entry={fixtureId:string;round:number;
  commandId:string;source:Source;result:Good};
export type M1V188Journal={schemaVersion:188;careerId:string;
  selectedClubId:string;basePackId:string;basePackVersion:string;
  revision:number;entries:M1V188Entry[]};
export type M1V188Request={schemaVersion:188;careerId:string;
  expectedRevision:number;commandId:string;prematch:unknown;
  policy:unknown;plannedCommands:unknown[];
  checkpointMedical:unknown[];result:unknown};
export type M1V188Error='INVALID_INITIAL'|'INVALID_JOURNAL'|
  'INVALID_REQUEST'|'WRONG_CAREER'|'STALE_REVISION'|
  'WRONG_FIXTURE'|'UNTRUSTED_CATALOG'|'SOURCE_MISMATCH'|
  'NO_LEGAL_LINEUP'|'GENERATOR_REJECTED'|'SEASON_COMPLETE'|
  'UNAUTHORIZED_MANAGER'|'JOURNAL_SIZE_LIMIT';
export type M1V188Gate=
  | Readonly<{ok:false;error:M1V188Error}>
  | Readonly<{ok:true;schemaVersion:188;status:
    'FULL_TWO_TEAM_FICTIONAL_SOURCE_NOT_LEAGUE_ACCEPTED';
    journal:M1V188Journal;scheduledFixtures:240;
    remainingFixtures:number;completeHistory:boolean;
    sourceReplayVerified:true;bothTeamsEligibilityApplied:true;
    externalKdkAuthenticated:false;clinicalAuthorityAuthenticated:false;
    rescheduledFixturesSupported:false}>;
export type M1V188Proposal=
  | Readonly<{ok:false;error:M1V188Error}>
  | Readonly<{ok:true;fixture:Fixture;request:M1V188Request;
    clock:PhysicalClock;remainingFixtures:number;
    selectedClubFixture:boolean}>;

const rec=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>
  Object.keys(v).length===keys.length&&
  keys.every(k=>Object.hasOwn(v,k));
const rootKeys=['schemaVersion','careerId','selectedClubId',
  'basePackId','basePackVersion','revision','entries'];
const entryKeys=['fixtureId','round','commandId','source','result'];
const sourceKeys=['prematch','policy','plannedCommands','checkpointMedical'];
const sourceKeysV2=[...sourceKeys,'disciplinePolicyVersion'];
const requestKeys=['schemaVersion','careerId','expectedRevision',
  'commandId','prematch','policy','plannedCommands',
  'checkpointMedical','result'];
const fail=(error:M1V188Error):Extract<M1V188Gate,{ok:false}>=>
  ({ok:false,error});
function copy(value:unknown,cap:number):unknown|null{
  if(!isPlainJsonTree(value))return null;
  try{
    const s=JSON.stringify(value);
    if(s.length>cap)return null;
    const parsed:unknown=JSON.parse(s);
    return sameCanonicalValue(value,parsed)?parsed:null;
  }catch{return null;}
}
function validInitial(value:unknown):value is InitialCareerSave{
  return startM1V120Journal(value).ok&&
    (value as InitialCareerSave).catalog.clubs.length===16;
}
function calendar(i:InitialCareerSave):Fixture[]{
  return generateDoubleRoundRobin(i.catalog.clubs.map(c=>c.id))
    .flatMap(round=>round.fixtures);
}
function belongs(f:Fixture,team:string){
  return f.homeClubId===team||f.awayClubId===team;
}
function missed(fixtureId:string,incidentId:string,playerId:string){
  let hash=0x6a09e667;
  for(const c of [fixtureId,incidentId,playerId].join('/'))
    hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  return 1+hash%4;
}
function addHolds(holds:Hold[],incidents:readonly Incident[],
  f:Fixture,index:number,versioned=false){
  const cautions=new Map<string,{clubId:string;playerId:string;count:number}>();
  const reds=new Set<string>();
  for(const inc of incidents){
    const key=JSON.stringify([inc.teamId,inc.playerId]);
    if(inc.sanction==='caution'){
      const previous=cautions.get(key);
      cautions.set(key,{clubId:inc.teamId,playerId:inc.playerId,
        count:(previous?.count??0)+1});
      continue;
    }
    // Only the internally modelled league durations are applied here.
    // Official KDK orders, cancellations and appeals are not inferred.
    if(inc.sanction==='direct-red'){
      reds.add(key);
      holds.push({clubId:inc.teamId,playerId:inc.playerId,
        sourceIndex:index,missedGames:3});
    }else if(inc.sanction==='injury-withdrawal'){
      holds.push({clubId:inc.teamId,playerId:inc.playerId,
        sourceIndex:index,missedGames:missed(f.id,inc.decisionId,
          inc.playerId)});
    }
  }
  for(const [key,warning] of cautions){
    if(warning.count===2){
      holds.push({clubId:warning.clubId,playerId:warning.playerId,
        sourceIndex:index,missedGames:1});
      continue;
    }
    if(warning.count!==1||reds.has(key))continue;
    // Zero-duration entries are replay-derived history, never bans.
    // They also recover the earlier simple-card count from legacy v188
    // careers without retroactively changing their legal lineups.
    const previous=holds.filter(h=>h.clubId===warning.clubId&&
      h.playerId===warning.playerId&&h.missedGames===0).length;
    holds.push({clubId:warning.clubId,playerId:warning.playerId,
      sourceIndex:index,missedGames:0});
    if(versioned&&(previous+1)%4===0){
      holds.push({clubId:warning.clubId,playerId:warning.playerId,
        sourceIndex:index,missedGames:1});
    }
  }
}
function excluded(team:string,index:number,holds:Hold[],
  schedule:readonly Fixture[]){
  const excluded=new Set<string>();
  for(const h of holds){
    if(h.clubId!==team)continue;
    const passed=schedule.slice(h.sourceIndex+1,index)
      .filter(f=>belongs(f,team)).length;
    if(h.missedGames===null||passed<h.missedGames)
      excluded.add(h.playerId);
  }
  return excluded;
}
function canonicalPrematch(i:InitialCareerSave,f:Fixture,
  index:number,holds:Hold[],schedule:readonly Fixture[]):
  M1PrematchInput|null{
  const teams=new Map(i.catalog.clubs.map(c=>[c.id,c]));
  const players=new Map(i.catalog.players.map(p=>[p.id,p]));
  const home=teams.get(f.homeClubId),away=teams.get(f.awayClubId);
  if(!home||!away)return null;
  const homeLineup=selectM1V96EligibleRegisteredLineup(
    home,players,excluded(home.id,index,holds,schedule),RULES);
  const awayLineup=selectM1V96EligibleRegisteredLineup(
    away,players,excluded(away.id,index,holds,schedule),RULES);
  if(!homeLineup||!awayLineup)return null;
  return{schemaVersion:MATCH_LEDGER_VERSION,
    engineVersion:M1_ENGINE_VERSION,rulesPackId:M0_RULES_PACK_ID,
    rulesPackVersion:M0_RULES_PACK_VERSION,fixture:f,
    catalog:i.catalog,homeLineup,awayLineup,
    homeTactics:defaultTacticalPlan(home.id),
    awayTactics:defaultTacticalPlan(away.id),rosterRules:RULES,
    rngAlgorithmVersion:RNG_VERSION,
    rngSeed:deriveM1FixtureSeed(i.rngState,f.id)};
}

/** User choices are not trusted match commands. Bind each choice to
 * the selected club, fixture, source version and manager actor first.
 */
function managerCommands(raw:unknown,f:Fixture,selected:string){
  if(!isPlainJsonTree(raw)||!Array.isArray(raw)||
      raw.length>5||(raw.length>0&&!belongs(f,selected)))return null;
  const out=new Set<string>(),incoming=new Set<string>();
  const commands:Record<string,unknown>[]=[];
  let prior=-1;
  for(let index=0;index<raw.length;index++){
    const choice=raw[index];
    if(!rec(choice)||!exact(choice,['outPlayerId','inPlayerId',
          'elapsedSeconds'])||
        typeof choice.outPlayerId!=='string'||!choice.outPlayerId||
        typeof choice.inPlayerId!=='string'||!choice.inPlayerId||
        choice.outPlayerId===choice.inPlayerId||
        out.has(choice.outPlayerId)||
        incoming.has(choice.inPlayerId)||
        !Number.isSafeInteger(choice.elapsedSeconds)||
        (choice.elapsedSeconds as number)<300||
        (choice.elapsedSeconds as number)>5100||
        (choice.elapsedSeconds as number)%300!==0||
        (choice.elapsedSeconds as number)<prior)return null;
    const sec=choice.elapsedSeconds as number;
    out.add(choice.outPlayerId);
    incoming.add(choice.inPlayerId);
    prior=sec;
    commands.push({schemaVersion:1,
      commandId:'v184-sub-'+f.id+'-'+index,
      fixtureId:f.id,teamId:selected,
      elapsedSeconds:sec,kind:'substitute-normal',
      actor:{kind:'player'},
      stoppage:sec===2700?'half-time':'referee-authorized',
      outPlayerId:choice.outPlayerId,inPlayerId:choice.inPlayerId});
  }
  return commands;
}
/** v158 performs strict canonical team/actor/command shape validation.
 * The v184 namespace is independently asserted before normalization.
 */
function validManagerCommands(input:M1PrematchInput,
  policy:unknown,manager:unknown,selected:string,seed:number):boolean{
  if(!Array.isArray(manager))return false;
  if(manager.some((c,index)=>!rec(c)||
      c.commandId!=='v184-sub-'+input.fixture.id+'-'+index))
    return false;
  const shaped=manager.map((c,index)=>({
    ...(c as Record<string,unknown>),
    commandId:'v158-sub-'+input.fixture.id+'-'+index,
  }));
  return verifyM1V158CommandShape(input,policy,shaped,
    input.fixture.id,selected,seed);
}

/** Derive authoritative fictional match time from the EXACT physically
 * replayed v105 events. No separate score, roster, referee or wall clock.
 * Unsupported goalkeeper-less shots and unsourced manager stops fail closed.
 * This view is transient; legacy and v188 persisted bytes stay unchanged.
 */
function replayedPhysicalClock(input:M1PrematchInput,result:Good,
  manager:readonly unknown[]):PhysicalClock|null{
  const clock=projectM1V179MatchClock(input,result);
  if(!clock.ok||clock.snapshots.length!==result.events.length)return null;
  const positions=new Map(input.catalog.players.map(p=>
    [p.id,p.primaryPosition]));
  const home=input.fixture.homeClubId,away=input.fixture.awayClubId;
  for(let n=0;n<result.events.length;n++){
    const e=result.events[n]!;
    let attacker:string;
    if(e.type==='adjudication')attacker=e.decision.teamId;
    else if(e.source.type==='shot')attacker=e.source.teamId;
    else continue;
    if(attacker!==home&&attacker!==away)return null;
    const defenders=attacker===home?
      clock.snapshots[n]!.awayPresent:
      clock.snapshots[n]!.homePresent;
    if(defenders.filter(id=>positions.get(id)==='GK').length!==1)
      return null;
  }
  for(const raw of manager){
    if(!rec(raw)||raw.kind!=='substitute-normal'||
        !Number.isSafeInteger(raw.elapsedSeconds)||
        !clock.managerStopsFromSource.includes(
          raw.elapsedSeconds as number))return null;
  }
  return clock;
}

function verifyEntry(i:InitialCareerSave,e:M1V188Entry,
  f:Fixture,index:number,holds:Hold[],schedule:readonly Fixture[],
  allowLegacy=true){
  if(!rec(e)||!exact(e,entryKeys)||
      e.fixtureId!==f.id||e.round!==f.round||
      e.commandId!=='v188-league-'+f.id||
      !rec(e.source)||
      !(exact(e.source,sourceKeys)||
        (exact(e.source,sourceKeysV2)&&
          e.source.disciplinePolicyVersion===2))||
      !rec(e.source.prematch)||
      Object.hasOwn(e.source.prematch,'catalog')||
      !Array.isArray(e.source.plannedCommands)||
      !Array.isArray(e.source.checkpointMedical)||
      !rec(e.result))return false;
  const input=canonicalPrematch(i,f,index,holds,schedule);
  if(!input)return false;
  const {catalog:_catalog,...canonical}=input;
  void _catalog;
  if(!sameCanonicalValue(e.source.prematch,canonical)||
      !sameCanonicalValue(e.source.policy,POLICY))return false;
  const manager=e.source.plannedCommands.filter(c=>
    rec(c)&&c.kind==='substitute-normal');
  if(manager.length&&!belongs(f,i.selectedClubId))return false;
  if(!validManagerCommands(input,POLICY,manager,
      i.selectedClubId,i.rngState))return false;
  // Immutable old v188 entries have no shot-source discriminator.
  // Prefer the final dense model, then prove exact legacy source replay.
  const sourceAttempt=(dense:boolean)=>{
    const replay=regenerateM1V184CausalSource(
      input,POLICY,manager,dense);
    return replay.ok&&
      sameCanonicalValue(replay.plannedCommands,
        e.source.plannedCommands)&&
      sameCanonicalValue(replay.checkpointMedical,
        e.source.checkpointMedical)&&
      sameCanonicalValue(replay.result,e.result)&&
      replayedPhysicalClock(input,replay.result,manager)?replay:null;
  };
  // Version 2 is minted only from the dense physical source. Never
  // validate a v2 entry by laundering an older v8 chronology through
  // the historical read-only fallback.
  const replay=sourceAttempt(true)??
    (allowLegacy&&e.source.disciplinePolicyVersion!==2?
      sourceAttempt(false):null);
  if(!replay)return false;
  addHolds(holds,replay.generatedIncidents,f,index,
    e.source.disciplinePolicyVersion===2);
  return true;
}
/** One process only. Match exact serialized input AND immutable M0 initial.
 * The first encounter always performs full source replay; identical bytes
 * already verified in this process reuse only their derived hold state.
 * No checksum or client-supplied attestation can mint authority.
 */
type VerifiedPrefix=Readonly<{initialBytes:string;journalBytes:string;
  holds:readonly Hold[]}>;
const VERIFIED_PREFIX_CACHE_LIMIT=2;
const verifiedPrefixes=new Map<string,VerifiedPrefix>();
function rememberVerified(i:InitialCareerSave,j:M1V188Journal,
  holds:readonly Hold[]):void{
  const initialBytes=JSON.stringify(i);
  const journalBytes=JSON.stringify(j);
  if(initialBytes.length>10_000_000||
      journalBytes.length>MAX_BYTES)return;
  verifiedPrefixes.delete(i.careerId);
  verifiedPrefixes.set(i.careerId,{
    initialBytes,journalBytes,holds:holds.map(h=>({...h})),
  });
  if(verifiedPrefixes.size>VERIFIED_PREFIX_CACHE_LIMIT){
    const oldest=verifiedPrefixes.keys().next().value;
    if(oldest!==undefined)verifiedPrefixes.delete(oldest);
  }
}

function read(i:InitialCareerSave,value:unknown){
  const raw=copy(value,MAX_BYTES);
  if(!rec(raw)||!exact(raw,rootKeys)||
      raw.schemaVersion!==188||raw.careerId!==i.careerId||
      raw.selectedClubId!==i.selectedClubId||
      raw.basePackId!==i.basePackId||
      raw.basePackVersion!==i.basePackVersion||
      !Number.isSafeInteger(raw.revision)||
      (raw.revision as number)<0||(raw.revision as number)>LIMIT||
      !Array.isArray(raw.entries)||
      raw.entries.length!==raw.revision)return null;
  const journal=raw as unknown as M1V188Journal;
  const cached=verifiedPrefixes.get(i.careerId);
  if(cached&&cached.initialBytes===JSON.stringify(i)&&
      cached.journalBytes===JSON.stringify(journal))
    return{journal,holds:cached.holds.map(h=>({...h})),
      schedule:calendar(i)};
  const schedule=calendar(i),holds:Hold[]=[];
  if(schedule.length!==LIMIT)return null;
  let versionedSeen=false;
  for(let n=0;n<journal.entries.length;n++){
    const entry=journal.entries[n]!;
    const versioned=entry.source?.disciplinePolicyVersion===2;
    if(versionedSeen&&!versioned)return null;
    if(copy(entry,MAX_REQUEST)===null||
        !verifyEntry(i,entry,schedule[n]!,n,holds,schedule))
      return null;
    if(versioned)versionedSeen=true;
  }
  rememberVerified(i,journal,holds);
  return{journal,holds,schedule};
}
function good(journal:M1V188Journal):M1V188Gate{
  return{ok:true,schemaVersion:188,
    status:'FULL_TWO_TEAM_FICTIONAL_SOURCE_NOT_LEAGUE_ACCEPTED',
    journal,scheduledFixtures:240,
    remainingFixtures:240-journal.revision,
    completeHistory:journal.revision===240,
    sourceReplayVerified:true,bothTeamsEligibilityApplied:true,
    externalKdkAuthenticated:false,
    clinicalAuthorityAuthenticated:false,
    rescheduledFixturesSupported:false};
}
export function startM1V188LeagueJournal(initial:unknown):M1V188Gate{
  if(!validInitial(initial))return fail('INVALID_INITIAL');
  return good({schemaVersion:188,careerId:initial.careerId,
    selectedClubId:initial.selectedClubId,
    basePackId:initial.basePackId,
    basePackVersion:initial.basePackVersion,revision:0,entries:[]});
}
export function validateM1V188LeagueJournal(
  initial:unknown,value:unknown):M1V188Gate{
  if(!validInitial(initial))return fail('INVALID_INITIAL');
  const accepted=read(initial,value);
  return accepted?good(accepted.journal):fail('INVALID_JOURNAL');
}
export function prepareM1V188LeagueMatch(
  initial:unknown,value:unknown,manager:unknown=[],
):M1V188Proposal|null{
  if(!validInitial(initial))return {ok:false,error:'INVALID_INITIAL'};
  const accepted=read(initial,value);
  if(!accepted)return {ok:false,error:'INVALID_JOURNAL'};
  const index=accepted.journal.revision,f=accepted.schedule[index];
  if(!f)return null;
  const managerCommandsForFixture=managerCommands(manager,f,
    initial.selectedClubId);
  if(managerCommandsForFixture===null)
    return {ok:false,error:'UNAUTHORIZED_MANAGER'};
  const prematch=canonicalPrematch(initial,f,index,
    accepted.holds,accepted.schedule);
  if(!prematch)return {ok:false,error:'NO_LEGAL_LINEUP'};
  if(!validManagerCommands(prematch,POLICY,
      managerCommandsForFixture,initial.selectedClubId,
      initial.rngState))
    return {ok:false,error:'UNAUTHORIZED_MANAGER'};
  const generated=regenerateM1V184CausalSource(
    prematch,POLICY,managerCommandsForFixture,true);
  if(!generated.ok)return {ok:false,error:'GENERATOR_REJECTED'};
  const clock=replayedPhysicalClock(
    prematch,generated.result,managerCommandsForFixture);
  if(!clock)return {ok:false,error:'GENERATOR_REJECTED'};
  return{ok:true,fixture:f,clock,request:{schemaVersion:188,
    careerId:initial.careerId,expectedRevision:index,
    commandId:'v188-league-'+f.id,prematch,policy:POLICY,
    plannedCommands:generated.plannedCommands,
    checkpointMedical:generated.checkpointMedical,
    result:generated.result},
    remainingFixtures:LIMIT-index-1,
    selectedClubFixture:belongs(f,initial.selectedClubId)};
}
export function applyM1V188LeagueMatch(
  initial:unknown,value:unknown,request:unknown,
):M1V188Gate{
  if(!validInitial(initial))return fail('INVALID_INITIAL');
  const accepted=read(initial,value);
  if(!accepted)return fail('INVALID_JOURNAL');
  const raw=copy(request,MAX_REQUEST);
  if(!rec(raw)||!exact(raw,requestKeys)||
      raw.schemaVersion!==188||
      !Number.isSafeInteger(raw.expectedRevision)||
      typeof raw.commandId!=='string'||!rec(raw.prematch)||
      !rec(raw.policy)||!rec(raw.result)||
      !Array.isArray(raw.plannedCommands)||
      !Array.isArray(raw.checkpointMedical))
    return fail('INVALID_REQUEST');
  if(raw.careerId!==initial.careerId)return fail('WRONG_CAREER');
  if(raw.expectedRevision!==accepted.journal.revision)
    return fail('STALE_REVISION');
  const n=accepted.journal.revision,f=accepted.schedule[n];
  if(!f)return fail('SEASON_COMPLETE');
  if(raw.commandId!=='v188-league-'+f.id||
      !sameCanonicalValue(raw.prematch.fixture,f))
    return fail('WRONG_FIXTURE');
  if(!sameCanonicalValue(raw.prematch.catalog,initial.catalog))
    return fail('UNTRUSTED_CATALOG');
  const {catalog:_catalog,...prematch}=raw.prematch;
  void _catalog;
  const entry:M1V188Entry={fixtureId:f.id,round:f.round,
    commandId:raw.commandId,source:{prematch,policy:raw.policy,
      plannedCommands:raw.plannedCommands,
      checkpointMedical:raw.checkpointMedical,
      disciplinePolicyVersion:2},
    result:raw.result as Good};
  const holds=[...accepted.holds];
  // New commits cannot claim the legacy shot/referee authority.
  if(!verifyEntry(initial,entry,f,n,holds,
      accepted.schedule,false))return fail('SOURCE_MISMATCH');
  const next:M1V188Journal={...accepted.journal,revision:n+1,
    entries:[...accepted.journal.entries,entry]};
  if(JSON.stringify(next).length>MAX_BYTES)
    return fail('JOURNAL_SIZE_LIMIT');
  rememberVerified(initial,next,holds);
  return good(next);
}
export function inspectM1V188LeagueCalendar(initial:unknown):
  {ok:false;error:'INVALID_INITIAL'}|
  {ok:true;fixtures:readonly Fixture[];fixtureCount:240;
    roundCount:30;selectedClubFixtures:30}{
  if(!validInitial(initial))return {ok:false,error:'INVALID_INITIAL'};
  return{ok:true,fixtures:calendar(initial),fixtureCount:240,
    roundCount:30,selectedClubFixtures:30};
}
