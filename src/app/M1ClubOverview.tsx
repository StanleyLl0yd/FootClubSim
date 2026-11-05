import type {Fixture} from '../core/fixtures.js';
import type {InitialCareerSave} from '../core/save.js';
import type {M1V188Journal} from '../core/m1-v188-league-source-journal.js';
import type {Position} from '../core/model.js';

const POSITION_LABELS:Readonly<Record<Position,string>>={
  GK:'ВР',DL:'ЛЗ',DC:'ЦЗ',DR:'ПЗ',WBL:'ЛК',WBR:'ПК',
  DM:'ОП',ML:'ЛП',MC:'ЦП',MR:'ПП',AML:'ЛВ',AMC:'АП',
  AMR:'ПВ',ST:'Н',
};

export function M1ClubOverview({career,journal,fixtures}:{
  readonly career:InitialCareerSave;
  readonly journal:M1V188Journal;
  readonly fixtures:readonly Fixture[];
}){
  const team=career.catalog.clubs.find(
    club=>club.id===career.selectedClubId);
  if(!team||journal.careerId!==career.careerId||
      journal.revision!==journal.entries.length)return null;
  const playerById=new Map(career.catalog.players.map(player=>
    [player.id,player]));
  const nameByClub=new Map(career.catalog.clubs.map(club=>
    [club.id,club.displayName]));
  const played=new Map(journal.entries.map(entry=>
    [entry.fixtureId,entry]));
  const ownFixtures=fixtures.filter(f=>
    f.homeClubId===team.id||f.awayClubId===team.id);
  const rows=ownFixtures.map(f=>{
    const home=f.homeClubId===team.id;
    const entry=played.get(f.id);
    const mine=entry?home?
      entry.result.report.home.goals:entry.result.report.away.goals:null;
    const theirs=entry?home?
      entry.result.report.away.goals:entry.result.report.home.goals:null;
    const outcome=mine===null||theirs===null?null:
      mine>theirs?'win':mine<theirs?'loss':'draw';
    return{fixture:f,home,entry,mine,theirs,outcome};
  });
  const form=rows.filter(r=>r.outcome!==null).slice(-5);
  return <div className="season-club-overview">
    <div className="season-club-summary">
      <strong>Ваш клуб: {team.displayName}</strong>
      <span className="subtle">Сыграно встреч: {rows.filter(r=>r.entry).length} из 30</span>
      <span className="subtle">Последние результаты: {' '}
        {form.length?form.map(r=>r.outcome==='win'?'В':
          r.outcome==='draw'?'Н':'П').join(' · '):'пока нет'}
      </span>
    </div>
    <details className="season-club-details">
      <summary>Все матчи вашего клуба · 30 туров</summary>
      <ol className="season-own-calendar">
        {rows.map(({fixture,home,entry,mine,theirs,outcome})=>
          <li key={fixture.id} className={entry?'season-played':'season-upcoming'}>
            <span className="subtle">Тур {fixture.round}</span>
            <span>{home?'Дома':'В гостях'}: {' '}
              <strong>{nameByClub.get(home?
                fixture.awayClubId:fixture.homeClubId)}</strong>
            </span>
            <strong className={outcome?'season-form-'+outcome:undefined}>
              {mine===null||theirs===null?'—':mine+' : '+theirs}
            </strong>
          </li>)}
      </ol>
    </details>
    <details className="season-club-details">
      <summary>Состав команды · {team.registeredPlayerIds.length} футболистов</summary>
      <div className="season-table-scroll">
        <table className="season-table season-squad">
          <caption className="subtle">
            Пока синтетические характеристики, без подтверждённых заявок реальных клубов
          </caption>
          <thead><tr>
            <th scope="col">Футболист</th>
            <th scope="col" title="Амплуа">Поз.</th>
            <th scope="col" title="Короткий пас">Пас</th>
            <th scope="col" title="Завершение атак">Удар</th>
            <th scope="col" title="Отбор мяча">Отб.</th>
            <th scope="col" title="Выносливость">Вын.</th>
            <th scope="col" title="Рефлексы вратаря">Реф.</th>
          </tr></thead>
          <tbody>{team.registeredPlayerIds.map(id=>{
            const player=playerById.get(id);
            return player?<tr key={player.id}>
              <th scope="row">{player.displayName}</th>
              <td>{POSITION_LABELS[player.primaryPosition]}</td>
              <td>{player.attributes.shortPassing}</td>
              <td>{player.attributes.finishing}</td>
              <td>{player.attributes.tackling}</td>
              <td>{player.attributes.stamina}</td>
              <td>{player.primaryPosition==='GK'?
                player.attributes.reflexes:'—'}</td>
            </tr>:null;
          })}</tbody>
        </table>
      </div>
    </details>
  </div>;
}
