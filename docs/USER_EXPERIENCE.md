# Russian-first interface and game flow (M0 proposal)

The interface should feel like a detailed manager, not a console or match-viewing game. No 2D/3D pitch animation is in initial scope.

## Starting a new career: manager creation

**Owner-approved experience (2026-10-14):** before the club-selection step,
the game asks the player to create a human manager with one of three origins:

1. **Бывший профессиональный футболист**: their practical experience shapes
   stronger/weaker starting managerial competencies, and the generated
   biography mentions fictional playing clubs and achievements.
2. **Теоретик / «ноутбучный менеджер»**: no professional playing career; stronger
   theoretical/analytical or coaching-methodology competencies. Biography
   describes learning, courses, analysis and work experience.
3. **Свой профиль**: independently allocate a **limited pool of points** to
   managerial skills; the game constructs a plausible biography from the
   dominant and weaker competencies, not a generic random background.

The user sees a **summary of abilities and a generated biography**, can
regenerate a plausible biography **without changing the allocated points**
and confirms before choosing a club. All personal biographies initially use
original fictional clubs, institutions, careers and honours; no invented
real-world qualifications. Settings and details including the exact number
of points, list of abilities, manager age and editing controls still need
design acceptance. See [ADR-0003](adr/0003-manager-origins-biographies.md)
and [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).

Manager competencies are separate from footballers' 33 ratings.
This choice does **not** switch or restrict which club responsibilities are
controlled manually: independent delegation under
[ADR-0002](adr/0002-configurable-delegation.md) remains available to all
three backgrounds.

## Main navigation

- **Главная:** current career date, next fixture, club goals, inbox/news and alerts.
- **Команда:** squad table, positions, age, form, condition, suspension, contracts, filters.
- **Тактика:** starting XI, substitutes, formations, roles and team instructions; accessible alternatives to drag-and-drop.
- **Календарь:** rounds, fixtures, results, unplayed fixtures and upcoming events.
- **Турнир:** standings, form table, goals/assist leaders and history.
- **Матчи:** completed-match report from canonical event ledger, including score, scorers, disciplinary events, shots, xG.
- **Клуб:** finances, staff, facilities and club board expectations as they become available by milestone.
- **Трансферы:** offers, contracts, scouting (M3 onward).
- **Обязанности и персонал:** отдельная настройка, кто принимает решение по каждой области: игрок (по умолчанию) или назначенный доступный сотрудник. Состав и тактика делегируются независимо друг от друга; тренировки, трансферы и контракты добавляются позже. Принцип утверждён в [ADR-0002](adr/0002-configurable-delegation.md), реализация отслеживается в [#58](https://github.com/StanleyLl0yd/FootClubSim/issues/58).
- **Сохранения и настройки:** explicit backups, import/export, game/pack versions and Russian help.

## Play loop

1. Create the **manager's background and competency profile**, preview/confirm a seeded fictional biography, then select a club and a versioned dataset; create the initial career snapshot.
2. Select tactics and legal squad; review fixture preparation.
3. Press **Продолжить**: the controller processes the next calendar boundary and due fixtures in deterministic order.
4. The worker calculates matches automatically, reports computation progress when needed; no visual match playback.
5. An atomic new career revision is saved; UI shows report, table changes, discipline, injuries and next actions.
6. Weekly/monthly/season fast-forward is a batch of identical transitions, not a shortcut scoring algorithm.

## UX principles

Russian strings visible to players; semantic IDs and source code names remain locale-independent. Keyboard navigation, visible focus, tabular alignment, filtering of large rosters and readable data density are first-class. Do not require drag-and-drop alone to configure a lineup.

Делегирование не должно быть настройкой «всё отдать ассистенту»: пользователь выбирает ответственного отдельно по каждой доступной обязанности и может вернуть управление без перезапуска карьеры. Автоматические решения сотрудников должны сопровождаться пояснениями и журналом действий. Нереализованные области не должны выдавать себя за рабочие.

Storage failures, invalid data, incompatible saves and worker interruptions must show actionable errors without wiping existing careers. Warn players that browser storage can be cleared and provide a versioned exported backup path. The game is browser-first and may require network access; a connection failure must produce a clear message and never damage locally saved careers. Mandatory offline play is no longer required under ADR-0008. PWA installation remains optional.

## Approved live-match interaction and currency UX (2026-10-14)

[ADR-0007](adr/0007-match-tactics-multicurrency.md) adds **interactive in-match tactics and substitutions** to the existing common deterministic match engine: pause/continue/fast-forward; legal substitutions; formation, team instructions and player-specific adjustments, all effective only at a validated virtual-time checkpoint. Full automatic calculation remains available without 2D/3D visualization. The available action set must clearly indicate who currently controls each responsibility (player or delegated staff).

Finance screens in M3 support **RUB, USD, EUR** (default RUB). Under [ADR-0008](adr/0008-online-daily-fx-rounding.md), obtain **one locked daily Google rate snapshot on first game entry**, reuse it for all same-day conversions, and never allow rate editing or retrospective adjustment. Round **USD/EUR -> RUB** final displayed/committed equivalents to **10,000 ₽**; **RUB -> USD/EUR** to **1,000** target units; retain exact original contract amounts and an auditable conversion delta. Show the snapshot date/time and source. A missing or legally unavailable quote must display an explicit error rather than invented converted values. Internet access may be required. Lawful Google access, implementation and further boundary tests remain future M3 work.
