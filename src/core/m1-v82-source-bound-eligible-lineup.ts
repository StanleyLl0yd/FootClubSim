import {sameCanonicalValue} from './canonical-value.js';
import {generateDoubleRoundRobin} from './fixtures.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {validateLineup} from './validation.js';
import {validateM1V32ExposureJournal} from './m1-v32-causal-medical-journal.js';
import type {InitialCareerSave} from './save.js';
import type {Catalog,Club,MatchLineup,Player} from './model.js';

/**
 * Opt-in lineup *proposal*, not admission. Exclude ALL still-unresolved
 * source-replayed withdrawal participants from XI and bench. This does not
 * heal a real-world injury, clear a suspension or bypass the v76 CAS gate.
 */
export const M1_V82_LINEUP_PROPOSAL_SCHEMA=1 as const;
const RULES={starterCount:11,maxBench:12,maxForeignersOnField:7} as const;
export interface M1V82ExcludedMedicalPlayer{
  readonly teamId:string;
  readonly playerId:string;
  readonly sourceFixtureId:string;
  readonly sourceRound:number;
}
export type M1V82LineupProjection=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'INVALID_SOURCE_JOURNAL'|
      'UNKNOWN_OR_TAMPERED_FIXTURE'|'PRIOR_MEDICAL_CONFLICT'|
      'INSUFFICIENT_ELIGIBLE_REGISTERED_PLAYERS';
    affectedTeamId?:string;affectedPlayerIds?:readonly string[];
    affectedFixtureId?:string}>
  | Readonly<{
    ok:true;schemaVersion:typeof M1_V82_LINEUP_PROPOSAL_SCHEMA;
    status:'MODELLED_MEDICAL_HOLDS_EXCLUDED_NO_RECOVERY_AUTHENTICATION';
    fixtureId:string;journalRevision:number;
    homeLineup:MatchLineup;awayLineup:MatchLineup;
    excludedMedicalPlayers:readonly M1V82ExcludedMedicalPlayer[];
    originalJournalFullySourceReplayed:true;
    sourceRegistrationVerified:true;
    historicalMedicalConflictsRejected:true;
    modelledMedicalHoldsExcludedFromBenchAndXI:true;
    releaseLineupMedicalFitnessAuthenticated:false;
    realWorldRefereeOrKdkAuthorityAuthenticated:false;
    medicalRecoveryOrTreatmentGranted:false;
    persistentChangeMade:false;
    subsequentV76AdmissionStillRequired:true;
  }>;
const fail=(error:Extract<M1V82LineupProjection,{ok:false}>['error'],
  extra:Partial<Extract<M1V82LineupProjection,{ok:false}>>={}):
  M1V82LineupProjection=>({ok:false,error,...extra});
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const key=(team:string,player:string)=>JSON.stringify([team,player]);

function registeredEligibleLineup(
  club:Club,players:ReadonlyMap<string,Player>,medical:ReadonlySet<string>,
):MatchLineup|null{
  const available=club.registeredPlayerIds.filter(id=>
    !medical.has(key(club.id,id)));
  const keeper=available.find(id=>players.get(id)?.primaryPosition==='GK');
  if(!keeper)return null;
  // Keep registration order, favor domestic and field players; never invent
  // a player or silently name an unresolved modelled medical withdrawal.
  const field=available.filter(id=>players.get(id)?.primaryPosition!=='GK');
  const chosen=[keeper,...field.slice(0,10)];
  if(chosen.length!==11)return null;
  const selected=new Set(chosen);
  const result:MatchLineup={
    clubId:club.id,starters:chosen,
    bench:available.filter(id=>!selected.has(id)).slice(0,RULES.maxBench),
  };
  return validateLineup(result,club,players,RULES).length===0?result:null;
}

export function deriveM1V82SourceBoundAvailableLineups(
  initial:unknown,journal:unknown,fixture:unknown,
):M1V82LineupProjection{
  if(!isPlainJsonTree(initial)||!isPlainJsonTree(journal)||
      !isPlainJsonTree(fixture)||fixture===null||
      typeof fixture!=='object'||Array.isArray(fixture))
    return fail('INVALID_INPUT');
  const checked=validateM1V32ExposureJournal(initial,journal);
  if(!checked.ok)return fail('INVALID_SOURCE_JOURNAL');
  const original=initial as InitialCareerSave;
  const catalog:Catalog=original.catalog;
  const calendar=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id))
    .flatMap(round=>round.fixtures);
  const fixtureMap=new Map(calendar.map(item=>[item.id,item]));
  const namedId=(fixture as Record<string,unknown>).id;
  const current=typeof namedId==='string'?fixtureMap.get(namedId):null;
  if(!current||!sameCanonicalValue(current,fixture))
    return fail('UNKNOWN_OR_TAMPERED_FIXTURE');

  const selectedClubs=new Set([current.homeClubId,current.awayClubId]);
  const history=checked.journal.results
    .map(row=>({row,played:fixtureMap.get(row.fixtureId)!}))
    .filter(x=>x.played.round<current.round&&
      (selectedClubs.has(x.played.homeClubId)||
       selectedClubs.has(x.played.awayClubId)))
    .sort((a,b)=>a.played.round-b.played.round||
      compare(a.played.id,b.played.id));
  const medical=new Map<string,M1V82ExcludedMedicalPlayer>();
  for(const {row,played} of history){
    for(const teamId of [played.homeClubId,played.awayClubId]){
      if(!selectedClubs.has(teamId))continue;
      const lineup=teamId===played.homeClubId?
        row.source.prematch.homeLineup as {starters:readonly string[];bench:readonly string[]}:
        row.source.prematch.awayLineup as {starters:readonly string[];bench:readonly string[]};
      const named=new Set([...lineup.starters,...lineup.bench]);
      const conflicts=[...medical.values()].filter(h=>
        h.teamId===teamId&&named.has(h.playerId))
        .map(h=>h.playerId);
      if(conflicts.length)return fail('PRIOR_MEDICAL_CONFLICT',{
        affectedTeamId:teamId,affectedPlayerIds:conflicts.sort(compare),
        affectedFixtureId:played.id,
      });
      for(const player of row.facts.playerRows){
        if(player.teamId!==teamId||player.permanentInjuryWithdrawals===0)
          continue;
        if(player.permanentInjuryWithdrawals!==1)
          return fail('INVALID_SOURCE_JOURNAL');
        medical.set(key(teamId,player.playerId),{
          teamId,playerId:player.playerId,
          sourceFixtureId:played.id,sourceRound:played.round,
        });
      }
    }
  }
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const players=new Map(catalog.players.map(p=>[p.id,p]));
  const home=clubs.get(current.homeClubId),away=clubs.get(current.awayClubId);
  if(!home||!away)return fail('UNKNOWN_OR_TAMPERED_FIXTURE');
  const excluded=new Set(medical.keys());
  const homeLineup=registeredEligibleLineup(home,players,excluded);
  const awayLineup=registeredEligibleLineup(away,players,excluded);
  if(!homeLineup||!awayLineup){
    return fail('INSUFFICIENT_ELIGIBLE_REGISTERED_PLAYERS',{
      affectedTeamId:!homeLineup?home.id:away.id,
    });
  }
  return {
    ok:true,schemaVersion:M1_V82_LINEUP_PROPOSAL_SCHEMA,
    status:'MODELLED_MEDICAL_HOLDS_EXCLUDED_NO_RECOVERY_AUTHENTICATION',
    fixtureId:current.id,journalRevision:checked.journal.revision,
    homeLineup,awayLineup,
    excludedMedicalPlayers:[...medical.values()].sort((a,b)=>
      compare(a.teamId,b.teamId)||compare(a.playerId,b.playerId)),
    originalJournalFullySourceReplayed:true,
    sourceRegistrationVerified:true,
    historicalMedicalConflictsRejected:true,
    modelledMedicalHoldsExcludedFromBenchAndXI:true,
    releaseLineupMedicalFitnessAuthenticated:false,
    realWorldRefereeOrKdkAuthorityAuthenticated:false,
    medicalRecoveryOrTreatmentGranted:false,
    persistentChangeMade:false,
    subsequentV76AdmissionStillRequired:true,
  };
}
