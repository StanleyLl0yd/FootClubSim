import { useState } from 'react';
import { startM1V8MatchJournal } from '../core/m1-v8-result-journal.js';
import { prepareM1V113PlayableMatch }
  from '../core/m1-v113-browser-playtest.js';
import { simulateM1V105SpecialGoalChronology }
  from '../core/m1-v105-special-goal-chronology.js';
import type { InitialCareerSave } from '../core/save.js';
import type { M1V120Journal, M1V120Apply }
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
  async function playFirst(){
    if(busy||disabled||!journal)return;
    if(journal.revision!==0){
      setMessage('v120: первый матч уже записан. Продолжение всей карьеры пока не подключено.');
      return;
    }
    setBusy(true);
    try{
      const empty=startM1V8MatchJournal(career);
      if(!empty.ok)throw Error('INVALID_INITIAL_SOURCE');
      const prepared=prepareM1V113PlayableMatch(career,empty.journal,'ordinary');
      if(!prepared?.ok)throw Error('INVALID_PREMATCH_SOURCE');
      const prematch=prepared.request.prematch;
      const policy=prepared.request.policy;
      const computed=simulateM1V105SpecialGoalChronology(prematch,policy);
      if(!computed.ok)throw Error('INVALID_DENSE_MATCH_SOURCE');
      const request:M1V120Apply={
        schemaVersion:120,commandId:'v120-dense-'+prepared.fixture.id,
        careerId:career.careerId,expectedRevision:journal.revision,
        prematch,policy,plannedCommands:[],checkpointMedical:[],
        intraphaseMedical:[],trustedDecisions:[],result:computed,
      };
      const persisted=await commitM1V120PersistedSource(
        career.careerId,journal.revision,request);
      setJournal(persisted);
      setMessage('v120: первый плотный матч атомарно записан, 270 PRNG draws, '+
        'ревизия '+persisted.revision+'.');
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
      или медицинскими решениями. Пока доступен только первый матч.</p>
    <div className="button-stack">
      <button type="button" disabled={busy||disabled}
        onClick={()=>void connect()}>Создать или загрузить отдельный v120</button>
      <button type="button" disabled={busy||disabled||!journal||journal.revision!==0}
        onClick={()=>void playFirst()}>Рассчитать и сохранить первый матч v120</button>
    </div>
    <p role="status">{message}</p>
    {journal&&<p>v120 ревизия: {journal.revision} · отдельный IndexedDB CAS</p>}
  </section>;
}
