import { useState } from 'react';
import {
  createManagerProfile, isManagerDisplayName, MANAGER_NAME_LIMIT, MANAGER_ORIGINS,
  MANAGER_SKILL_KEYS, MANAGER_SKILL_SCALE, MANAGER_START_BUDGET, MANAGER_START_MAX,
  MANAGER_START_MIN, regenerateManagerBiography, startingManagerSkills,
  type ManagerBiographyEvent, type ManagerOrigin, type ManagerProfile, type ManagerSkill,
} from '../core/manager-profile.js';

const originLabels: Record<ManagerOrigin, string> = {
  'former-player': 'Бывший профессиональный игрок',
  theorist: 'Теоретик',
  custom: 'Свой тренер',
};
const originHints: Record<ManagerOrigin, string> = {
  'former-player': 'Опыт раздевалки, мотивации и решений по ходу матча.',
  theorist: 'Сильная тактика, подготовка к матчам и аналитика.',
  custom: 'Распределите очки между любыми навыками и создайте свою историю.',
};
const skillLabels: Record<ManagerSkill, string> = {
  tacticalKnowledge: 'Тактика',
  matchPreparation: 'Подготовка к матчам',
  inGameAdaptation: 'Реакция по ходу матча',
  trainingMethodology: 'Методика тренировок',
  playerDevelopment: 'Развитие игроков',
  peopleManagement: 'Работа с коллективом',
  motivation: 'Мотивация',
  talentAssessment: 'Оценка игроков',
  scoutingAnalysis: 'Анализ и скаутинг',
  negotiation: 'Переговоры',
  clubManagement: 'Управление клубом',
  mediaCommunication: 'Работа с прессой',
};

// The texts for template version 1 are pinned along with the event identifiers.
const biographyTextV1: Record<ManagerBiographyEvent['kind'], readonly string[]> = {
  'playing-debut': [
    'Дебют в профессиональном футболе за вымышленный «Льняной берег».',
    'Первый профессиональный сезон в вымышленной команде «Северный гребень».',
    'Первый профессиональный контракт с вымышленным клубом «Медный мыс».',
  ],
  'playing-milestone': [
    'Опыт капитанства и выход с командой в финал местного кубка.',
    'Переход в более сильный дивизион вместе с командой.',
    'Полный сезон в стартовом составе и роль наставника для новичков.',
  ],
  courses: [
    'Курс по тактическому анализу в вымышленной школе «Третий тайм».',
    'Курс по планированию тренировок в вымышленной мастерской «Поле и схема».',
    'Самостоятельный разбор матчей и занятия в вымышленном кружке «Линии поля».',
  ],
  analyst: [
    'Работа видеоаналитиком: разбор переходов и стандартов соперников.',
    'Работа в штабе молодёжной команды: методика занятий и отчёты по матчам.',
    'Подготовка аналитических заметок о соперниках для тренерского штаба.',
  ],
  grassroots: [
    'Первые футбольные проекты в районной любительской лиге.',
    'Волонтёрская работа на матчах местной футбольной школы.',
    'Участие в организации любительского турнира «Дворовый кубок».',
  ],
  analysis: [
    'Разработка отчётов по соперникам для любительской команды.',
    'Ведение базы наблюдений за тактикой и игроками региональной лиги.',
    'Подготовка видеоразборов и рекомендаций к следующим матчам.',
  ],
  development: [
    'Работа с юношеской группой над индивидуальными планами развития.',
    'Оценка игроков и организация пробных тренировок для футбольной школы.',
    'Подготовка тренировочного цикла для молодёжной команды.',
  ],
  leadership: [
    'Руководство любительской командой и помощь новым игрокам в адаптации.',
    'Координация волонтёрского штаба и поддержка игроков в трудных матчах.',
    'Работа с командной атмосферой и решениями по ходу любительских матчей.',
  ],
  operations: [
    'Организация выездов и переговоры с партнёрами любительского клуба.',
    'Ведение клубных объявлений и согласование расписания с площадками.',
    'Координация работы клуба и общение с местной спортивной прессой.',
  ],
  generalist: [
    'Работа в небольшом штабе: тренировки, разборы и организация матчей.',
    'Помощь молодёжной команде с расписанием и подготовкой к соперникам.',
    'Работа в местном клубе с игроками, тренировочным планом и матчами.',
  ],
  coaching: [
    'Переход к самостоятельной работе в тренерском штабе.',
    'Ведение тренировок и подготовка команды к матчам в роли помощника тренера.',
    'Работа в тренерском штабе с ответственностью за подготовку первой команды.',
  ],
};

function Biography({ profile }: { readonly profile: ManagerProfile }) {
  return <div>
    <p className="subtle">Вымышленная биография</p>
    <ol className="manager-timeline">
      {profile.biography.events.map(event => <li key={event.yearsBeforeStart}>
        <strong>За {event.yearsBeforeStart} г. до начала карьеры.</strong>{' '}
        {biographyTextV1[event.kind][event.variant]}
      </li>)}
    </ol>
  </div>;
}

export function SavedManagerProfile({ profile }: { readonly profile: ManagerProfile }) {
  return <details className="manager-saved">
    <summary>{profile.displayName} · {originLabels[profile.origin]}</summary>
    <ul className="manager-skills">
      {MANAGER_SKILL_KEYS.map(key => <li key={key}>
        {skillLabels[key]} <strong>{profile.skills[key]}</strong>
      </li>)}
    </ul>
    <Biography profile={profile} />
  </details>;
}

export function ManagerProfileSetup({ disabled, onConfirm }: {
  readonly disabled: boolean;
  readonly onConfirm: (profile: ManagerProfile) => void;
}) {
  const [origin, setOrigin] = useState<ManagerOrigin>('former-player');
  const [name, setName] = useState('');
  const [customSkills, setCustomSkills] = useState(() => startingManagerSkills('custom'));
  const [preview, setPreview] = useState<ManagerProfile | null>(null);
  const isCustom = origin === 'custom';
  const skills = isCustom ? customSkills : startingManagerSkills(origin);
  const remaining = MANAGER_START_BUDGET -
    MANAGER_SKILL_KEYS.reduce((sum, key) => sum + skills[key], 0);
  const displayName = name.trim();
  const canPreview = remaining === 0 && isManagerDisplayName(displayName);

  function generateBiography() {
    if (!canPreview) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    setPreview(createManagerProfile(displayName, origin, skills, seed));
  }

  return <section className="panel manager-setup" aria-labelledby="manager-title">
    <h2 id="manager-title">1. Создайте тренера</h2>
    <label htmlFor="manager-name">Имя тренера</label>
    <input id="manager-name" type="text" value={name} maxLength={MANAGER_NAME_LIMIT}
      disabled={disabled} onChange={event => { setName(event.target.value); setPreview(null); }} />
    <fieldset disabled={disabled}>
      <legend>Происхождение</legend>
      {MANAGER_ORIGINS.map(option => <label key={option} className="manager-origin">
        <input type="radio" name="manager-origin" checked={origin === option}
          onChange={() => { setOrigin(option); setPreview(null); }} />
        <span><strong>{originLabels[option]}</strong><br />
          <span className="subtle">{originHints[option]}</span></span>
      </label>)}
    </fieldset>
    <p className="subtle">
      Шкала 1–{MANAGER_SKILL_SCALE}. На старте {MANAGER_START_MIN}–{MANAGER_START_MAX} на навык
      и {MANAGER_START_BUDGET} очков в сумме.
    </p>
    <ul className="manager-skills" aria-label="Навыки тренера">
      {MANAGER_SKILL_KEYS.map(key => <li key={key}>
        {isCustom ? <label htmlFor={'manager-skill-' + key}>{skillLabels[key]}</label> : skillLabels[key]}
        <strong>{skills[key]}</strong>
        {isCustom && <input id={'manager-skill-' + key} type="range" min={MANAGER_START_MIN}
          max={MANAGER_START_MAX} value={skills[key]} disabled={disabled}
          onChange={event => {
            const value = event.currentTarget.valueAsNumber;
            setCustomSkills(current => ({ ...current, [key]: value }));
            setPreview(null);
          }} />}
      </li>)}
    </ul>
    {isCustom && <p aria-live="polite">{remaining < 0 ?
      'Снимите очков: ' + -remaining : 'Осталось распределить очков: ' + remaining}</p>}
    <div className="button-stack">
      {isCustom && <button type="button" className="secondary-button" disabled={disabled}
        onClick={() => { setCustomSkills(startingManagerSkills('custom')); setPreview(null); }}>
        Сбросить навыки
      </button>}
      <button type="button" disabled={disabled || !canPreview} onClick={generateBiography}>
        Показать биографию
      </button>
    </div>
    {preview && <div className="m1-preview" aria-label="Предпросмотр биографии">
      <Biography profile={preview} />
      <div className="button-stack">
        <button type="button" className="secondary-button" disabled={disabled}
          onClick={() => setPreview(regenerateManagerBiography(preview))}>
          Сгенерировать заново
        </button>
        <button type="button" disabled={disabled} onClick={() => onConfirm(preview)}>
          Подтвердить тренера
        </button>
      </div>
    </div>}
  </section>;
}
