import {isPlainJsonTree} from './plain-json-tree.js';
import {selectM1V96EligibleRegisteredLineup}
  from './m1-v96-cap-safe-lineup.js';
import {deriveM1V82SourceBoundAvailableLineups}
  from './m1-v82-source-bound-eligible-lineup.js';
import {admitM1V56ModelledAutomaticDiscipline,
  type M1V56DisciplineGateRun} from './m1-v56-automatic-discipline.js';
import type {M1PrematchInput} from './m1-clock.js';
import type {Catalog,Club,MatchLineup,Player} from './model.js';
import type {InitialCareerSave} from './save.js';

/** An opt-in lineup PROPOSAL. v76 admission/CAS remains mandatory. */
export const M1_V84_AUTO_BAN_LINEUP_SCHEMA=1 as const;
export type M1V84SafeLineupProposal=
  | Readonly<{ok:false;error:'INVALID_INPUT'|'MEDICAL_OR_JOURNAL_DENIED'|
      'DISCIPLINE_NOT_RESOLVABLE'|'NOT_ENOUGH_REGISTERED_PLAYERS';
      sourceError?:string;affectedClubId?:string}>
  | Readonly<{ok:true;
      schemaVersion:typeof M1_V84_AUTO_BAN_LINEUP_SCHEMA;
      status:'SOURCE_REPLAYED_MEDICAL_AND_MODELLED_AUTOMATIC_BANS_EXCLUDED';
      fixtureId:string;journalRevision:number;
      homeLineup:MatchLineup;awayLineup:MatchLineup;
      excludedMedicalPlayers:readonly string[];
      excludedAutomaticBanPlayers:readonly string[];
      sourceJournalFullyReplayed:true;
      bothClubsAutomaticBansVerified:true;
      noExternalRefereeOrKdkAuthorityAuthenticated:true;
      noMedicalRecoveryOrTreatmentGranted:true;
      subsequentV76AdmissionStillRequired:true;
      stateOrJournalModified:false}>;
const fail=(error:Extract<M1V84SafeLineupProposal,{ok:false}>['error'],
  sourceError?:string,affectedClubId?:string):M1V84SafeLineupProposal=>
    ({ok:false,error,...(sourceError?{sourceError}:{}),
      ...(affectedClubId?{affectedClubId}:{})});
const RULES={starterCount:11,maxBench:12,maxForeignersOnField:7} as const;
type Denied=Extract<M1V56DisciplineGateRun,{ok:false}>;
function validRegisteredLineup(
  club:Club,players:ReadonlyMap<string,Player>,
  medical:ReadonlySet<string>,banned:ReadonlySet<string>,
):MatchLineup|null {
  // Medical holds and verified automatic bans are separate source-replayed
  // exclusions, both respected by the common cap-aware full roster picker.
  return selectM1V96EligibleRegisteredLineup(club,players,
    new Set([...medical,...banned]),RULES);
}

export function proposeM1V84MedicallyAndAutomaticallyEligibleLineups(
  initial:unknown,journal:unknown,prematch:unknown,
):M1V84SafeLineupProposal {
  if(!isPlainJsonTree(initial)||!isPlainJsonTree(journal)||
    !isPlainJsonTree(prematch)||prematch===null||
    typeof prematch!=='object'||Array.isArray(prematch))return fail('INVALID_INPUT');
  const input=prematch as M1PrematchInput;
  const medical=deriveM1V82SourceBoundAvailableLineups(
    initial,journal,input.fixture);
  if(!medical.ok)return fail('MEDICAL_OR_JOURNAL_DENIED',medical.error);
  const original=initial as InitialCareerSave;
  const catalog:Catalog=original.catalog;
  const players=new Map(catalog.players.map(p=>[p.id,p]));
  const clubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  const home=clubs.get(input.fixture.homeClubId);
  const away=clubs.get(input.fixture.awayClubId);
  if(!home||!away)return fail('INVALID_INPUT');
  const removed={home:new Set<string>(),away:new Set<string>()};
  const held={home:new Set<string>(),away:new Set<string>()};
  for(const entry of medical.excludedMedicalPlayers){
    if(entry.teamId===home.id)held.home.add(entry.playerId);
    else if(entry.teamId===away.id)held.away.add(entry.playerId);
  }
  let homeLineup=medical.homeLineup,awayLineup=medical.awayLineup;
  for(let attempt=0;attempt<=home.registeredPlayerIds.length+
    away.registeredPlayerIds.length;attempt++){
    const source={...input,homeLineup,awayLineup};
    const h=admitM1V56ModelledAutomaticDiscipline(
      initial,journal,source,home.id);
    const a=admitM1V56ModelledAutomaticDiscipline(
      initial,journal,source,away.id);
    if(h.ok&&a.ok){
      return{ok:true,schemaVersion:M1_V84_AUTO_BAN_LINEUP_SCHEMA,
        status:'SOURCE_REPLAYED_MEDICAL_AND_MODELLED_AUTOMATIC_BANS_EXCLUDED',
        fixtureId:input.fixture.id,journalRevision:medical.journalRevision,
        homeLineup,awayLineup,
        excludedMedicalPlayers:medical.excludedMedicalPlayers.map(x=>x.playerId)
          .sort(),
        excludedAutomaticBanPlayers:[...removed.home,...removed.away].sort(),
        sourceJournalFullyReplayed:true,bothClubsAutomaticBansVerified:true,
        noExternalRefereeOrKdkAuthorityAuthenticated:true,
        noMedicalRecoveryOrTreatmentGranted:true,
        subsequentV76AdmissionStillRequired:true,
        stateOrJournalModified:false};
    }
    // Nonautomatic sanctions, incomplete histories and any other
    // unresolvable authority claim MUST fail closed, not be assigned
    // a fabricated one-match ban or ignored.
    for(const [side,gate,club] of [
      ['home',h,home],['away',a,away],
    ] as const){
      if(gate.ok)continue;
      const denied=gate as Denied;
      if(denied.error!=='CURRENT_LINEUP_BLOCKED'||
        !denied.affectedPlayerIds?.length)
        return fail('DISCIPLINE_NOT_RESOLVABLE',denied.error,club.id);
      const banned=removed[side];
      let foundNew=false;
      for(const id of denied.affectedPlayerIds){
        if(!club.registeredPlayerIds.includes(id) || banned.has(id))
          return fail('DISCIPLINE_NOT_RESOLVABLE',
            'INCONSISTENT_BAN_EVIDENCE',club.id);
        banned.add(id);foundNew=true;
      }
      if(!foundNew)return fail('DISCIPLINE_NOT_RESOLVABLE',
        'NO_BAN_PROGRESS',club.id);
    }
    const newerHome=validRegisteredLineup(home,players,
      held.home,removed.home);
    const newerAway=validRegisteredLineup(away,players,
      held.away,removed.away);
    if(!newerHome||!newerAway)
      return fail('NOT_ENOUGH_REGISTERED_PLAYERS',undefined,
        !newerHome?home.id:away.id);
    homeLineup=newerHome;awayLineup=newerAway;
  }
  return fail('DISCIPLINE_NOT_RESOLVABLE','BOUNDED_REPLAY_LIMIT');
}
