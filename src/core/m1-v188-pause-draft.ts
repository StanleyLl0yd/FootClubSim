import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {prepareM1V188LeagueMatch,
  type M1V188Journal,type M1V188ManagedXI,
  type M1V188Proposal} from './m1-v188-league-source-journal.js';
import type {M1V105Run} from './m1-v105-special-goal-chronology.js';
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
  playedPrefix:readonly unknown[];
}>;
export type M1V188RecoveredPause=Readonly<{
  draft:M1V188PauseDraft;proposal:Ready;
}>;
const record=(x:unknown):x is Record<string,unknown>=>
  x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=['schemaVersion','careerId','fixtureId','expectedRevision',
  'pauseMinute','substitutions','coachingChoices','playedPrefix'];
const validMinute=(m:unknown):m is number=>
  Number.isSafeInteger(m)&&(m as number)>=5&&(m as number)<=85&&
  (m as number)%5===0;
const played=(proposal:Ready,second:number)=>
  (proposal.request.result as Good).events.filter(e=>
    e.elapsedSeconds<second);
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
  const firstGoal=journal.revision===0?2:
    journal.entries[0]?.source.specialGoalSourceVersion;
  const restored=prepareM1V188LeagueMatch(initial,journal,
    draft.substitutions,undefined,undefined,draft.managedXI,
    firstGoal,draft.coachingChoices);
  if(!restored?.ok||!restored.selectedClubFixture||
      restored.fixture.id!==draft.fixtureId||
      restored.request.expectedRevision!==draft.expectedRevision||
      !sameCanonicalValue(
        played(restored,draft.pauseMinute*60),draft.playedPrefix))
    return null;
  return {draft,proposal:restored};
}
