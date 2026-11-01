import { useEffect, useMemo, useState } from 'react';
import { loadInitialCareer } from '../browser/initial-career-store.js';
import {
  commitM1V8PersistedBatch, createM1V8PersistedJournal,
  loadM1V8PersistedJournal, M1V8PersistenceError,
} from '../browser/m1-v8-journal-store.js';
import { sameCanonicalValue } from '../core/canonical-value.js';
import { prepareM1V113PlayableMatch,
  type M1V113Playtest, type M1V113Scenario }
  from '../core/m1-v113-browser-playtest.js';
import type { M1V8MatchJournal } from '../core/m1-v8-result-journal.js';
import type { InitialCareerSave } from '../core/save.js';

type Ready = Extract<M1V113Playtest, { ok: true }>;
const OPTIONS: ReadonlyArray<{ value: M1V113Scenario; label: string }> = [
  { value: 'ordinary', label: 'Обычный матч' },
  { value: 'temporary-treatment', label: 'Временная медицинская помощь' },
  { value: 'normal-substitution', label: 'Замена на 5-й минуте' },
  { value: 'combined', label: 'Медицинская помощь и замена' },
];
const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function M1Playtest({ career, disabled }: {
  readonly career: InitialCareerSave;
  readonly disabled: boolean;
}) {
  const [journal, setJournal] = useState<M1V8MatchJournal | null>(null);
  const [scenario, setScenario] = useState<M1V113Scenario>('ordinary');
  const [preview, setPreview] = useState<Ready | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    'Для начала сначала сохраните исходную карьеру M0 в браузере.',
  );

  useEffect(() => {
    setJournal(null);
    setPreview(null);
    setStatus('Подключите сохранённую карьеру к отдельному журналу M1.');
  }, [career]);

  const next = useMemo(() => journal ?
    prepareM1V113PlayableMatch(career, journal, 'ordinary') : null,
  [career, journal]);

  async function connect(): Promise<void> {
    if (busy || disabled) return;
    setBusy(true);
    setPreview(null);
    try {
      const stored = await loadInitialCareer(career.careerId);
      if (!sameCanonicalValue(stored, career)) {
        setStatus('Сохранение M0 в браузере отличается от выбранного. Журнал не создан.');
        return;
      }
      let current: M1V8MatchJournal;
      try {
        current = await loadM1V8PersistedJournal(career.careerId);
      } catch (error) {
        if (!(error instanceof M1V8PersistenceError) ||
            error.code !== 'NOT_FOUND') throw error;
        try {
          current = await createM1V8PersistedJournal(career.careerId);
        } catch (creationError) {
          if (!(creationError instanceof M1V8PersistenceError) ||
              creationError.code !== 'ALREADY_EXISTS') throw creationError;
          current = await loadM1V8PersistedJournal(career.careerId);
        }
      }
      setJournal(current);
      setStatus('Проверен исходный M0 и весь сохранённый журнал M1.');
    } catch (error) {
      setJournal(null);
      setStatus('Подключение отклонено: ' + errorText(error));
    } finally {
      setBusy(false);
    }
  }

  function simulate(): void {
    if (busy || disabled || !journal) return;
    setPreview(null);
    const nextMatch = prepareM1V113PlayableMatch(career, journal, scenario);
    if (nextMatch === null) {
      setStatus('Матчи выбранного клуба в тестовом календаре завершены.');
    } else if (!nextMatch.ok) {
      setStatus('Симуляция отклонена: ' + nextMatch.error);
    } else {
      setPreview(nextMatch);
      setStatus('Матч рассчитан. Результат пока не записан. Проверьте его и подтвердите.');
    }
  }

  async function commit(): Promise<void> {
    if (busy || disabled || !journal || !preview) return;
    setBusy(true);
    const request = structuredClone(preview.request);
    const expectedRevision = journal.revision;
    setPreview(null);
    try {
      const updated = await commitM1V8PersistedBatch(
        career.careerId, expectedRevision, [request],
      );
      setJournal(updated);
      setStatus('Матч подтверждён, независимо перепроверен и сохранён через IndexedDB CAS.');
    } catch (error) {
      try {
        const current = await loadM1V8PersistedJournal(career.careerId);
        setJournal(current);
        setStatus('Запись отклонена: ' + errorText(error) +
          '. Сохранённое состояние перечитано без перезаписи.');
      } catch (reloadError) {
        setJournal(null);
        setStatus('Запись не подтверждена: ' + errorText(error) +
          '. Не удалось проверить хранилище: ' + errorText(reloadError));
      }
    } finally {
      setBusy(false);
    }
  }

  const clubs = new Map(career.catalog.clubs.map(c => [c.id, c.displayName]));
  const latest = journal?.results.at(-1);
  return (
    <section className="panel" aria-labelledby="m1-playtest-title">
      <h2 id="m1-playtest-title">M1 · тестовая карьера с матчами</h2>
      <p className="subtle">
        Изолированный игровой прототип: виртуальные судейские и медицинские
        события не являются официально удостоверенными. Исходное сохранение
        M0 остаётся неизменным; таблица, санкции и полноценная карьера ещё не приняты.
      </p>
      <div className="button-stack">
        <button type="button" onClick={() => void connect()}
          disabled={disabled || busy}>
          {journal ? 'Перепроверить и загрузить журнал' : 'Начать или продолжить M1'}
        </button>
      </div>
      {journal && <>
        <p className="subtle">
          Сохранено матчей выбранного клуба: {journal.results.length} из 30.
          Ревизия журнала: {journal.revision}.
        </p>
        {latest && <p>
          Последний: {clubs.get(latest.homeClubId)}{' '}
          <strong>{latest.dossier.match.home.goals} : {latest.dossier.match.away.goals}</strong>{' '}
          {clubs.get(latest.awayClubId)}
        </p>}
        {next?.ok && <p>
          Следующий матч (тур {next.fixture.round}):{' '}
          <strong>{clubs.get(next.fixture.homeClubId)} — {clubs.get(next.fixture.awayClubId)}</strong>
        </p>}
        {next && !next.ok && <p role="alert">
          Дальнейшее участие заблокировано: {next.error}.
          Нужна проверка медицинских/дисциплинарных решений P3.
        </p>}
        {next === null && <p>Календарь матчей вашего клуба завершён.</p>}
        {next?.ok && <>
          <label htmlFor="m1-playtest-scenario">Сценарий матча</label>
          <select id="m1-playtest-scenario" value={scenario}
            onChange={event => {
              setScenario(event.target.value as M1V113Scenario);
              setPreview(null);
            }} disabled={disabled || busy}>
            {OPTIONS.map(option => <option key={option.value}
              value={option.value}>{option.label}</option>)}
          </select>
          <div className="button-stack m1-actions">
            <button type="button" onClick={simulate}
              disabled={disabled || busy}>Рассчитать матч</button>
          </div>
        </>}
        {preview && <div className="m1-preview">
          <strong>Результат · тур {preview.fixture.round}</strong>
          <p>{clubs.get(preview.fixture.homeClubId)}{' '}
            <strong>{preview.request.result.report.home.goals} :{' '}
              {preview.request.result.report.away.goals}</strong>{' '}
            {clubs.get(preview.fixture.awayClubId)}</p>
          <p className="subtle">
            Удары: {preview.request.result.report.home.shots} —{' '}
            {preview.request.result.report.away.shots};
            в створ: {preview.request.result.report.home.shotsOnTarget} —{' '}
            {preview.request.result.report.away.shotsOnTarget}.
            Медицинских событий: {preview.request.medicalActions.length};
            замен: {preview.request.plannedCommands.length}.
          </p>
          <div className="button-stack">
            <button type="button" onClick={() => void commit()}
              disabled={disabled || busy}>Подтвердить и сохранить матч</button>
            <button type="button" onClick={() => setPreview(null)}
              disabled={disabled || busy}>Отменить результат</button>
          </div>
        </div>}
      </>}
      <p className="subtle" role="status" aria-live="polite">{status}</p>
    </section>
  );
}
