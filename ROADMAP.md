# FootClubSim roadmap

> Planning document, updated **2026-11-09**. **M0 closed 2026-10-15**; M1 and formal M2 exit #4 remain OPEN. The single-season Playable Preview is publicly accessible on [GitHub Pages](https://stanleyll0yd.github.io/FootClubSim/) as a **test preview**, not an accepted stable/playable release. Owner manual acceptance [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488) is OPEN. [Final acceptance ADR-0010](docs/adr/0010-m0-final-acceptance.md). The owner-approved [M0/M2 gate boundary](docs/adr/0006-m0-m2-acceptance-boundary.md) separates M0 source/contracts acceptance from M2 playable rosters and executable authentic rules.

## Product-first reorientation · 2026-11-05

The owner directed active development toward a **working game**, not more low-frequency referee, medical, or disciplinary edge cases. [ADR-0011](docs/adr/0011-playable-first.md), [product task #478](https://github.com/StanleyLl0yd/FootClubSim/issues/478).

**Implemented vertical slice (on the existing v188 engine):** create a manager → choose among 16 fictional clubs → choose XI/tactics → play and resume a season → inspect 30 rounds/240 results and provisional table → export/import complete career. The approved playable synthetic pack remains separate from the immutable M0 catalog. [#478](https://github.com/StanleyLl0yd/FootClubSim/issues/478) tracks the initial #479–#486 implementation; [#492–#495](https://github.com/StanleyLl0yd/FootClubSim/pull/495) added owner-driven improvements. Automated evidence does not replace manual product acceptance.

**Deferred until a functioning playable preview:** rare Law 5 returns, clinical authority edge cases, KDK appeals/cancellations, unusual late rescheduling, and research-level statistical calibration. Preserve existing implementation, regression checks, original save formats and rights boundaries; do not merge a failing PR. Open historic P3/P5 gates stay OPEN, not artificially accepted. This decision authorizes **M1 player-facing prototype work** now, without falsely signing off M1 exit #3 or M2 release compliance. Any changed formal milestone gates require an explicit documented re-baseline, not silent checklist edits.

**The next decision is owner product acceptance, not an automatic M1 or M2 exit:** automated full seasons have passed in Windows Chrome/Edge and macOS Safari, and the owner has played complete seasons and reported follow-up defects. The nine owner checklist items are **not signed off**. Real Safari lifecycle/download and quota/eviction coverage remain open in [#155](https://github.com/StanleyLl0yd/FootClubSim/issues/155).

## Player-facing navigation · 2026-11-09

Two in-page workspaces: **«Тренер и клуб»** for onboarding and club selection, **«Сезон»** for active competition. The canonical v188 season stays mounted while hidden; save/restore and full archive controls are shared in an expandable panel. Creating, loading or importing a career opens the season automatically; starting a new career returns to setup. No browser routes, persistence schema migrations or match-engine changes.

Extend the same workspace navigation with dedicated **transfers, finances, contracts and staff** sections only when their M3 game functionality is implemented. Avoid dead tabs or an ever-growing season page. Verify keyboard tab access, responsive layout and an entire v188 season with reload and full archive restore; manual product acceptance [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488) remains OPEN.

## Playable Preview: published state and owner-feedback backlog · 2026-11-09

**Published test build:** [GitHub Pages](https://stanleyll0yd.github.io/FootClubSim/). Initial preview [#495](https://github.com/StanleyLl0yd/FootClubSim/pull/495) has since been superseded by [#497](https://github.com/StanleyLl0yd/FootClubSim/pull/497) (club badges and actor teams), [#498](https://github.com/StanleyLl0yd/FootClubSim/pull/498) (measurable versioned formation influence), and [#499](https://github.com/StanleyLl0yd/FootClubSim/pull/499) (final-round leader congratulation). GitHub Actions publication is confirmed; independent HTTP verification and overall owner manual sign-off remain separate.

**Implemented after the first owner playthrough; owner retest still required:**

| Owner finding | Integrated change | Evidence / outstanding check |
| --- | --- | --- |
| Starting an unsaved career raised `NOT_FOUND` | Start-season persists the new active career safely | [#492](https://github.com/StanleyLl0yd/FootClubSim/pull/492); owner retest |
| Other clubs' fixtures required manual clicks | Automatically simulate opponents up to the next user's fixture, including the final season tail | [#493](https://github.com/StanleyLl0yd/FootClubSim/pull/493); owner retest |
| Table lacked W/D/L; XI had no formation selector | Show wins/draws/losses; select and persist a formation with a schematic XI field | [#494](https://github.com/StanleyLl0yd/FootClubSim/pull/494); actual match effect subsequently added in [#498](https://github.com/StanleyLl0yd/FootClubSim/pull/498), owner verified |
| No title celebration, limited match history, tactics reset between matches | Read-only mathematically guaranteed title display, event-derived own-match reports, carry forward eligible XI/formation/pressing/tempo | [#495](https://github.com/StanleyLl0yd/FootClubSim/pull/495); owner retest |
| New careers repeated the same league positions; lineup controls overlapped | New-career Web Crypto seed, preserving each stored seed; responsive XI/tactics layout | [#495](https://github.com/StanleyLl0yd/FootClubSim/pull/495); 390/768/1280 px automated checks passed, owner retest |

**Owner-feedback implementation status.** A fixed defect is not formal M1/M2 closure or completion of all nine PP checks. Owner confirmed badge/team labels and formation effects in [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488). Final-round congratulations were corrected in #499 but still await a retest on the owner's archived season. Role-aware XI suggestion in [#500](https://github.com/StanleyLl0yd/FootClubSim/pull/500) is an additional player-facing improvement, not an accepted release gate.

| Priority | Work and owner-visible completion criterion | Existing tracking |
| --- | --- | --- |
| **P0 — tactics (implemented, owner verified #498)** | Trace the selected formation through the UI → versioned tactical plan → canonical v188 match input → chance/position/role evaluation. Verify whether it has a gameplay effect rather than just being stored/displayed. Use paired identical pre-match states and seeds, then a sufficiently sized seed cohort with reproducible aggregate changes in events/xG/chances, meaningful role fit and documented uncertainty. If the current runner ignores formation, implement an explicit versioned, tested gameplay effect **without rewriting existing careers**. A single unchanged score is not proof of no effect, nor must every tactical change force a different score. | [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488), M1-P2 [#28](https://github.com/StanleyLl0yd/FootClubSim/issues/28), M1-P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31), [ADR-0007](docs/adr/0007-match-tactics-multicurrency.md) |
| **P1 — club badges (implemented, owner verified #497)** | Reuse the **already approved 16 original abstract circular badges** (not real club crests) with stable club IDs. Show both teams' badges in match headers, a player's team badge in each match-event row, and consistent identities in fixtures, tables and club-selection UI. Verify contrast, sizes 16/20/24/32 px, accessibility/alternative labels, and real-browser layout. Club badge designs exist in [ADR-0005](docs/adr/0005-liga-prikolov-brand-and-personnel.md); their use in the main playable match/fixture/table UI is **owner verified**; broader accessibility review remains open. | [#87](https://github.com/StanleyLl0yd/FootClubSim/issues/87), [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488) |
| **P1 — match-event ownership (implemented, owner verified #497)** | For each shown goal, own goal, penalty, card or dismissal, make the actor's club identifiable by badge and accessible team name. Distinguish an own-goal offender's team from the **beneficiary** of the credited goal. Source participant/team/minute/type from the authoritative v188 ledger; do not synthesize possession, corners, fouls or other unavailable statistics. Verify home/away, own-goals, penalties and scorer records against replay. | M1-P4 [#30](https://github.com/StanleyLl0yd/FootClubSim/issues/30), [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488) |
| **P1 — usable lineup and reports (XI adviser implemented #500; owner retest and accessibility review open)** | Retest XI/formation/tempo/pressing controls and report tables with real player input at narrow and wide widths, keyboard and screen-reader navigation; no text overlap, clipped selector or horizontal overflow. Continue to preserve the last legal XI/tactics and show unavailable-player replacements explicitly. Verified UX problems belong in the **current Playable Preview**, not deferred wholesale to M5. | [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488), M5 [#7](https://github.com/StanleyLl0yd/FootClubSim/issues/7) |
| **P1 — season diversity / competitive balance (open)** | Reproduce the former fixed-seed repetition and confirm that **new** careers now use different stored seeds while existing ones replay identically. Analyze multiple independent full-season seeds, mirrored clubs/opponents where appropriate, table-position variability and chances/xG/goal distributions; distinguish true club-strength bias from one or two observed seasons. No forced winners, hand-tuned table positions or retroactive match rewrites. Statistical realism and reference calibration remain separate formal M1-P5 gates. | [#495](https://github.com/StanleyLl0yd/FootClubSim/pull/495), [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31) |
| **P2 — approved personnel (open M2 gate)** | Replace current preview-generated names only through a **new versioned, vetted M2 catalog** with verified player/staff roles and positional eligibility. The 46 approved «Надир» characters include **26 footballers, 12 coaches, 2 executives and 6 support staff**, not 46 footballers. Do not rename the immutable 23-player synthetic seed or silently migrate prior IndexedDB careers. | [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91), [ADR-0005](docs/adr/0005-liga-prikolov-brand-and-personnel.md), M2 [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4) |

**Completion policy:** each item needs an attributable source/engine or UI change, relevant reproducible core/browser regression checks, and a new owner observation where user experience is involved. Record owner feedback in [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488) and link implementation PRs. This backlog **does not silently alter the nine already approved PP-1–PP-9 criteria**, close their manual checklist, re-baseline M1/M2, or waive source rights. Preserve old IndexedDB careers and archive/replay/CAS formats unless an explicit versioned migration is approved. A public Pages test deployment **is not a stable release**; [#155](https://github.com/StanleyLl0yd/FootClubSim/issues/155), M1 [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) and M2 [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4) remain independent gates.

## Independent acceptance tracks · owner approved 2026-11-09

The [Playable Preview acceptance specification](docs/PLAYABLE_PREVIEW_ACCEPTANCE.md) defines the nine agreed product criteria and owner manual walkthrough. **Criteria are approved; the preview itself is not yet signed off.** This product gate does not amend the formal milestone requirements.

| Track | Acceptance basis | Current status |
| --- | --- | --- |
| **M1 technical engine** | All P1–P5 criteria, P3/P5 matrix and two full whole-repository exit audit passes in [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) | OPEN; P3/P5 1/9 accepted, exit audits not completed |
| **Playable Preview product** | Coherent single-season manager journey, save/recovery, real-browser evidence and separate owner manual sign-off | Scope approved; automation demonstrated; manual sign-off pending |
| **M2 formal competition** | Verified sporting rules/provenance/rights, league restrictions, full M2 acceptance and two exit audit passes in [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4) | OPEN; not inferred from the prototype |

A Playable Preview may be internally accepted while M1 stays open under ADR-0011, but it does not close M1, M2 or [release/storage gate #155](https://github.com/StanleyLl0yd/FootClubSim/issues/155). No public playable or stable release is authorized by approving preview criteria.

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

M1 P3/P5 priorities are tracked in the [nine-block functional closure matrix](docs/M1_P3_P5_ACCEPTANCE_MATRIX.md). Its nine tracked groups are **not** a substitute for P1/P2/P4 or the two mandatory repository-wide M1 exit audits.

**After functional work and acceptance for M0 and every subsequent M stage**, perform a full two-pass whole-repository audit, safe refactor and code review per [AGENTS.md](AGENTS.md). A milestone is not complete until its exit issue contains the report and available CI/test/security evidence. Do not equate a green PR with passing the exit gate.

| Stage | Planned result | Mandatory exit |
| --- | --- | --- |
| M0 (closed 2026-10-15) | Requirements, architecture, data contracts, match specification, provenance policy, tooling and M1 backlog; closed after exact-main CI, with explicit pre-release deferrals under ADR-0010 | [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) |
| M1 | Reproducible, headless 11v11 event-driven match engine, tactical input and statistical calibration | [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) |
| M2 | Formally accept the «Лига приколов» season under verified authentic RPL/RFU/IFAB sporting rules, original fictional clubs, licensed/provenanced data, and durable saves. The playable prototype is tracked separately. | [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4) |
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

**Current player-facing M1 evidence (2026-11-09):** the canonical v188 browser path completes 240 scheduled matches and restores full career archives in Windows Chrome/Edge and macOS Safari. A selected formation is now stored in the tactical plan and shown on a schematic field, but its effect on the simulated events has **not been demonstrated**; the paired-formation investigation above is an immediate product task. Historical reproducibility, source replay, and preservation of old careers remain requirements. Full formal M1-P1–P5 acceptance, independently sourced calibration and milestone exit audits remain OPEN.

**Historical technical progress (2026-10-16):** M1 had progressed from deterministic clock, tactics and shot replay (#159-#165) to isolated versioned v8 medical/disciplinary/special-goal match events, independently replay-verified dossiers and season statistics, bounded 16-fixture atomic domain batches and a separate browser-local IndexedDB revision-CAS prototype. PR #218 and #219 are merged; all eight PR-head checks passed for each, including a dedicated **240/240 synthetic fixture** full-season workload (not gameplay calibration or production browser acceptance). The second Ubuntu/Node CI sample processed all 240 fixtures in 312.25 seconds using 16-fixture batches, 3,740,301 serialized journal bytes and independent final source/season verification; see [the v8 journal evidence](docs/M1_V8_SOURCE_REPLAY_JOURNAL.md) and [P5 #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31). A late 16-fixture batch still took 28.25 seconds of synchronous Node CPU time; this explicitly **does not** certify main-thread browser responsiveness, durable real-quota/eviction recovery or production throughput.

**M1 blockers remain OPEN:** P1/P2/P3/P4/P5 #27-#31, full deterministic competition-sanction/injury/fatigue/condition policy, an independently licensed statistical reference and calibration tolerances, actual native-browser quota/eviction and recovery evidence (release issue #155), two complete repository-wide M1 exit audit/review passes (#3). Protected-main governance was completed separately in [#217](https://github.com/StanleyLl0yd/FootClubSim/issues/217). No inferred third-party referee/medical/KDK authorization, authenticated source claims, official standings or playable RPL compliance is created by the synthetic v8 data. The original M0 pack and v3-v7 stored formats remain separate; **formal M2 acceptance and a stable release are not authorized**. Player-facing prototype work proceeds only within [ADR-0011](docs/adr/0011-playable-first.md).

**M1 START AUTHORIZED BY OWNER 2026-10-15.** The complete [M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) and a subsequent post-M0 whole-repo review #157 are closed. Work started with [M1-P1 #27](https://github.com/StanleyLl0yd/FootClubSim/issues/27) via narrow, versioned, reproducible headless state-machine increments; the subsequently authorized playable-first work does not grant M2 registration/rules compliance or stable-release claims. M1 itself stays **OPEN** until tasks #27-#31 and mandatory two full whole-repo exit audits under [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) pass.



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

M3 introduces economy/transfer systems, training, staff and full per-area responsibility delegation (player/staff contracts, recruitment, training), plus practical effects of manager competencies on these real systems. **Owner-approved D07 (latest [ADR-0009](docs/adr/0009-rub-only-ledger-and-cbr-source-option.md))** requires a **RUB-only** internal ledger with all financial amounts posted to nearest **10,000 ₽**, even when contracts/deals use USD or EUR and **automatic currency conversion based on the official Bank of Russia daily XML rates**, using **one immutable daily snapshot** fetched at first game entry, with foreign -> RUB rounded to nearest **10,000 ₽** and any USD/EUR target conversion, **including EUR ↔ USD**, to nearest **1,000** target units, with date-pinned rates, no retroactive career changes and prior verification of Bank of Russia source attribution, applicable commercial reuse terms and actual browser CORS/adapter operation ([ADR-0007](docs/adr/0007-match-tactics-multicurrency.md), [ADR-0008](docs/adr/0008-online-daily-fx-rounding.md), [M3 issue #131](https://github.com/StanleyLl0yd/FootClubSim/issues/131)). The approved manager-profile wizard has been implemented in the authorized Playable Preview; gameplay effects and formal M2 acceptance remain separate in #76 and #4. Neither stage introduces multiplayer. M4 introduces additional modeled divisions/world clubs without promising fully playable foreign leagues. M5 introduces PWA polish, not a required backend. M6 desktop packaging is conditional on real benefit and platform acceptance; no dedicated Linux app is promised.

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
- [Independent Playable Preview acceptance](docs/PLAYABLE_PREVIEW_ACCEPTANCE.md)
