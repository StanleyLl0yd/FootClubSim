import {sameCanonicalValue} from './canonical-value.js';
import {generateDoubleRoundRobin, type Fixture} from './fixtures.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {validateM1V32ExposureJournal,
  type M1V32JournalError, type M1V32AppliedFixture}
  from './m1-v32-causal-medical-journal.js';
import type {InitialCareerSave} from './save.js';

/**
 * In-game cards from replay-verified synthetic fixtures. Count yellow-card
 * OBSERVATIONS in different matches, never a legally confirmed ban.
 *
 * Real 2026/27 RPL eligibility is contingent on the authorized competition
 * rule, KDK sanctions, served games and their appeals/revocations. Neither
 * the sequence of this career's commits nor a synthetic round proves them.
 */
export const M1_V55_CAUTION_REVIEW_SCHEMA=1 as const;
export const M1_V55_CAUTION_REVIEW_RULES=
  'm1-v32-source-replayed-distinct-synthetic-match-caution-review' as const;
interface CautionFixture {
  readonly fixtureId:string;
  readonly round:number;
}
export interface M1V55CautionSignal {
  readonly fixtureId:string;
  readonly round:number;
  readonly postedRevision:number;
  readonly teamId:string;
  readonly playerId:string;
  readonly observedFirstYellowCards:1;
  /** The count of distinct synthetic fixtures, not a legal card tally. */
  readonly cumulativeDistinctCautionMatches:number;
  readonly secondYellowDismissalInSameFixture:boolean;
  readonly straightRedDismissalInSameFixture:boolean;
  /** Review trigger only. Not a suspension or proof of a new ban. */
  readonly fourthDistinctCautionReviewSignal:boolean;
  readonly nextSyntheticRoundFixtureId:string|null;
}
export interface M1V55CautionLaterListing {
  readonly teamId:string;
  readonly playerId:string;
  readonly observedFourthCautionFixtureId:string;
  readonly fixtureId:string;
  readonly round:number;
  readonly postedRevision:number;
  readonly listedInStartingXI:boolean;
  readonly listedInNamedBench:boolean;
  readonly physicalSeconds:number;
}
export type M1V55CautionReviewRun=
  | Readonly<{ok:false;error:M1V32JournalError|'SOURCE_INVARIANT_FAILED'}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V55_CAUTION_REVIEW_SCHEMA;
    rulesId:typeof M1_V55_CAUTION_REVIEW_RULES;
    status:'FOUR_DISTINCT_MODELLED_CAUTION_MATCHES_REVIEW_NOT_SANCTION';
    careerId:string;
    revision:number;
    fixtureCount:number;
    signals:readonly M1V55CautionSignal[];
    laterMatchdayListings:readonly M1V55CautionLaterListing[];
    fullSourceReplayVerified:true;
    countedBySyntheticRoundNotCommitOrder:true;
    fourCautionIsOnlyAReviewThreshold:true;
    externallyAuthenticatedRplDiscipline:false;
    servedMatchOrAppealStatusKnown:false;
    automaticEligibilityAllowed:false;
    calibratedDisciplineRate:false;
  }>;
type Entry=Readonly<{
  item:M1V32AppliedFixture;fixture:Fixture;postedRevision:number;
}>;
const cmp=(a:string,b:string):number=>a<b?-1:a>b?1:0;
const key=(club:string,player:string):string=>
  JSON.stringify([club,player]);

export function deriveM1V55CautionReview(
  initial:unknown,journal:unknown,
):M1V55CautionReviewRun {
  const checked=validateM1V32ExposureJournal(initial,journal);
  if(!checked.ok)return {ok:false,error:checked.error};
  const safe=checked.journal;
  const catalog=(initial as InitialCareerSave).catalog;
  const fixtures=generateDoubleRoundRobin(
    catalog.clubs.map(c=>c.id)).flatMap(r=>r.fixtures);
  const byTeam=new Map<string,CautionFixture[]>();
  for(const f of fixtures){
    for(const club of [f.homeClubId,f.awayClubId]){
      const list=byTeam.get(club)??[];
      list.push({fixtureId:f.id,round:f.round});
      byTeam.set(club,list);
    }
  }
  const ordered:Entry[]=safe.results.map((item,index)=>({
    item,fixture:item.source.prematch.fixture as unknown as Fixture,
    postedRevision:index+1,
  })).sort((a,b)=>a.fixture.round-b.fixture.round ||
    cmp(a.fixture.id,b.fixture.id));
  const counts=new Map<string,number>();
  const latestFourth=new Map<string,Readonly<{fixtureId:string;round:number}>>();
  const signals:M1V55CautionSignal[]=[];
  const laterMatchdayListings:M1V55CautionLaterListing[]=[];
  for(const entry of ordered){
    const {item,fixture,postedRevision}=entry;
    const starters={
      home:new Set((item.source.prematch.homeLineup as {
        starters:readonly string[]}).starters),
      away:new Set((item.source.prematch.awayLineup as {
        starters:readonly string[]}).starters),
    };
    const bench={
      home:new Set((item.source.prematch.homeLineup as {
        bench:readonly string[]}).bench),
      away:new Set((item.source.prematch.awayLineup as {
        bench:readonly string[]}).bench),
    };
    // Matchday lists include unused named substitutes. Physical exposure
    // rows alone cannot prove that an unused player was not named.
    for(const side of ['home','away'] as const){
      const teamId=side==='home'?fixture.homeClubId:fixture.awayClubId;
      const named=[...starters[side],...bench[side]];
      if(new Set(named).size!==named.length){
        return {ok:false,error:'SOURCE_INVARIANT_FAILED'};
      }
      for(const playerId of named){
        const last=latestFourth.get(key(teamId,playerId));
        if(!last||last.round>=fixture.round)continue;
        const source=item.facts.playerRows.find(row=>
          row.teamId===teamId&&row.playerId===playerId);
        laterMatchdayListings.push({
          teamId,playerId,
          observedFourthCautionFixtureId:last.fixtureId,
          fixtureId:fixture.id,round:fixture.round,postedRevision,
          listedInStartingXI:starters[side].has(playerId),
          listedInNamedBench:bench[side].has(playerId),
          physicalSeconds:source?.physicalSeconds??0,
        });
      }
    }
    for(const row of item.facts.playerRows){
      if(row.firstYellowCards===0)continue;
      if(row.firstYellowCards!==1)return {
        ok:false,error:'SOURCE_INVARIANT_FAILED',
      };
      const k=key(row.teamId,row.playerId);
      const count=(counts.get(k)??0)+1;
      counts.set(k,count);
      const review=count%4===0;
      const future=(byTeam.get(row.teamId)??[])
        .find(next=>next.round>fixture.round)?.fixtureId??null;
      signals.push({
        fixtureId:fixture.id,round:fixture.round,postedRevision,
        teamId:row.teamId,playerId:row.playerId,
        observedFirstYellowCards:1,
        cumulativeDistinctCautionMatches:count,
        secondYellowDismissalInSameFixture:row.secondYellowDismissals>0,
        straightRedDismissalInSameFixture:row.straightRedDismissals>0,
        fourthDistinctCautionReviewSignal:review,
        nextSyntheticRoundFixtureId:future,
      });
      if(review)latestFourth.set(k,{
        fixtureId:fixture.id,round:fixture.round,
      });
    }
  }
  return {
    ok:true,schemaVersion:M1_V55_CAUTION_REVIEW_SCHEMA,
    rulesId:M1_V55_CAUTION_REVIEW_RULES,
    status:'FOUR_DISTINCT_MODELLED_CAUTION_MATCHES_REVIEW_NOT_SANCTION',
    careerId:safe.careerId,revision:safe.revision,
    fixtureCount:safe.results.length,signals,laterMatchdayListings,
    fullSourceReplayVerified:true,
    countedBySyntheticRoundNotCommitOrder:true,
    fourCautionIsOnlyAReviewThreshold:true,
    externallyAuthenticatedRplDiscipline:false,
    servedMatchOrAppealStatusKnown:false,
    automaticEligibilityAllowed:false,
    calibratedDisciplineRate:false,
  };
}
export function verifyM1V55CautionReview(
  initial:unknown,journal:unknown,candidate:unknown,
):boolean {
  if(!isPlainJsonTree(candidate))return false;
  const replay=deriveM1V55CautionReview(initial,journal);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
