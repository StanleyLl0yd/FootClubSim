import {useMemo,useState} from 'react';
import {sameCanonicalValue} from '../core/canonical-value.js';
import {deriveM1V188ProvisionalTable}
  from '../core/m1-v188-provisional-table.js';
import {inspectM1V188LeagueCalendar,prepareM1V188LeagueMatch,
  type M1V188Journal,type M1V188Proposal}
  from '../core/m1-v188-league-source-journal.js';
import type {M1V105Run} from '../core/m1-v105-special-goal-chronology.js';
import type {InitialCareerSave} from '../core/save.js';
import {loadInitialCareer} from '../browser/initial-career-store.js';
import {createM1V188PersistedLeague,loadM1V188PersistedLeague,
  commitM1V188PersistedLeagueMatch,M1V188StorageError}
  from '../browser/m1-v188-league-store.js';

type Ready=Extract<M1V188Proposal,{ok:true}>;
type Good=Extract<M1V105Run,{ok:true}>;
const errorText=(error:unknown)=>
  error instanceof Error?error.message:String(error);

/**
 * First player-facing browser season slice. Uses the existing two-team
 * v188 domain and its independent replay/CAS store; no parallel match engine.
 */
export function M1LeagueSeason({career,disabled}:{
  readonly career:InitialCareerSave;readonly disabled:boolean;
}){
  const [journal,setJournal]=useState<M1V188Journal|null>(null);
  const [preview,setPreview]=useState<Ready|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState(
    'Сначала сохраните начальную карьеру, затем нажмите «Начать или продолжить сезон».');
  const calendar=useMemo(()=>inspectM1V188LeagueCalendar(career),[career]);
  const fixtures=calendar.ok?calendar.fixtures:[];
  const clubs=useMemo(()=>new Map(
    career.catalog.clubs.map(club=>[club.id,club.displayName])),[career]);
  const table=useMemo(()=>journal?
    deriveM1V188ProvisionalTable(career,journal):null,[career,journal]);
  const saved=useMemo(()=>new Map(
    (journal?.entries??[]).map(entry=>[entry.fixtureId,entry])),
  [journal]);
  const next=journal?fixtures[journal.revision]:null;
  const ownNext=journal?fixtures.slice(journal.revision).find(f=>
    f.homeClubId===career.selectedClubId||
    f.awayClubId===career.selectedClubId):null;
  const last=journal?.entries.at(-1);
  const lastFixture=last?fixtures[journal!.revision-1]:null;
  const round=next?.round??30;
  const roundFixtures=journal?fixtures.filter(f=>f.round===round):[];
  const previewResult=preview?.request.result as Good|undefined;

  async function connect():Promise<void>{
    if(busy||disabled)return;
    setBusy(true);setPreview(null);
    try{
      const stored=await loadInitialCareer(career.careerId);
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
    }catch(error){
      setJournal(null);
      setStatus('Не удалось открыть сезон: '+errorText(error)+
        '. Уже сохранённые данные не изменены.');
    }finally{setBusy(false);}
  }

  function calculate():void{
    if(busy||disabled||!journal||preview)return;
    try{
      const prepared=prepareM1V188LeagueMatch(career,journal);
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
      setStatus('Матч №'+updated.revision+
        ' записан в браузер. Результат и таблица обновлены.');
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
        {next&&<div className="season-next">
          <span className="subtle">Следующая игра · тур {next.round}</span>
          <strong>{clubs.get(next.homeClubId)} — {clubs.get(next.awayClubId)}</strong>
          <div className="button-stack">
            <button type="button" disabled={busy||disabled||!!preview}
              onClick={calculate}>Рассчитать матч</button>
            <button type="button" disabled={busy||disabled||!!preview}
              className="secondary-button"
              onClick={()=>void connect()}>Обновить сохранение</button>
          </div>
        </div>}
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
                    <td>{row.goalDifference>0?'+':''}{row.goalDifference}</td>
                    <td><strong>{row.points}</strong></td>
                  </tr>)}</tbody>
              </table>:
              <p role="alert">Таблица недоступна: журнал не соответствует календарю.</p>}
          </div>
        </div>
      </>}
    <p className="subtle" role="status" aria-live="polite">{status}</p>
  </section>;
}
