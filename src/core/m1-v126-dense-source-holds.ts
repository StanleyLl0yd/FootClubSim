import {simulateM1V19InternalReferee} from './m1-v19-internal-foul-injury.js';
import {verifyM1V158SourceClaim}
  from './m1-v158-generated-goal-stops.js';
import {verifyM1V166CombinedSourceClaim}
  from './m1-v166-combined-source.js';
import type {M1PrematchInput} from './m1-clock.js';
import {verifyM1V124DenseVirtualRefereeSource}
  from './m1-v124-dense-internal-referee.js';
import {validateM1V120Journal,type M1V120Journal}
  from './m1-v120-playable-journal.js';
import type {InitialCareerSave} from './save.js';

export const M1_V126_DENSE_HOLDS_SCHEMA=126 as const;
export interface M1V126DenseHold {
  readonly clubId:string;
  readonly playerId:string;
  readonly sourceFixtureId:string;
  readonly sourceIncidentId:string;
  readonly sourceIndex:number;
  readonly kind:'fictional-injury'|'direct-red'|'second-yellow';
  readonly modelledMissedCompleteClubFixtures:number|null;
  readonly remainingModelledFixtures:number|null;
  readonly activeForNextFixture:boolean;
}
export type M1V126DenseHoldReview=
  | Readonly<{ok:false;error:'INVALID_JOURNAL'|
      'UNVERIFIED_VIRTUAL_SOURCE'|'HISTORICAL_HOLD_BYPASS'}>
  | Readonly<{ok:true;schemaVersion:126;
      status:'SOURCE_VERIFIED_FICTIONAL_HOLDS_NOT_PLAY_AUTHORITY';
      sourceVerifiedVirtualFixtures:number;
      modelledIncidentCount:number;modelledCautions:number;
      holds:readonly M1V126DenseHold[];
      fullOpponentHistoryAvailable:false;
      kdkSanctionsAuthenticated:false;clinicalClearanceAuthenticated:false;
      automaticCareerAdvancementAuthorized:false}>;

function missedFixtureCount(fixtureId:string,incidentId:string,
  playerId:string):number {
  let digest=0x6a09e667;
  for(const char of [fixtureId,incidentId,playerId].join('/'))
    digest=Math.imul(digest^char.charCodeAt(0),16777619)>>>0;
  return 1+digest%4;
}
type InternalHold=Omit<M1V126DenseHold,
  'remainingModelledFixtures'|'activeForNextFixture'>;
function heldInFixture(hold:InternalHold,nextIndex:number):boolean {
  return hold.modelledMissedCompleteClubFixtures===null||
    nextIndex<=hold.sourceIndex+hold.modelledMissedCompleteClubFixtures;
}
function selectedLineup(initial:InitialCareerSave,prematch:M1PrematchInput) {
  return prematch.fixture.homeClubId===initial.selectedClubId?
    prematch.homeLineup:prematch.awayLineup;
}
/**
 * Read-only projection. Full v120 replay and exact v124 source recreation
 * are mandatory. Nothing here grants real-world sanction or medical clearance,
 * changes a saved journal or unlocks automatic dense career advancement.
 */
export function reviewM1V126DenseSourceHolds(
  initial:InitialCareerSave,untrustedJournal:M1V120Journal,
):M1V126DenseHoldReview {
  const verified=validateM1V120Journal(initial,untrustedJournal);
  if(!verified.ok)return {ok:false,error:'INVALID_JOURNAL'};
  const journal=verified.journal;
  const holds:InternalHold[]=[];
  let virtualFixtures=0,incidentCount=0,cautions=0;
  for(let index=0;index<journal.entries.length;index++){
    const entry=journal.entries[index]!;
    const source=entry.source;
    if(source.checkpointMedical.length!==0||
       source.intraphaseMedical.length!==0||
       source.trustedDecisions.length!==0)
      return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
    // A v124 claim is source-verified even if it carries zero incidents:
    // an empty command list must not masquerade as a modelled clean match.
    if(source.plannedCommands.length===0&&
       entry.commandId!=='v124-virtual-referee-'+entry.fixtureId&&
       entry.commandId!=='v132-sub-'+entry.fixtureId&&
       entry.commandId!=='v136-double-'+entry.fixtureId&&
       entry.commandId!=='v138-multi-'+entry.fixtureId&&
       entry.commandId!=='v158-goal-multi-'+entry.fixtureId)continue;
    // A user-requested v132 normal substitution is already checked for
    // physical legality by the full v120/v105 source replay above. It is not
    // a modelled referee sanction and must not mint or discharge any hold.
    if(entry.commandId==='v132-sub-'+entry.fixtureId){
      const cmd=source.plannedCommands[0] as Record<string,unknown>|undefined;
      if(source.plannedCommands.length!==1||!cmd||
         Reflect.ownKeys(cmd).length!==10||
         cmd.schemaVersion!==1||cmd.kind!=='substitute-normal'||
         cmd.commandId!==entry.commandId||
         cmd.fixtureId!==entry.fixtureId||
         cmd.teamId!==initial.selectedClubId||
         !cmd.actor||typeof cmd.actor!=='object'||
         Array.isArray(cmd.actor)||
         (cmd.actor as Record<string,unknown>).kind!=='player'||
         !Number.isSafeInteger(cmd.elapsedSeconds)||
         (cmd.elapsedSeconds as number)<300||
         (cmd.elapsedSeconds as number)>5100||
         (cmd.elapsedSeconds as number)%300!==0||
         cmd.stoppage!==
           (cmd.elapsedSeconds===2700?'half-time':'referee-authorized'))
        return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
      continue;
    }
    // Multi-window manager commands are legal only if their exact in-match
    // source replay passed above and the namespace matches both commands.
    if(entry.commandId==='v136-double-'+entry.fixtureId){
      if(source.plannedCommands.length!==2)
        return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
      const out=new Set<string>(),incoming=new Set<string>();
      let previous=-1;
      for(let i=0;i<2;i++){
        const c=source.plannedCommands[i] as Record<string,unknown>|undefined;
        if(!c||typeof c!=='object'||Array.isArray(c)||
           Reflect.ownKeys(c).length!==10||
           c.schemaVersion!==1||c.kind!=='substitute-normal'||
           c.commandId!=='v136-sub-'+entry.fixtureId+'-'+(i+1)||
           c.fixtureId!==entry.fixtureId||
           c.teamId!==initial.selectedClubId||
           !c.actor||typeof c.actor!=='object'||
           Array.isArray(c.actor)||
           (c.actor as Record<string,unknown>).kind!=='player'||
           typeof c.outPlayerId!=='string'||
           typeof c.inPlayerId!=='string'||
           out.has(c.outPlayerId)||incoming.has(c.inPlayerId)||
           !Number.isSafeInteger(c.elapsedSeconds)||
           (c.elapsedSeconds as number)<300||
           (c.elapsedSeconds as number)>5100||
           (c.elapsedSeconds as number)%300!==0||
           (c.elapsedSeconds as number)<previous||
           c.stoppage!==
             (c.elapsedSeconds===2700?'half-time':'referee-authorized'))
          return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
        out.add(c.outPlayerId);incoming.add(c.inPlayerId);
        previous=c.elapsedSeconds as number;
      }
      continue;
    }
    // Manager-selected normal changes never mint a modelled referee
    // incident. The exact physical source was already replayed in v120.
    const generatedGoalStop=
      entry.commandId==='v158-goal-multi-'+entry.fixtureId;
    if(entry.commandId==='v138-multi-'+entry.fixtureId||
       generatedGoalStop){
      const commands=source.plannedCommands;
      if(commands.length<(generatedGoalStop?1:3)||
         commands.length>5)
        return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
      const out=new Set<string>(),incoming=new Set<string>();
      let previous=-1;
      for(let i=0;i<commands.length;i++){
        const c=commands[i] as Record<string,unknown>|undefined;
        if(!c||typeof c!=='object'||Array.isArray(c)||
           Reflect.ownKeys(c).length!==10||
           c.schemaVersion!==1||c.kind!=='substitute-normal'||
           c.commandId!==(generatedGoalStop?'v158-sub-':'v138-sub-')+
             entry.fixtureId+'-'+i||
           c.fixtureId!==entry.fixtureId||
           c.teamId!==initial.selectedClubId||
           !c.actor||typeof c.actor!=='object'||
           Array.isArray(c.actor)||
           Reflect.ownKeys(c.actor).length!==1||
           (c.actor as Record<string,unknown>).kind!=='player'||
           typeof c.outPlayerId!=='string'||
           typeof c.inPlayerId!=='string'||
           out.has(c.outPlayerId)||incoming.has(c.inPlayerId)||
           !Number.isSafeInteger(c.elapsedSeconds)||
           (c.elapsedSeconds as number)<300||
           (c.elapsedSeconds as number)>5100||
           (c.elapsedSeconds as number)%300!==0||
           (c.elapsedSeconds as number)<previous||
           c.stoppage!==(
             c.elapsedSeconds===2700?'half-time':'referee-authorized'))
          return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
        out.add(c.outPlayerId);incoming.add(c.inPlayerId);
        previous=c.elapsedSeconds as number;
      }
      if(generatedGoalStop&&!verifyM1V158SourceClaim(
        {...source.prematch,catalog:initial.catalog},
        source.policy,commands,entry.fixtureId,initial.selectedClubId,
        initial.rngState))
        return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
      continue;
    }
    const combined=entry.commandId==='v166-combined-'+entry.fixtureId;
    const sourceVerified=combined?verifyM1V166CombinedSourceClaim(
      {...source.prematch,catalog:initial.catalog},source.policy,
      source.plannedCommands,entry.fixtureId,initial.selectedClubId,
      initial.rngState):verifyM1V124DenseVirtualRefereeSource(
        initial,journal,entry.fixtureId);
    if(!sourceVerified)
      return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
    const prematch={...source.prematch,
      catalog:initial.catalog} as M1PrematchInput;
    const replay=simulateM1V19InternalReferee(prematch,source.policy);
    if(!replay.ok)return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
    virtualFixtures++;
    incidentCount+=replay.generatedIncidents.length;
    const matchCautions=new Map<string,number>();
    for(const incident of replay.generatedIncidents){
      if(incident.sanction==='caution')cautions++;
      if(incident.teamId!==initial.selectedClubId)continue;
      let kind:InternalHold['kind']|null=null;
      let duration:number|null=null;
      if(incident.sanction==='direct-red')kind='direct-red';
      else if(incident.sanction==='injury-withdrawal'){
        kind='fictional-injury';
        duration=missedFixtureCount(entry.fixtureId,
          incident.decisionId,incident.playerId);
      }else if(incident.sanction==='caution'){
        const count=(matchCautions.get(incident.playerId)??0)+1;
        matchCautions.set(incident.playerId,count);
        if(count===2)kind='second-yellow';
      }
      if(kind!==null)holds.push({
        clubId:incident.teamId,playerId:incident.playerId,
        sourceFixtureId:entry.fixtureId,
        sourceIncidentId:incident.decisionId,sourceIndex:index,
        kind,modelledMissedCompleteClubFixtures:duration,
      });
    }
  }
  for(const hold of holds){
    for(let next=hold.sourceIndex+1;next<journal.entries.length;next++){
      if(!heldInFixture(hold,next))continue;
      const raw=journal.entries[next]!.source.prematch;
      const fixture=raw as unknown as M1PrematchInput;
      const lineup=selectedLineup(initial,fixture);
      if(lineup.starters.includes(hold.playerId)||
        lineup.bench.includes(hold.playerId))
        return {ok:false,error:'HISTORICAL_HOLD_BYPASS'};
    }
  }
  return {ok:true,schemaVersion:M1_V126_DENSE_HOLDS_SCHEMA,
    status:'SOURCE_VERIFIED_FICTIONAL_HOLDS_NOT_PLAY_AUTHORITY',
    sourceVerifiedVirtualFixtures:virtualFixtures,
    modelledIncidentCount:incidentCount,modelledCautions:cautions,
    holds:holds.map(hold=>{
      const duration=hold.modelledMissedCompleteClubFixtures;
      const remaining=duration===null?null:
        Math.max(0,hold.sourceIndex+duration+1-journal.revision);
      return {...hold,remainingModelledFixtures:remaining,
        activeForNextFixture:duration===null||remaining!==0};
    }),
    fullOpponentHistoryAvailable:false,
    kdkSanctionsAuthenticated:false,clinicalClearanceAuthenticated:false,
    automaticCareerAdvancementAuthorized:false};
}
