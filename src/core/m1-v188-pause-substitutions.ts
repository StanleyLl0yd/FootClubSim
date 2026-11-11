import type {M1PrematchInput} from './m1-clock.js';
import type {M1V188Proposal} from './m1-v188-league-source-journal.js';

export type M1V188PauseSubstitutionChoice=Readonly<{
  outPlayerId:string;inPlayerId:string;elapsedSeconds:number;
}>;
export type M1V188PauseSubstitutionInspection=Readonly<{
  canSubstitute:boolean;
  reason:'LEGAL_STOP'|'NO_REFEREE_STOP'|'SUBSTITUTION_LIMIT'|'NO_LEGAL_PAIR';
  usedSubstitutions:number;
  pairs:readonly Readonly<{outPlayerId:string;inPlayerId:string}>[];
}>;

/** Advises the UI, never authorizes a substitution. The canonical v188
 * generator and CAS reverify the physical XI and actual referee stop.
 */
export function inspectM1V188PauseSubstitutions(
  proposal:M1V188Proposal|null,selectedClubId:string,seconds:number,
):M1V188PauseSubstitutionInspection|null{
  if(!proposal?.ok||!Number.isSafeInteger(seconds)||
      seconds<300||seconds>5100||seconds%300!==0)return null;
  const input=proposal.request.prematch as M1PrematchInput;
  if(input.fixture.id!==proposal.fixture.id||
      proposal.clock.fixtureId!==proposal.fixture.id)return null;
  const side=input.fixture.homeClubId===selectedClubId?'home':
    input.fixture.awayClubId===selectedClubId?'away':null;
  if(side===null)return null;
  const lineup=side==='home'?input.homeLineup:input.awayLineup;
  const earlier=proposal.request.plannedCommands.filter(
    c=>c!==null&&typeof c==='object'&&
      'kind' in c&&c.kind==='substitute-normal'&&
      'teamId' in c&&c.teamId===selectedClubId) as
    Readonly<Record<string,unknown>>[];
  if(earlier.some(c=>!Number.isSafeInteger(c.elapsedSeconds)||
      (c.elapsedSeconds as number)>=seconds))return null;
  const stop=proposal.clock.managerStopsFromSource.includes(seconds);
  const inPlayWindows=new Set(earlier.map(c=>c.elapsedSeconds as number)
    .filter(t=>t!==2700));
  const full=earlier.length>=5||
    seconds!==2700&&inPlayWindows.size>=3;
  if(!stop||full)return{
    canSubstitute:false,
    reason:!stop?'NO_REFEREE_STOP':'SUBSTITUTION_LIMIT',
    usedSubstitutions:earlier.length,pairs:[],
  };
  const at=proposal.clock.snapshots.filter(
    s=>s.runningSeconds<=seconds).at(-1);
  const active=at?
    side==='home'?at.homePresent:at.awayPresent:lineup.starters;
  const activeIds=new Set(active);
  const usedOut=new Set(earlier.map(c=>c.outPlayerId));
  const usedIn=new Set(earlier.map(c=>c.inPlayerId));
  const players=new Map(input.catalog.players.map(p=>[p.id,p]));
  const foreign=active.filter(id=>
    players.get(id)?.foreignerForCompetition).length;
  const pairs:({outPlayerId:string;inPlayerId:string})[]=[];
  for(const outPlayerId of active){
    const out=players.get(outPlayerId);
    if(!out||usedOut.has(outPlayerId))continue;
    for(const inPlayerId of lineup.bench){
      const incoming=players.get(inPlayerId);
      if(!incoming||usedIn.has(inPlayerId)||
          activeIds.has(inPlayerId)||
          (out.primaryPosition==='GK')!==
            (incoming.primaryPosition==='GK')||
          foreign-Number(out.foreignerForCompetition)+
            Number(incoming.foreignerForCompetition)>
              input.rosterRules.maxForeignersOnField)continue;
      pairs.push({outPlayerId,inPlayerId});
    }
  }
  return{
    canSubstitute:pairs.length>0,
    reason:pairs.length?'LEGAL_STOP':'NO_LEGAL_PAIR',
    usedSubstitutions:earlier.length,pairs,
  };
}
