# FootClubSim roadmap

> Planning document. Updated 2026-10-13. The project is in **M0: design/foundation**; no playable release exists.

## Product contract

- Browser-first, offline-capable, Russian-language single-player football **club management** simulation.
- Initially playable league: Russian Premier League (RPL). Other competitions may have a reduced non-playable representation to support transfers, promotion and relegation.
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
| M0 | Requirements, architecture, data contracts, match specification, provenance policy, tooling and M1 backlog | [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) |
| M1 | Reproducible, headless 11v11 event-driven match engine, tactical input and statistical calibration | [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) |
| M2 | Play a complete RPL season in the browser with club selection, fixtures, standings, match reports and durable saves | [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4) |
| M3 | Transfers, contracts, finances, training, scouting foundation and AI club choices | [#5](https://github.com/StanleyLl0yd/FootClubSim/issues/5) |
| M4 | Multi-season careers, player aging, academy/regens, promotion/relegation and modeled external market | [#6](https://github.com/StanleyLl0yd/FootClubSim/issues/6) |
| M5 | Refined Russian UI, accessibility, performance, offline PWA install, data update UX and recovery | [#7](https://github.com/StanleyLl0yd/FootClubSim/issues/7) |
| M6 | Stable numbered release and optional macOS/Windows desktop packaging after explicit feasibility review | [#8](https://github.com/StanleyLl0yd/FootClubSim/issues/8) |

## M0: foundation and acceptance

See [M0 acceptance checklist](docs/M0_ACCEPTANCE.md).

- [x] Public repository, README and original-derived `AGENTS.md`.
- [x] Create non-optional audit issues for M0–M6.
- [ ] Approve product scope and [architecture](ARCHITECTURE.md); the independent staff-delegation principle [ADR-0002](docs/adr/0002-configurable-delegation.md) and manager-origin/biography principle [ADR-0003](docs/adr/0003-manager-origins-biographies.md) have been accepted, while numerical balance and remaining product decisions are open.
- [ ] Finalize minimum player/club data contract and a legally usable initial **synthetic** dataset.
- [ ] Specify deterministic match simulation and game-calendar transitions; [M1 calibration protocol](docs/M1_CALIBRATION_PROTOCOL.md) is drafted, but approved statistical reference baselines remain unavailable.
- [ ] Establish provenance/rights gates for real RPL data and assets.
- [x] Bootstrap TypeScript/Vite/React shell, locked dependencies and CI for types, ESLint, source formatting, tests and production build. Native Safari and Windows Edge smoke verification is also automated; exceptional storage cases remain tracked.
- [ ] Finish browser storage capability and fallback/export strategy testing: the initial career save/reload/restore and unavailable IndexedDB path are verified in actual Safari/macOS, Chrome/Edge Windows and Chromium/Linux (see [PR #67](https://github.com/StanleyLl0yd/FootClubSim/pull/67)); **actual private mode, quota/eviction, backup/recovery** remain unverified.
- [x] Open a [prioritized M1 implementation backlog](docs/M1_BACKLOG.md) with dependencies and preliminary effort/risks.
- [ ] Validate the remaining M1 estimates, risks and open technical decisions before M0 exit.
- [ ] Complete the [M0 whole-repository exit audit](https://github.com/StanleyLl0yd/FootClubSim/issues/2) **including second full pass** and attach results.

M0 documentation may be merged incrementally without claiming M0 completion. Do not mark unverified tasks complete.

**Mandatory handoff pause:** when every M0 acceptance criterion and both complete audit passes really pass, publish a final M0 completion report, close the M0 exit issue #2, **STOP all implementation work, and notify the project owner**. Start no M1 feature, prototype or PR without the owner's explicit subsequent authorization.

## M1: simulation engine

- Player match attributes and tactical roles with typed contracts.
- Seeded deterministic, replayable match action/event model independent of React.
- Coherent goals, assists, shots, xG, cards, injuries, substitutions, fatigue and disciplinary records.
- Match report generated from the same event log, including 0–0 and abandoned/error handling policy.
- Statistical calibration over a documented seeded sample against independently sourced reference distributions; record tolerances and variance, do not claim realism before evidence.
- Invariant/property and regression testing, bounded runtime, proper error reports.
- Whole-repository exit gate [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3).

## M2: RPL season

- Russian-language desktop-oriented browser interface; **first create a manager profile** (former pro, theorist, or custom point allocation) with a seeded fictional biography to preview/accept, **then** pick a club. See [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).
- Season fixtures, fixtures chronology, results, standings and tiebreaker rule data.
- Computer clubs select legal lineups and adapt tactics; absences and suspensions respected.
- Player's lineup/bench and tactics responsibilities are separately configurable: decide manually by default, or delegate to an eligible named club employee. Show decision authority and support manual takeover ([#58](https://github.com/StanleyLl0yd/FootClubSim/issues/58)).
- Simulate next event/tour rapidly, persist and restore game state, export/import career save. Preserve manager origin, competencies, accepted biography and its generator/template version across saves.
- Fully offline core behavior; tested Safari/Chromium compatibility.
- Whole-repository exit gate [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4).

## M3–M6 scope controls

M3 introduces economy/transfer systems, training, staff and full per-area responsibility delegation (player/staff contracts, recruitment, training), plus practical effects of manager competencies on these real systems. The approved manager-profile wizard is planned for M2, not M1. Neither stage introduces multiplayer. M4 introduces additional modeled divisions/world clubs without promising fully playable foreign leagues. M5 introduces PWA polish, not a required backend. M6 desktop packaging is conditional on real benefit and platform acceptance; no dedicated Linux app is promised.

## Explicit exclusions until a future decision

- Real-time 2D/3D matches, 11v11 physical animation, live human-versus-human multiplayer.
- Mandatory hosted accounts, central game server or remote simulation.
- Scraping Transfermarkt or club/league pages without appropriate authorization.
- Shipping unlicensed crests, photos, player likeness collections, or third-party commercial data.
- Automatic importing of live real-world transfers into existing careers.
- Unverified promises about exact 2026/27 competition regulations; official rules must be versioned in a rules pack.

## Related documents

- [Architecture](ARCHITECTURE.md)
- [Model of data and career state](docs/DATA_MODEL.md)
- [Match simulation design](docs/MATCH_ENGINE.md)
- [Data provenance and rights](docs/DATA_SOURCES.md)
- [M0 exit criteria](docs/M0_ACCEPTANCE.md)
- [Prioritized M1 tasks](docs/M1_BACKLOG.md)
- [M1 calibration and evidence protocol](docs/M1_CALIBRATION_PROTOCOL.md)
