import {buildM1V124VirtualRefereeFromVerifiedBase}
  from './m1-v124-dense-internal-referee.js';
import {prepareM1V128ManualFictionalContinuation}
  from './m1-v128-manual-fictional-continuation.js';
import type {M1V120Journal,M1V120Apply}
  from './m1-v120-playable-journal.js';
import type {Fixture} from './fixtures.js';
import type {InitialCareerSave} from './save.js';

export const M1_V130_MANUAL_VIRTUAL_REFEREE_SCHEMA=130 as const;
export type M1V130ManualVirtualReferee=
  | Readonly<{ok:false;error:'INVALID_JOURNAL'|
      'UNVERIFIED_VIRTUAL_SOURCE'|'HISTORICAL_HOLD_BYPASS'|
      'NO_LEGAL_LINEUP'|'SOURCE_GENERATION_REJECTED'|
      'REFEREE_REPLAY_REJECTED'|'PREVIOUS_EXCEPTION_NOT_SUPPORTED'}>
  | Readonly<{ok:true;schemaVersion:130;
      status:'MANUAL_SOURCE_VERIFIED_FICTIONAL_REFEREE_CONTINUATION';
      fixture:Fixture;request:M1V120Apply;incidents:number;
      manualActionRequired:true;fullSourceReplayRequired:true;
      kdkSanctionsAuthenticated:false;clinicalClearanceAuthenticated:false;
      completeOpponentHistory:false;automaticCareerAdvancementAuthorized:false;
      previousV8AndM0Unchanged:true}>;

/**
 * A later fictional virtual-referee fixture can only be proposed after
 * independently replayed v126 holds are enforced in a manually selected
 * v128 eligible XI/bench. The exact v124 generator and command namespace
 * are reused; v120 CAS still authoritatively validates the resulting source.
 */
export function prepareM1V130ManualVirtualRefereeContinuation(
  initial:InitialCareerSave,journal:M1V120Journal,
):M1V130ManualVirtualReferee|null {
  const base=prepareM1V128ManualFictionalContinuation(initial,journal);
  if(base===null)return null;
  if(!base.ok)return base;
  const generated=buildM1V124VirtualRefereeFromVerifiedBase(base);
  if(!generated.ok)return generated;
  return {ok:true,schemaVersion:M1_V130_MANUAL_VIRTUAL_REFEREE_SCHEMA,
    status:'MANUAL_SOURCE_VERIFIED_FICTIONAL_REFEREE_CONTINUATION',
    fixture:base.fixture,request:generated.request,
    incidents:generated.incidents,
    manualActionRequired:true,fullSourceReplayRequired:true,
    kdkSanctionsAuthenticated:false,clinicalClearanceAuthenticated:false,
    completeOpponentHistory:false,automaticCareerAdvancementAuthorized:false,
    previousV8AndM0Unchanged:true};
}
