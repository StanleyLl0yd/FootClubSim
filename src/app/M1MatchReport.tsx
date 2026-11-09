import type {M1V188Entry} from '../core/m1-v188-league-source-journal.js';
import type {Catalog} from '../core/model.js';
import {deriveM1V188MatchDetails}
  from '../core/m1-v188-match-details.js';

/** Source-backed match centre, not a synthetic dashboard of invented metrics. */
export function M1MatchReport({entry,catalog}:{
  readonly entry:M1V188Entry;readonly catalog:Catalog;
}){
  const report=deriveM1V188MatchDetails(entry);
  if(!report)return <p role="alert">Не удалось проверить протокол матча.</p>;
  const teams=new Map(catalog.clubs.map(team=>[team.id,team.displayName]));
  const names=new Map(catalog.players.map(player=>[player.id,player.displayName]));
  const incidentLabel={
    'goal':'гол','penalty-goal':'пенальти, гол',
    'own-goal':'автогол','penalty-saved':'пенальти отражён',
    'penalty-missed':'пенальти мимо','yellow':'жёлтая карточка',
    'red':'удаление',
  } as const;
  const rows=[
    {name:'Удары',left:report.home.shots,right:report.away.shots},
    {name:'В створ',left:report.home.shotsOnTarget,
      right:report.away.shotsOnTarget},
    {name:'Сейвы',left:report.home.saves,right:report.away.saves},
    {name:'Пенальти (удары)',left:report.home.penalties,
      right:report.away.penalties},
    {name:'Предупреждения',left:report.home.yellow,
      right:report.away.yellow},
    {name:'Удаления',left:report.home.red,right:report.away.red},
    {name:'xG с игры',left:(report.home.xgMilli/1000).toFixed(2),
      right:(report.away.xgMilli/1000).toFixed(2)},
  ];
  return <div className="season-report" aria-label="Статистика сыгранного матча">
    <p className="season-preview-score">
      {teams.get(report.homeClubId)}{' '}
      <strong>{report.home.goals} : {report.away.goals}</strong>{' '}
      {teams.get(report.awayClubId)}
    </p>
    <div className="season-report-stats">
      {rows.map(row=><div className="season-report-stat" key={row.name}>
        <strong>{row.left}</strong><span>{row.name}</span>
        <strong>{row.right}</strong>
      </div>)}
    </div>
    <h4>События матча</h4>
    {report.incidents.length?
      <ol className="season-report-events">
        {report.incidents.map((event,index)=><li key={index}>
          <span className="season-event-minute">
            {Math.floor(event.time/60)+1}′
          </span>
          <span>{names.get(event.playerId)??event.playerId}</span>
          <span>{incidentLabel[event.kind]}
            {event.kind==='own-goal'?
              ' (в пользу '+teams.get(event.teamId)+')':''}
          </span>
        </li>)}
      </ol>:<p className="subtle">Голов и дисциплинарных событий не было.</p>}
    <p className="subtle">Показаны только проверяемые события игрового
      движка. xG учитывает только удары с игры; владение, угловые,
      фолы и офсайды пока не рассчитываются.</p>
  </div>;
}
