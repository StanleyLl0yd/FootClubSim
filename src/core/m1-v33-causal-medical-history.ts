import { sameCanonicalValue } from './canonical-value.js';
import { validateM1V32ExposureJournal,
  type M1V32JournalError } from './m1-v32-causal-medical-journal.js';
import type { M1V29CausalAssessment } from './m1-v23-temporary-treatment.js';
import type { M1V24PlayerExposure } from './m1-v24-physical-exposure.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * Fully source-replayed, read-only medical episode chronology in journal
 * POSTING order. Calendar chronology, medical clearance and sanctions
 * require independent authority and are never inferred from this data.
 */
export const M1_V33_HISTORY_SCHEMA = 1 as const;
export const M1_V33_HISTORY_RULES =
  'm1-v32-replayed-posting-order-causal-medical-history' as const;
type CountKey = Exclude<
  keyof M1V24PlayerExposure, 'playerId' | 'teamId' | 'onFieldAtFullTime'
>;
const COUNTS = [
  'physicalSeconds', 'shots', 'goals', 'firstYellowCards',
  'secondYellowDismissals', 'straightRedDismissals',
  'permanentInjuryWithdrawals', 'temporaryTreatmentExits',
  'temporaryTreatmentReturns', 'substitutionsIn', 'substitutionsOut',
] as const satisfies readonly CountKey[];
const cmp = (a:string,b:string):number => a < b ? -1 : a > b ? 1 : 0;
export type M1V33PlayerHistory = Readonly<
  Omit<M1V24PlayerExposure,'onFieldAtFullTime'> & {
    fixtureRecords:number;
    lastPostedFixtureId:string;
    onFieldAtLastPostedFixture:boolean;
    modelOnFieldAssessments:number;
    modelOffFieldAssessments:number;
    lastPostedMedicalFixtureId:string|null;
    lastModelIncidentId:string|null;
  }
>;
type Mutable = {-readonly [K in keyof M1V33PlayerHistory]:M1V33PlayerHistory[K]};

export type M1V33Episode = Readonly<M1V29CausalAssessment & {
  fixtureId:string;
  postedRevision:number;
}>;
export type M1V33MedicalHistoryRun =
  | Readonly<{ok:false;error:M1V32JournalError}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V33_HISTORY_SCHEMA;
    rulesId:typeof M1_V33_HISTORY_RULES;
    careerId:string;
    revision:number;
    fixtureCount:number;
    playerFixtureRows:number;
    modelMedicalEpisodeCount:number;
    players:readonly M1V33PlayerHistory[];
    episodes:readonly M1V33Episode[];
    status:'SOURCE_REPLAYED_MODEL_MEDICAL_EVENTS_NOT_CLINICALLY_AUTHENTICATED';
    fullHistorySourceReplayVerified:true;
    calendarChronologyAuthenticated:false;
    independentMedicalDiagnosisAuthenticated:false;
    medicalReturnAndClearanceAuthenticated:false;
    disciplinaryCarryoverAuthenticated:false;
    fatigueDeltasCalibrated:false;
    officialLeaguePointsAwarded:false;
  }>;
export function deriveM1V33CausalMedicalHistory(
  initialCareer:unknown,journalCandidate:unknown,
):M1V33MedicalHistoryRun {
  const verified=validateM1V32ExposureJournal(initialCareer,journalCandidate);
  if(!verified.ok)return {ok:false,error:verified.error};
  const journal=verified.journal;
  const rows=new Map<string,Mutable>();
  const episodes:M1V33Episode[]=[];
  let playerFixtureRows=0;
  for(let index=0;index<journal.results.length;index++){
    const match=journal.results[index]!;
    for(const row of match.facts.playerRows){
      playerFixtureRows++;
      const key=JSON.stringify([row.teamId,row.playerId]);
      const existing=rows.get(key);
      if(existing){
        existing.fixtureRecords++;
        for(const count of COUNTS)existing[count]+=row[count];
        existing.lastPostedFixtureId=match.fixtureId;
        existing.onFieldAtLastPostedFixture=row.onFieldAtFullTime;
      }else{
        const {onFieldAtFullTime,...rest}=row;
        rows.set(key,{
          ...rest,fixtureRecords:1,lastPostedFixtureId:match.fixtureId,
          onFieldAtLastPostedFixture:onFieldAtFullTime,
          modelOnFieldAssessments:0,modelOffFieldAssessments:0,
          lastPostedMedicalFixtureId:null,lastModelIncidentId:null,
        });
      }
    }
    for(const assessment of match.facts.causalAssessments){
      const key=JSON.stringify([
        assessment.patientTeamId,assessment.patientPlayerId]);
      const player=rows.get(key);
      const physical=match.facts.playerRows.find(x=>
        x.teamId===assessment.patientTeamId &&
        x.playerId===assessment.patientPlayerId);
      if(!player || !physical ||
          (assessment.transition==='off-field-return' &&
            (physical.temporaryTreatmentExits<1 ||
              physical.temporaryTreatmentReturns<1))) {
        return {ok:false,error:'INVALID_JOURNAL'};
      }
      if(assessment.transition==='on-field-quick'){
        player.modelOnFieldAssessments++;
      }else{
        player.modelOffFieldAssessments++;
      }
      player.lastPostedMedicalFixtureId=match.fixtureId;
      player.lastModelIncidentId=assessment.incidentId;
      episodes.push({...assessment,fixtureId:match.fixtureId,
        postedRevision:index+1});
    }
  }
  const players=[...rows.values()].sort((a,b)=>
    cmp(a.teamId,b.teamId)||cmp(a.playerId,b.playerId));
  return {
    ok:true,schemaVersion:M1_V33_HISTORY_SCHEMA,
    rulesId:M1_V33_HISTORY_RULES,careerId:journal.careerId,
    revision:journal.revision,fixtureCount:journal.results.length,
    playerFixtureRows,modelMedicalEpisodeCount:episodes.length,
    players,episodes,
    status:'SOURCE_REPLAYED_MODEL_MEDICAL_EVENTS_NOT_CLINICALLY_AUTHENTICATED',
    fullHistorySourceReplayVerified:true,
    calendarChronologyAuthenticated:false,
    independentMedicalDiagnosisAuthenticated:false,
    medicalReturnAndClearanceAuthenticated:false,
    disciplinaryCarryoverAuthenticated:false,
    fatigueDeltasCalibrated:false,
    officialLeaguePointsAwarded:false,
  };
}
export function verifyM1V33CausalMedicalHistory(
  initialCareer:unknown,journalCandidate:unknown,candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const replay=deriveM1V33CausalMedicalHistory(initialCareer,journalCandidate);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
