import {useEffect,useMemo,useRef,useState} from 'react';
import {M1ClubOverview} from './M1ClubOverview.js';
import {M1MatchReport} from './M1MatchReport.js';
import {LigaClubLabel} from './LigaClubLabel.js';
import {deriveM1V188Champion} from '../core/m1-v188-championship.js';
import {deriveM1V188CheckpointScore,sameM1V188CheckpointPrefix}
  from '../core/m1-v188-half-time.js';
import {inspectM1V188PauseSubstitutions,
  type M1V188PauseSubstitutionChoice}
  from '../core/m1-v188-pause-substitutions.js';
import {createM1V188PauseDraft,recoverM1V188PauseDraft}
  from '../core/m1-v188-pause-draft.js';
import {saveM1V188PauseDraft,loadM1V188PauseDraft,
  clearM1V188PauseDraft}
  from '../browser/m1-v188-pause-draft-store.js';
import {inspectM1V188ClubCondition}
  from '../core/m1-v188-condition.js';
import {deriveM1V188RememberedXI} from '../core/m1-v188-manager-defaults.js';
import {sameCanonicalValue} from '../core/canonical-value.js';
import {deriveM1V188ProvisionalTable}
  from '../core/m1-v188-provisional-table.js';
import {planM1V188NextOwnMatch}
  from '../core/m1-v188-season-navigation.js';
import type {M1PrematchInput} from '../core/m1-clock.js';
import {inspectM1V188LeagueCalendar,prepareM1V188LeagueMatch,
  type M1V188Journal,type M1V188Proposal,type M1V188ManagedXI}
  from '../core/m1-v188-league-source-journal.js';
import type {M1V105Run} from '../core/m1-v105-special-goal-chronology.js';
import {validateLineup} from '../core/validation.js';
import {inspectM1V2FormationFit,m1V2PositionGroup}
  from '../core/m1-v2-formation-fit.js';
import {suggestM1V2FormationXI}
  from '../core/m1-v2-lineup-advisor.js';
import type {InitialCareerSave} from '../core/save.js';
import {CareerStorageError,loadInitialCareer,saveNewInitialCareer}
  from '../browser/initial-career-store.js';
import {createM1V188PersistedLeague,loadM1V188PersistedLeague,
  commitM1V188PersistedLeagueMatch,M1V188StorageError}
  from '../browser/m1-v188-league-store.js';

type Ready=Extract<M1V188Proposal,{ok:true}>;
type Good=Extract<M1V105Run,{ok:true}>;
type HalfTimeChange=Readonly<{
  outPlayerId:string;inPlayerId:string;elapsedSeconds:2700;
}>;
const FORMATIONS=['4-2-3-1','4-3-3','4-4-2','4-1-4-1',
  '3-5-2','3-4-3','5-3-2'] as const;
const errorText=(error:unknown)=>
  error instanceof Error?error.message:String(error);

/**
 * First player-facing browser season slice. Uses the existing two-team
 * v188 domain and its independent replay/CAS store; no parallel match engine.
 */
export function M1LeagueSeason({career,disabled,onCareerStored}:{
  readonly career:InitialCareerSave;readonly disabled:boolean;
  readonly onCareerStored:()=>void;
}){
  const [journal,setJournal]=useState<M1V188Journal|null>(null);
  // Only brand-new careers opt into the existing internally generated
  // medical v5 and source-2 goal model. Preserve both source versions
  // from the first played fixture when reopening historical careers.
  const prepareSource=(saved:M1V188Journal,manager:unknown=[],
    selection:unknown=undefined,coaching:unknown[])=>
    prepareM1V188LeagueMatch(career,saved,manager,
      undefined,saved.revision===0?
        5:saved.entries[0]?.source.medicalPolicyVersion,
      selection,saved.revision===0?
        2:saved.entries[0]?.source.specialGoalSourceVersion,coaching);
  const [preview,setPreview]=useState<Ready|null>(null);
  const [halfTime,setHalfTime]=useState<Ready|null>(null);
  const [pauseMinute,setPauseMinute]=useState(45);
  const [nextPauseMinute,setNextPauseMinute]=useState(60);
  const [inGameChoices,setInGameChoices]=useState<unknown[]>([]);
  const [inGameSubstitutions,setInGameSubstitutions]=
    useState<M1V188PauseSubstitutionChoice[]>([]);
  const [pauseSubEnabled,setPauseSubEnabled]=useState(false);
  const [pauseOutId,setPauseOutId]=useState('');
  const [pauseInId,setPauseInId]=useState('');
  const [busy,setBusy]=useState(false);
  const [advancing,setAdvancing]=useState(false);
  const [managerSetup,setManagerSetup]=useState<Ready|null>(null);
  const [xiSetup,setXiSetup]=useState<Ready|null>(null);
  const [starterIds,setStarterIds]=useState<string[]>([]);
  const [forceAutoXI,setForceAutoXI]=useState(false);
  const [matchInspectId,setMatchInspectId]=useState('');
  const [xiFormation,setXiFormation]=useState('4-2-3-1');
  const [xiMentality,setXiMentality]=useState(0);
  const [xiPressing,setXiPressing]=useState(50);
  const [xiTempo,setXiTempo]=useState(50);
  const [coachEnabled,setCoachEnabled]=useState(false);
  const [coachMinute,setCoachMinute]=useState(45);
  const [coachFormation,setCoachFormation]=useState('4-2-3-1');
  const [coachMentality,setCoachMentality]=useState(0);
  const [coachPressing,setCoachPressing]=useState(50);
  const [coachTempo,setCoachTempo]=useState(50);
  const [focusEnabled,setFocusEnabled]=useState(false);
  const [focusId,setFocusId]=useState('');
  const [focusMode,setFocusMode]=useState('attack');
  const [outId,setOutId]=useState('');
  const [inId,setInId]=useState('');
  const stopRequested=useRef(false);
  useEffect(()=>()=>{stopRequested.current=true;},[]);
  const [status,setStatus]=useState(
    'Нажмите «Начать или продолжить сезон». Начальная карьера сохранится автоматически.');
  const calendar=useMemo(()=>inspectM1V188LeagueCalendar(career),[career]);
  const fixtures=calendar.ok?calendar.fixtures:[];
  const clubs=useMemo(()=>new Map(
    career.catalog.clubs.map(club=>[club.id,club.displayName])),[career]);
  const table=useMemo(()=>journal?
    deriveM1V188ProvisionalTable(career,journal):null,[career,journal]);
  const champion=useMemo(()=>journal?
    deriveM1V188Champion(career,journal):null,[career,journal]);
  const saved=useMemo(()=>new Map(
    (journal?.entries??[]).map(entry=>[entry.fixtureId,entry])),
  [journal]);
  // The loaded v188 journal is already source-validated by its store.
  // Readiness is a fictional per-fixture workload estimate, not medical
  // clearance and never a mutation of a persisted player attribute.
  const readiness=useMemo(()=>journal?
    inspectM1V188ClubCondition(career,journal.entries,
      career.selectedClubId):null,[career,journal]);
  const readinessById=new Map((readiness?.players??[]).map(
    player=>[player.playerId,player.condition]));
  const navigation=useMemo(()=>journal?
    planM1V188NextOwnMatch(career,journal):null,[career,journal]);
  const ownReports=fixtures.filter(f=>
    f.homeClubId===career.selectedClubId||
    f.awayClubId===career.selectedClubId).flatMap(f=>{
      const entry=saved.get(f.id);return entry?[{fixture:f,entry}]:[];
    });
  const selectedReport=ownReports.find(row=>
    row.fixture.id===matchInspectId)??ownReports.at(-1);
  const playerNames=useMemo(()=>new Map(
    career.catalog.players.map(player=>[player.id,player.displayName])),[career]);
  const playersById=useMemo(()=>new Map(
    career.catalog.players.map(player=>[player.id,player])),[career]);
  const next=journal?fixtures[journal.revision]:null;
  const ownNext=journal?fixtures.slice(journal.revision).find(f=>
    f.homeClubId===career.selectedClubId||
    f.awayClubId===career.selectedClubId):null;
  // Keep the scorecard focused on the club the manager actually controls.
  // The final committed league fixture may belong to two other teams.
  const lastOwnPlayed=ownReports.at(-1);
  const round=next?.round??30;
  const roundFixtures=journal?fixtures.filter(f=>f.round===round):[];
  const previewResult=preview?.request.result as Good|undefined;
  const ownNextNow=Boolean(next&&(
    next.homeClubId===career.selectedClubId||
    next.awayClubId===career.selectedClubId));
  const managerInput=managerSetup?.request.prematch as
    M1PrematchInput|undefined;
  const managerLineup=managerInput?(
    managerInput.fixture.homeClubId===career.selectedClubId?
      managerInput.homeLineup:managerInput.awayLineup):null;
  const outOptions=managerLineup?.starters.filter(id=>
    playersById.get(id)?.primaryPosition!=='GK')??[];
  const actualOut=outOptions.includes(outId)?outId:outOptions[0]??'';
  const inOptions=managerLineup?.bench.filter(id=>
    playersById.get(id)?.primaryPosition!=='GK')??[];
  const actualIn=inOptions.includes(inId)?inId:inOptions[0]??'';
  const xiPrematch=xiSetup?.request.prematch as M1PrematchInput|undefined;
  const xiBase=xiPrematch?(
    xiPrematch.fixture.homeClubId===career.selectedClubId?
      xiPrematch.homeLineup:xiPrematch.awayLineup):null;
  const xiAvailable=xiBase?[...xiBase.starters,...xiBase.bench]:[];
  const xiBaseTactics=xiPrematch?(
    xiPrematch.fixture.homeClubId===career.selectedClubId?
      xiPrematch.homeTactics:xiPrematch.awayTactics):null;
  const xiChoice:M1V188ManagedXI|undefined=xiSetup&&xiBaseTactics?{
    schemaVersion:1,clubId:career.selectedClubId,starters:starterIds,
    tactics:{...xiBaseTactics,schemaVersion:2 as const,formation:xiFormation,
      mentality:xiMentality,pressing:xiPressing,tempo:xiTempo},
  }:undefined;
  const xiPlayers=new Set(starterIds);
  const halfTimeInput=halfTime?.request.prematch as
    M1PrematchInput|undefined;
  const halfTimeOwn=halfTimeInput?(
    halfTimeInput.fixture.homeClubId===career.selectedClubId?
      halfTimeInput.homeLineup:halfTimeInput.awayLineup):null;
  const halfTimeTactics=halfTimeInput?(
    halfTimeInput.fixture.homeClubId===career.selectedClubId?
      halfTimeInput.homeTactics:halfTimeInput.awayTactics):null;
  const focusCandidates=(halfTimeOwn?.starters??starterIds).filter(id=>
    playersById.get(id)?.primaryPosition!=='GK');
  const actualFocusId=focusCandidates.includes(focusId)?
    focusId:focusCandidates[0]??'';
  const coachedPlan=xiChoice?.tactics??halfTimeTactics;
  const coachingChoices=coachEnabled&&coachedPlan?[{
    kind:'team-tactics',elapsedSeconds:(halfTime?pauseMinute:coachMinute)*60,
    plan:{...coachedPlan,schemaVersion:2 as const,
      formation:coachFormation,mentality:coachMentality,
      pressing:coachPressing,tempo:coachTempo},
  },...(focusEnabled&&actualFocusId?[{
    kind:'player-focus',elapsedSeconds:(halfTime?pauseMinute:coachMinute)*60,
    playerId:actualFocusId,focus:focusMode,
  }]:[])]:[];
  const halfTimeScore=halfTime&&halfTimeInput?
    deriveM1V188CheckpointScore(halfTimeInput,
      halfTime.request.result as Good,pauseMinute*60):null;
  const pauseSubOptions=halfTime?inspectM1V188PauseSubstitutions(
    halfTime,career.selectedClubId,pauseMinute*60):null;
  const pauseOutOptions=[...new Set((pauseSubOptions?.pairs??[])
    .map(pair=>pair.outPlayerId))];
  const actualPauseOut=pauseOutOptions.includes(pauseOutId)?
    pauseOutId:pauseOutOptions[0]??'';
  const pauseInOptions=(pauseSubOptions?.pairs??[])
    .filter(pair=>pair.outPlayerId===actualPauseOut)
    .map(pair=>pair.inPlayerId);
  const actualPauseIn=pauseInOptions.includes(pauseInId)?
    pauseInId:pauseInOptions[0]??'';
  // A read-only pitch preview. The tactical formation is persisted in v188,
  // while individual player-to-slot assignments are not yet modelled.
  const boardGoalkeeper=starterIds.find(id=>
    playersById.get(id)?.primaryPosition==='GK')??null;
  const groupRank={defenders:0,holding:1,midfield:2,
    advanced:3,strikers:4};
  const boardRank=(id:string)=>{
    const pos=playersById.get(id)?.primaryPosition;
    const group=pos?m1V2PositionGroup(pos):null;
    return group===null?5:groupRank[group];
  };
  const boardOutfield=starterIds.filter(id=>
    playersById.get(id)?.primaryPosition!=='GK').sort(
      (a,b)=>boardRank(a)-boardRank(b));
  let boardOffset=0;
  const boardLines=xiFormation.split('-').map(part=>{
    const size=Number(part);
    const line=Array.from({length:size},(_,index)=>
      boardOutfield[boardOffset+index]??null);
    boardOffset+=size;
    return line;
  });
  const xiClub=career.catalog.clubs.find(c=>c.id===career.selectedClubId);
  const xiErrors=xiBase&&xiClub?validateLineup({
    clubId:career.selectedClubId,starters:starterIds,
    bench:xiAvailable.filter(id=>!xiPlayers.has(id)),
  },xiClub,playersById,{
    starterCount:11,maxBench:12,maxForeignersOnField:7,
  }):[];
  const xiLegal=!xiSetup||xiErrors.length===0;
  const xiFit=xiSetup&&starterIds.length===11?
    inspectM1V2FormationFit(xiFormation,starterIds,playersById):null;

  async function connect():Promise<void>{
    if(busy||disabled)return;
    setBusy(true);setPreview(null);setHalfTime(null);
    setInGameChoices([]);setInGameSubstitutions([]);
    setPauseSubEnabled(false);setManagerSetup(null);
    setXiSetup(null);setStarterIds([]);
    setCoachEnabled(false);setFocusEnabled(false);
    setForceAutoXI(false);setMatchInspectId('');
    try{
      let stored:InitialCareerSave;
      try{stored=await loadInitialCareer(career.careerId);}
      catch(error){
        if(!(error instanceof CareerStorageError)||
            error.code!=='NOT_FOUND')throw error;
        // An unsaved new or imported career must be persisted before starting.
        // Add-only storage protects existing careers even across multiple tabs.
        try{await saveNewInitialCareer(career);}
        catch(saveError){
          if(!(saveError instanceof CareerStorageError)||
              saveError.code!=='DUPLICATE')throw saveError;
        }
        stored=await loadInitialCareer(career.careerId);
        onCareerStored();
      }
      if(!sameCanonicalValue(stored,career)){
        setJournal(null);
        setStatus('Начальная карьера в браузере отличается от выбранной. '+
          'Восстановите сохранение, чтобы не смешивать два сезона.');
        return;
      }
      let loaded:M1V188Journal;
      try{loaded=await loadM1V188PersistedLeague(career.careerId);}
      catch(error){
        if(!(error instanceof M1V188StorageError)||
            error.code!=='NOT_FOUND')throw error;
        try{loaded=await createM1V188PersistedLeague(career.careerId);}
        catch(created){
          if(!(created instanceof M1V188StorageError)||
              created.code!=='ALREADY_EXISTS')throw created;
          loaded=await loadM1V188PersistedLeague(career.careerId);
        }
      }
      setJournal(loaded);
      // An untrusted pause is NOT a journal entry. It can only restore
      // an exact replayed event prefix at the current journal revision.
      let savedDraft:unknown=null;
      try{savedDraft=await loadM1V188PauseDraft(career.careerId);}
      catch(error){
        setStatus('Сезон проверен; черновик паузы недоступен: '+
          errorText(error));
      }
      const resumed=savedDraft===null?null:
        recoverM1V188PauseDraft(career,loaded,savedDraft);
      if(resumed){
        const {draft,proposal}=resumed;
        const input=proposal.request.prematch as M1PrematchInput;
        const tactics=input.fixture.homeClubId===career.selectedClubId?
          input.homeTactics:input.awayTactics;
        setHalfTime(proposal);setPauseMinute(draft.pauseMinute);
        setNextPauseMinute(Math.min(85,draft.pauseMinute+15));
        setInGameChoices([...draft.coachingChoices]);
        setInGameSubstitutions(
          [...draft.substitutions] as M1V188PauseSubstitutionChoice[]);
        setCoachMinute(draft.pauseMinute);
        setCoachFormation(tactics.formation);
        setCoachMentality(tactics.mentality);
        setCoachPressing(tactics.pressing);setCoachTempo(tactics.tempo);
        setStatus('Восстановлена пауза матча · '+draft.pauseMinute+
          '-я минута. Уже сыгранные события проверены и неизменны.');
        return;
      }
      if(savedDraft!==null){
        // A stale, invalid or previously committed draft is nonauthoritative.
        // Cleanup failure must not interfere with a verified league journal.
        try{await clearM1V188PauseDraft(career.careerId,loaded.revision);}
        catch{/* Source journal remains authoritative. */}
      }
      setStatus('Сезон проверен и загружен. Сыграно матчей: '+
        loaded.revision+' из 240.');
      await advanceOpponents(loaded);
    }catch(error){
      setJournal(null);
      setStatus('Не удалось открыть сезон: '+errorText(error)+
        '. Уже сохранённые данные не изменены.');
    }finally{setBusy(false);}
  }

  function calculate(changes:readonly HalfTimeChange[]=[]):void{
    if(busy||disabled||!journal||preview||halfTime||!xiLegal)return;
    try{
      const base=prepareSource(journal,changes,undefined,coachingChoices);
      const remembered=!xiChoice&&!forceAutoXI&&base?.ok?
        deriveM1V188RememberedXI(
          career,journal,base.request.prematch as M1PrematchInput):null;
      const prepared=xiChoice||remembered?
        prepareSource(journal,changes,xiChoice??remembered,
          coachingChoices):base;
      if(prepared===null){
        setStatus('Сезон завершён. Все 240 матчей уже сохранены.');
      }else if(!prepared.ok){
        setStatus('Матч пока невозможно провести: '+prepared.error+
          (prepared.stage?' ['+prepared.stage+
            (prepared.cause?':'+prepared.cause:'')+']':''));
      }else{
        setPreview(prepared);
        setStatus('Результат рассчитан. Подтвердите запись или отмените просмотр.');
      }
    }catch(error){
      setStatus('Не удалось рассчитать матч: '+errorText(error));
    }
  }

  async function startHalfTime():Promise<void>{
    if(busy||disabled||!journal||preview||halfTime||
        !ownNextNow||!xiLegal)return;
    setBusy(true);
    try{
      const base=prepareSource(journal);
      const remembered=!xiChoice&&!forceAutoXI&&base?.ok?
        deriveM1V188RememberedXI(career,journal,
          base.request.prematch as M1PrematchInput):null;
      const prepared=xiChoice||remembered?
        prepareSource(journal,[],xiChoice??remembered):base;
      if(!prepared?.ok){
        setStatus('Первый тайм не рассчитан: '+
          (prepared?.error??'SEASON_COMPLETE'));
        return;
      }
      const draft=createM1V188PauseDraft(prepared,pauseMinute);
      if(!draft){
        setStatus('Первый тайм не рассчитан: неверная игровая пауза.');
        return;
      }
      // Do not reveal a pause as resumable until its source prefix is durable.
      await saveM1V188PauseDraft(draft);
      const input=prepared.request.prematch as M1PrematchInput;
      const tactics=input.fixture.homeClubId===career.selectedClubId?
        input.homeTactics:input.awayTactics;
      setCoachMinute(pauseMinute);setCoachEnabled(false);setFocusEnabled(false);
      setCoachFormation(tactics.formation);
      setCoachMentality(tactics.mentality);
      setCoachPressing(tactics.pressing);setCoachTempo(tactics.tempo);
      setHalfTime(prepared);setInGameChoices([]);
      setInGameSubstitutions([]);setPauseSubEnabled(false);
      setPauseOutId('');setPauseInId('');
      setNextPauseMinute(Math.min(85,pauseMinute+15));
      setManagerSetup(null);
      setStatus('Матч рассчитан до выбранной паузы. '+
        'Выберите указания на оставшуюся часть игры.');
    }catch(error){
      setStatus('Первый тайм не рассчитан: '+errorText(error));
    }finally{setBusy(false);}
  }
  async function finishHalfTime(nextMinute:number|null):Promise<void>{
    if(busy||disabled||!journal||!halfTime||!halfTimeInput)return;
    if(nextMinute!==null&&(nextMinute<=pauseMinute||nextMinute>85||
        nextMinute%5!==0)){
      setStatus('Следующая пауза должна быть позже текущей и кратна 5 минутам.');
      return;
    }
    setBusy(true);
    try{
      const choices=[...inGameChoices,...coachingChoices];
      if(pauseSubEnabled&&(!pauseSubOptions?.canSubstitute||
          !actualPauseOut||!actualPauseIn||
          !pauseSubOptions.pairs.some(p=>
            p.outPlayerId===actualPauseOut&&
            p.inPlayerId===actualPauseIn))){
        setStatus('Замена не разрешена на этой остановке. '+
          'Сохранение не изменено.');
        return;
      }
      const changes:M1V188PauseSubstitutionChoice[]=[
        ...inGameSubstitutions,
        ...(pauseSubEnabled?[{outPlayerId:actualPauseOut,
          inPlayerId:actualPauseIn,elapsedSeconds:pauseMinute*60}]:[]),
      ];
      const prepared=prepareSource(journal,changes,
        halfTime.request.managedXI,choices);
      if(!prepared?.ok){
        setStatus('Продолжение матча отклонено: '+
          (prepared?.error??'SEASON_COMPLETE'));
        return;
      }
      if(prepared.request.expectedRevision!==
          halfTime.request.expectedRevision||
          !sameCanonicalValue(prepared.request.prematch,
            halfTime.request.prematch)||
          !sameM1V188CheckpointPrefix(
            halfTime.request.result as Good,
            prepared.request.result as Good,pauseMinute*60)){
        setStatus('Продолжение запрещено: уже сыгранные события '+
          'отличаются от проверенного источника.');
        return;
      }
      if(nextMinute!==null){
        const draft=createM1V188PauseDraft(
          prepared,nextMinute,changes,choices);
        if(!draft){
          setStatus('Не удалось подготовить проверяемую игровую паузу.');
          return;
        }
        await saveM1V188PauseDraft(draft);
        setInGameChoices(choices);setInGameSubstitutions(changes);
        setPauseSubEnabled(false);setPauseOutId('');setPauseInId('');
        setHalfTime(prepared);
        setPauseMinute(nextMinute);
        setNextPauseMinute(Math.min(85,nextMinute+15));
        setCoachEnabled(false);setFocusEnabled(false);
        setStatus('Игра продолжена до '+nextMinute+'-й минуты. '+
          'Предыдущие события не изменены. Можно дать новый приказ.');
      }else{
        setInGameChoices([]);setInGameSubstitutions([]);
        setPauseSubEnabled(false);setHalfTime(null);setPreview(prepared);
        setStatus('Матч завершён без изменения сыгранного отрезка. '+
          'Проверьте результат перед сохранением.');
      }
    }catch(error){
      setStatus('Не удалось продолжить матч: '+errorText(error));
    }finally{setBusy(false);}
  }
  async function cancelPausedMatch():Promise<void>{
    if(busy||disabled||!journal||!halfTime)return;
    setBusy(true);
    try{
      await clearM1V188PauseDraft(career.careerId,
        journal.revision,pauseMinute);
      setHalfTime(null);setInGameChoices([]);
      setInGameSubstitutions([]);setPauseSubEnabled(false);
      setCoachEnabled(false);setFocusEnabled(false);
      setStatus('Перерыв отменён. Сохранение не изменено.');
    }catch(error){
      setStatus('Не удалось удалить черновик паузы: '+
        errorText(error)+'. Текущий матч не изменён.');
    }finally{setBusy(false);}
  }
  async function commit():Promise<void>{
    if(busy||disabled||!journal||!preview)return;
    const expected=journal.revision;
    const request=preview.request;
    setBusy(true);setPreview(null);setInGameChoices([]);
    setInGameSubstitutions([]);setPauseSubEnabled(false);
    try{
      const updated=await commitM1V188PersistedLeagueMatch(
        career.careerId,expected,request);
      setJournal(updated);
      setManagerSetup(null);setXiSetup(null);setStarterIds([]);
      setCoachEnabled(false);setFocusEnabled(false);
      setForceAutoXI(false);
      setStatus('Матч №'+updated.revision+
        ' записан в браузер. Результат и таблица обновлены.');
      try{await clearM1V188PauseDraft(career.careerId,expected);}
      catch{/* A stale pause cannot survive revision-bound replay. */}
      await advanceOpponents(updated);
    }catch(error){
      try{
        const reloaded=await loadM1V188PersistedLeague(career.careerId);
        setJournal(reloaded);
        setStatus('Запись не подтверждена: '+errorText(error)+
          '. Показано актуальное сохранение, без перезаписи.');
      }catch(reloadError){
        setJournal(null);
        setStatus('Запись не подтверждена: '+errorText(error)+
          '. Проверка сохранения не удалась: '+errorText(reloadError));
      }
    }finally{setBusy(false);}
  }

  function configureXI():void{
    if(busy||disabled||!journal||!ownNextNow||preview||halfTime)return;
    const prepared=prepareSource(journal);
    if(!prepared?.ok){
      setStatus('Не удалось открыть состав: '+
        (prepared?.error??'SEASON_COMPLETE'));
      return;
    }
    const prematch=prepared.request.prematch as M1PrematchInput;
    const own=prematch.fixture.homeClubId===career.selectedClubId?
      prematch.homeLineup:prematch.awayLineup;
    const remembered=!forceAutoXI?
      deriveM1V188RememberedXI(career,journal,prematch):null;
    setXiSetup(prepared);
    setStarterIds([...(remembered?.starters??own.starters)]);
    const tactics=remembered?.tactics??(
      prematch.fixture.homeClubId===career.selectedClubId?
        prematch.homeTactics:prematch.awayTactics);
    setXiFormation(tactics.formation);
    setXiMentality(tactics.mentality);
    setXiPressing(tactics.pressing);
    setXiTempo(tactics.tempo);setForceAutoXI(false);
    setCoachEnabled(false);setFocusEnabled(false);
    setCoachFormation(tactics.formation);
    setCoachMentality(tactics.mentality);
    setCoachPressing(tactics.pressing);
    setCoachTempo(tactics.tempo);
    setManagerSetup(null);
    setStatus(remembered?
      'Восстановлены состав и тактика прошлого матча. Проверьте доступность игроков.':
      'Выберите 11 игроков для ближайшего матча своего клуба.');
  }
  function autoChooseXI():void{
    if(busy||disabled||!xiSetup||!xiBase||preview)return;
    const suggested=suggestM1V2FormationXI(
      xiFormation,xiAvailable,playersById,starterIds);
    if(!suggested){
      setStatus('Нет доступного законного состава для выбранной схемы. '+
        'Проверьте вратаря и лимит легионеров.');
      return;
    }
    setStarterIds([...suggested.starters]);
    setManagerSetup(null);
    setStatus('Подобраны 11 доступных футболистов под схему '+xiFormation+
      '. Совпадение линий с амплуа: '+
      Math.round(suggested.fit.fit*100)+'%. Проверьте состав перед матчем.');
  }
  function clearXI():void{
    setXiSetup(null);setStarterIds([]);setManagerSetup(null);
    setCoachEnabled(false);setFocusEnabled(false);
    setForceAutoXI(true);
    setStatus('Для этого матча выбран автоматический стартовый состав.');
  }

  function configureHalfTime():void{
    if(busy||disabled||!journal||!ownNextNow||preview||halfTime)return;
    try{
      if(!xiLegal)return;
      const base=prepareSource(journal,[],undefined,coachingChoices);
      const remembered=!xiChoice&&!forceAutoXI&&base?.ok?
        deriveM1V188RememberedXI(
          career,journal,base.request.prematch as M1PrematchInput):null;
      const prepared=xiChoice||remembered?
        prepareSource(journal,[],xiChoice??remembered,
          coachingChoices):base;
      if(!prepared?.ok){
        setStatus('Подготовка состава отклонена: '+
          (prepared?.error??'SEASON_COMPLETE'));
        return;
      }
      setManagerSetup(prepared);
      setOutId('');setInId('');
      setStatus('Выберите футболистов для замены в перерыве.');
    }catch(error){
      setStatus('Подготовка состава отклонена: '+errorText(error));
    }
  }

  /** Continue durably until the next user-managed fixture (or season end).
   * Only a confirmed user match or explicit season load starts this task.
   * Never rely on an effect to commit twice under React StrictMode.
   */
  async function advanceOpponents(start:M1V188Journal):Promise<void>{
    const plan=planM1V188NextOwnMatch(career,start);
    if(!plan||plan.automaticMatches===0)return;
    setAdvancing(true);setPreview(null);setHalfTime(null);
    setInGameChoices([]);setInGameSubstitutions([]);
    setPauseSubEnabled(false);setManagerSetup(null);setXiSetup(null);
    setStatus('Автоматически рассчитываются матчи остальных клубов.');
    stopRequested.current=false;
    try{
      const stored=await loadInitialCareer(career.careerId);
      if(!sameCanonicalValue(stored,career))
        throw Error('Начальное сохранение изменено; продолжение отменено.');
      let current=await loadM1V188PersistedLeague(career.careerId);
      if(!sameCanonicalValue(current,start))
        throw Error('Сезон изменён в другом окне; требуется обновление.');
      const target=plan.targetRevision;
      while(current.revision<target&&!stopRequested.current){
        const expectedFixture=fixtures[current.revision];
        const proposal=prepareSource(current);
        if(!proposal?.ok)
          throw Error('Невозможно рассчитать матч: '+
            (proposal?.error??'SEASON_COMPLETE'));
        if(!expectedFixture||proposal.fixture.id!==expectedFixture.id||
            proposal.selectedClubFixture)
          throw Error('Переход заблокирован: матч вашего клуба нельзя пропускать.');
        const updated=await commitM1V188PersistedLeagueMatch(
          career.careerId,current.revision,proposal.request);
        current=updated;
        setJournal(updated);
        setStatus('Автоматически сохранён матч '+updated.revision+
          ' из '+target+'.');
        // Allow progress repaint and the stop button between atomic writes.
        await new Promise<void>(resolve=>window.setTimeout(resolve,0));
      }
      setStatus(stopRequested.current?
        'Автоматический расчёт остановлен. Все завершённые матчи сохранены.':
        target===240?
          'Сезон завершён. Все 240 матчей сохранены.':
          'Теперь очередь вашего клуба. Остальные матчи сохранены.');
    }catch(error){
      try{
        const current=await loadM1V188PersistedLeague(career.careerId);
        setJournal(current);
        setStatus('Автоматический расчёт не завершён: '+errorText(error)+
          '. Показано проверенное сохранение.');
      }catch(reloadError){
        setJournal(null);
        setStatus('Автоматический расчёт не завершён: '+errorText(error)+
          '. Невозможно подтвердить сохранение: '+errorText(reloadError));
      }
    }finally{
      setAdvancing(false);stopRequested.current=false;
    }
  }

  /** Recovery-only control after a deliberate stop or interrupted write. */
  async function resumeOpponents():Promise<void>{
    if(busy||disabled||!journal||preview)return;
    setBusy(true);
    try{await advanceOpponents(journal);}
    finally{setBusy(false);}
  }

  return <section className="panel season-panel" aria-labelledby="season-title">
    <div className="season-heading">
      <div>
        <p className="eyebrow">Ваша карьера</p>
        <h2 id="season-title">Первый сезон</h2>
        <p className="subtle">
          {clubs.get(career.selectedClubId)} · 16 клубов · 30 туров
        </p>
      </div>
      <span className="season-counter">{journal?
        journal.revision+' / 240 матчей':'Сезон не открыт'}</span>
    </div>
    <p className="subtle">
      Игровая предварительная версия: пока используется синтетический состав
      клубов. Таблица условная, без официальных критериев равенства очков.
      Прогресс сохраняется локально после подтверждения каждого матча.
    </p>
    {!journal?
      <button type="button" disabled={busy||disabled}
        onClick={()=>void connect()}>Начать или продолжить сезон</button>:
      <>
        <progress className="season-progress" max={240}
          value={journal.revision} aria-label="Прогресс сезона" />
        {champion&&champion.clubId===career.selectedClubId&&
          <section className="season-champion" aria-label="Чемпионство">
            <h3>🏆 Поздравляем! {clubs.get(champion.clubId)}
              {' '}— {champion.provisionalTieBreak?
                'первый в «Лиге приколов» по предварительной таблице!':
                'чемпион «Лиги приколов»!'}</h3>
            {champion.provisionalTieBreak?
              <p>После 30 туров очков поровну, но ваш клуб выше по
                {' '}{champion.provisionalTieBreak==='goal-difference'?
                  'разнице мячей':'числу забитых мячей'}.
                {' '}Это предварительный порядок таблицы: официальные
                критерии равенства очков пока не реализованы.</p>:
              <p>{champion.remainingRounds>0?
                'Титул гарантирован досрочно в '+champion.clinchedRound+
                  '-м туре, за '+champion.remainingRounds+' туров до конца.':
                'Победа подтверждена по очкам после 30 туров.'}
                {' '}Ни один соперник уже не мог догнать вашу команду
                по очкам.</p>}
            {champion.seasonComplete&&
              <p>Сезон завершён: {champion.points} очков.
                {' '}{champion.provisionalTieBreak?
                  'Первое место ваше по предварительной таблице!':
                  'Кубок ваш!'}</p>}
          </section>}
        {journal.revision===240&&!champion&&
          table?.[0]?.clubId===career.selectedClubId&&
          <section className="season-champion"
            aria-label="Первое место в предварительной таблице">
            <h3>Первое место в предварительной таблице</h3>
            <p>Сезон завершён, но у лидеров совпали очки, разница
              мячей и количество голов. Порядок по идентификатору
              клуба не подтверждает чемпионство: официальные
              критерии равенства очков пока не реализованы.</p>
          </section>}
        <div className="season-scoreboard">
          <div>
            <span className="subtle">Ваш следующий матч</span>
            <strong>{ownNext?<span className="season-club-pair">
              Тур {ownNext.round}:
              <LigaClubLabel clubId={ownNext.homeClubId}
                name={clubs.get(ownNext.homeClubId)??ownNext.homeClubId}/>
              {' — '}
              <LigaClubLabel clubId={ownNext.awayClubId}
                name={clubs.get(ownNext.awayClubId)??ownNext.awayClubId}/>
            </span>:'Все матчи клуба сыграны'}</strong>
          </div>
          {lastOwnPlayed&&<div>
            <span className="subtle">
              Последний матч вашего клуба · тур {lastOwnPlayed.fixture.round}
            </span>
            <strong className="season-club-pair">
              <LigaClubLabel clubId={lastOwnPlayed.fixture.homeClubId}
                name={clubs.get(lastOwnPlayed.fixture.homeClubId)??
                  lastOwnPlayed.fixture.homeClubId}/>
              {' '}{lastOwnPlayed.entry.result.report.home.goals} :{' '}
              {lastOwnPlayed.entry.result.report.away.goals}{' '}
              <LigaClubLabel clubId={lastOwnPlayed.fixture.awayClubId}
                name={clubs.get(lastOwnPlayed.fixture.awayClubId)??
                  lastOwnPlayed.fixture.awayClubId}/>
            </strong>
          </div>}
        </div>
        {next&&navigation&&navigation.automaticMatches>0&&
          <div className="season-advance">
            <div>
              <strong>{navigation.targetRevision===240?
                'Завершение сезона':'До следующего матча вашего клуба'}</strong>
              <p className="subtle">{advancing?
                'Идёт автоматический расчёт и сохранение матчей других клубов.':
                'Осталось матчей других клубов: '+navigation.automaticMatches+
                  '. Вы можете возобновить расчёт.'}</p>
            </div>
            <div className="button-stack">
              {advancing?
                <button type="button" className="secondary-button"
                  onClick={()=>{stopRequested.current=true;}}>
                  Остановить переход
                </button>:
                <button type="button" disabled={busy||disabled||!!preview}
                  onClick={()=>void resumeOpponents()}>
                  Продолжить автоматический расчёт
                </button>}
            </div>
          </div>}
        {next&&ownNextNow&&<div className="season-next">
          <span className="subtle">Следующая игра · тур {next.round}</span>
          <strong className="season-club-pair">
            <LigaClubLabel clubId={next.homeClubId}
              name={clubs.get(next.homeClubId)??next.homeClubId}/>
            {' — '}
            <LigaClubLabel clubId={next.awayClubId}
              name={clubs.get(next.awayClubId)??next.awayClubId}/>
          </strong>
          <div className="button-stack">
            <button type="button" disabled={busy||disabled||!!preview||!!halfTime||!xiLegal}
              onClick={()=>calculate()}>Рассчитать матч</button>
            <label>Остановить матч на минуте
              <select value={pauseMinute} disabled={busy||disabled||
                !!preview||!!halfTime}
                onChange={e=>setPauseMinute(Number(e.target.value))}>
                {Array.from({length:17},(_,i)=>(i+1)*5).map(minute=>
                  <option value={minute} key={minute}>{minute}-я</option>)}
              </select>
            </label>
            <button type="button" className="secondary-button"
              disabled={busy||disabled||!!preview||!!halfTime||!xiLegal}
              onClick={()=>void startHalfTime()}>Играть до паузы</button>
            {ownNextNow&&<button type="button" className="secondary-button"
              disabled={busy||disabled||!!preview||!!halfTime}
              onClick={xiSetup?clearXI:configureXI}>
              {xiSetup?'Вернуть автосостав':'Настроить стартовый состав'}
            </button>}
            {ownNextNow&&<button type="button" className="secondary-button"
              disabled={busy||disabled||!!preview}
              onClick={configureXI}>Настроить тактику по ходу матча</button>}
            {ownNextNow&&<button type="button" className="secondary-button"
              disabled={busy||disabled||!!preview||!xiLegal}
              onClick={configureHalfTime}>Настроить замену</button>}
            <button type="button" disabled={busy||disabled||!!preview}
              className="secondary-button"
              onClick={()=>void connect()}>Обновить сохранение</button>
          </div>
        </div>}
        {xiSetup&&ownNextNow&&!preview&&!halfTime&&<fieldset
          className="season-substitution" disabled={busy||disabled}>
          <legend>Стартовый состав · {starterIds.length} из 11</legend>
          <p className="subtle">Выберите 11 игроков, включая ровно
            одного вратаря. Дисквалифицированные и недоступные
            футболисты исключены.</p>
          <div className="season-xi-advice">
            <button type="button" className="secondary-button"
              onClick={autoChooseXI}>Подобрать XI под схему</button>
            <p aria-live="polite" className="subtle">
              {xiFit?
                'Совпадение линий с амплуа: '+
                  Math.round(xiFit.fit*100)+'%'+
                  (xiFit.mismatch?
                    ' · есть позиционные несоответствия':
                    ' · амплуа подходят выбранным линиям'):
                'Выберите 11 игроков, чтобы увидеть соответствие схеме.'}
              {' '}Это не вероятность победы и не назначение точных ролей.
            </p>
          </div>
          <div className="season-xi-layout">
            <div className="season-xi-grid">
            {xiAvailable.map(id=><label key={id}>
              <input type="checkbox" checked={xiPlayers.has(id)}
                onChange={event=>{
                  setStarterIds(current=>event.target.checked?
                    current.length<11?[...current,id]:current:
                    current.filter(player=>player!==id));
                  setManagerSetup(null);
                }} />
              <span>{playerNames.get(id)??id} ·
                {' '}{playersById.get(id)?.primaryPosition}
                {readinessById.has(id)?' · готовность '+
                  readinessById.get(id)+'%':''}</span>
            </label>)}
            </div>
          <figure className="season-formation-board"
            aria-label={'Предварительная расстановка '+xiFormation}>
            <figcaption>Расстановка · {xiFormation}</figcaption>
            <div className="season-formation-pitch">
              {[...boardLines].reverse().map((line,lineIndex)=>
                <div className="season-formation-line" key={lineIndex}>
                  {line.map((id,slotIndex)=>
                    <span className={id?'season-formation-player':
                      'season-formation-empty'} key={slotIndex}
                      title={id?playerNames.get(id)??id:'Позиция не выбрана'}>
                      {id?playerNames.get(id)??id:'Свободно'}
                    </span>)}
                </div>)}
              <div className="season-formation-line">
                <span className={boardGoalkeeper?
                  'season-formation-player':'season-formation-empty'}
                  title={boardGoalkeeper?
                    playerNames.get(boardGoalkeeper)??boardGoalkeeper:
                    'Выберите вратаря'}>
                  {boardGoalkeeper?
                    playerNames.get(boardGoalkeeper)??boardGoalkeeper:
                    'Вратарь'}
                </span>
              </div>
            </div>
            <p className="subtle">Игроки группируются по основному амплуа.
              Их расположение на схеме условное: точные роли и
              персональные места на поле пока не назначаются.</p>
          </figure>
          </div>
          <h4 className="season-editor-title">Тактика на матч</h4>
          <div className="season-tactics-grid">
            <label>Настрой
              <select value={xiMentality}
                onChange={event=>setXiMentality(Number(event.target.value))}>
                <option value={-2}>Осторожный</option>
                <option value={-1}>Сдержанный</option>
                <option value={0}>Сбалансированный</option>
                <option value={1}>Атакующий</option>
                <option value={2}>Всё вперёд</option>
              </select>
            </label>
            <label htmlFor="season-formation">Схема
              <select id="season-formation" value={xiFormation}
                onChange={event=>{
                  setXiFormation(event.target.value);
                  setManagerSetup(null);
                }}>
                {FORMATIONS.map(formation=>
                  <option value={formation} key={formation}>{formation}</option>)}
              </select>
            </label>
            <label>Прессинг · {xiPressing}
              <input type="range" min="0" max="100" step="10"
                value={xiPressing}
                onChange={event=>setXiPressing(Number(event.target.value))}/>
            </label>
            <label>Темп · {xiTempo}
              <input type="range" min="0" max="100" step="10"
                value={xiTempo}
                onChange={event=>setXiTempo(Number(event.target.value))}/>
            </label>
          </div>

          <h4 className="season-editor-title">Изменение тактики в игре</h4>
          <label>
            <input type="checkbox" checked={coachEnabled}
              onChange={e=>setCoachEnabled(e.target.checked)}/>
            {' '}Запланировать тактический приказ на пятиминутной границе
          </label>
          {coachEnabled&&<div className="season-tactics-grid">
            <label>Минута изменения
              <select value={coachMinute}
                onChange={e=>setCoachMinute(Number(e.target.value))}>
                {[15,30,45,60,75,85].map(minute=>
                  <option key={minute} value={minute}>{minute}-я</option>)}
              </select>
            </label>
            <label>Новая схема
              <select value={coachFormation}
                onChange={e=>setCoachFormation(e.target.value)}>
                {FORMATIONS.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Новый настрой
              <select value={coachMentality}
                onChange={e=>setCoachMentality(Number(e.target.value))}>
                <option value={-2}>Осторожный</option>
                <option value={-1}>Сдержанный</option>
                <option value={0}>Сбалансированный</option>
                <option value={1}>Атакующий</option>
                <option value={2}>Всё вперёд</option>
              </select>
            </label>
            <label>Новый прессинг · {coachPressing}
              <input type="range" min="0" max="100" step="10"
                value={coachPressing}
                onChange={e=>setCoachPressing(Number(e.target.value))}/>
            </label>
            <label>Новый темп · {coachTempo}
              <input type="range" min="0" max="100" step="10"
                value={coachTempo}
                onChange={e=>setCoachTempo(Number(e.target.value))}/>
            </label>
            <label>
              <input type="checkbox" checked={focusEnabled}
                onChange={e=>setFocusEnabled(e.target.checked)}/>
              {' '}Индивидуальное указание
            </label>
            {focusEnabled&&<>
              <label>Игрок
                <select value={actualFocusId}
                  onChange={e=>setFocusId(e.target.value)}>
                  {focusCandidates.map(id=><option key={id} value={id}>
                    {playerNames.get(id)??id}</option>)}
                </select>
              </label>
              <label>Приоритет
                <select value={focusMode}
                  onChange={e=>setFocusMode(e.target.value)}>
                  <option value="attack">Атака</option>
                  <option value="balanced">Баланс</option>
                  <option value="defend">Защита</option>
                </select>
              </label>
            </>}
          </div>}
          {coachEnabled&&<p className="subtle">Приказ вступает в силу
            только с выбранной минуты и влияет на последующие эпизоды.
            Если футболист к этому моменту удалён или недоступен,
            индивидуальный приказ будет отклонён.</p>}
          <p className="subtle">Готовность рассчитана по реальным игровым
            минутам предыдущих матчей, с условным восстановлением перед
            следующим туром. Усталость влияет на автоматическую ротацию
            соперников и вашего состава при автоматическом выборе.
            Это не медицинское заключение.</p>
          {!xiLegal&&<p role="alert" className="subtle">
            Проверьте 11 игроков, вратаря и лимит легионеров.
          </p>}
        </fieldset>}
        {managerSetup&&ownNextNow&&!preview&&!halfTime&&<fieldset
          className="season-substitution" disabled={busy||disabled}>
          <legend>Замена в перерыве вашего матча</legend>
          <div className="season-sub-fields">
            <label htmlFor="season-sub-out">Уходит с поля
              <select id="season-sub-out" value={actualOut}
                onChange={event=>{setOutId(event.target.value);setInId('');}}>
                {outOptions.map(id=><option value={id} key={id}>
                  {playerNames.get(id)??id}</option>)}
              </select>
            </label>
            <label htmlFor="season-sub-in">Выходит на поле
              <select id="season-sub-in" value={actualIn}
                onChange={event=>setInId(event.target.value)}>
                {inOptions.map(id=><option value={id} key={id}>
                  {playerNames.get(id)??id}</option>)}
              </select>
            </label>
          </div>
          <div className="button-stack">
            <button type="button" disabled={!actualOut||!actualIn||!xiLegal}
              onClick={()=>calculate([{
                outPlayerId:actualOut,inPlayerId:actualIn,
                elapsedSeconds:2700,
              }])}>Рассчитать с заменой</button>
            <button type="button" className="secondary-button"
              onClick={()=>setManagerSetup(null)}>Отмена настройки</button>
          </div>
        </fieldset>}
        {halfTime&&halfTimeScore&&<section className="season-preview"
          aria-label="Пауза матча">
          <h3>Пауза · {pauseMinute}′</h3>
          <p className="season-preview-score season-report-score">
            <LigaClubLabel clubId={halfTime.fixture.homeClubId}
              name={clubs.get(halfTime.fixture.homeClubId)??halfTime.fixture.homeClubId}/>
            {' '}<strong>{halfTimeScore.homeGoals} : {halfTimeScore.awayGoals}</strong>{' '}
            <LigaClubLabel clubId={halfTime.fixture.awayClubId}
              name={clubs.get(halfTime.fixture.awayClubId)??halfTime.fixture.awayClubId}/>
          </p>
          <p className="subtle">Удары до паузы:
            {' '}{halfTimeScore.homeShots} : {halfTimeScore.awayShots}.
            События после паузы пока не раскрываются.</p>
          <fieldset disabled={busy||disabled}>
            <legend>Указания тренера на оставшуюся часть матча</legend>
            <label><input type="checkbox" checked={coachEnabled}
              onChange={e=>setCoachEnabled(e.target.checked)}/>
              {' '}Изменить тактику</label>
            {coachEnabled&&<div className="season-tactics-grid">
              <label>Схема
                <select value={coachFormation}
                  onChange={e=>setCoachFormation(e.target.value)}>
                  {FORMATIONS.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label>Настрой
                <select value={coachMentality}
                  onChange={e=>setCoachMentality(Number(e.target.value))}>
                  <option value={-2}>Осторожный</option>
                  <option value={-1}>Сдержанный</option>
                  <option value={0}>Сбалансированный</option>
                  <option value={1}>Атакующий</option>
                  <option value={2}>Всё вперёд</option>
                </select>
              </label>
              <label>Прессинг · {coachPressing}
                <input type="range" min="0" max="100" step="10"
                  value={coachPressing}
                  onChange={e=>setCoachPressing(Number(e.target.value))}/>
              </label>
              <label>Темп · {coachTempo}
                <input type="range" min="0" max="100" step="10"
                  value={coachTempo}
                  onChange={e=>setCoachTempo(Number(e.target.value))}/>
              </label>
              <label><input type="checkbox" checked={focusEnabled}
                onChange={e=>setFocusEnabled(e.target.checked)}/>
                {' '}Индивидуальное указание</label>
              {focusEnabled&&<>
                <label>Игрок
                  <select value={actualFocusId}
                    onChange={e=>setFocusId(e.target.value)}>
                    {focusCandidates.map(id=><option key={id} value={id}>
                      {playerNames.get(id)??id}</option>)}
                  </select>
                </label>
                <label>Приоритет
                  <select value={focusMode}
                    onChange={e=>setFocusMode(e.target.value)}>
                    <option value="attack">Атака</option>
                    <option value="balanced">Баланс</option>
                    <option value="defend">Защита</option>
                  </select>
                </label>
              </>}
            </div>}
            <div className="season-substitution">
              <label><input id="season-pause-replace" type="checkbox"
                checked={pauseSubEnabled}
                disabled={!pauseSubOptions?.canSubstitute}
                onChange={e=>setPauseSubEnabled(e.target.checked)}/>
                {' '}Заменить игрока на этой остановке</label>
              {pauseSubOptions?.canSubstitute&&pauseSubEnabled&&
                <div className="season-sub-fields">
                  <label htmlFor="season-pause-out">Уходит с поля
                    <select id="season-pause-out" value={actualPauseOut}
                      onChange={e=>{setPauseOutId(e.target.value);
                        setPauseInId('');}}>
                      {pauseOutOptions.map(id=><option key={id} value={id}>
                        {playerNames.get(id)??id}</option>)}
                    </select>
                  </label>
                  <label htmlFor="season-pause-in">Выходит на поле
                    <select id="season-pause-in" value={actualPauseIn}
                      onChange={e=>setPauseInId(e.target.value)}>
                      {pauseInOptions.map(id=><option key={id} value={id}>
                        {playerNames.get(id)??id}</option>)}
                    </select>
                  </label>
                </div>}
              {!pauseSubOptions?.canSubstitute&&
                <p className="subtle" role="status">
                  {pauseSubOptions?.reason==='NO_REFEREE_STOP'?
                    'На этой минуте нет подтверждённой остановки судьи. '+
                    'Тактические указания доступны без замены.':
                    'На этой остановке больше нет допустимых замен.'}
                </p>}
              {pauseSubOptions?.canSubstitute&&<p className="subtle">
                Использовано замен: {pauseSubOptions.usedSubstitutions} из 5.
                Замена допускается только после проверки игрового протокола.
              </p>}
            </div>
            <p className="subtle">Изменения вступают в силу на
              {' '}{pauseMinute}-й минуте. Уже сыгранные эпизоды
              остаются неизменными.</p>
            <div className="button-stack">
              {pauseMinute<85&&<>
                <label>Следующая пауза
                  <select value={nextPauseMinute}
                    onChange={e=>setNextPauseMinute(Number(e.target.value))}>
                    {Array.from({length:17},(_,i)=>(i+1)*5)
                      .filter(minute=>minute>pauseMinute)
                      .map(minute=><option key={minute} value={minute}>
                        {minute}-я минута</option>)}
                  </select>
                </label>
                <button type="button" disabled={busy||disabled}
                  onClick={()=>void finishHalfTime(nextPauseMinute)}>
                  Продолжить до следующей паузы
                </button>
              </>}
              <button type="button" disabled={busy||disabled}
                onClick={()=>void finishHalfTime(null)}>До финального свистка</button>
              <button type="button" className="secondary-button"
                onClick={()=>void cancelPausedMatch()}>
                Отменить просмотр
              </button>
            </div>
          </fieldset>
        </section>}
        {preview&&previewResult&&<div className="season-preview"
          aria-label="Предварительный результат">
          <span className="subtle">Результат · тур {preview.fixture.round}</span>
          <p className="season-preview-score season-report-score">
            <LigaClubLabel clubId={preview.fixture.homeClubId}
              name={clubs.get(preview.fixture.homeClubId)??preview.fixture.homeClubId}
              size={28}/>{' '}
            <strong>{previewResult.report.home.goals} :{' '}
              {previewResult.report.away.goals}</strong>{' '}
            <LigaClubLabel clubId={preview.fixture.awayClubId}
              name={clubs.get(preview.fixture.awayClubId)??preview.fixture.awayClubId}
              size={28}/>
          </p>
          <p className="subtle">
            Удары {previewResult.report.home.shots} :{' '}
            {previewResult.report.away.shots}.
            В створ {previewResult.report.home.shotsOnTarget} :{' '}
            {previewResult.report.away.shotsOnTarget}.
          </p>
          {preview.request.managedXI&&
            <p className="subtle">Стартовый состав и тактика выбраны тренером
              и включены в проверяемый расчёт.</p>}
          {preview.request.inMatchOrdersVersion===1&&
            <p className="subtle">Изменение тактики и индивидуальное указание
              включены в проверяемый протокол по ходу матча.</p>}
          {preview.request.plannedCommands.some(command=>
            command!==null&&typeof command==='object'&&
            'kind' in command&&command.kind==='substitute-normal')&&
            <p className="subtle">{preview.request.plannedCommands.some(
              command=>command!==null&&typeof command==='object'&&
                'kind' in command&&command.kind==='substitute-normal'&&
                'elapsedSeconds' in command&&command.elapsedSeconds!==2700)?
                'Замена по ходу матча включена в проверяемый протокол.':
                'Замена в перерыве включена в расчёт матча.'}</p>}
          <div className="button-stack">
            <button type="button" disabled={busy||disabled}
              onClick={()=>void commit()}>Подтвердить и сохранить</button>
            <button type="button" className="secondary-button"
              disabled={busy||disabled}
              onClick={()=>{setPreview(null);setStatus('Расчёт отменён. Сохранение не изменено.');}}>
              Отменить
            </button>
          </div>
        </div>}
        {selectedReport&&<section className="season-match-centre">
          <div className="season-match-centre-heading">
            <h3>Протокол сыгранного матча</h3>
            <label>Матч вашего клуба
              <select aria-label="Выбрать сыгранный матч"
                value={selectedReport.fixture.id}
                onChange={event=>setMatchInspectId(event.target.value)}>
                {ownReports.map(row=><option key={row.fixture.id}
                  value={row.fixture.id}>
                  Тур {row.fixture.round}: {clubs.get(row.fixture.homeClubId)}
                  {' — '}{clubs.get(row.fixture.awayClubId)}
                </option>)}
              </select>
            </label>
          </div>
          <M1MatchReport entry={selectedReport.entry}
            catalog={career.catalog}/>
        </section>}
        {!next&&<p className="season-complete">
          Сезон завершён. Все 240 результатов находятся в локальном журнале.
        </p>}
        <div className="season-columns">
          <div>
            <h3>Тур {round}</h3>
            <ol className="season-fixtures">
              {roundFixtures.map(f=>{
                const entry=saved.get(f.id);
                return <li key={f.id}>
                  <span className={f.homeClubId===career.selectedClubId||
                    f.awayClubId===career.selectedClubId?'my-club-fixture':''}>
                    <span className="season-club-pair">
                      <LigaClubLabel clubId={f.homeClubId}
                        name={clubs.get(f.homeClubId)??f.homeClubId}/>
                      {' — '}
                      <LigaClubLabel clubId={f.awayClubId}
                        name={clubs.get(f.awayClubId)??f.awayClubId}/>
                    </span>
                  </span>
                  <strong>{entry?
                    entry.result.report.home.goals+' : '+
                    entry.result.report.away.goals:'—'}</strong>
                </li>;
              })}
            </ol>
          </div>
          <div className="season-table-scroll">
            <h3>Таблица</h3>
            {table?
              <table className="season-table">
                <caption className="subtle">Предварительная, 3 очка за победу</caption>
                <thead><tr>
                  <th scope="col">#</th><th scope="col">Клуб</th>
                  <th scope="col" title="Матчи">И</th>
                  <th scope="col" title="Победы">В</th>
                  <th scope="col" title="Ничьи">Н</th>
                  <th scope="col" title="Поражения">П</th>
                  <th scope="col" title="Разница голов">РМ</th>
                  <th scope="col" title="Очки">О</th>
                </tr></thead>
                <tbody>{table.map((row,index)=>
                  <tr key={row.clubId}
                    className={row.clubId===career.selectedClubId?
                      'season-my-row':undefined}>
                    <td>{index+1}</td>
                    <th scope="row">
                      <LigaClubLabel clubId={row.clubId}
                        name={clubs.get(row.clubId)??row.clubId}/>
                    </th>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td>{row.goalDifference>0?'+':''}{row.goalDifference}</td>
                    <td><strong>{row.points}</strong></td>
                  </tr>)}</tbody>
              </table>:
              <p role="alert">Таблица недоступна: журнал не соответствует календарю.</p>}
          </div>
        </div>
        <M1ClubOverview career={career} journal={journal} fixtures={fixtures}/>
      </>}
    <p className="subtle" role="status" aria-live="polite">{status}</p>
  </section>;
}
