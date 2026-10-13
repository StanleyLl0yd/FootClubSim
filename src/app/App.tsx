import { useMemo, useState, type ChangeEvent } from 'react';
import { createSyntheticRplScaleCatalog } from '../core/synthetic.js';
import { generateDoubleRoundRobin } from '../core/fixtures.js';
import { validateDoubleRoundRobin } from '../core/fixture-validation.js';
import { createInitialCareer, exportInitialCareer, importInitialCareer, type InitialCareerSave } from '../core/save.js';
import { loadInitialCareer, saveNewInitialCareer } from '../browser/initial-career-store.js';

const CAREER_ID = 'm0-ui-initial-career';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function App() {
  const catalog = useMemo(() => createSyntheticRplScaleCatalog(2026), []);
  const rounds = useMemo(() => generateDoubleRoundRobin(catalog.clubs.map(club => club.id)), [catalog]);
  const fixtureErrors = useMemo(
    () => validateDoubleRoundRobin(rounds, catalog.clubs.map(club => club.id)), [rounds, catalog],
  );
  const [selectedClubId, setSelectedClubId] = useState(catalog.clubs[0]!.id);
  const [career, setCareer] = useState<InitialCareerSave | null>(null);
  const [message, setMessage] = useState('Выберите вымышленный клуб и создайте стартовую карьеру.');
  const [working, setWorking] = useState(false);
  const club = catalog.clubs.find(entry => entry.id === selectedClubId)!;
  const firstRound = rounds[0]!;

  function createCareer(): void {
    try {
      const next = createInitialCareer(catalog, selectedClubId, 42, CAREER_ID);
      setCareer(next);
      setMessage('Стартовая карьера создана в памяти браузера. Матчи пока не рассчитываются.');
    } catch (error) {
      setMessage('Ошибка создания: ' + errorMessage(error));
    }
  }

  async function saveCareer(): Promise<void> {
    if (!career || working) return;
    setWorking(true);
    try {
      await saveNewInitialCareer(career);
      setMessage('Начальная карьера записана в IndexedDB. Повторная запись не перезапишет её.');
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
      const restored = await loadInitialCareer(CAREER_ID);
      if (restored.basePackId !== catalog.packId ||
          restored.basePackVersion !== catalog.packVersion) {
        setMessage('Восстановление отклонено: сохранение относится к другой версии тестовой базы. Существующее сохранение не изменено.');
        return;
      }
      setCareer(restored);
      setSelectedClubId(restored.selectedClubId);
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
      anchor.download = 'footclubsim-initial-career.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Файл JSON экспортирован.');
    } catch (error) {
      setMessage('Экспорт отклонён: ' + errorMessage(error));
    } finally {
      setWorking(false);
    }
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
      if (imported.value.basePackId !== catalog.packId ||
          imported.value.basePackVersion !== catalog.packVersion) {
        setMessage('Импорт отклонён: версия тестовой базы отличается. Текущее состояние не изменено.');
        return;
      }
      setCareer(imported.value);
      setSelectedClubId(imported.value.selectedClubId);
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
        <span className="edition">Версия 0.0.0 · M0</span>
      </header>

      <section className="hero" aria-labelledby="welcome">
        <p className="eyebrow">Футбольный клуб под вашим руководством</p>
        <h1 id="welcome">Начало карьеры</h1>
        <p>Первый технический прототип будущего футбольного менеджера. Выберите клуб и проверьте сохранение. Все команды и футболисты пока вымышленные.</p>
      </section>

      <section className="metrics" aria-label="Тестовая лига">
        <div><strong>{catalog.clubs.length}</strong><span>клубов</span></div>
        <div><strong>{catalog.players.length}</strong><span>футболистов</span></div>
        <div><strong>{rounds.length}</strong><span>туров</span></div>
        <div><strong>{rounds.reduce((sum, round) => sum + round.fixtures.length, 0)}</strong><span>матчей в календаре</span></div>
      </section>

      <div className="columns">
        <section className="panel" aria-labelledby="club-title">
          <h2 id="club-title">Ваш клуб</h2>
          <label htmlFor="club-select">Выберите команду</label>
          <select id="club-select" value={selectedClubId}
            onChange={event => setSelectedClubId(event.target.value)}>
            {catalog.clubs.map(entry =>
              <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}
          </select>
          <p className="subtle">В заявке: {club.registeredPlayerIds.length} игроков. Все имена и характеристики созданы генератором.</p>
          <button type="button" onClick={createCareer} disabled={working || fixtureErrors.length > 0}>
            Создать стартовую карьеру
          </button>
          {career && <div className="career-info">
            <strong>Активная карьера</strong>
            <span>Клуб: {catalog.clubs.find(entry => entry.id === career.selectedClubId)?.displayName}</span>
            <span>Ревизия {career.revision} · схема сохранения {career.saveSchemaVersion}</span>
          </div>}
        </section>

        <section className="panel" aria-labelledby="save-title">
          <h2 id="save-title">Сохранения</h2>
          <p className="subtle">Стартовое состояние хранится локально. Уже записанная карьера не перезаписывается.</p>
          <div className="button-stack">
            <button type="button" onClick={() => void saveCareer()} disabled={!career || working}>Сохранить в браузере</button>
            <button type="button" onClick={() => void restoreCareer()} disabled={working}>Восстановить из браузера</button>
            <button type="button" onClick={() => void downloadCareer()} disabled={!career || working}>Экспортировать JSON</button>
          </div>
          <label className="file-label" htmlFor="import-file">Импортировать JSON</label>
          <input id="import-file" type="file" accept=".json,application/json" onChange={event => void importCareer(event)} disabled={working} />
        </section>
      </div>

      <section className="panel" aria-labelledby="schedule-title">
        <h2 id="schedule-title">Календарь · тур {firstRound.number}</h2>
        <p className="subtle">Тестовое двухкруговое расписание. Это не официальный календарь РПЛ.</p>
        <ol className="matches">
          {firstRound.fixtures.map(fixture => <li key={fixture.id}>
            <span>{catalog.clubs.find(entry => entry.id === fixture.homeClubId)?.displayName}</span>
            <span className="versus">vs</span>
            <span>{catalog.clubs.find(entry => entry.id === fixture.awayClubId)?.displayName}</span>
          </li>)}
        </ol>
      </section>

      <p className="status" role="status" aria-live="polite">{fixtureErrors.length ?
        'Календарь некорректен: ' + fixtureErrors[0]!.code : message}</p>
      <footer>В M0 ещё нет матчевого движка, трансферов, финансов и многосезонной карьеры. Разработка ведётся локально, без обязательного сервера.</footer>
    </main>
  );
}
