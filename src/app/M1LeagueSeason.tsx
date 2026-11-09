import {useEffect,useMemo,useRef,useState} from 'react';
import {M1ClubOverview} from './M1ClubOverview.js';
import {M1MatchReport} from './M1MatchReport.js';
import {deriveM1V188Champion} from '../core/m1-v188-championship.js';
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
  const [preview,setPreview]=useState<Ready|null>(null);
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
  const last=journal?.entries.at(-1);
  const lastFixture=last?fixtures[journal!.revision-1]:null;
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
    tactics:{...xiBaseTactics,formation:xiFormation,
      mentality:xiMentality,pressing:xiPressing,tempo:xiTempo},
  }:undefined;
  const xiPlayers=new Set(starterIds);
  // A read-only pitch preview. The tactical formation is persisted in v188,
  // while individual player-to-slot assignments are not yet modelled.
  const boardGoalkeeper=starterIds.find(id=>
    playersById.get(id)?.primaryPosition==='GK')??null;
  const boardOutfield=starterIds.filter(id=>
    playersById.get(id)?.primaryPosition!=='GK');
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

  async function connect():Promise<void>{
    if(busy||disabled)return;
    setBusy(true);setPreview(null);setManagerSetup(null);
    setXiSetup(null);setStarterIds([]);
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
    if(busy||disabled||!journal||preview||!xiLegal)return;
    try{
      const base=prepareM1V188LeagueMatch(career,journal,changes);
      const remembered=!xiChoice&&!forceAutoXI&&base?.ok?
        deriveM1V188RememberedXI(
          career,journal,base.request.prematch as M1PrematchInput):null;
      const prepared=xiChoice||remembered?
        prepareM1V188LeagueMatch(career,journal,changes,
          undefined,undefined,xiChoice??remembered):base;
      if(prepared===null){
        setStatus('Сезон завершён. Все 240 матчей уже сохранены.');
      }else if(!prepared.ok){
        setStatus('Матч пока невозможно провести: '+prepared.error);
      }else{
        setPreview(prepared);
        setStatus('Результат рассчитан. Подтвердите запись или отмените просмотр.');
      }
    }catch(error){
      setStatus('Не удалось рассчитать матч: '+errorText(error));
    }
  }

  async function commit():Promise<void>{
    if(busy||disabled||!journal||!preview)return;
    const expected=journal.revision;
    const request=preview.request;
    setBusy(true);setPreview(null);
    try{
      const updated=await commitM1V188PersistedLeagueMatch(
        career.careerId,expected,request);
      setJournal(updated);
      setManagerSetup(null);setXiSetup(null);setStarterIds([]);
      setForceAutoXI(false);
      setStatus('Матч №'+updated.revision+
        ' записан в браузер. Результат и таблица обновлены.');
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
    if(busy||disabled||!journal||!ownNextNow||preview)return;
    const prepared=prepareM1V188LeagueMatch(career,journal);
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
    setManagerSetup(null);
    setStatus(remembered?
      'Восстановлены состав и тактика прошлого матча. Проверьте доступность игроков.':
      'Выберите 11 игроков для ближайшего матча своего клуба.');
  }
  function clearXI():void{
    setXiSetup(null);setStarterIds([]);setManagerSetup(null);
    setForceAutoXI(true);
    setStatus('Для этого матча выбран автоматический стартовый состав.');
  }

  function configureHalfTime():void{
    if(busy||disabled||!journal||!ownNextNow||preview)return;
    try{
      if(!xiLegal)return;
      const base=prepareM1V188LeagueMatch(career,journal);
      const remembered=!xiChoice&&!forceAutoXI&&base?.ok?
        deriveM1V188RememberedXI(
          career,journal,base.request.prematch as M1PrematchInput):null;
      const prepared=xiChoice||remembered?
        prepareM1V188LeagueMatch(career,journal,[],
          undefined,undefined,xiChoice??remembered):base;
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
    setAdvancing(true);setPreview(null);
    setManagerSetup(null);setXiSetup(null);
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
        const proposal=prepareM1V188LeagueMatch(career,current);
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
              {' '}— чемпион «Лиги приколов»!</h3>
            <p>{champion.remainingRounds>0?
              'Титул гарантирован досрочно в '+champion.clinchedRound+
                '-м туре, за '+champion.remainingRounds+' туров до конца.':
              'Победа в чемпионате подтверждена по очкам.'}
              {' '}Ни один соперник уже не мог догнать вашу команду,
              даже выиграв все оставшиеся встречи.</p>
            {champion.seasonComplete&&
              <p>Сезон завершён: {champion.points} очков. Кубок ваш!</p>}
          </section>}
        <div className="season-scoreboard">
          <div>
            <span className="subtle">Ваш следующий матч</span>
            <strong>{ownNext?
              'Тур '+ownNext.round+': '+
              clubs.get(ownNext.homeClubId)+' — '+
              clubs.get(ownNext.awayClubId):'Все матчи клуба сыграны'}</strong>
          </div>
          {last&&lastFixture&&<div>
            <span className="subtle">Последний результат</span>
            <strong>{clubs.get(lastFixture.homeClubId)} {' '}
              {last.result.report.home.goals} :{' '}
              {last.result.report.away.goals} {' '}
              {clubs.get(lastFixture.awayClubId)}</strong>
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
          <strong>{clubs.get(next.homeClubId)} — {clubs.get(next.awayClubId)}</strong>
          <div className="button-stack">
            <button type="button" disabled={busy||disabled||!!preview||!xiLegal}
              onClick={()=>calculate()}>Рассчитать матч</button>
            {ownNextNow&&<button type="button" className="secondary-button"
              disabled={busy||disabled||!!preview}
              onClick={xiSetup?clearXI:configureXI}>
              {xiSetup?'Вернуть автосостав':'Настроить стартовый состав'}
            </button>}
            {ownNextNow&&<button type="button" className="secondary-button"
              disabled={busy||disabled||!!preview||!xiLegal}
              onClick={configureHalfTime}>Настроить замену</button>}
            <button type="button" disabled={busy||disabled||!!preview}
              className="secondary-button"
              onClick={()=>void connect()}>Обновить сохранение</button>
          </div>
        </div>}
        {xiSetup&&ownNextNow&&!preview&&<fieldset
          className="season-substitution" disabled={busy||disabled}>
          <legend>Стартовый состав · {starterIds.length} из 11</legend>
          <p className="subtle">Выберите 11 игроков, включая ровно
            одного вратаря. Дисквалифицированные и недоступные
            футболисты исключены.</p>
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
                {' '}{playersById.get(id)?.primaryPosition}</span>
            </label>)}
          </div>
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
            <p className="subtle">Позиции игроков показаны условно.
              Выбранная схема сохраняется в тактике матча;
              индивидуальные роли на поле пока не назначаются.</p>
          </figure>
          {!xiLegal&&<p role="alert" className="subtle">
            Проверьте 11 игроков, вратаря и лимит легионеров.
          </p>}
        </fieldset>}
        {managerSetup&&ownNextNow&&!preview&&<fieldset
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
        {preview&&previewResult&&<div className="season-preview"
          aria-label="Предварительный результат">
          <span className="subtle">Результат · тур {preview.fixture.round}</span>
          <p className="season-preview-score">
            {clubs.get(preview.fixture.homeClubId)}{' '}
            <strong>{previewResult.report.home.goals} :{' '}
              {previewResult.report.away.goals}</strong>{' '}
            {clubs.get(preview.fixture.awayClubId)}
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
          {preview.request.plannedCommands.some(command=>
            command!==null&&typeof command==='object'&&
            'kind' in command&&command.kind==='substitute-normal')&&
            <p className="subtle">Замена в перерыве включена в расчёт матча.</p>}
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
                    {clubs.get(f.homeClubId)} — {clubs.get(f.awayClubId)}
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
                    <th scope="row">{clubs.get(row.clubId)}</th>
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
