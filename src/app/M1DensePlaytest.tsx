import { useState } from 'react';
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
      setJournal(loaded);
      setMessage('v120: проверен и загружен отдельный журнал, матчей: '+
        loaded.revision+'.');
    }catch(error){
      setMessage('v120: запись/восстановление отклонены: '+
        (error instanceof Error?error.message:String(error)));
    }finally{setBusy(false);}
  }
  async function playNext(){
    if(busy||disabled||!journal)return;
    setBusy(true);
    try{
      const prepared=prepareM1V122DenseOrdinaryMatch(career,journal);
      if(prepared===null){
        setMessage('v120: все 30 матчей выбранного клуба сохранены.');
        return;
      }
      if(!prepared.ok)throw Error(prepared.error);
      const persisted=await commitM1V120PersistedSource(
        career.careerId,journal.revision,prepared.request);
      setJournal(persisted);
      setMessage('v120: плотный матч атомарно записан, 270 PRNG draws, '+
        'ревизия '+persisted.revision+' из 30.');
    }catch(error){
      setMessage('v120: сохранение отклонено: '+
        (error instanceof Error?error.message:String(error)));
    }finally{setBusy(false);}
  }
  return <section className="panel" aria-labelledby="m1-dense-title">
    <h2 id="m1-dense-title">M1 · экспериментальный плотный матч v120</h2>
    <p className="subtle">Отдельная тестовая ветка карьеры: 100-секундные слоты
      ударов, медицинские ограничения и проверка полного исходного источника.
      Никаких миграций из v8; события не являются официальными судейскими
      или медицинскими решениями. Доступны последовательные матчи в обычном режиме без медицинских или судейских исключений.</p>
    <div className="button-stack">
      <button type="button" disabled={busy||disabled}
        onClick={()=>void connect()}>Создать или загрузить отдельный v120</button>
      <button type="button" disabled={busy||disabled||!journal||journal.revision>=30}
        onClick={()=>void playNext()}>Рассчитать и сохранить следующий матч v120</button>
    </div>
    <p role="status">{message}</p>
    {journal&&<p>v120 ревизия: {journal.revision} · отдельный IndexedDB CAS</p>}
  </section>;
}
