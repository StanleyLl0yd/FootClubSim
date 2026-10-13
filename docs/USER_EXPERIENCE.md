# Russian-first interface and game flow (M0 proposal)

The interface should feel like a detailed manager, not a console or match-viewing game. No 2D/3D pitch animation is in initial scope.

## Main navigation

- **Главная:** current career date, next fixture, club goals, inbox/news and alerts.
- **Команда:** squad table, positions, age, form, condition, suspension, contracts, filters.
- **Тактика:** starting XI, substitutes, formations, roles and team instructions; accessible alternatives to drag-and-drop.
- **Календарь:** rounds, fixtures, results, unplayed fixtures and upcoming events.
- **Турнир:** standings, form table, goals/assist leaders and history.
- **Матчи:** completed-match report from canonical event ledger, including score, scorers, disciplinary events, shots, xG.
- **Клуб:** finances, staff, facilities and club board expectations as they become available by milestone.
- **Трансферы:** offers, contracts, scouting (M3 onward).
- **Сохранения и настройки:** explicit backups, import/export, game/pack versions and Russian help.

## Play loop

1. Select a club and a versioned dataset; create career snapshot.
2. Select tactics and legal squad; review fixture preparation.
3. Press **Продолжить**: the controller processes the next calendar boundary and due fixtures in deterministic order.
4. The worker calculates matches automatically, reports computation progress when needed; no visual match playback.
5. An atomic new career revision is saved; UI shows report, table changes, discipline, injuries and next actions.
6. Weekly/monthly/season fast-forward is a batch of identical transitions, not a shortcut scoring algorithm.

## UX principles

Russian strings visible to players; semantic IDs and source code names remain locale-independent. Keyboard navigation, visible focus, tabular alignment, filtering of large rosters and readable data density are first-class. Do not require drag-and-drop alone to configure a lineup.

Storage failures, invalid data, incompatible saves and worker interruptions must show actionable errors without wiping existing careers. Warn players that browser storage can be cleared and provide a versioned exported backup path. PWA should behave consistently after offline/online switches and app updates.
