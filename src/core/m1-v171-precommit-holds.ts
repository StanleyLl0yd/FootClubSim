import {sameCanonicalValue} from './canonical-value.js';
import {deriveM1FixtureSeed} from './m1-fixture-seed.js';
import {buildM1V122NextOrdinaryFromVerified,
  prepareM1V122DenseOrdinaryMatch}
  from './m1-v122-dense-ordinary-season.js';
import {prepareM1V128ManualFictionalContinuation}
  from './m1-v128-manual-fictional-continuation.js';
import {prepareM1V176DenseMedicalMatch}
  from './m1-v176-dense-medical.js';
import {applyM1V120Source,type M1V120Gate}
  from './m1-v120-playable-journal.js';
import {reviewM1V126DenseSourceHolds,
  type M1V126DenseHold}
  from './m1-v126-dense-source-holds.js';
import type {InitialCareerSave} from './save.js';
import type {M1V120Journal} from './m1-v120-playable-journal.js';

const ADMITTED_COMMAND_PREFIXES=[
  'v122-ordinary-','v124-virtual-referee-',
  'v128-fictional-continuation-','v132-sub-','v136-double-',
  'v138-multi-','v158-goal-multi-','v166-combined-',
  'v176-medical-',
] as const;

/** Validate origins on the whole prospective persisted history, not only
 * its newest entry. Legacy source-replayable journals remain readable,
 * but unverifiable source claims cannot authorize further writes.
 */
function verifiedSourceOrigins(
  initial:InitialCareerSave,journal:M1V120Journal,
  holds:readonly M1V126DenseHold[],
):boolean{
  for(let index=0;index<journal.entries.length;index++){
    const entry=journal.entries[index]!;
    if(!ADMITTED_COMMAND_PREFIXES.some(prefix=>
         entry.commandId===prefix+entry.fixtureId)||
       entry.source.prematch.rngSeed!==
         deriveM1FixtureSeed(initial.rngState,entry.fixtureId))
      return false;
    if(!verifiedManagerWhistle(entry))return false;
    const ordinary=entry.commandId==='v122-ordinary-'+entry.fixtureId;
    if(ordinary&&journal.entries.slice(0,index).some(prior=>
      prior.source.plannedCommands.length!==0||
      prior.source.checkpointMedical.length!==0||
      prior.source.intraphaseMedical.length!==0||
      prior.source.trustedDecisions.length!==0))return false;
    const excluded=new Set(holds.filter(hold=>
      hold.sourceIndex<index&&
      (hold.modelledMissedCompleteClubFixtures===null||
       index<=hold.sourceIndex+hold.modelledMissedCompleteClubFixtures))
      .map(hold=>hold.playerId));
    const prior:M1V120Journal={...journal,revision:index,
      entries:journal.entries.slice(0,index)};
    const canonical=buildM1V122NextOrdinaryFromVerified(
      initial,prior,ordinary?new Set<string>():excluded);
    if(!canonical?.ok)return false;
    const prematch={
      ...(canonical.request.prematch as Record<string,unknown>)};
    delete prematch.catalog;
    if(!sameCanonicalValue(entry.source.prematch,prematch)||
       !sameCanonicalValue(entry.source.policy,canonical.request.policy))
      return false;
  }
  return true;
}

/** A text-only referee-authorized flag is not whistle evidence.
 * Only the verified source goal immediately before a checkpoint, or
 * half-time, can authorize a legacy manual in-play substitution.
 * The v120 result is already fully replayed before this check.
 */
function verifiedManagerWhistle(entry:M1V120Journal['entries'][number]):boolean{
  const id=entry.commandId;
  if(!['v132-sub-','v136-double-','v138-multi-'].some(prefix=>
      id===prefix+entry.fixtureId))return true;
  const stops=new Set<number>([2700]);
  for(const event of entry.result.events){
    if(event.type==='source'&&event.source.type==='shot'&&
        event.source.outcome==='goal'&&
        event.elapsedSeconds+1<5400)
      stops.add(event.elapsedSeconds+1);
  }
  return entry.source.plannedCommands.every(command=>
    command!==null&&typeof command==='object'&&
    !Array.isArray(command)&&
    stops.has((command as {elapsedSeconds:number}).elapsedSeconds));
}

export const M1_V171_PRECOMMIT_HOLDS_SCHEMA=171 as const;
export type M1V171Admission=M1V120Gate|
  Readonly<{ok:false;error:'UNVERIFIED_VIRTUAL_SOURCE'|
    'HISTORICAL_HOLD_BYPASS'}>;

/** Fail closed before the native IndexedDB transaction's put.
 * This is fictional hold integrity, not KDK or clinical certification.
 */
export function admitM1V171SourceWithHolds(
  initial:InitialCareerSave,journal:M1V120Journal,request:unknown,
):M1V171Admission{
  const accepted=applyM1V120Source(initial,journal,request);
  if(!accepted.ok)return accepted;
  const holds=reviewM1V126DenseSourceHolds(initial,accepted.journal);
  if(!holds.ok)return {ok:false,error:holds.error};
  if(!verifiedSourceOrigins(initial,accepted.journal,holds.holds))
    return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
  // A valid prefix and fixture seed cannot replace the actual selected
  // source generator. Neither mode accepts caller-invented tactics or XI.
  const last=accepted.journal.entries.at(-1)!;
  if(last.commandId==='v122-ordinary-'+last.fixtureId){
    const expected=prepareM1V122DenseOrdinaryMatch(initial,journal);
    if(!expected?.ok||!sameCanonicalValue(expected.request,request))
      return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
  }
  if(last.commandId==='v128-fictional-continuation-'+last.fixtureId){
    const expected=prepareM1V128ManualFictionalContinuation(initial,journal);
    if(!expected?.ok||!sameCanonicalValue(expected.request,request))
      return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
  }
  if(last.commandId==='v176-medical-'+last.fixtureId){
    const expected=prepareM1V176DenseMedicalMatch(initial,journal);
    if(!expected?.ok||!sameCanonicalValue(expected.request,request))
      return {ok:false,error:'UNVERIFIED_VIRTUAL_SOURCE'};
  }
  return accepted;
}
