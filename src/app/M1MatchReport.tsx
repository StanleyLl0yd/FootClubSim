import type {M1V188Entry} from '../core/m1-v188-league-source-journal.js';
import type {Catalog} from '../core/model.js';
import {LigaClubLabel} from './LigaClubLabel.js';
import {deriveM1V188MatchDetails}
  from '../core/m1-v188-match-details.js';
import {deriveM1V188PhysicalExposure}
  from '../core/m1-v188-physical-exposure.js';

/** Source-backed match centre, not a synthetic dashboard of invented metrics. */
export function M1MatchReport({entry,catalog}:{
  readonly entry:M1V188Entry;readonly catalog:Catalog;
}){
  const report=deriveM1V188MatchDetails(entry);
  const exposure=deriveM1V188PhysicalExposure(entry);
  if(!report||!exposure)return <p role="alert">Не удалось проверить протокол матча.</p>;
  const teams=new Map(catalog.clubs.map(team=>[team.id,team.displayName]));
  const names=new Map(catalog.players.map(player=>[player.id,player.displayName]));
  // This presentation is read from the already source-verified v188 entry;
  // it does not claim a referee-authorized interruption.
  const coaching=entry.source.inMatchOrdersVersion===1?
    entry.source.plannedCommands.flatMap(raw=>{
      if(!raw||typeof raw!=='object'||Array.isArray(raw))return [];
      const order=raw as Record<string,unknown>;
      if(typeof order.elapsedSeconds!=='number')return [];
      if(order.kind==='set-tactics'&&order.plan&&
          typeof order.plan==='object'&&!Array.isArray(order.plan)){
        const p=order.plan as Record<string,unknown>;
        return [{elapsedSeconds:order.elapsedSeconds,
          label:'Тактика: '+p.formation+', настрой '+p.mentality+
            ', прессинг '+p.pressing+', темп '+p.tempo}];
      }
      if(order.kind==='set-player-focus'){
        const focus=order.focus==='attack'?'атака':
          order.focus==='defend'?'защита':'баланс';
        return [{elapsedSeconds:order.elapsedSeconds,
          label:'Указание '+(names.get(String(order.playerId))??
            String(order.playerId))+': '+focus}];
      }
      return [];
    }):[];
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
    <p className="season-preview-score season-report-score">
      <LigaClubLabel clubId={report.homeClubId}
        name={teams.get(report.homeClubId)??report.homeClubId} size={32}/>
      {' '}<strong>{report.home.goals} : {report.away.goals}</strong>{' '}
      <LigaClubLabel clubId={report.awayClubId}
        name={teams.get(report.awayClubId)??report.awayClubId} size={32}/>
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
        {report.incidents.map((event,index)=>{
          // An own goal credits the opposite side; the scorer plays
          // for the defending club, not the beneficiary in teamId.
          const actorClubId=event.kind==='own-goal'?
            (event.teamId===report.homeClubId?
              report.awayClubId:report.homeClubId):event.teamId;
          return <li key={index}>
            <span className="season-event-minute">
              {Math.floor(event.time/60)+1}′
            </span>
            <span className="season-event-player">
              <strong>{names.get(event.playerId)??event.playerId}</strong>
              <LigaClubLabel clubId={actorClubId}
                name={teams.get(actorClubId)??actorClubId} size={20}/>
            </span>
            <span>{incidentLabel[event.kind]}
              {event.kind==='own-goal'?
                ' (в пользу '+teams.get(event.teamId)+')':''}
            </span>
          </li>;
        })}
      </ol>:<p className="subtle">Голов и дисциплинарных событий не было.</p>}
    {coaching.length>0&&<details className="season-club-details">
      <summary>Решения тренера по ходу игры ({coaching.length})</summary>
      <ol className="season-report-events">
        {coaching.map((order,index)=><li key={index}>
          <span className="season-event-minute">
            {Math.floor(order.elapsedSeconds/60)+1}′
          </span>
          <span>{order.label}</span>
        </li>)}
      </ol>
      <p className="subtle">Изменения проверены по источнику матча
        и влияют только на последующие игровые эпизоды.</p>
    </details>}
    <details className="season-club-details">
      <summary>Время футболистов на поле</summary>
      <p className="subtle">Только игровое время из журнала физических
        составов, без перерыва и остановок. В модели сезона эти секунды
        влияют на условное восстановление и физическое состояние игроков,
        но не являются медицинским заключением.</p>
      <div className="season-table-scroll">
        <table className="season-table">
          <thead><tr>
            <th scope="col">Команда</th>
            <th scope="col">Футболист</th>
            <th scope="col">Участие</th>
            <th scope="col">Минут</th>
          </tr></thead>
          <tbody>{exposure.players.map(player=><tr
            key={player.teamId+'-'+player.playerId}>
            <td>{teams.get(player.teamId)??player.teamId}</td>
            <td>{names.get(player.playerId)??player.playerId}</td>
            <td>{player.started?'Основа':'Выход на замену'}</td>
            <td>{(player.physicalSeconds/60).toFixed(1)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
    <p className="subtle">Показаны только проверяемые события игрового
      движка. xG учитывает только удары с игры; владение, угловые,
      фолы и офсайды пока не рассчитываются.</p>
  </div>;
}
