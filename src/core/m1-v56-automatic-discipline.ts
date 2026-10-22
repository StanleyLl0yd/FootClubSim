import {sameCanonicalValue} from './canonical-value.js';
import {generateDoubleRoundRobin} from './fixtures.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {startM1Clock, type M1PrematchInput} from './m1-clock.js';
import {validateM1V32ExposureJournal}
  from './m1-v32-causal-medical-journal.js';
import type {InitialCareerSave} from './save.js';

/**
 * Automatic in-game ONE-FIXTURE bans only, from a fully replayed fictional
 * league's own historical first-yellow and second-yellow events.
 *
 * This is NOT an import of RFU/KDK sanctions, not verified served matches
 * of real RPL players and not authority for straight-red durations.
 */
export const M1_V56_AUTOMATIC_DISCIPLINE_SCHEMA=1 as const;
export const M1_V56_AUTOMATIC_DISCIPLINE_RULES=
  'rpl-2026-27-synthetic-four-simple-cautions-and-second-yellow-v1' as const;
export type M1V56AutomaticBanReason=
  'four-distinct-simple-cautions'|'second-yellow-dismissal';
export interface M1V56AutomaticBan {
  readonly clubId:string;
  readonly playerId:string;
  readonly causedByFixtureId:string;
  readonly causedByRound:number;
  readonly reason:M1V56AutomaticBanReason;
}
export type M1V56DisciplineGateError=
  'INVALID_INITIAL_OR_JOURNAL'|'INVALID_PREMATCH'|
  'UNRELATED_CLUB'|'ALREADY_COMMITTED_FIXTURE'|
  'PRIOR_CLUB_MATCHES_MISSING'|'HISTORICAL_AUTO_BAN_CONFLICT'|
  'UNRESOLVED_DIRECT_RED_KDK'|'CURRENT_LINEUP_BLOCKED'|
  'SOURCE_INVARIANT_FAILED';
export type M1V56DisciplineGateRun=
  | Readonly<{ok:false;error:M1V56DisciplineGateError;
    missingFixtureIds?:readonly string[];
    affectedFixtureId?:string;
    affectedPlayerIds?:readonly string[]}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V56_AUTOMATIC_DISCIPLINE_SCHEMA;
    rulesId:typeof M1_V56_AUTOMATIC_DISCIPLINE_RULES;
    status:'MODELLED_AUTOMATIC_BANS_CONTROLLED_CLUB_ONLY';
    clubId:string;
    fixtureId:string;
    careerId:string;
    journalRevision:number;
    verifiedPriorClubFixtures:number;
    automaticBans:readonly M1V56AutomaticBan[];
    currentNamedLineupClearOfAutomaticBans:true;
    fullSourceReplayVerified:true;
    syntheticRoundNotRealCalendar:true;
    opponentEligibilityChecked:false;
    realRplSanctionOrKdkAuthorityAuthenticated:false;
    resolvedStraightRedOrAppealAuthority:false;
    medicalFitnessVerified:false;
    seasonRealismCalibrated:false;
  }>;
type State={
  cautions:number;
  pending:M1V56AutomaticBan|null;
  unresolvedDirectRedSource:string|null;
};
const fail=(error:M1V56DisciplineGateError,
  fields:Readonly<Record<string,unknown>>={}):M1V56DisciplineGateRun=>
  ({ok:false,error,...fields});
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;

export function admitM1V56ModelledAutomaticDiscipline(
  initial:unknown,journal:unknown,prematch:unknown,clubId:unknown,
):M1V56DisciplineGateRun{
  const checked=validateM1V32ExposureJournal(initial,journal);
  if(!checked.ok)return fail('INVALID_INITIAL_OR_JOURNAL');
  if(!isPlainJsonTree(prematch) || prematch===null ||
      typeof prematch!=='object'||Array.isArray(prematch)) {
    return fail('INVALID_PREMATCH');
  }
  const pre=startM1Clock(prematch);
  if(!pre.ok ||
      !sameCanonicalValue((initial as InitialCareerSave).catalog,
        (prematch as M1PrematchInput).catalog))return fail('INVALID_PREMATCH');
  const input=prematch as M1PrematchInput;
  const fixture=input.fixture;
  if(clubId!==fixture.homeClubId&&clubId!==fixture.awayClubId) {
    return fail('UNRELATED_CLUB');
  }
  const teamId=clubId as string;
  const games=generateDoubleRoundRobin(
    input.catalog.clubs.map(x=>x.id)).flatMap(x=>x.fixtures);
  const current=games.find(x=>x.id===fixture.id);
  if(!current || !sameCanonicalValue(fixture,current)) {
    return fail('INVALID_PREMATCH');
  }
  const teamSchedule=games.filter(x=>x.homeClubId===teamId||
    x.awayClubId===teamId).sort((a,b)=>a.round-b.round);
  const completed=new Map(checked.journal.results.map(x=>[
    x.fixtureId,x,
  ]));
  if(completed.has(fixture.id))return fail('ALREADY_COMMITTED_FIXTURE');
  const previous=teamSchedule.filter(x=>x.round<fixture.round);
  const missing=previous.filter(x=>!completed.has(x.id));
  if(missing.length) return fail('PRIOR_CLUB_MATCHES_MISSING',{
    missingFixtureIds:missing.map(x=>x.id),
  });
  const futurePosted=teamSchedule.find(x=>
    x.round>fixture.round&&completed.has(x.id));
  if(futurePosted)return fail('SOURCE_INVARIANT_FAILED');
  const players=new Map<string,State>();
  const get=(playerId:string):State=>{
    let state=players.get(playerId);
    if(!state){
      state={cautions:0,pending:null,unresolvedDirectRedSource:null};
      players.set(playerId,state);
    }
    return state;
  };
  for(const played of previous){
    const match=completed.get(played.id)!;
    const home=match.source.prematch.homeLineup as {
      starters:readonly string[];bench:readonly string[]};
    const away=match.source.prematch.awayLineup as {
      starters:readonly string[];bench:readonly string[]};
    const lineup=(played.homeClubId===teamId?home:away);
    const named=new Set([...lineup.starters,...lineup.bench]);
    // A one-match ban is served only by the next completely recorded
    // match of this synthetic club, not the next global journal revision.
    for(const [id,state] of players){
      if(state.pending){
        if(named.has(id))return fail('HISTORICAL_AUTO_BAN_CONFLICT',{
          affectedFixtureId:played.id,affectedPlayerIds:[id],
        });
        state.pending=null;
      }
    }
    for(const row of match.facts.playerRows){
      if(row.teamId!==teamId)continue;
      if(row.firstYellowCards>1||row.secondYellowDismissals>1||
          row.straightRedDismissals>1){
        return fail('SOURCE_INVARIANT_FAILED');
      }
      if(row.firstYellowCards===0&&
          row.secondYellowDismissals===0&&row.straightRedDismissals===0){
        continue;
      }
      const state=get(row.playerId);
      if(row.straightRedDismissals>0){
        // The RFU/KDK may issue multiple or conditional matches,
        // appeals or revocations. Never fabricate a 1-game duration.
        state.unresolvedDirectRedSource=played.id;
      }
      if(row.secondYellowDismissals>0){
        state.pending={
          clubId:teamId,playerId:row.playerId,
          causedByFixtureId:played.id,causedByRound:played.round,
          reason:'second-yellow-dismissal',
        };
      }else if(row.straightRedDismissals===0&&row.firstYellowCards===1){
        state.cautions++;
        if(state.cautions%4===0){
          state.pending={
            clubId:teamId,playerId:row.playerId,
            causedByFixtureId:played.id,causedByRound:played.round,
            reason:'four-distinct-simple-cautions',
          };
        }
      }
    }
  }
  const unresolved=[...players.entries()]
    .filter(([,x])=>x.unresolvedDirectRedSource!==null)
    .map(([id])=>id).sort(cmp);
  if(unresolved.length)return fail('UNRESOLVED_DIRECT_RED_KDK',{
    affectedPlayerIds:unresolved,
  });
  const bans=[...players.values()].flatMap(s=>
    s.pending?[s.pending]:[]).sort((a,b)=>cmp(a.playerId,b.playerId));
  const side=fixture.homeClubId===teamId?'home':'away';
  const lineup=side==='home'?input.homeLineup:input.awayLineup;
  const named=new Set([...lineup.starters,...lineup.bench]);
  const blocked=bans.filter(x=>named.has(x.playerId))
    .map(x=>x.playerId);
  if(blocked.length)return fail('CURRENT_LINEUP_BLOCKED',{
    affectedFixtureId:fixture.id,affectedPlayerIds:blocked,
  });
  return {
    ok:true,schemaVersion:M1_V56_AUTOMATIC_DISCIPLINE_SCHEMA,
    rulesId:M1_V56_AUTOMATIC_DISCIPLINE_RULES,
    status:'MODELLED_AUTOMATIC_BANS_CONTROLLED_CLUB_ONLY',
    clubId:teamId,fixtureId:fixture.id,careerId:checked.journal.careerId,
    journalRevision:checked.journal.revision,
    verifiedPriorClubFixtures:previous.length,automaticBans:bans,
    currentNamedLineupClearOfAutomaticBans:true,
    fullSourceReplayVerified:true,syntheticRoundNotRealCalendar:true,
    opponentEligibilityChecked:false,
    realRplSanctionOrKdkAuthorityAuthenticated:false,
    resolvedStraightRedOrAppealAuthority:false,
    medicalFitnessVerified:false,seasonRealismCalibrated:false,
  };
}
