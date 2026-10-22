import { sameCanonicalValue } from './canonical-value.js';
import type { Fixture } from './fixtures.js';
import { validateM1V32ExposureJournal,
  type M1V32JournalError, type M1V32AppliedFixture }
  from './m1-v32-causal-medical-journal.js';
import { isPlainJsonTree } from './plain-json-tree.js';

/**
 * A round-ordered review of modelled withdrawals/dismissals and subsequent
 * physical appearances. None of these facts establishes a clinical
 * diagnosis, a league suspension, a clearance or legal match eligibility.
 */
export const M1_V34_REVIEW_SCHEMA = 1 as const;
export const M1_V34_REVIEW_RULES =
  'm1-v32-replayed-round-ordered-medical-disciplinary-review' as const;

export interface M1V34ReviewSignal {
  readonly teamId: string;
  readonly playerId: string;
  readonly fixtureId: string;
  /** Synthetic round, not an authenticated calendar date. */
  readonly round: number;
  readonly postedRevision: number;
  readonly permanentInjuryWithdrawals: number;
  readonly secondYellowDismissals: number;
  readonly straightRedDismissals: number;
}

export interface M1V34LaterPhysicalAppearance {
  readonly teamId: string;
  readonly playerId: string;
  readonly fixtureId: string;
  readonly round: number;
  readonly postedRevision: number;
  readonly physicalSeconds: number;
  /** Most recent EARLIER synthetic round with matching model evidence. */
  readonly afterWithdrawalFixtureId: string | null;
  readonly afterDismissalFixtureId: string | null;
}
export type M1V34ReviewRun =
  | Readonly<{ok:false;error:M1V32JournalError}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V34_REVIEW_SCHEMA;
    rulesId:typeof M1_V34_REVIEW_RULES;
    careerId:string;
    revision:number;
    fixtureCount:number;
    signals:readonly M1V34ReviewSignal[];
    laterPhysicalAppearances:readonly M1V34LaterPhysicalAppearance[];
    status:'MODEL_EVIDENCE_FOR_REVIEW_NOT_LEGAL_ELIGIBILITY';
    fullSourceReplayVerified:true;
    syntheticRoundOrderVerified:true;
    officialCalendarAuthenticated:false;
    medicalDiagnosisOrClearanceAuthenticated:false;
    disciplinarySanctionsAuthenticated:false;
    playerEligibilityVerified:false;
    fatigueCalibrated:false;
  }>;
type Entry = Readonly<{
  item:M1V32AppliedFixture;
  fixture:Fixture;
  postedRevision:number;
}>;
type Ref = Readonly<{fixtureId:string;round:number}>;
const cmp = (a:string,b:string):number => a < b ? -1 : a > b ? 1 : 0;
const key = (teamId:string,playerId:string):string =>
  JSON.stringify([teamId,playerId]);

export function deriveM1V34CrossFixtureReview(
  initialCareer:unknown,journalCandidate:unknown,
):M1V34ReviewRun {
  const verified=validateM1V32ExposureJournal(initialCareer,journalCandidate);
  if(!verified.ok)return {ok:false,error:verified.error};
  const journal=verified.journal;
  // v32 already canonical-fixture-verifies every prematch, including round.
  const ordered:Entry[]=journal.results.map((item,index)=>({
    item,fixture:item.source.prematch.fixture as unknown as Fixture,
    postedRevision:index+1,
  })).sort((a,b)=>a.fixture.round-b.fixture.round ||
    cmp(a.fixture.id,b.fixture.id));
  const withdrawal=new Map<string,Ref>();
  const dismissal=new Map<string,Ref>();
  const signals:M1V34ReviewSignal[]=[];
  const laterPhysicalAppearances:M1V34LaterPhysicalAppearance[]=[];
  for(const {item,fixture,postedRevision} of ordered){
    // Process earlier-round observations BEFORE recording this fixture's
    // signals: an injury/dismissal never triggers a same-match 'return'.
    for(const row of item.facts.playerRows){
      if(row.physicalSeconds<=0)continue;
      const identity=key(row.teamId,row.playerId);
      const medical=withdrawal.get(identity);
      const disciplinary=dismissal.get(identity);
      const afterWithdrawalFixtureId=medical && medical.round<fixture.round ?
        medical.fixtureId:null;
      const afterDismissalFixtureId=
        disciplinary && disciplinary.round<fixture.round ?
          disciplinary.fixtureId:null;
      if(afterWithdrawalFixtureId!==null ||
          afterDismissalFixtureId!==null){
        laterPhysicalAppearances.push({
          teamId:row.teamId,playerId:row.playerId,
          fixtureId:fixture.id,round:fixture.round,postedRevision,
          physicalSeconds:row.physicalSeconds,
          afterWithdrawalFixtureId,afterDismissalFixtureId,
        });
      }
    }
    for(const row of item.facts.playerRows){
      if(row.permanentInjuryWithdrawals===0 &&
          row.secondYellowDismissals===0 &&
          row.straightRedDismissals===0)continue;
      const identity=key(row.teamId,row.playerId);
      const ref={fixtureId:fixture.id,round:fixture.round};
      if(row.permanentInjuryWithdrawals>0)withdrawal.set(identity,ref);
      if(row.secondYellowDismissals>0 ||
          row.straightRedDismissals>0)dismissal.set(identity,ref);
      signals.push({
        teamId:row.teamId,playerId:row.playerId,
        fixtureId:fixture.id,round:fixture.round,postedRevision,
        permanentInjuryWithdrawals:row.permanentInjuryWithdrawals,
        secondYellowDismissals:row.secondYellowDismissals,
        straightRedDismissals:row.straightRedDismissals,
      });
    }
  }
  return {
    ok:true,schemaVersion:M1_V34_REVIEW_SCHEMA,
    rulesId:M1_V34_REVIEW_RULES,careerId:journal.careerId,
    revision:journal.revision,fixtureCount:journal.results.length,
    signals,laterPhysicalAppearances,
    status:'MODEL_EVIDENCE_FOR_REVIEW_NOT_LEGAL_ELIGIBILITY',
    fullSourceReplayVerified:true,syntheticRoundOrderVerified:true,
    officialCalendarAuthenticated:false,
    medicalDiagnosisOrClearanceAuthenticated:false,
    disciplinarySanctionsAuthenticated:false,
    playerEligibilityVerified:false,fatigueCalibrated:false,
  };
}
export function verifyM1V34CrossFixtureReview(
  initialCareer:unknown,journalCandidate:unknown,candidate:unknown,
):boolean {
  if(!isPlainJsonTree(candidate))return false;
  const replay=deriveM1V34CrossFixtureReview(
    initialCareer,journalCandidate);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
