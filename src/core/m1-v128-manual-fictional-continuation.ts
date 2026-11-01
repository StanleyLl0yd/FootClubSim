import {reviewM1V126DenseSourceHolds,
  type M1V126DenseHold} from './m1-v126-dense-source-holds.js';
import {buildM1V122NextOrdinaryFromVerified}
  from './m1-v122-dense-ordinary-season.js';
import {validateM1V120Journal,type M1V120Journal,
  type M1V120Apply} from './m1-v120-playable-journal.js';
import type {Fixture} from './fixtures.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {InitialCareerSave} from './save.js';

export const M1_V128_MANUAL_FICTIONAL_CONTINUATION_SCHEMA=128 as const;
export type M1V128ManualContinuation=
  | Readonly<{ok:false;error:'INVALID_JOURNAL'|
      'UNVERIFIED_VIRTUAL_SOURCE'|'HISTORICAL_HOLD_BYPASS'|
      'NO_LEGAL_LINEUP'|'SOURCE_GENERATION_REJECTED'|
      'PREVIOUS_EXCEPTION_NOT_SUPPORTED'}>
  | Readonly<{ok:true;schemaVersion:128;fixture:Fixture;
      request:M1V120Apply;remainingClubFixtures:number;
      status:'MANUAL_FICTIONAL_CONTINUATION_WITH_SOURCE_VERIFIED_HOLDS';
      activeControlledClubHolds:readonly M1V126DenseHold[];
      manualActionRequired:true;externalRefereeAuthorityAuthenticated:false;
      clinicalReturnAuthenticated:false;completeOpponentHistory:false;
      previousV8AndM0Unchanged:true}>;

/**
 * Explicitly user-triggered fictional-only continuation after complete
 * source replay. Injury windows are modelled 1..4 *controlled club* fixtures;
 * straight-red and second-yellow holds stay indefinite. Never infer real
 * KDK/physician release, official opponent history or automatic career rights.
 */
export function prepareM1V128ManualFictionalContinuation(
  initial:InitialCareerSave,candidate:M1V120Journal,
):M1V128ManualContinuation|null {
  const holds=reviewM1V126DenseSourceHolds(initial,candidate);
  if(!holds.ok)return {ok:false,error:holds.error};
  const verified=validateM1V120Journal(initial,candidate);
  if(!verified.ok)return {ok:false,error:'INVALID_JOURNAL'};
  const active=holds.holds.filter(hold=>hold.activeForNextFixture);
  const excluded=new Set(active.map(hold=>hold.playerId));
  const proposed=buildM1V122NextOrdinaryFromVerified(
    initial,verified.journal,excluded);
  if(proposed===null)return null;
  if(!proposed.ok)return proposed;
  const prematch=proposed.request.prematch as M1PrematchInput;
  const own=proposed.fixture.homeClubId===initial.selectedClubId?
    prematch.homeLineup:prematch.awayLineup;
  if(active.some(hold=>own.starters.includes(hold.playerId)||
      own.bench.includes(hold.playerId)))
    return {ok:false,error:'HISTORICAL_HOLD_BYPASS'};
  return {ok:true,
    schemaVersion:M1_V128_MANUAL_FICTIONAL_CONTINUATION_SCHEMA,
    status:'MANUAL_FICTIONAL_CONTINUATION_WITH_SOURCE_VERIFIED_HOLDS',
    fixture:proposed.fixture,request:{...proposed.request,
      commandId:'v128-fictional-continuation-'+proposed.fixture.id},
    remainingClubFixtures:proposed.remainingClubFixtures,
    activeControlledClubHolds:active,
    manualActionRequired:true,externalRefereeAuthorityAuthenticated:false,
    clinicalReturnAuthenticated:false,completeOpponentHistory:false,
    previousV8AndM0Unchanged:true};
}
