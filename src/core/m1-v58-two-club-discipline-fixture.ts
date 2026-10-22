import {sameCanonicalValue} from './canonical-value.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {type M1PrematchInput} from './m1-clock.js';
import {admitM1V56ModelledAutomaticDiscipline,
  type M1V56DisciplineGateRun} from './m1-v56-automatic-discipline.js';
import {deriveM1V31CausalPhysicalExposure,
  type M1V31CausalExposureRun} from './m1-v24-physical-exposure.js';

/**
 * Opt-in, READ-ONLY playable-fixture preflight. Fully replay all prior
 * synthetic fixtures for BOTH clubs before simulating the current fixture.
 * Never mistake automatic-modelled sanctions for authentic KDK clearance.
 */
export const M1_V58_TWO_CLUB_DISCIPLINE_GATE_SCHEMA=1 as const;
export const M1_V58_TWO_CLUB_DISCIPLINE_GATE_RULES=
  'm1-v58-two-club-source-replayed-automatic-card-match-gate' as const;
type AcceptedAdmission=Extract<M1V56DisciplineGateRun,{ok:true}>;
type AcceptedMatch=Extract<M1V31CausalExposureRun,{ok:true}>;
export type M1V58TwoClubGatedFixtureRun=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'HOME_DISCIPLINE_DENIED'|
    'AWAY_DISCIPLINE_DENIED'|'SOURCE_MATCH_REJECTED';
    gateError?:Extract<M1V56DisciplineGateRun,{ok:false}>['error'];
    affectedFixtureId?:string;
    missingFixtureIds?:readonly string[];
    affectedPlayerIds?:readonly string[];
    sourceError?:Extract<M1V31CausalExposureRun,{ok:false}>['error']}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V58_TWO_CLUB_DISCIPLINE_GATE_SCHEMA;
    rulesId:typeof M1_V58_TWO_CLUB_DISCIPLINE_GATE_RULES;
    status:'MODELLED_BOTH_CLUBS_PASSED_SOURCE_REPLAYED_DISCIPLINE';
    fixtureId:string;
    home:AcceptedAdmission;
    away:AcceptedAdmission;
    match:AcceptedMatch;
    fullReplayVerified:true;
    sameJournalForBothClubs:true;
    syntheticScheduleNotOfficialCalendar:true;
    realWorldKdkAuthenticated:false;
    medicalFitnessAuthenticated:false;
    refereeSourceAuthenticated:false;
    calibrationPassed:false;
  }>;

export function simulateM1V58TwoClubDisciplineGatedFixture(
  initial:unknown,journal:unknown,prematch:unknown,policy:unknown,
  halfTimeCommands:unknown=[],inPlayCommands:unknown=[],
):M1V58TwoClubGatedFixtureRun {
  if(!isPlainJsonTree(initial)||!isPlainJsonTree(journal)||
      !isPlainJsonTree(prematch)||!isPlainJsonTree(policy)||
      !isPlainJsonTree(halfTimeCommands)||
      !isPlainJsonTree(inPlayCommands)||
      prematch===null||typeof prematch!=='object'||
      Array.isArray(prematch)||!Array.isArray(halfTimeCommands)||
      !Array.isArray(inPlayCommands)) {
    return {ok:false,error:'INVALID_INPUT'};
  }
  // The complete source journal and original M0 catalog are checked inside
  // the v56 admissibility function, not caller-supplied identity claims.
  const input=prematch as M1PrematchInput;
  const home=admitM1V56ModelledAutomaticDiscipline(
    initial,journal,prematch,input.fixture?.homeClubId);
  if(!home.ok) {
    return {
      ok:false,error:'HOME_DISCIPLINE_DENIED',gateError:home.error,
      ...('affectedFixtureId' in home ? {
        affectedFixtureId:home.affectedFixtureId,
      } : {}),
      ...('missingFixtureIds' in home ? {
        missingFixtureIds:home.missingFixtureIds,
      } : {}),
      ...('affectedPlayerIds' in home ? {
        affectedPlayerIds:home.affectedPlayerIds,
      } : {}),
    };
  }
  const away=admitM1V56ModelledAutomaticDiscipline(
    initial,journal,prematch,input.fixture.awayClubId);
  if(!away.ok){
    return {
      ok:false,error:'AWAY_DISCIPLINE_DENIED',gateError:away.error,
      ...('affectedFixtureId' in away ? {
        affectedFixtureId:away.affectedFixtureId,
      } : {}),
      ...('missingFixtureIds' in away ? {
        missingFixtureIds:away.missingFixtureIds,
      } : {}),
      ...('affectedPlayerIds' in away ? {
        affectedPlayerIds:away.affectedPlayerIds,
      } : {}),
    };
  }
  // Source gameplay executes only after BOTH clubs are admitted.
  const result=deriveM1V31CausalPhysicalExposure(
    prematch,policy,halfTimeCommands,inPlayCommands);
  if(!result.ok){
    return {ok:false,error:'SOURCE_MATCH_REJECTED',
      sourceError:result.error};
  }
  return {
    ok:true,schemaVersion:M1_V58_TWO_CLUB_DISCIPLINE_GATE_SCHEMA,
    rulesId:M1_V58_TWO_CLUB_DISCIPLINE_GATE_RULES,
    status:'MODELLED_BOTH_CLUBS_PASSED_SOURCE_REPLAYED_DISCIPLINE',
    fixtureId:input.fixture.id,home,away,match:result,
    fullReplayVerified:true,sameJournalForBothClubs:true,
    syntheticScheduleNotOfficialCalendar:true,
    realWorldKdkAuthenticated:false,medicalFitnessAuthenticated:false,
    refereeSourceAuthenticated:false,calibrationPassed:false,
  };
}
export function verifyM1V58TwoClubDisciplineGatedFixture(
  initial:unknown,journal:unknown,prematch:unknown,policy:unknown,
  halfTimeCommands:unknown,inPlayCommands:unknown,candidate:unknown,
):boolean {
  if(!isPlainJsonTree(candidate))return false;
  const replay=simulateM1V58TwoClubDisciplineGatedFixture(
    initial,journal,prematch,policy,halfTimeCommands,inPlayCommands);
  return replay.ok&&sameCanonicalValue(replay,candidate);
}
