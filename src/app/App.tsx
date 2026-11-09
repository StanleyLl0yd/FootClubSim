import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { LIGA_PRIKOLOV_IDENTITIES } from '../branding/identities.js';
import { ClubBadge } from './ClubBadge.js';
import { M1Playtest } from './M1Playtest.js';
import { M1DensePlaytest } from './M1DensePlaytest.js';
import { M1LeagueSeason } from './M1LeagueSeason.js';
import { ManagerProfileSetup, SavedManagerProfile } from './ManagerProfileSetup.js';
import type { ManagerProfile } from '../core/manager-profile.js';
import {createLigaPrikolovPreviewCatalog}
  from './ligaPrikolovPreviewCatalog.js';
import {sameCanonicalValue} from '../core/canonical-value.js';
import { createSyntheticRplScaleCatalog } from '../core/synthetic.js';
import { generateDoubleRoundRobin } from '../core/fixtures.js';
import { validateDoubleRoundRobin } from '../core/fixture-validation.js';
import { createInitialCareer, exportInitialCareer, importInitialCareer, type InitialCareerSave } from '../core/save.js';
import { CareerStorageError, loadInitialCareer, saveNewInitialCareer,
  listStoredInitialCareerIds } from '../browser/initial-career-store.js';
import {exportM1V188FullCareerBackup,restoreM1V188FullCareerBackup,
  M1V188FullBackupError}
  from '../browser/m1-v188-full-career-backup.js';

const CAREER_ID = 'm0-ui-initial-career';
const WELCOME_MESSAGE = 'Создайте тренера, выберите клуб и начните сезон.';
type PackMode='liga'|'demo';

function errorMessage(error: unknown): string {
  if (error instanceof M1V188FullBackupError) {
    if(error.code==='CONFLICT') return 'Сохранение с этим именем уже существует и отличается. Оно не перезаписано.';
    if(error.code==='UNKNOWN_PACK') return 'Неизвестный или изменённый набор клубов.';
    return 'Ошибка полного архива: '+error.code;
  }
  if (error instanceof CareerStorageError && error.code === 'QUOTA_EXCEEDED') {
    return 'Недостаточно места в браузере. Если сезон уже начат, скачайте полный архив. Иначе сохраните стартовый JSON, затем освободите место.';
  }
  return error instanceof Error ? error.message : String(error);
}

export function App() {
  const legacyCatalog=useMemo(()=>createSyntheticRplScaleCatalog(2026),[]);
  const ligaCatalog=useMemo(()=>createLigaPrikolovPreviewCatalog(2026),[]);
  const [mode,setMode]=useState<PackMode>('liga');
  const catalog=mode==='liga'?ligaCatalog:legacyCatalog;
  const rounds = useMemo(() => generateDoubleRoundRobin(catalog.clubs.map(club => club.id)), [catalog]);
  const fixtureErrors = useMemo(
    () => validateDoubleRoundRobin(rounds, catalog.clubs.map(club => club.id)), [rounds, catalog],
  );
  const [selectedClubId, setSelectedClubId] = useState(ligaCatalog.clubs[0]!.id);
  const [storedIds,setStoredIds]=useState<readonly string[]>([]);
  const [storedId,setStoredId]=useState('');
  const [career, setCareer] = useState<InitialCareerSave | null>(null);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [message, setMessage] = useState(WELCOME_MESSAGE);
  const packSelect = useRef<HTMLSelectElement>(null);
  const [working, setWorking] = useState(false);
  const club = catalog.clubs.find(entry => entry.id === selectedClubId)!;
  useEffect(()=>{
    let alive=true;
    void listStoredInitialCareerIds().then(ids=>{
      if(alive)setStoredIds(ids);
    }).catch(()=>{ /* IndexedDB availability is reported by explicit save/load. */ });
    return()=>{alive=false;};
  },[]);
  useEffect(() => {
    if (manager) packSelect.current?.focus();
  }, [manager]);

  function modeForSaved(value:InitialCareerSave):PackMode|null{
    if(value.basePackId===legacyCatalog.packId&&
        value.basePackVersion===legacyCatalog.packVersion&&
        sameCanonicalValue(value.catalog,legacyCatalog))return 'demo';
    if(value.basePackId===ligaCatalog.packId&&
        value.basePackVersion===ligaCatalog.packVersion&&
        sameCanonicalValue(value.catalog,ligaCatalog))return 'liga';
    return null;
  }
  function switchPack(next:PackMode):void{
    setMode(next);
    setSelectedClubId(
      (next==='liga'?ligaCatalog:legacyCatalog).clubs[0]!.id);
    setCareer(null);
    setStoredId('');
    setMessage('Выбран другой набор клубов. Существующие сохранения не удалены.');
  }
  const firstRound = rounds[0]!;

  function startNewCareer(): void {
    setMode('liga');
    setSelectedClubId(ligaCatalog.clubs[0]!.id);
    setCareer(null);
    setManager(null);
    setStoredId('');
    setMessage(WELCOME_MESSAGE);
  }

  function createCareer(): void {
    if (!manager || working || fixtureErrors.length > 0) return;
    try {
      const careerId=mode==='liga'?
        'lp-career-'+crypto.randomUUID():CAREER_ID;
      // Secure per-career seed, persisted inside the immutable initial snapshot.
      // Old saves keep their original seed and exact source-replayed results.
      const seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;
      const next=createInitialCareer(catalog,selectedClubId,seed,careerId,manager);
      setManager(null);
      setStoredId(careerId);
      setCareer(next);
      setMessage('Карьера создана. При запуске сезона она автоматически сохранится в браузере.');
    } catch (error) {
      setMessage('Ошибка создания: ' + errorMessage(error));
    }
  }

  async function saveCareer(): Promise<void> {
    if (!career || working) return;
    setWorking(true);
    try {
      let alreadySaved=false;
      try{await saveNewInitialCareer(career);}
      catch(error){
        if(!(error instanceof CareerStorageError)||error.code!=='DUPLICATE')
          throw error;
        const stored=await loadInitialCareer(career.careerId);
        if(!sameCanonicalValue(stored,career))throw error;
        alreadySaved=true;
      }
      setMessage(alreadySaved?
        'Эта карьера уже сохранена в браузере. Данные не перезаписывались.':
        'Начальная карьера записана в IndexedDB. Повторная запись не перезапишет её.');
      try{setStoredIds(await listStoredInitialCareerIds());}
      catch{/* Save was successful; a failed listing must not claim failure. */}
    } catch (error) {
      setMessage('Сохранение отклонено: ' + errorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  async function restoreCareer(): Promise<void> {
    if (working) return;
    setWorking(true);
    try {
      const restored=await loadInitialCareer(storedId||CAREER_ID);
      const restoredMode=modeForSaved(restored);
      if(restoredMode===null){
        setMessage('Восстановление отклонено: неизвестная или изменённая версия игрового набора.');
        return;
      }
      const restoredCatalog=restoredMode==='liga'?ligaCatalog:legacyCatalog;
      if (!restoredCatalog.clubs.some(entry => entry.id === restored.selectedClubId)) {
        setMessage('Восстановление отклонено: клуб отсутствует в тестовой базе. Текущее состояние не изменено.');
        return;
      }
      setMode(restoredMode);
      setCareer(restored);
      setManager(null);
      setSelectedClubId(restored.selectedClubId);
      setStoredId(restored.careerId);
      setMessage('Стартовая карьера восстановлена и проверена по SHA-256.');
    } catch (error) {
      setMessage('Восстановление отклонено: ' + errorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  async function downloadCareer(): Promise<void> {
    if (!career || working) return;
    setWorking(true);
    try {
      const json = await exportInitialCareer(career);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = career.careerId===CAREER_ID?
        'footclubsim-initial-career.json':
        'footclubsim-'+career.careerId+'.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Файл JSON экспортирован. Он содержит только стартовую карьеру, без сыгранных матчей.');
    } catch (error) {
      setMessage('Экспорт отклонён: ' + errorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  async function downloadFullCareer():Promise<void>{
    if(!career||working)return;
    setWorking(true);
    try{
      const json=await exportM1V188FullCareerBackup(career.careerId);
      const url=URL.createObjectURL(new Blob([json],
        {type:'application/json'}));
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download='footclubsim-'+career.careerId+'-full-career.json';
      document.body.append(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage('Полный архив создан: стартовая карьера и все сыгранные матчи. Храните файл отдельно от браузера.');
    }catch(error){
      setMessage('Полный экспорт не выполнен: '+errorMessage(error)+
        '. Сначала откройте сезон, если он ещё не создан.');
    }finally{setWorking(false);}
  }

  async function importFullCareer(event:ChangeEvent<HTMLInputElement>):Promise<void>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!file||working)return;
    if(file.size>150_000_000){
      setMessage('Импорт полного архива отклонён: файл слишком большой.');
      return;
    }
    setWorking(true);
    try{
      const restored=await restoreM1V188FullCareerBackup(
        await file.text(),[legacyCatalog,ligaCatalog]);
      const restoredMode=modeForSaved(restored.initial);
      if(restoredMode===null)throw Error('Неверный игровой набор');
      setMode(restoredMode);setCareer(restored.initial);
      setManager(null);
      setSelectedClubId(restored.initial.selectedClubId);
      setStoredId(restored.initial.careerId);
      try{setStoredIds(await listStoredInitialCareerIds());}
      catch{ /* Full import completed; list is only a convenience. */ }
      setMessage('Полная карьера восстановлена. Сыграно матчей: '+
        restored.journal.revision+' из 240. Можно продолжать сезон.');
    }catch(error){
      setMessage('Импорт полного архива отклонён: '+errorMessage(error)+
        '. Существующие сохранения не перезаписаны.');
    }finally{setWorking(false);}
  }

  async function importCareer(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || working) return;
    if (file.size > 5_000_000) {
      setMessage('Импорт отклонён: файл превышает 5 МБ.');
      return;
    }
    setWorking(true);
    try {
      const imported = await importInitialCareer(await file.text());
      if (!imported.ok) {
        setMessage('Импорт отклонён: ' + imported.error + '. Текущее состояние не изменено.');
        return;
      }
      const importedMode=modeForSaved(imported.value);
      if(importedMode===null){
        setMessage('Импорт отклонён: неизвестная версия игрового набора.');
        return;
      }
      if(importedMode==='demo'&&imported.value.careerId!==CAREER_ID||
          importedMode==='liga'&&
          !imported.value.careerId.startsWith('lp-career-')){
        setMessage('Импорт отклонён: идентификатор карьеры отличается. Текущее состояние не изменено.');
        return;
      }
      const importedCatalog=importedMode==='liga'?ligaCatalog:legacyCatalog;
      if (!importedCatalog.clubs.some(entry => entry.id === imported.value.selectedClubId)) {
        setMessage('Импорт отклонён: клуб отсутствует в тестовой базе. Текущее состояние не изменено.');
        return;
      }
      setMode(importedMode);
      setCareer(imported.value);
      setManager(null);
      setSelectedClubId(imported.value.selectedClubId);
      setStoredId(imported.value.careerId);
      setMessage('Стартовая карьера проверена и загружена в память, без перезаписи IndexedDB.');
    } catch (error) {
      setMessage('Ошибка импорта: ' + errorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div className="brand"><span className="brand-mark" aria-hidden="true">FC</span>
          <span>FootClubSim</span></div>
        <span className="edition">Версия 0.0.0 · игровой прототип</span>
      </header>

      <section className="hero" aria-labelledby="welcome">
        <p className="eyebrow">Футбольный клуб под вашим руководством</p>
        <h1 id="welcome">Начните свою карьеру</h1>
        <p>Создайте тренера, выберите клуб и проведите первый сезон: матчи, результаты, турнирная таблица и сохранение прогресса. Пока это игровая пробная версия на вымышленных командах и составах.</p>
      </section>

      <section className="metrics" aria-label="Тестовая лига">
        <div><strong>{catalog.clubs.length}</strong><span>клубов</span></div>
        <div><strong>{catalog.players.length}</strong><span>футболистов</span></div>
        <div><strong>{rounds.length}</strong><span>туров</span></div>
        <div><strong>{rounds.reduce((sum, round) => sum + round.fixtures.length, 0)}</strong><span>матчей в календаре</span></div>
      </section>

      <details className="panel identities-details">
        <summary>Клубы «Лиги приколов» · утверждённые эмблемы</summary>
        <p className="subtle">{mode==='liga'?
          'Утверждённые оригинальные названия и эмблемы команд пробного сезона. Составы пока полностью синтетические.':
          'Предпросмотр будущей «Лиги приколов»: демонстрационная M0-карьера использует отдельные клубы.'}</p>
        <div className="club-identity-grid">
          {LIGA_PRIKOLOV_IDENTITIES.map(entry => <div className="club-identity" key={entry.id}>
            <ClubBadge club={entry} size={58} />
            <span>{entry.name}</span>
          </div>)}
        </div>
      </details>

      {!career && !manager && <ManagerProfileSetup disabled={working}
        onConfirm={profile => {
          setManager(profile);
          setMessage('Тренер подтверждён. Теперь выберите клуб.');
        }} />}

      <div className="columns">
        <section className="panel" aria-labelledby="club-title">
          <h2 id="club-title">2. Ваш клуб</h2>
          {!career && !manager && <p className="subtle">Сначала подтвердите профиль тренера.</p>}
          {manager && <p>Тренер: <strong>{manager.displayName}</strong></p>}
          <label htmlFor="pack-select">Игровой набор</label>
          <select id="pack-select" ref={packSelect} value={mode} disabled={working || !manager}
            onChange={event=>switchPack(event.target.value as PackMode)}>
            <option value="liga">Лига приколов · оригинальные клубы</option>
            <option value="demo">Технический деморежим M0</option>
          </select>
          <p className="subtle">{mode==='liga'?
            'Утверждённые вымышленные клубы; футболисты и характеристики полностью синтетические. Это ещё не подтверждённые составы РПЛ.':
            'Старый синтетический набор сохраняется для совместимости и тестов.'}</p>
          <label htmlFor="club-select">Выберите команду</label>
          <select id="club-select" value={selectedClubId} disabled={working || !manager}
            onChange={event => {
              setSelectedClubId(event.target.value);
              setCareer(null);
              setStoredId('');
              setMessage('Выбран другой клуб. Создайте новую карьеру: уже сохранённые сезоны не изменятся.');
            }}>
            {catalog.clubs.map(entry =>
              <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}
          </select>
          {mode==='liga'&&<div className="selected-club-badge">
            {LIGA_PRIKOLOV_IDENTITIES.filter(identity=>
              identity.id===selectedClubId).map(identity=>
              <ClubBadge key={identity.id} club={identity} size={66} />)}
            <strong>{club.displayName}</strong>
          </div>}
          <p className="subtle">В заявке: {club.registeredPlayerIds.length} игроков. Все имена и характеристики созданы генератором.</p>
          <div className="button-stack">
            {career ? <button type="button" onClick={startNewCareer} disabled={working}>
              Новая карьера
            </button> : <button type="button" onClick={createCareer}
              disabled={working || !manager || fixtureErrors.length > 0}>
              Создать стартовую карьеру
            </button>}
            {manager && <button type="button" className="secondary-button" disabled={working}
              onClick={() => { setManager(null); setMessage(WELCOME_MESSAGE); }}>
              Выбрать другого тренера
            </button>}
          </div>
          {career && <div className="career-info">
            <strong>Активная карьера</strong>
            <span>Клуб: {catalog.clubs.find(entry => entry.id === career.selectedClubId)?.displayName}</span>
            <span>Ревизия {career.revision} · схема сохранения {career.saveSchemaVersion}</span>
            {career.managerProfile && <SavedManagerProfile profile={career.managerProfile} />}
          </div>}
        </section>

        <section className="panel" aria-labelledby="save-title">
          <h2 id="save-title">Сохранения</h2>
          <p className="subtle">Стартовое состояние хранится локально. Уже записанная карьера не перезаписывается.</p>
          <p className="subtle">Обычный JSON сохраняет только начальные данные. Полный архив включает и журнал матчей; храните его вне браузера.</p>
          <label htmlFor="career-saved-select">Сохранённые карьеры</label>
          <select id="career-saved-select" value={storedId}
            onChange={event=>setStoredId(event.target.value)}
            disabled={working}>
            <option value="">Сохранение не выбрано</option>
            {storedId&&!storedIds.includes(storedId)&&
              <option value={storedId}>Текущая карьера</option>}
            {storedIds.map(id=><option key={id} value={id}>
              {id===CAREER_ID?'Демокарьера M0':
                'Лига приколов · '+id.slice(-12)}
            </option>)}
          </select>
          <div className="button-stack">
            <button type="button" onClick={() => void saveCareer()} disabled={!career || working}>Сохранить в браузере</button>
            <button type="button" onClick={() => void restoreCareer()} disabled={working}>Восстановить из браузера</button>
            <button type="button" onClick={() => void downloadCareer()} disabled={!career || working}>Экспортировать JSON</button>
            <button type="button" onClick={() => void downloadFullCareer()} disabled={!career || working}>Скачать полную карьеру</button>
          </div>
          <label className="file-label" htmlFor="import-file">Импортировать JSON</label>
          <input id="import-file" type="file" accept=".json,application/json" onChange={event => void importCareer(event)} disabled={working} />
          <label className="file-label" htmlFor="import-full-file">Восстановить полную карьеру</label>
          <input id="import-full-file" type="file" accept=".json,application/json" onChange={event => void importFullCareer(event)} disabled={working} />
        </section>
      </div>

      {career && <M1LeagueSeason key={career.careerId}
        career={career} disabled={working}
        onCareerStored={()=>{
          void listStoredInitialCareerIds().then(setStoredIds)
            .catch(()=>{/* Stored career remains valid if listing fails. */});
        }} />}
      {career && <details className="panel technical-tests">
        <summary>Технические сценарии движка (для разработчиков)</summary>
        <p className="subtle">Два отдельных старых журнала для регрессионных проверок. Они не изменяют сезон выше.</p>
        <M1Playtest key={career.selectedClubId} career={career} disabled={working} />
        <M1DensePlaytest key={career.selectedClubId} career={career} disabled={working} />
      </details>}

      {!career&&<section className="panel" aria-labelledby="schedule-title">
        <h2 id="schedule-title">Календарь · тур {firstRound.number}</h2>
        <p className="subtle">Тестовое двухкруговое расписание. Это не официальный календарь РПЛ.</p>
        <ol className="matches">
          {firstRound.fixtures.map(fixture => <li key={fixture.id}>
            <span>{catalog.clubs.find(entry => entry.id === fixture.homeClubId)?.displayName}</span>
            <span className="versus">vs</span>
            <span>{catalog.clubs.find(entry => entry.id === fixture.awayClubId)?.displayName}</span>
          </li>)}
        </ol>
      </section>}

      <p className="status" role="status" aria-live="polite">{fixtureErrors.length ?
        'Календарь некорректен: ' + fixtureErrors[0]!.code : message}</p>
      <footer>Пока это первый пробный сезон: трансферы и финансы ещё впереди. Результаты матчей сохраняются в браузере. Полный архив включает весь сезон; обычный JSON только стартовые данные.</footer>
    </main>
  );
}
