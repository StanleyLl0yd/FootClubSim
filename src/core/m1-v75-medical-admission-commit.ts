import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {validateM1V32ExposureJournal,applyM1V32ExposureBatch,
  type M1V32Journal,type M1V32JournalError}
  from './m1-v32-causal-medical-journal.js';
import {simulateM1V63UnresolvedMedicalHoldFixture,
  type M1V63MedicalHoldRun,type M1V63PendingMedicalHold}
  from './m1-v63-unresolved-medical-hold.js';

/**
 * One opt-in in-process fixture commit. v63 medical + v58 both-club
 * disciplinary admission, verified v31 match and source-v32 append share
 * the same immutable source snapshot and expected career revision.
 * A real IndexedDB CAS transaction and official external authority are
 * separate requirements; this does not modify the legacy low-level API.
 */
export const M1_V75_GATED_COMMIT_SCHEMA=1 as const;
type GateFailure=Extract<M1V63MedicalHoldRun,{ok:false}>;
type GatedCommitError=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'INVALID_JOURNAL'|
      'CAS_REVISION_MISMATCH'|'CLAIMED_SOURCE_RESULT_MISMATCH'}>
  | Readonly<{ok:false;error:'ADMISSION_DENIED';
      gateError:GateFailure['error'];
      affectedFixtureId?:string;affectedTeamId?:string;
      affectedPlayerIds?:readonly string[]}>
  | Readonly<{ok:false;error:'JOURNAL_APPEND_DENIED';
      journalError:M1V32JournalError}>;
export type M1V75GatedCommitResult=GatedCommitError|Readonly<{
  ok:true;
  schemaVersion:typeof M1_V75_GATED_COMMIT_SCHEMA;
  status:'SOURCE_VERIFIED_PRECOMMIT_MEDICAL_AND_DISCIPLINE_ADMISSION';
  journal:M1V32Journal;
  fixtureId:string;
  previousRevision:number;
  pendingMedicalHolds:readonly M1V63PendingMedicalHold[];
  originalM0CatalogVerified:true;
  bothClubHistoryChecked:true;
  sameRevisionAndSourceForGateAndAppend:true;
  officialMedicalAndKdkAuthorityAuthenticated:false;
  durableIndexedDbCasCommitted:false;
}>;

const reqKeys=['schemaVersion','commandId','careerId','expectedRevision',
  'prematch','policy','halfTimeCommands','inPlayCommands','result'];
const rec=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);

export function commitM1V75MedicallyGatedFixture(
  initial:unknown,journalCandidate:unknown,request:unknown,
  expectedRevision:unknown,
):M1V75GatedCommitResult{
  if(!isPlainJsonTree(initial)||!isPlainJsonTree(journalCandidate)||
      !isPlainJsonTree(request)||!rec(request)||
      Reflect.ownKeys(request).length!==reqKeys.length||
      reqKeys.some(k=>!Object.hasOwn(request,k))||
      request.schemaVersion!==6||
      !Number.isSafeInteger(expectedRevision)||
      (expectedRevision as number)<0||
      !isPlainJsonTree(request.prematch)||
      !isPlainJsonTree(request.policy)||
      !Array.isArray(request.halfTimeCommands)||
      !Array.isArray(request.inPlayCommands)||
      !isPlainJsonTree(request.result)){
    return {ok:false,error:'INVALID_INPUT'};
  }
  const checked=validateM1V32ExposureJournal(initial,journalCandidate);
  if(!checked.ok)return {ok:false,error:'INVALID_JOURNAL'};
  if(checked.journal.revision!==expectedRevision||
      request.expectedRevision!==expectedRevision){
    return {ok:false,error:'CAS_REVISION_MISMATCH'};
  }
  const gated=simulateM1V63UnresolvedMedicalHoldFixture(
    initial,checked.journal,request.prematch,request.policy,
    request.halfTimeCommands,request.inPlayCommands);
  if(!gated.ok){
    return {ok:false,error:'ADMISSION_DENIED',
      gateError:gated.error,
      ...('affectedFixtureId' in gated?
        {affectedFixtureId:gated.affectedFixtureId}:{}),
      ...('affectedTeamId' in gated?
        {affectedTeamId:gated.affectedTeamId}:{}),
      ...('affectedPlayerIds' in gated?
        {affectedPlayerIds:gated.affectedPlayerIds}:{})};
  }
  if(!sameCanonicalValue(request.result,gated.result.match)){
    return {ok:false,error:'CLAIMED_SOURCE_RESULT_MISMATCH'};
  }
  const applied=applyM1V32ExposureBatch(
    initial,checked.journal,[request],expectedRevision as number);
  if(!applied.ok){
    return {ok:false,error:'JOURNAL_APPEND_DENIED',
      journalError:applied.error};
  }
  return {ok:true,schemaVersion:M1_V75_GATED_COMMIT_SCHEMA,
    status:'SOURCE_VERIFIED_PRECOMMIT_MEDICAL_AND_DISCIPLINE_ADMISSION',
    journal:applied.journal,fixtureId:gated.fixtureId,
    previousRevision:expectedRevision as number,
    pendingMedicalHolds:gated.pendingMedicalHolds,
    originalM0CatalogVerified:true,bothClubHistoryChecked:true,
    sameRevisionAndSourceForGateAndAppend:true,
    officialMedicalAndKdkAuthorityAuthenticated:false,
    durableIndexedDbCasCommitted:false};
}
