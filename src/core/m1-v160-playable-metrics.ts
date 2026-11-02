import {validateM1V120Journal} from './m1-v120-playable-journal.js';
import type {M1V7TeamReport} from './m1-v7-adjudications.js';

export const M1_V160_PLAYABLE_METRICS_SCHEMA=160 as const;
export interface M1V160TeamMetrics {
  readonly goalsAllTypes:number;
  readonly openPlayGoals:number;
  readonly penaltyGoals:number;
  readonly ownGoalsFor:number;
  readonly penaltiesTaken:number;
  readonly shots:number;
  readonly shotsOnTarget:number;
  readonly openPlayXgMilli:number;
}
export interface M1V160Cohort {
  readonly schemaVersion:160;
  readonly status:'PLAYABLE_SOURCE_REPLAYED_SELECTED_CLUB_COHORT_NOT_CALIBRATION';
  readonly careerId:string;
  readonly journalRevision:number;
  readonly matches:number;
  readonly outcomeHomeWins:number;
  readonly outcomeDraws:number;
  readonly outcomeAwayWins:number;
  readonly nilNilMatches:number;
  readonly home:M1V160TeamMetrics;
  readonly away:M1V160TeamMetrics;
  readonly twoTeamTotal:M1V160TeamMetrics;
  readonly xgCoverage:'open-play-only';
  readonly providerShotTaxonomyVerified:false;
  readonly providerGoalsAllTypesComparable:false;
  readonly cardsAndMedicalRatesComparable:false;
  readonly fullLeagueFixtureCoverage:false;
  readonly holdout2024_25Used:false;
  readonly releaseCalibrationAccepted:false;
}
export type M1V160Result=
  | Readonly<{ok:false;error:'INVALID_JOURNAL'|'INCONSISTENT_METRIC'}>
  | Readonly<{ok:true;report:M1V160Cohort}>;

const zero=():M1V160TeamMetrics=>({
  goalsAllTypes:0,openPlayGoals:0,penaltyGoals:0,
  ownGoalsFor:0,penaltiesTaken:0,shots:0,shotsOnTarget:0,
  openPlayXgMilli:0,
});
const keys=['goalsAllTypes','openPlayGoals','penaltyGoals','ownGoalsFor',
  'penaltiesTaken','shots','shotsOnTarget','openPlayXgMilli'] as const;
type Editable={-readonly [K in keyof M1V160TeamMetrics]:M1V160TeamMetrics[K]};
function add(row:Editable,source:M1V7TeamReport):boolean{
  if(source.xgCoverage!=='open-play-only'||![
    source.goals,source.openPlayGoals,source.penaltyGoals,
    source.ownGoalsFor,source.penaltiesTaken,source.shots,
    source.shotsOnTarget,source.xgMilli,
  ].every(n=>Number.isSafeInteger(n)&&n>=0)||
     source.goals!==source.openPlayGoals+source.penaltyGoals+
       source.ownGoalsFor||
     source.penaltyGoals>source.penaltiesTaken||
     source.shotsOnTarget>source.shots||
     source.goals>source.shotsOnTarget+source.ownGoalsFor)return false;
  const values=[source.goals,source.openPlayGoals,source.penaltyGoals,
    source.ownGoalsFor,source.penaltiesTaken,source.shots,
    source.shotsOnTarget,source.xgMilli];
  for(let i=0;i<keys.length;i++){
    const key=keys[i]!;
    const updated=row[key]+values[i]!;
    if(!Number.isSafeInteger(updated))return false;
    row[key]=updated;
  }
  return true;
}
/** Revalidate the entire v120 source journal before reading any
 * event-derived statistic. Rates refer only to controlled-club
 * recorded fixtures; no real provider taxonomy or 240-match claim.
 */
export function deriveM1V160PlayableMetrics(
  initial:unknown,journal:unknown,
):M1V160Result{
  const verified=validateM1V120Journal(initial,journal);
  if(!verified.ok)return {ok:false,error:'INVALID_JOURNAL'};
  const row=verified.journal;
  const home=zero(),away=zero();
  let outcomeHomeWins=0,outcomeDraws=0,outcomeAwayWins=0,nilNilMatches=0;
  for(const entry of row.entries){
    const report=entry.result.report;
    if(report.fixtureId!==entry.fixtureId||
       !add(home,report.home)||!add(away,report.away))
      return {ok:false,error:'INCONSISTENT_METRIC'};
    if(report.home.goals>report.away.goals)outcomeHomeWins++;
    else if(report.home.goals<report.away.goals)outcomeAwayWins++;
    else outcomeDraws++;
    if(report.home.goals===0&&report.away.goals===0)nilNilMatches++;
  }
  const twoTeamTotal:Editable={...zero()};
  for(const key of keys)twoTeamTotal[key]=home[key]+away[key];
  if(!keys.every(key=>Number.isSafeInteger(twoTeamTotal[key]))||
      outcomeHomeWins+outcomeDraws+outcomeAwayWins!==row.revision)
    return {ok:false,error:'INCONSISTENT_METRIC'};
  return {ok:true,report:{
    schemaVersion:160,
    status:'PLAYABLE_SOURCE_REPLAYED_SELECTED_CLUB_COHORT_NOT_CALIBRATION',
    careerId:row.careerId,journalRevision:row.revision,
    matches:row.entries.length,outcomeHomeWins,outcomeDraws,
    outcomeAwayWins,nilNilMatches,home,away,twoTeamTotal,
    xgCoverage:'open-play-only',providerShotTaxonomyVerified:false,
    providerGoalsAllTypesComparable:false,
    cardsAndMedicalRatesComparable:false,fullLeagueFixtureCoverage:false,
    holdout2024_25Used:false,releaseCalibrationAccepted:false,
  }};
}
