import {useState} from 'react';
import type {Fixture} from '../core/fixtures.js';
import type {InitialCareerSave} from '../core/save.js';
import type {M1V188Journal} from '../core/m1-v188-league-source-journal.js';
import type {Position} from '../core/model.js';
import {m1V2PositionGroup} from '../core/m1-v2-formation-fit.js';
import type {M1V188ScorerRow} from '../core/m1-v188-scorers.js';
import {LigaClubLabel} from './LigaClubLabel.js';

const POSITION_LABELS:Readonly<Record<Position,string>>={
  GK:'ВР',DL:'ЛЗ',DC:'ЦЗ',DR:'ПЗ',WBL:'ЛК',WBR:'ПК',
  DM:'ОП',ML:'ЛП',MC:'ЦП',MR:'ПП',AML:'ЛВ',AMC:'АП',
  AMR:'ПВ',ST:'Н',
};

const squadGroup=(position:Position)=>{
  const group=m1V2PositionGroup(position);
  return group===null?'GK':group==='defenders'?'DEF':
    group==='advanced'||group==='strikers'?'ATT':'MID';
};

export function M1ClubOverview({
  career,journal,fixtures,conditionById,scorerRows,
}:{
  readonly career:InitialCareerSave;
  readonly journal:M1V188Journal;
  readonly fixtures:readonly Fixture[];
  readonly conditionById:ReadonlyMap<string,number>;
  readonly scorerRows:readonly M1V188ScorerRow[]|null;
}){
  const [rosterSearch,setRosterSearch]=useState('');
  const [rosterGroup,setRosterGroup]=useState('all');
  const [rosterSort,setRosterSort]=useState('default');
  const team=career.catalog.clubs.find(
    club=>club.id===career.selectedClubId);
  if(!team||journal.careerId!==career.careerId||
      journal.revision!==journal.entries.length)return null;
  const playerById=new Map(career.catalog.players.map(player=>
    [player.id,player]));
  const scorerById=new Map((scorerRows??[]).map(row=>
    [row.playerId,row]));
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
  const query=rosterSearch.trim().toLocaleLowerCase('ru');
  const visibleRoster=team.registeredPlayerIds.filter(id=>{
    const player=playerById.get(id);
    return player&&(rosterGroup==='all'||
      squadGroup(player.primaryPosition)===rosterGroup)&&
      (!query||player.displayName.toLocaleLowerCase('ru').includes(query));
  });
  if(rosterSort==='readiness')visibleRoster.sort((a,b)=>
    (conditionById.get(b)??-1)-(conditionById.get(a)??-1));
  if(rosterSort==='goals'&&scorerRows!==null)visibleRoster.sort((a,b)=>
    (scorerById.get(b)?.goals??0)-(scorerById.get(a)?.goals??0));
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
              <strong>
                <LigaClubLabel
                  clubId={home?fixture.awayClubId:fixture.homeClubId}
                  name={nameByClub.get(home?
                    fixture.awayClubId:fixture.homeClubId)??''}/>
              </strong>
            </span>
            <strong className={outcome?'season-form-'+outcome:undefined}>
              {mine===null||theirs===null?'—':mine+' : '+theirs}
            </strong>
          </li>)}
      </ol>
    </details>
    <details className="season-club-details">
      <summary>Состав команды · {team.registeredPlayerIds.length} футболистов</summary>
      <div className="season-roster-controls">
        <label htmlFor="season-roster-search">Поиск по имени
          <input id="season-roster-search" type="search"
            value={rosterSearch}
            onChange={event=>setRosterSearch(event.target.value)}/>
        </label>
        <label htmlFor="season-roster-group">Амплуа
          <select id="season-roster-group" value={rosterGroup}
            onChange={event=>setRosterGroup(event.target.value)}>
            <option value="all">Все</option>
            <option value="GK">Вратари</option>
            <option value="DEF">Защитники</option>
            <option value="MID">Полузащитники</option>
            <option value="ATT">Нападающие</option>
          </select>
        </label>
        <label htmlFor="season-roster-sort">Сортировка
          <select id="season-roster-sort" value={rosterSort}
            onChange={event=>setRosterSort(event.target.value)}>
            <option value="default">По списку клуба</option>
            <option value="readiness">По готовности</option>
            <option value="goals" disabled={scorerRows===null}>По голам</option>
          </select>
        </label>
      </div>
      <p className="subtle">Показано: {visibleRoster.length} из{' '}
        {team.registeredPlayerIds.length}</p>
      <div className="season-table-scroll">
        <table className="season-table season-squad">
          <caption className="subtle">
            Синтетические характеристики. Готовность — условная
            игровая нагрузка к следующему матчу, не медицинский допуск.
            Голы и пенальти — только из завершённых матчей;
            автоголы не записываются бомбардиру.
          </caption>
          <thead><tr>
            <th scope="col">Футболист</th>
            <th scope="col" title="Амплуа">Поз.</th>
            <th scope="col" title="Игровая готовность к следующему матчу">Гот.</th>
            <th scope="col" title="Короткий пас">Пас</th>
            <th scope="col" title="Завершение атак">Удар</th>
            <th scope="col" title="Отбор мяча">Отб.</th>
            <th scope="col" title="Выносливость">Вын.</th>
            <th scope="col" title="Рефлексы вратаря">Реф.</th>
            <th scope="col" title="Голы в сыгранных матчах">Голы</th>
            <th scope="col" title="Голы с пенальти">Пен.</th>
          </tr></thead>
          <tbody>{visibleRoster.map(id=>{
            const player=playerById.get(id);
            const condition=conditionById.get(id);
            return player?<tr key={player.id}>
              <th scope="row">{player.displayName}</th>
              <td>{POSITION_LABELS[player.primaryPosition]}</td>
              <td title="Игровая готовность к следующему матчу">
                {condition===undefined?'—':condition+'%'}
              </td>
              <td>{player.attributes.shortPassing}</td>
              <td>{player.attributes.finishing}</td>
              <td>{player.attributes.tackling}</td>
              <td>{player.attributes.stamina}</td>
              <td>{player.primaryPosition==='GK'?
                player.attributes.reflexes:'—'}</td>
              <td>{scorerRows===null?'—':
                (scorerById.get(id)?.goals??0)}</td>
              <td>{scorerRows===null?'—':
                (scorerById.get(id)?.penaltyGoals??0)}</td>
            </tr>:null;
          })}
            {!visibleRoster.length&&<tr><td colSpan={10}>
              По заданным условиям футболисты не найдены.
            </td></tr>}
          </tbody>
        </table>
      </div>
    </details>
  </div>;
}
