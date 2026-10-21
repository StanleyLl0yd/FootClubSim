import { sameCanonicalValue } from './canonical-value.js';
import { validateM1V26ExposureJournal,
  type M1V26JournalError } from './m1-v26-exposure-journal.js';
import type { M1V24PlayerExposure } from './m1-v24-physical-exposure.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * Read-only posting-order projection from a FULLY replay-validated v26
 * journal. No fitness, medical diagnosis, suspension or chronology inferred.
 */
export const M1_V30_TRACE_SCHEMA = 1 as const;
export const M1_V30_TRACE_RULES =
  'm1-replayed-cross-fixture-exposure-posting-order' as const;

export type M1V30PlayerTrace = Readonly<
  Omit<M1V24PlayerExposure, 'onFieldAtFullTime'> & {
    fixtureRecords: number;
    lastPostedFixtureId: string;
    onFieldAtLastPostedFixture: boolean;
  }
>;
type MutableTrace = {-readonly [K in keyof M1V30PlayerTrace]: M1V30PlayerTrace[K]};
type CountKey = Exclude<
  keyof M1V24PlayerExposure, 'playerId' | 'teamId' | 'onFieldAtFullTime'
>;
const COUNTS = [
  'physicalSeconds', 'shots', 'goals', 'firstYellowCards',
  'secondYellowDismissals', 'straightRedDismissals',
  'permanentInjuryWithdrawals', 'temporaryTreatmentExits',
  'temporaryTreatmentReturns', 'substitutionsIn', 'substitutionsOut',
] as const satisfies readonly CountKey[];
const sort = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export type M1V30CareerTraceRun =
  | Readonly<{ok:false;error:M1V26JournalError}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V30_TRACE_SCHEMA;
    rulesId:typeof M1_V30_TRACE_RULES;
    careerId:string;
    revision:number;
    fixtureCount:number;
    sourcePlayerFixtureRows:number;
    players:readonly M1V30PlayerTrace[];
    status:'SOURCE_REPLAYED_POSTING_ORDER_NOT_AUTHENTICATED_MEDICAL_STATE';
    fullJournalSourceReplayVerified:true;
    calendarChronologyAuthenticated:false;
    medicalDiagnosisAuthenticated:false;
    disciplinaryCarryoverAuthenticated:false;
    fatigueDeltasCalibrated:false;
    officialLeaguePointsAwarded:false;
  }>;

export function deriveM1V30CareerTrace(
  initialCareer: unknown, journalCandidate: unknown,
): M1V30CareerTraceRun {
  const source = validateM1V26ExposureJournal(initialCareer, journalCandidate);
  if (!source.ok) return {ok:false,error:source.error};
  const journal = source.journal;
  const accumulator = new Map<string,MutableTrace>();
  let sourceRows = 0;
  for (const fixture of journal.results) {
    for (const row of fixture.facts.playerRows) {
      sourceRows++;
      const key = row.teamId + ':' + row.playerId;
      const current = accumulator.get(key);
      if (current) {
        current.fixtureRecords++;
        for (const field of COUNTS) current[field] += row[field];
        current.lastPostedFixtureId = fixture.fixtureId;
        current.onFieldAtLastPostedFixture = row.onFieldAtFullTime;
      } else {
        const {onFieldAtFullTime, ...fields} = row;
        accumulator.set(key,{
          ...fields, fixtureRecords:1,
          lastPostedFixtureId:fixture.fixtureId,
          onFieldAtLastPostedFixture:onFieldAtFullTime,
        });
      }
    }
  }
  const players = [...accumulator.values()].sort((a,b)=>
    sort(a.teamId,b.teamId)||sort(a.playerId,b.playerId));
  return {
    ok:true, schemaVersion:M1_V30_TRACE_SCHEMA, rulesId:M1_V30_TRACE_RULES,
    careerId:journal.careerId, revision:journal.revision,
    fixtureCount:journal.results.length, sourcePlayerFixtureRows:sourceRows,
    players,
    status:'SOURCE_REPLAYED_POSTING_ORDER_NOT_AUTHENTICATED_MEDICAL_STATE',
    fullJournalSourceReplayVerified:true,
    calendarChronologyAuthenticated:false,
    medicalDiagnosisAuthenticated:false,
    disciplinaryCarryoverAuthenticated:false,
    fatigueDeltasCalibrated:false,
    officialLeaguePointsAwarded:false,
  };
}

export function verifyM1V30CareerTrace(
  initialCareer:unknown, journalCandidate:unknown, candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const replay=deriveM1V30CareerTrace(initialCareer,journalCandidate);
  return replay.ok&&sameCanonicalValue(candidate,replay);
}
