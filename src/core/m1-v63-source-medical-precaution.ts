import {sameCanonicalValue} from './canonical-value.js';
import {generateDoubleRoundRobin} from './fixtures.js';
import {startM1Clock,type M1PrematchInput} from './m1-clock.js';
import {validateM1V32ExposureJournal}
  from './m1-v32-causal-medical-journal.js';
import {admitM1V56ModelledAutomaticDiscipline}
  from './m1-v56-automatic-discipline.js';
import {simulateM1V58TwoClubDisciplineGatedFixture,
  type M1V58TwoClubGatedFixtureRun}
  from './m1-v58-two-club-discipline-fixture.js';
import {isPlainJsonTree} from './plain-json-tree.js';

/**
 * Experimental next-club-fixture precaution after a *modelled permanent
 * injury withdrawal* in fully source-replayed schema-6 history.
 * Not a diagnosis, KDK ruling, physician's clearance or clinical timeline.
 */
export const M1_V63_PRECAUTION_SCHEMA=1 as const;
export const M1_V63_PRECAUTION_RULES=
  'm1-modelled-injury-next-club-fixture-precaution-only' as const;
type Side='home'|'away';
export type M1V63PrecautionError=
  'INVALID_INPUT'|'INVALID_JOURNAL'|
  'HOME_DISCIPLINE_DENIED'|'AWAY_DISCIPLINE_DENIED'|
  'HOME_MODELLED_PRECAUTION'|'AWAY_MODELLED_PRECAUTION';
export type M1V63PrecautionGate =
  | Readonly<{ok:false;error:M1V63PrecautionError;
    affectedFixtureId?:string;affectedPlayerIds?:readonly string[];
    priorFixtureId?:string}>
  | Readonly<{
    ok:true;
    schemaVersion:typeof M1_V63_PRECAUTION_SCHEMA;
    rulesId:typeof M1_V63_PRECAUTION_RULES;
    status:'BOTH_CLUBS_SOURCE_REPLAYED_MODEL_PRECAUTION_ADMITTED';
    careerId:string;fixtureId:string;journalRevision:number;
    priorClubFixtures:Readonly<{home:string|null;away:string|null}>;
    affectedPriorWithdrawals:Readonly<{
      home:readonly string[];away:readonly string[]}>;
    fullJournalReplayVerified:true;
    syntheticRoundOrderOnly:true;
    noPriorFixtureModelledInjuryWithdrawnPlayerNamed:true;
    realWorldInjuryOrDiagnosisAuthenticated:false;
    actualClinicalFitnessEstablished:false;
    modelledPrecautionIsNotMedicalClearance:true;
    KdkSanctionsAuthenticated:false;
  }>;
const fail=(error:M1V63PrecautionError,
  extra:Readonly<Record<string,unknown>>={}):M1V63PrecautionGate=>
  ({ok:false,error,...extra});
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function admitM1V63SourceMedicalPrecaution(
  initial:unknown,journal:unknown,prematch:unknown,
):M1V63PrecautionGate{
  if(!isPlainJsonTree(initial)||!isPlainJsonTree(journal)||
      !isPlainJsonTree(prematch)||prematch===null||
      typeof prematch!=='object'||Array.isArray(prematch)){
    return fail('INVALID_INPUT');
  }
  const started=startM1Clock(prematch);
  if(!started.ok)return fail('INVALID_INPUT');
  const checked=validateM1V32ExposureJournal(initial,journal);
  if(!checked.ok)return fail('INVALID_JOURNAL');
  const input=prematch as M1PrematchInput;
  const clubIds=[input.fixture.homeClubId,input.fixture.awayClubId];
  for(const [index,club] of clubIds.entries()){
    const gate=admitM1V56ModelledAutomaticDiscipline(
      initial,journal,prematch,club);
    if(!gate.ok){
      return fail(index===0?'HOME_DISCIPLINE_DENIED':
        'AWAY_DISCIPLINE_DENIED',
      'affectedFixtureId' in gate && gate.affectedFixtureId ?
        {affectedFixtureId:gate.affectedFixtureId}: {});
    }
  }
  const fixtures=generateDoubleRoundRobin(
    input.catalog.clubs.map(c=>c.id)).flatMap(round=>round.fixtures);
  const byId=new Map(checked.journal.results.map(row=>[row.fixtureId,row]));
  const predecessor:Record<Side,string|null>={home:null,away:null};
  const withdrawn:Record<Side,string[]>={home:[],away:[]};
  for(const side of ['home','away'] as const){
    const club=side==='home'?input.fixture.homeClubId:
      input.fixture.awayClubId;
    const prior=fixtures.filter(f=>
      f.round<input.fixture.round&&
      (f.homeClubId===club||f.awayClubId===club))
      .sort((a,b)=>b.round-a.round)[0];
    if(!prior)continue;
    const row=byId.get(prior.id);
    if(!row)return fail('INVALID_JOURNAL'); // v56 must prove all prior games
    predecessor[side]=prior.id;
    withdrawn[side]=[...new Set(row.facts.playerRows
      .filter(p=>p.teamId===club&&p.permanentInjuryWithdrawals>0)
      .map(p=>p.playerId))].sort(cmp);
    const lineup=side==='home'?input.homeLineup:input.awayLineup;
    const named=new Set([...lineup.starters,...lineup.bench]);
    const affected=withdrawn[side].filter(id=>named.has(id));
    if(affected.length)return fail(side==='home'?
      'HOME_MODELLED_PRECAUTION':'AWAY_MODELLED_PRECAUTION',{
      affectedFixtureId:input.fixture.id,
      affectedPlayerIds:affected,priorFixtureId:prior.id,
    });
  }
  return {
    ok:true,schemaVersion:M1_V63_PRECAUTION_SCHEMA,
    rulesId:M1_V63_PRECAUTION_RULES,
    status:'BOTH_CLUBS_SOURCE_REPLAYED_MODEL_PRECAUTION_ADMITTED',
    careerId:checked.journal.careerId,
    fixtureId:input.fixture.id,journalRevision:checked.journal.revision,
    priorClubFixtures:predecessor,affectedPriorWithdrawals:withdrawn,
    fullJournalReplayVerified:true,syntheticRoundOrderOnly:true,
    noPriorFixtureModelledInjuryWithdrawnPlayerNamed:true,
    realWorldInjuryOrDiagnosisAuthenticated:false,
    actualClinicalFitnessEstablished:false,
    modelledPrecautionIsNotMedicalClearance:true,
    KdkSanctionsAuthenticated:false,
  };
}
type Accepted=Extract<M1V63PrecautionGate,{ok:true}>;
type Game=Extract<M1V58TwoClubGatedFixtureRun,{ok:true}>;
export type M1V63GatedGame =
  | Readonly<{ok:false;error:M1V63PrecautionError|'SOURCE_MATCH_REJECTED';
    affectedPlayerIds?:readonly string[];priorFixtureId?:string}>
  | Readonly<{
    ok:true;schemaVersion:1;
    status:'SOURCE_GAME_AFTER_BOTH_CLUBS_MODEL_MEDICAL_PRECAUTION';
    gate:Accepted;game:Game;
    originalJournalUnchanged:true;
    clinicalClearanceNotEstablished:true;
    independentRealInjuryReferenceAbsent:true;
  }>;
export function simulateM1V63PrecautionGatedFixture(
  initial:unknown,journal:unknown,prematch:unknown,policy:unknown,
  halfTimeCommands:unknown=[],inPlayCommands:unknown=[],
):M1V63GatedGame {
  if(!isPlainJsonTree(policy)||!isPlainJsonTree(halfTimeCommands)||
      !isPlainJsonTree(inPlayCommands)||
      !Array.isArray(halfTimeCommands)||!Array.isArray(inPlayCommands)){
    return {ok:false,error:'INVALID_INPUT'};
  }
  const admitted=admitM1V63SourceMedicalPrecaution(
    initial,journal,prematch);
  if(!admitted.ok){
    return {ok:false,error:admitted.error,
      ...('affectedPlayerIds' in admitted?
        {affectedPlayerIds:admitted.affectedPlayerIds}:{}),
      ...('priorFixtureId' in admitted?
        {priorFixtureId:admitted.priorFixtureId}:{})};
  }
  const run=simulateM1V58TwoClubDisciplineGatedFixture(
    initial,journal,prematch,policy,halfTimeCommands,inPlayCommands);
  if(!run.ok)return {ok:false,error:'SOURCE_MATCH_REJECTED'};
  return {
    ok:true,schemaVersion:1,
    status:'SOURCE_GAME_AFTER_BOTH_CLUBS_MODEL_MEDICAL_PRECAUTION',
    gate:admitted,game:run,originalJournalUnchanged:true,
    clinicalClearanceNotEstablished:true,
    independentRealInjuryReferenceAbsent:true,
  };
}
export function verifyM1V63PrecautionGatedFixture(
  initial:unknown,journal:unknown,prematch:unknown,policy:unknown,
  halfTimeCommands:unknown,inPlayCommands:unknown,candidate:unknown,
):boolean{
  if(!isPlainJsonTree(candidate))return false;
  const verified=simulateM1V63PrecautionGatedFixture(
    initial,journal,prematch,policy,halfTimeCommands,inPlayCommands);
  return verified.ok&&sameCanonicalValue(verified,candidate);
}
