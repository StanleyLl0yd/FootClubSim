import {useMemo,useState} from 'react';
import { prepareM1V124DenseVirtualRefereeMatch }
  from '../core/m1-v124-dense-internal-referee.js';
import { reviewM1V126DenseSourceHolds,
  type M1V126DenseHoldReview }
  from '../core/m1-v126-dense-source-holds.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V130ManualVirtualRefereeContinuation}
  from '../core/m1-v130-manual-virtual-referee.js';
import {prepareM1V132DenseManagerSubstitution}
  from '../core/m1-v132-dense-manager-substitution.js';
import type {M1PrematchInput} from '../core/m1-clock.js';
import { prepareM1V122DenseOrdinaryMatch }
  from '../core/m1-v122-dense-ordinary-season.js';
import type { InitialCareerSave } from '../core/save.js';
import type { M1V120Journal }
  from '../core/m1-v120-playable-journal.js';
import { createM1V120PersistedJournal, loadM1V120PersistedJournal,
  commitM1V120PersistedSource, M1V120StorageError }
  from '../browser/m1-v120-journal-store.js';

/** v120 has its own journal, strictly isolated from existing v8 careers. */
export function M1DensePlaytest({career,disabled}:{
  career:InitialCareerSave;disabled:boolean;
}){
  const [journal,setJournal]=useState<M1V120Journal|null>(null);
  const [message,setMessage]=useState('Пробный плотный движок v120 пока не подключён.');
  const [busy,setBusy]=useState(false);
  const [holdReview,setHoldReview]=useState<M1V126DenseHoldReview|null>(null);
  const [outId,setOutId]=useState('');
  const [inId,setInId]=useState('');
  const [checkpoint,setCheckpoint]=useState(900);
  const nextCandidate=useMemo(()=>journal&&holdReview?.ok&&journal.revision<30?
    prepareM1V128ManualFictionalContinuation(career,journal):null,
  [career,journal,holdReview]);
  const prematch=nextCandidate?.ok?
    nextCandidate.request.prematch as M1PrematchInput:null;
  const clubLineup=prematch?
    prematch.fixture.homeClubId===career.selectedClubId?
      prematch.homeLineup:prematch.awayLineup:null;
  const outOptions=clubLineup?.starters??[];
  const actualOut=outOptions.includes(outId)?outId:outOptions[0]??'';
  const availableIn=(clubLineup?.bench??[]).filter(id=>{
    const outgoing=career.catalog.players.find(p=>p.id===actualOut);
    const incoming=career.catalog.players.find(p=>p.id===id);
    return (outgoing?.primaryPosition==='GK')===
      (incoming?.primaryPosition==='GK');
  });
  const actualIn=availableIn.includes(inId)?inId:availableIn[0]??'';
  async function connect(){
    if(busy||disabled)return;
    setBusy(true);
    try{
      let loaded:M1V120Journal;
      try{loaded=await loadM1V120PersistedJournal(career.careerId);}
      catch(error){
        if(!(error instanceof M1V120StorageError)||
            error.code!=='NOT_FOUND')throw error;
        loaded=await createM1V120PersistedJournal(career.careerId);
      }
      const reviewed=reviewM1V126DenseSourceHolds(career,loaded);
      if(!reviewed.ok){
        setJournal(null);
        setHoldReview(reviewed);
        throw Error(reviewed.error);
      }
      setJournal(loaded);
      setHoldReview(reviewed);
      setMessage('v120: проверен и загружен отдельный журнал, матчей: '+
        loaded.revision+'.');
    }catch(error){
      setMessage('v120: запись/восстановление отклонены: '+
        (error instanceof Error?error.message:String(error)));
    }finally{setBusy(false);}
  }
  async function playNext(mode:'ordinary'|'virtual'|'manual'|'manual-virtual'|
    'substitution'='ordinary'){
    if(busy||disabled||!journal||!holdReview?.ok)return;
    setBusy(true);
    try{
      const prepared=mode==='virtual'?
        prepareM1V124DenseVirtualRefereeMatch(career,journal):
        mode==='manual'?
          prepareM1V128ManualFictionalContinuation(career,journal):
          mode==='manual-virtual'?
            prepareM1V130ManualVirtualRefereeContinuation(career,journal):
            mode==='substitution'?
              prepareM1V132DenseManagerSubstitution(career,journal,{
                outPlayerId:actualOut,inPlayerId:actualIn,
                elapsedSeconds:checkpoint}):
              prepareM1V122DenseOrdinaryMatch(career,journal);
      if(prepared===null){
        setMessage('v120: все 30 матчей выбранного клуба сохранены.');
        return;
      }
      if(!prepared.ok)throw Error(prepared.error);
      const persisted=await commitM1V120PersistedSource(
        career.careerId,journal.revision,prepared.request);
      const reviewed=reviewM1V126DenseSourceHolds(career,persisted);
      setJournal(persisted);
      setHoldReview(reviewed);
      if(!reviewed.ok){
        setMessage('v120: матч сохранён, но проверка ограничений отклонена: '+
          reviewed.error+'. Продолжение заблокировано.');
        return;
      }
      setMessage('v120: '+(mode==='virtual'?'виртуальный арбитр, ':
        mode==='manual'?'модельное продолжение, ':
        mode==='manual-virtual'?'повторный виртуальный арбитр, ':
        mode==='substitution'?'выбранная замена, ':'')+
        'плотный матч атомарно записан, 270 PRNG draws, ревизия '+
        persisted.revision+' из 30. Активных ограничений: '+
        reviewed.holds.filter(hold=>hold.activeForNextFixture).length+'.');
    }catch(error){
      setMessage('v120: сохранение отклонено: '+
        (error instanceof Error?error.message:String(error)));
    }finally{setBusy(false);}
  }
  return <section className="panel" aria-labelledby="m1-dense-title">
    <h2 id="m1-dense-title">M1 · экспериментальный плотный матч v120</h2>
    <p className="subtle">Отдельная тестовая ветка карьеры: 100-секундные слоты
      ударов и независимая проверка исходного источника. Виртуальный арбитр
      создаёт только вымышленные карточки и травмы, но не медицинские или
      дисциплинарные решения реальных органов. После исключительного события
      обычный сценарий блокируется; ручное продолжение применяет только
      проверенные модельные ограничения своего клуба, без истории соперников.</p>
    <div className="button-stack">
      <button type="button" disabled={busy||disabled}
        onClick={()=>void connect()}>Создать или загрузить отдельный v120</button>
      <button type="button" disabled={busy||disabled||!journal||journal.revision>=30||!holdReview?.ok}
        onClick={()=>void playNext()}>Рассчитать и сохранить следующий матч v120</button>
      <button type="button" disabled={busy||disabled||!journal||journal.revision>=30||
        !holdReview?.ok||journal.entries.some(entry=>
          entry.source.plannedCommands.length!==0||
          entry.source.checkpointMedical.length!==0||
          entry.source.intraphaseMedical.length!==0||
          entry.source.trustedDecisions.length!==0)}
        onClick={()=>void playNext('virtual')}>
        Рассчитать следующий матч с виртуальным арбитром
      </button>
      <button type="button" disabled={busy||disabled||!journal||journal.revision>=30||
        !holdReview?.ok||!journal.entries.some(entry=>
          entry.source.plannedCommands.length!==0)}
        onClick={()=>void playNext('manual')}>
        Продолжить с вымышленными ограничениями
      </button>
      <button type="button" disabled={busy||disabled||!journal||journal.revision>=30||
        !holdReview?.ok||!journal.entries.some(entry=>
          entry.source.plannedCommands.length!==0)}
        onClick={()=>void playNext('manual-virtual')}>
        Следующий матч с виртуальным арбитром и ограничениями
      </button>
      <fieldset disabled={busy||disabled||!nextCandidate?.ok}>
        <legend>Замена игрока в плотном матче</legend>
        <label htmlFor="m1-dense-sub-out">Уходит с поля</label>
        <select id="m1-dense-sub-out" value={actualOut}
          onChange={event=>{setOutId(event.target.value);setInId('');}}>
          {outOptions.map(id=><option key={id} value={id}>{id}</option>)}
        </select>
        <label htmlFor="m1-dense-sub-in">Выходит на поле</label>
        <select id="m1-dense-sub-in" value={actualIn}
          onChange={event=>setInId(event.target.value)}>
          {availableIn.map(id=><option key={id} value={id}>{id}</option>)}
        </select>
        <label htmlFor="m1-dense-sub-time">Виртуальная игровая секунда</label>
        <select id="m1-dense-sub-time" value={checkpoint}
          onChange={event=>setCheckpoint(Number(event.target.value))}>
          {[300,900,2700,5100].map(second=><option key={second}
            value={second}>{second}</option>)}
        </select>
        <button type="button" disabled={!actualOut||!actualIn}
          onClick={()=>void playNext('substitution')}>
          Провести выбранную замену в плотном матче
        </button>
      </fieldset>
    </div>
    <p role="status">{message}</p>
    {journal&&<p>v120 ревизия: {journal.revision} · отдельный IndexedDB CAS</p>}
    {holdReview?.ok&&<div aria-label="Вымышленные межматчевые ограничения">
      <p>Проверено вымышленных событий: {holdReview.modelledIncidentCount}.
        Активных ограничений: {holdReview.holds.filter(h=>h.activeForNextFixture).length}.</p>
      <ul>{holdReview.holds.filter(h=>h.activeForNextFixture).map(h=><li
        key={h.sourceFixtureId+':'+h.sourceIncidentId}>
        {h.playerId} · {h.kind==='fictional-injury'?'травма':
          h.kind==='direct-red'?'прямое удаление':'вторая жёлтая'} ·
        {h.remainingModelledFixtures===null?' до подтверждения решения':
          ' осталось матчей: '+h.remainingModelledFixtures}
      </li>)}</ul>
      <p className="subtle">Это только проверенная игровая проекция,
        не официальное разрешение на возвращение. Продолжение требует
        отдельного ручного действия и не учитывает полную историю соперников.</p>
    </div>}
  </section>;
}
