import {sameCanonicalValue} from './canonical-value.js';
import {generateDoubleRoundRobin} from './fixtures.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {startM1Clock, type M1PrematchInput} from './m1-clock.js';
import {validateM1V32ExposureJournal} from './m1-v32-causal-medical-journal.js';
import {simulateM1V58TwoClubDisciplineGatedFixture,
  type M1V58TwoClubGatedFixtureRun}
  from './m1-v58-two-club-discipline-fixture.js';
import type {InitialCareerSave} from './save.js';

/**
 * An unresolved, fully source-replayed *modelled withdrawal* is not a
 * clinical injury diagnosis. Without a trusted recovery protocol, the
 * withdrawn player may NOT be named in later synthetic XI OR bench.
 * This opt-in admission runs BEFORE v58 executes a new match.
 */
export const M1_V63_MEDICAL_HOLD_SCHEMA=1 as const;
export const M1_V63_MEDICAL_HOLD_RULES=
  'm1-v63-unresolved-modelled-withdrawal-before-both-club-match' as const;
export interface M1V63PendingMedicalHold {
  readonly teamId:string;
  readonly playerId:string;
  readonly sourceFixtureId:string;
  readonly sourceRound:number;
  readonly evidence:'source-replayed-permanent-injury-withdrawal';
}
type GoodMatch=Extract<M1V58TwoClubGatedFixtureRun,{ok:true}>;
export type M1V63MedicalHoldRun=
  | Readonly<{ok:false;error:
    'INVALID_INPUT'|'INVALID_INITIAL_OR_JOURNAL'|
    'INVALID_PREMATCH'|'HISTORICAL_UNRESOLVED_MEDICAL_CONFLICT'|
    'CURRENT_MODELLED_MEDICAL_HOLD'|'DISCIPLINE_OR_MATCH_DENIED';
    affectedFixtureId?:string;
    affectedTeamId?:string;
    affectedPlayerIds?:readonly string[];
    underlyingError?:Extract<M1V58TwoClubGatedFixtureRun,{ok:false}>['error']}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V63_MEDICAL_HOLD_SCHEMA;
    rulesId:typeof M1_V63_MEDICAL_HOLD_RULES;
    status:'BOTH_CLUBS_CLEAR_OF_MODELLED_UNRESOLVED_WITHDRAWALS';
    fixtureId:string;
    careerId:string;
    journalRevision:number;
    pendingMedicalHolds:readonly M1V63PendingMedicalHold[];
    result:GoodMatch;
    sourceCareerFullyReplayed:true;
    originalM0CatalogVerified:true;
    bothCurrentNamedLineupsChecked:true;
    officialInjuryDiagnosesAuthenticated:false;
    actualRecoveryOrFitnessVerified:false;
    medicalClearanceProtocolImplemented:false;
    clinicalInjuryRatesCalibrated:false;
    changesPersisted:false;
  }>;
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
const fail=(error:Extract<M1V63MedicalHoldRun,{ok:false}>['error'],
  extras:Readonly<Record<string,unknown>>={}):M1V63MedicalHoldRun=>
  ({ok:false,error,...extras});

export function simulateM1V63UnresolvedMedicalHoldFixture(
  initial:unknown,journal:unknown,prematch:unknown,policy:unknown,
  halfTimeCommands:unknown=[],inPlayCommands:unknown=[],
):M1V63MedicalHoldRun {
  if(!isPlainJsonTree(initial)||!isPlainJsonTree(journal)||
      !isPlainJsonTree(prematch)||prematch===null||
      typeof prematch!=='object'||Array.isArray(prematch)||
      !isPlainJsonTree(policy)||
      !isPlainJsonTree(halfTimeCommands)||
      !isPlainJsonTree(inPlayCommands)||
      !Array.isArray(halfTimeCommands)||
      !Array.isArray(inPlayCommands))return fail('INVALID_INPUT');
  const checked=validateM1V32ExposureJournal(initial,journal);
  if(!checked.ok)return fail('INVALID_INITIAL_OR_JOURNAL');
  const prematchGate=startM1Clock(prematch);
  if(!prematchGate.ok||
      !sameCanonicalValue((initial as InitialCareerSave).catalog,
        (prematch as M1PrematchInput).catalog))return fail('INVALID_PREMATCH');
  const input=prematch as M1PrematchInput;
  const clubs=new Set([input.fixture.homeClubId,input.fixture.awayClubId]);
  const fixtures=generateDoubleRoundRobin(input.catalog.clubs.map(c=>c.id))
    .flatMap(x=>x.fixtures);
  const index=new Map(fixtures.map(f=>[f.id,f]));
  const actual=index.get(input.fixture.id);
  if(!actual||!sameCanonicalValue(actual,input.fixture)) {
    return fail('INVALID_PREMATCH');
  }
  const history=[...checked.journal.results]
    .map(m=>({match:m,fixture:index.get(m.fixtureId)!}))
    .filter(x=>x.fixture.round<input.fixture.round &&
      (clubs.has(x.fixture.homeClubId)||clubs.has(x.fixture.awayClubId)))
    .sort((a,b)=>a.fixture.round-b.fixture.round||
      cmp(a.fixture.id,b.fixture.id));
  const medical=new Map<string,M1V63PendingMedicalHold>();
  const key=(team:string,player:string)=>JSON.stringify([team,player]);
  for(const {match,fixture} of history){
    for(const teamId of [fixture.homeClubId,fixture.awayClubId]){
      if(!clubs.has(teamId))continue;
      const sourceLineup=teamId===fixture.homeClubId?
        match.source.prematch.homeLineup as {
          starters:readonly string[];bench:readonly string[]}:
        match.source.prematch.awayLineup as {
          starters:readonly string[];bench:readonly string[]};
      const named=new Set([...sourceLineup.starters,...sourceLineup.bench]);
      for(const hold of medical.values()){
        if(hold.teamId===teamId&&named.has(hold.playerId)){
          return fail('HISTORICAL_UNRESOLVED_MEDICAL_CONFLICT',{
            affectedFixtureId:fixture.id,affectedTeamId:teamId,
            affectedPlayerIds:[hold.playerId],
          });
        }
      }
      for(const row of match.facts.playerRows){
        if(row.teamId!==teamId||row.permanentInjuryWithdrawals===0)continue;
        if(row.permanentInjuryWithdrawals!==1){
          return fail('INVALID_INITIAL_OR_JOURNAL');
        }
        medical.set(key(teamId,row.playerId),{
          teamId,playerId:row.playerId,sourceFixtureId:fixture.id,
          sourceRound:fixture.round,
          evidence:'source-replayed-permanent-injury-withdrawal',
        });
      }
    }
  }
  const holds=[...medical.values()].sort((a,b)=>
    cmp(a.teamId,b.teamId)||cmp(a.playerId,b.playerId));
  for(const teamId of [input.fixture.homeClubId,input.fixture.awayClubId]){
    const lineup=teamId===input.fixture.homeClubId?
      input.homeLineup:input.awayLineup;
    const named=new Set([...lineup.starters,...lineup.bench]);
    const blocked=holds.filter(h=>h.teamId===teamId&&named.has(h.playerId))
      .map(h=>h.playerId);
    if(blocked.length)return fail('CURRENT_MODELLED_MEDICAL_HOLD',{
      affectedFixtureId:input.fixture.id,affectedTeamId:teamId,
      affectedPlayerIds:blocked,
    });
  }
  // Only now generate a match. The pre-existing v58 discipline gate still
  // checks both clubs' complete prior fixtures, sanctions and full replay.
  const result=simulateM1V58TwoClubDisciplineGatedFixture(
    initial,journal,prematch,policy,halfTimeCommands,inPlayCommands);
  if(!result.ok)return fail('DISCIPLINE_OR_MATCH_DENIED',{
    underlyingError:result.error,
  });
  return {
    ok:true,schemaVersion:M1_V63_MEDICAL_HOLD_SCHEMA,
    rulesId:M1_V63_MEDICAL_HOLD_RULES,
    status:'BOTH_CLUBS_CLEAR_OF_MODELLED_UNRESOLVED_WITHDRAWALS',
    fixtureId:input.fixture.id,careerId:checked.journal.careerId,
    journalRevision:checked.journal.revision,
    pendingMedicalHolds:holds,result,
    sourceCareerFullyReplayed:true,originalM0CatalogVerified:true,
    bothCurrentNamedLineupsChecked:true,
    officialInjuryDiagnosesAuthenticated:false,
    actualRecoveryOrFitnessVerified:false,
    medicalClearanceProtocolImplemented:false,
    clinicalInjuryRatesCalibrated:false,changesPersisted:false,
  };
}
export function verifyM1V63UnresolvedMedicalHoldFixture(
  initial:unknown,journal:unknown,prematch:unknown,policy:unknown,
  halfTimeCommands:unknown,inPlayCommands:unknown,candidate:unknown,
):boolean {
  if(!isPlainJsonTree(candidate))return false;
  const replay=simulateM1V63UnresolvedMedicalHoldFixture(
    initial,journal,prematch,policy,halfTimeCommands,inPlayCommands);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
