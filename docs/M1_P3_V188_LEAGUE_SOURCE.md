# M1 P3-4 — v188 full two-team source journal (partial)

The versioned v188 journal walks all 240 synthetic fixtures across 30
rounds, not just 30 chosen-club fixtures. Each match is admitted from the
same causal v184 referee/medical source and its v105 physical XI result.
The fixture, seed, home and away lineups, policies, actions and score
are regenerated and replayed on each read and revision-bound apply.

Fictional source-derived injury and red/second-yellow holds are carried
across subsequent fixtures of BOTH clubs. Held players are excluded from
both XI and bench. Unknown KDK rulings do not silently remove the holds.

This is not yet the accepted P3-4 career: official/rescheduled fixture
orders, external sanctions and clinical decisions, entire completed
240-fixture native persisted season, recovery/eviction, performance
budgets, all IFAB exceptions and full P3-1/2/3 dependencies are open.
No existing M0, v8 or v120 saves are migrated or overwritten.

P3 0/4, P5 0/5, exit #3 0/2. M1 OPEN; M2 forbidden.
2024/25 holdout stays sealed.

## Native browser source CAS (partial)

The same v188 append/replay now runs inside a dedicated native IndexedDB
readwrite transaction. The browser smoke covers Linux Chromium, Windows
Chrome/Edge and macOS Safari, real navigation, stored two-team fixture
recovery, corrupt-source refusal, exactly one winner in concurrent CAS,
unchanged M0 and old journal namespaces. Two fixtures are tested; 240
fully persisted real-platform matches, quota/eviction and full-season
performance budgets are NOT verified by this smoke.

Manager-selected changes accept only exact three-field choices,
then construct and replay canonical `v184-sub` commands with a verified
club/fixture/actor. Illegal or fabricated manager commands fail closed.
