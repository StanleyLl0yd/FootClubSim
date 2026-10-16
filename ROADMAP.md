# FootClubSim roadmap

> Planning document. **M0 closed 2026-10-15**, with successful exact-main CI and completed exit issue #2; no playable release exists. **M1 separately authorized by the owner and actively in development since 2026-10-15**; milestone #3 remains OPEN and M2 has not begun. [Final acceptance ADR-0010](docs/adr/0010-m0-final-acceptance.md). The owner-approved [M0/M2 gate boundary](docs/adr/0006-m0-m2-acceptance-boundary.md) separates M0 source/contracts acceptance from M2 playable rosters and executable authentic rules.

## Product contract

- Browser-first, **internet-connected** Russian-language single-player football **club management** simulation; mandatory offline gameplay is **not** required. Deterministic calculations and local career saves remain separate from network-dependent Bank of Russia rates ([ADR-0008](docs/adr/0008-online-daily-fx-rounding.md)).
- Owner-approved initial playable league: the fictional **«Лига приколов»**, with club display names formed through antonyms/semantic inversions of the 16 current RPL 2026/27 clubs, **but sporting rules, quotas, standings, discipline and limits taken from genuinely verified effective RPL/RFU/IFAB regulations**. All sixteen fictional names and circular badge designs are owner-approved (2026-10-14); factual squad licenses, registration accuracy, full sporting rules and exceptions remain unverified. See ADR-0005. See [ADR-0004](docs/adr/0004-liga-prikolov-rpl-rules.md) and [ADR-0005](docs/adr/0005-liga-prikolov-brand-and-personnel.md). Other competitions may have reduced non-playable representation, with official promotion/relegation rules required if modeled.
- The application computes matches automatically; **no 2D or 3D match visualization** is planned for the initial milestones.
- Prioritize macOS Safari and Windows Chrome/Edge, then compatible desktop browsers. No dedicated Linux application.
- All career calculations take place locally. OCI/backend is optional and never required for single-player gameplay.
- Public source, **all rights reserved**, no open-source license; no third-party football data/assets without verified rights.
- Maintain an independent and reproducible match engine, a versioned starting dataset, and versioned persistent career saves.
- Version numbers, when introduced, are numeric-only (no alpha/beta/rc suffixes).
- Match reality is judged against recorded simulation events and reproducible aggregate measurements, not hand-tuned preferred scores.
- **Configurable responsibility delegation:** the player initially controls all implemented coaching/director duties, but independently chooses who decides each area. Club staff cannot silently take over manual areas. Owner-approved principle: [ADR-0002](docs/adr/0002-configurable-delegation.md); implementation [#58](https://github.com/StanleyLl0yd/FootClubSim/issues/58).
- **Manager identity at career start:** the human chooses an ex-professional, a formally educated/self-taught football theorist with no pro playing career, or a custom **point-allocated** skill profile; the game generates a relevant, believable fictional biography before club selection. Accepted principle: [ADR-0003](docs/adr/0003-manager-origins-biographies.md); implementation [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).

## Milestone gates

**After functional work and acceptance for M0 and every subsequent M stage**, perform a full two-pass whole-repository audit, safe refactor and code review per [AGENTS.md](AGENTS.md). A milestone is not complete until its exit issue contains the report and available CI/test/security evidence. Do not equate a green PR with passing the exit gate.

| Stage | Planned result | Mandatory exit |
| --- | --- | --- |
| M0 (closed 2026-10-15) | Requirements, architecture, data contracts, match specification, provenance policy, tooling and M1 backlog; closed after exact-main CI, with explicit pre-release deferrals under ADR-0010 | [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) |
| M1 | Reproducible, headless 11v11 event-driven match engine, tactical input and statistical calibration | [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) |
| M2 | Play a complete «Лига приколов» season using authentic verified RPL sporting rules and fictional inverse-name clubs, with club selection, fixtures, standings, reports and durable saves | [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4) |
| M3 | Transfers, contracts, finances, training, scouting foundation and AI club choices | [#5](https://github.com/StanleyLl0yd/FootClubSim/issues/5) |
| M4 | Multi-season careers, player aging, academy/regens, promotion/relegation and modeled external market | [#6](https://github.com/StanleyLl0yd/FootClubSim/issues/6) |
| M5 | Refined Russian UI, accessibility, performance, optional PWA install, online update UX and recovery | [#7](https://github.com/StanleyLl0yd/FootClubSim/issues/7) |
| M6 | Stable numbered release and optional macOS/Windows desktop packaging after explicit feasibility review | [#8](https://github.com/StanleyLl0yd/FootClubSim/issues/8) |

## M0: foundation and acceptance

**Closed 2026-10-15** under [ADR-0010](docs/adr/0010-m0-final-acceptance.md), with successful final verification of `f71b7873448b3043a0ab8de463259d3f854e7729` recorded in completed [issue #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2). The explicit limited-browser M0 acceptance preserves **NOT TESTED** pre-release blockers in [#155](https://github.com/StanleyLl0yd/FootClubSim/issues/155); legal/real-roster rights remain in #15/#87/#91. This was not a release sign-off; a **separate explicit M1 authorization was subsequently granted on 2026-10-15**. M1 is now active, and M2 still requires its own milestone gates.

See [M0 acceptance checklist](docs/M0_ACCEPTANCE.md).

- [x] Public repository, README and original-derived `AGENTS.md`.
- [x] Create non-optional audit issues for M0–M6.
- [x] **M0-only** product scope, platform and versioned architecture owner-accepted under [ADR-0010](docs/adr/0010-m0-final-acceptance.md). Actual numerical M1 tuning, legally cleared reference baselines, brand clearance and executable real RPL implementation are future separately tracked gates.
- [x] Define and validate the initial **original synthetic** player/club data contract and immutable seeded pack (16 clubs/368 players); M0 sign-off is recorded in [M0 acceptance](docs/M0_ACCEPTANCE.md), with release-specific risks carried forward. **This does not certify 2026/27 rosters.**
- [x] Owner approved **M0-only** deterministic match/fixture/input-output ledger, PRNG and **M1 calibration method**, not a running match generator or numerical targets. Reference baselines and tolerance bands require agreement **before M1 tuning** [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31).
- [x] M0 provenance/rights **risk inventory** and synthetic artifact boundary owner-accepted under [ADR-0010](docs/adr/0010-m0-final-acceptance.md); Wikipedia-first frozen revisions and official rules-source matrix established. **No legal trademark/data-rights clearance** is claimed; real player registrations, release permissions and executable real-RPL rules remain M2 gates [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15), [#87](https://github.com/StanleyLl0yd/FootClubSim/issues/87) and [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91).
- [x] Bootstrap TypeScript/Vite/React shell, locked dependencies and CI for types, ESLint, source formatting, tests and production build. Native Safari and Windows Edge smoke verification is also automated; exceptional storage cases remain tracked.
- [x] Owner explicitly accepted **limited M0-only** browser/storage evidence with ordinary Safari/macOS, Windows Chrome/Edge and Linux Chromium positive cases. Safari **true Private/full-app restart/native-download**, enforced quota and organic eviction are **NOT TESTED** and hard pre-release gate [#155](https://github.com/StanleyLl0yd/FootClubSim/issues/155), **not** passed or waived for the first playable career release.
- [x] Open a [prioritized M1 implementation backlog](docs/M1_BACKLOG.md) with dependencies and preliminary effort/risks.
- [x] M0 architecture accepted; remaining M1 simulation trade-offs, empirical calibration reference baselines and numeric bounds deliberately deferred to M1 backlog [#27](https://github.com/StanleyLl0yd/FootClubSim/issues/27) through [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31) and require separate owner authorization before any M1 development.
- [x] Two **complete sequential entire-repository audit passes** and justified safe fixes executed and documented in [M0 exit report](docs/M0_EXIT_AUDIT_REPORT.md), [PR #153](https://github.com/StanleyLl0yd/FootClubSim/pull/153) and [PR #154](https://github.com/StanleyLl0yd/FootClubSim/pull/154). Successful final exact-main CI is recorded in completed #2.

Later maintenance does not waive any unverified release task.

**Milestone boundary evidence:** M0 exit #2 completed with all seven exact-main checks. The owner **subsequently authorized M1** on 2026-10-15, and M1 source work now proceeds under #27-#31. M2/M5/M6 release blockers remain OPEN; M1 authorization does not automatically authorize M2 or a playable release.

## M1: simulation engine

**Current technical progress (2026-10-16):** M1 has progressed from deterministic clock, tactics and shot replay (#159-#165) to isolated versioned v8 medical/disciplinary/special-goal match events, independently replay-verified dossiers and season statistics, bounded 16-fixture atomic domain batches and a separate browser-local IndexedDB revision-CAS prototype. PR #218 and #219 are merged; all eight PR-head checks passed for each, including a dedicated **240/240 synthetic fixture** full-season workload (not gameplay calibration or production browser acceptance). The second Ubuntu/Node CI sample processed all 240 fixtures in 312.25 seconds using 16-fixture batches, 3,740,301 serialized journal bytes and independent final source/season verification; see [the v8 journal evidence](docs/M1_V8_SOURCE_REPLAY_JOURNAL.md) and [P5 #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31). A late 16-fixture batch still took 28.25 seconds of synchronous Node CPU time; this explicitly **does not** certify main-thread browser responsiveness, durable real-quota/eviction recovery or production throughput.

**M1 blockers remain OPEN:** P1/P2/P3/P4/P5 #27-#31, full deterministic competition-sanction/injury/fatigue/condition policy, an independently licensed statistical reference and calibration tolerances, actual native-browser quota/eviction and recovery evidence (release issue #155), two complete repository-wide M1 exit audit/review passes (#3), and enforceable protected `main` CI rules (#217). No inferred third-party referee/medical/KDK authorization, authenticated source claims, official standings or playable RPL compliance is created by the synthetic v8 data. The original M0 pack and v3-v7 stored formats remain separate; **M2 is not authorized**.

**M1 START AUTHORIZED BY OWNER 2026-10-15.** The complete [M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) and a subsequent post-M0 whole-repo review #157 are closed. Begin with [M1-P1 #27](https://github.com/StanleyLl0yd/FootClubSim/issues/27) via narrow, versioned, reproducible headless state-machine increments; no M2 registration/rules or playable-release claims. M1 itself stays **OPEN** until tasks #27-#31 and mandatory two full whole-repo exit audits under [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) pass.



- Player match attributes and tactical roles with typed contracts.
- Seeded deterministic, replayable match action/event model independent of React.
- Coherent goals, assists, shots, xG, cards, injuries, substitutions, fatigue and disciplinary records.
- Match report generated from the same event log, including 0–0 and abandoned/error handling policy.
- Statistical calibration over a documented seeded sample against independently sourced reference distributions; record tolerances and variance, do not claim realism before evidence.
- Invariant/property and regression testing, bounded runtime, proper error reports.
- Whole-repository exit gate [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3).

## M2: «Лига приколов» with real RPL rules

- Russian-language desktop-oriented browser interface; **first create a manager profile** (former pro, theorist, or custom point allocation) with a seeded fictional biography to preview/accept, **then** pick a club. See [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).
- Versioned **Wikipedia-first, independently corroborated 2026/27 prototype personnel catalog for all 16 fictional clubs**, with original names/ratings, freeze date, rights/provenance review and save compatibility under [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91).
- Season fixtures, fixtures chronology, results, standings and all actually verified RPL/RFU/IFAB executable rule data, with real eligibility, substitution, foreign-player, match/interruption and standings constraints, not invented simplifications.
- Computer clubs select legal lineups and adapt tactics; absences and suspensions respected.
- Player's lineup/bench and tactics responsibilities are separately configurable: decide manually by default, or delegate to an eligible named club employee. Show decision authority and support manual takeover ([#58](https://github.com/StanleyLl0yd/FootClubSim/issues/58)).
- Simulate next event/tour rapidly, persist and restore game state, export/import career save. Preserve manager origin, competencies, accepted biography and its generator/template version across saves.
- Deterministic browser-local core with reliable network-error handling (mandatory offline play not required); tested Safari/Chromium compatibility.
- Whole-repository exit gate [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4).

## M3–M6 scope controls

M3 source decision: **CBR's official daily XML data is the sole approved FX input** (ADR-0009); Google is excluded, and no actual connectivity/rights tests are yet certified.

M3 introduces economy/transfer systems, training, staff and full per-area responsibility delegation (player/staff contracts, recruitment, training), plus practical effects of manager competencies on these real systems. **Owner-approved D07 (latest [ADR-0009](docs/adr/0009-rub-only-ledger-and-cbr-source-option.md))** requires a **RUB-only** internal ledger with all financial amounts posted to nearest **10,000 ₽**, even when contracts/deals use USD or EUR and **automatic currency conversion based on the official Bank of Russia daily XML rates**, using **one immutable daily snapshot** fetched at first game entry, with foreign -> RUB rounded to nearest **10,000 ₽** and any USD/EUR target conversion, **including EUR ↔ USD**, to nearest **1,000** target units, with date-pinned rates, no retroactive career changes and prior verification of Bank of Russia source attribution, applicable commercial reuse terms and actual browser CORS/adapter operation ([ADR-0007](docs/adr/0007-match-tactics-multicurrency.md), [ADR-0008](docs/adr/0008-online-daily-fx-rounding.md), [M3 issue #131](https://github.com/StanleyLl0yd/FootClubSim/issues/131)). The approved manager-profile wizard is planned for M2, not M1. Neither stage introduces multiplayer. M4 introduces additional modeled divisions/world clubs without promising fully playable foreign leagues. M5 introduces PWA polish, not a required backend. M6 desktop packaging is conditional on real benefit and platform acceptance; no dedicated Linux app is promised.

## Explicit exclusions until a future decision

- Real-time 2D/3D matches, 11v11 physical animation, live human-versus-human multiplayer.
- Mandatory hosted accounts, central game server or remote simulation.
- Scraping Transfermarkt or club/league pages without appropriate authorization.
- Shipping unlicensed crests, photos, player likeness collections, or third-party commercial data.
- Automatic importing of live real-world transfers into existing careers.
- Unverified promises about exact 2026/27 competition regulations: official sporting rules are the approved target for «Лига приколов», and every encoded rule/exception must be article-verified and frozen in a versioned pack before claiming exact compliance.

## Related documents

- [Architecture](ARCHITECTURE.md)
- [Model of data and career state](docs/DATA_MODEL.md)
- [Match simulation design](docs/MATCH_ENGINE.md)
- [Data provenance and rights](docs/DATA_SOURCES.md)
- [M0 exit criteria](docs/M0_ACCEPTANCE.md)
- [Prioritized M1 tasks](docs/M1_BACKLOG.md)
- [M1 calibration and evidence protocol](docs/M1_CALIBRATION_PROTOCOL.md)
