import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {prepareM1V188LeagueMatch,
  type M1V188Journal,type M1V188ManagedXI,
  type M1V188Proposal} from './m1-v188-league-source-journal.js';
import type {M1V105Run} from './m1-v105-special-goal-chronology.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {InitialCareerSave} from './save.js';

type Ready=Extract<M1V188Proposal,{ok:true}>;
type Good=Extract<M1V105Run,{ok:true}>;
export const M1_V188_PAUSE_DRAFT_SCHEMA=1 as const;
export const M1_V188_PAUSE_DRAFT_MAX_BYTES=1_000_000;
export type M1V188PauseDraft=Readonly<{
  schemaVersion:1;careerId:string;fixtureId:string;
  expectedRevision:number;pauseMinute:number;
  managedXI?:M1V188ManagedXI;
  substitutions:readonly unknown[];coachingChoices:readonly unknown[];
  prematchWitness:Readonly<Record<string,unknown>>;
  commandPrefix:readonly unknown[];playedPrefix:readonly unknown[];
}>;
export type M1V188RecoveredPause=Readonly<{
  draft:M1V188PauseDraft;proposal:Ready;
}>;
const record=(x:unknown):x is Record<string,unknown>=>
  x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=['schemaVersion','careerId','fixtureId','expectedRevision',
  'pauseMinute','substitutions','coachingChoices',
  'prematchWitness','commandPrefix','playedPrefix'];
const validMinute=(m:unknown):m is number=>
  Number.isSafeInteger(m)&&(m as number)>=5&&(m as number)<=85&&
  (m as number)%5===0;
const played=(proposal:Ready,second:number)=>
  (proposal.request.result as Good).events.filter(e=>
    e.elapsedSeconds<second);
const sourcePrematch=(proposal:Ready)=>{
  const input=proposal.request.prematch as M1PrematchInput;
  return {
    fixture:input.fixture,
    homeLineup:input.homeLineup,awayLineup:input.awayLineup,
    homeTactics:input.homeTactics,awayTactics:input.awayTactics,
    rngSeed:input.rngSeed,rngAlgorithmVersion:input.rngAlgorithmVersion,
    engineVersion:input.engineVersion,
    rulesPackId:input.rulesPackId,rulesPackVersion:input.rulesPackVersion,
    rosterRules:input.rosterRules,
  };
};
const beforeCommands=(proposal:Ready,second:number)=>
  proposal.request.plannedCommands.filter(c=>record(c)&&
    Number.isSafeInteger(c.elapsedSeconds)&&
    (c.elapsedSeconds as number)<second);

const validEnvelope=(raw:unknown):raw is M1V188PauseDraft=>{
  if(!isPlainJsonTree(raw)||!record(raw))return false;
  const expected=Object.hasOwn(raw,'managedXI')?
    [...keys,'managedXI']:keys;
  if(Object.keys(raw).length!==expected.length||
      expected.some(k=>!Object.hasOwn(raw,k))||
      raw.schemaVersion!==1||
      typeof raw.careerId!=='string'||!raw.careerId||
      typeof raw.fixtureId!=='string'||!raw.fixtureId||
      !Number.isSafeInteger(raw.expectedRevision)||
      (raw.expectedRevision as number)<0||
      (raw.expectedRevision as number)>239||
      !validMinute(raw.pauseMinute)||
      !Array.isArray(raw.substitutions)||raw.substitutions.length>5||
      !Array.isArray(raw.coachingChoices)||
      raw.coachingChoices.length>10||
      !record(raw.prematchWitness)||
      !Array.isArray(raw.commandPrefix)||
      raw.commandPrefix.length>1500||
      !Array.isArray(raw.playedPrefix)||
      raw.playedPrefix.length>1500)return false;
  const stop=(raw.pauseMinute as number)*60;
  return raw.substitutions.every(c=>record(c)&&
      Number.isSafeInteger(c.elapsedSeconds)&&
      (c.elapsedSeconds as number)<stop)&&
    raw.coachingChoices.every(c=>record(c)&&
      Number.isSafeInteger(c.elapsedSeconds)&&
      (c.elapsedSeconds as number)<stop);
};
export function parseM1V188PauseDraft(raw:unknown):M1V188PauseDraft|null{
  if(!validEnvelope(raw))return null;
  try{
    const bytes=JSON.stringify(raw);
    if(bytes.length>M1_V188_PAUSE_DRAFT_MAX_BYTES)return null;
    const cloned:unknown=JSON.parse(bytes);
    return validEnvelope(cloned)&&sameCanonicalValue(raw,cloned)?
      cloned:null;
  }catch{return null;}
}
/** Only a bounded already-played prefix is persisted; future events,
 * scores and source authority must be independently regenerated.
 */
export function createM1V188PauseDraft(
  proposal:Ready,pauseMinute:number,
  substitutions:readonly unknown[]=[],
  coachingChoices:readonly unknown[]=[],
):M1V188PauseDraft|null{
  if(!validMinute(pauseMinute)||!proposal.selectedClubFixture)return null;
  return parseM1V188PauseDraft({
    schemaVersion:1,careerId:proposal.request.careerId,
    fixtureId:proposal.fixture.id,
    expectedRevision:proposal.request.expectedRevision,pauseMinute,
    ...(proposal.request.managedXI?
      {managedXI:proposal.request.managedXI}:{}),
    substitutions:[...substitutions],coachingChoices:[...coachingChoices],
    prematchWitness:sourcePrematch(proposal),
    commandPrefix:beforeCommands(proposal,pauseMinute*60),
    playedPrefix:played(proposal,pauseMinute*60),
  });
}
/** Untrusted drafts never change the canonical v188 journal. They may
 * restore a UI-only pause only after exact source and prefix replay.
 */
export function recoverM1V188PauseDraft(
  initial:InitialCareerSave,journal:M1V188Journal,raw:unknown,
):M1V188RecoveredPause|null{
  const draft=parseM1V188PauseDraft(raw);
  if(!draft||draft.careerId!==initial.careerId||
      draft.expectedRevision!==journal.revision||
      journal.revision>=240)return null;
  // A first-match draft has not committed its source-version markers yet.
  // Try the current playable defaults first, then a fixed, small set of
  // historical versions. NONE of these attempts trusts the draft's label:
  // the whole original physical event and command prefix must replay.
  // After any committed fixture, read versions from the verified journal.
  type Model=readonly [
    2|3|4|5|undefined,1|2|undefined,2|undefined];
  const oldFirst:readonly (readonly [
    Model[0],Model[1]])[]=[
    [5,2],[undefined,2],[undefined,undefined],
    [2,2],[3,2],[4,2],[5,undefined],
    [2,undefined],[3,undefined],[4,undefined],
    [undefined,1],[2,1],[3,1],[4,1],[5,1],
  ];
  const models:readonly Model[]=journal.revision===0?
    [[5,2,2],...oldFirst.map(([medical,goal])=>
      [medical,goal,undefined] as const)]:
    [[journal.entries.at(-1)?.source.medicalPolicyVersion,
      journal.entries[0]?.source.specialGoalSourceVersion,
      journal.entries[0]?.source.fixtureCalendarPolicyVersion]];
  for(const [medical,goal,calendar] of models){
    const restored=prepareM1V188LeagueMatch(initial,journal,
      draft.substitutions,undefined,medical,draft.managedXI,
      goal,draft.coachingChoices,calendar);
    if(!restored?.ok||!restored.selectedClubFixture||
        restored.fixture.id!==draft.fixtureId||
        restored.request.expectedRevision!==draft.expectedRevision||
        !sameCanonicalValue(sourcePrematch(restored),draft.prematchWitness)||
        !sameCanonicalValue(beforeCommands(restored,draft.pauseMinute*60),
          draft.commandPrefix)||
        !sameCanonicalValue(
          played(restored,draft.pauseMinute*60),draft.playedPrefix))
      continue;
    return {draft,proposal:restored};
  }
  return null;
}
