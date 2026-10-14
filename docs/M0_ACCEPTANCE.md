# M0 acceptance checklist

Status: **OPEN**. The owner accepted the [M0 foundation versus M2 playable-personnel/rules boundary](adr/0006-m0-m2-acceptance-boundary.md) on 2026-10-14. M0 requires contracts, source/release-risk controls for its own synthetic pack and dated primary-source reference paths; completed 16-club registrations, M2 fictional player catalog and executable authentic rules are **not** M0 exit predicates. Evidence must come from actual implementation, source review or observed tests, not from the existence of this checklist. The [M0 blocker decision package](M0_BLOCKER_DECISIONS.md) lists concrete **pending** owner choices and proposed M0 vs M2 acceptance boundaries; it grants no automatic approval. Complete and cross-reference [M0 exit issue #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) before declaring M0 closed.

## Scope and documentation

Продуктовые решения и их статусы перечислены в [M0_PRODUCT_DECISIONS.md](M0_PRODUCT_DECISIONS.md). **2026-10-14 утверждены принципы распределения обязанностей по каждой задаче отдельно** ([ADR-0002](adr/0002-configurable-delegation.md)), **трёх путей создания менеджера с характеристиками и вымышленной биографией** ([ADR-0003](adr/0003-manager-origins-biographies.md)), а также **«Лиги приколов» с вымышленными клубами-антонимами и настоящими спортивными правилами РПЛ** ([ADR-0004](adr/0004-liga-prikolov-rpl-rules.md)), с уточнением утверждённых 16 названий, эмблем и прототипов в [ADR-0005](adr/0005-liga-prikolov-brand-and-personnel.md)). Остальные решения и конкретные численные параметры не считаются согласованными автоматически.

- [x] Create public FootClubSim repository and adapt `AGENTS.md` from WindowTidy.
- [x] Create dedicated whole-repo exit issues for M0–M6.
- [ ] Review and approve roadmap, boundaries and platform plan.
- [x] Agree on **default player control with independent delegation per responsibility** across coach/director/staff duties (owner decision 2026-10-14, [ADR-0002](adr/0002-configurable-delegation.md)). Detailed UX and feature-phase acceptance remain open.
- [x] Agree on **three manager-origin paths**, starter competencies and biography generation based on the origin/skill distribution before club selection (owner decision 2026-10-14, [ADR-0003](adr/0003-manager-origins-biographies.md)); exact attribute list, point budget, templates and implementation are for later design/M2 under [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).
- [x] Agree on fictional **«Лига приколов»** with reversed/antonym-inspired names based on the 16 RPL 2026/27 participants, **but genuine source-verified effective RPL/RFU/IFAB sporting regulations** (owner decision 2026-10-14, [ADR-0004](adr/0004-liga-prikolov-rpl-rules.md)). **All 16 source-team aliases and circular badge concepts** are approved, with «Статика М1»/«Статика М2» and original ring-based graphics ([ADR-0005](adr/0005-liga-prikolov-brand-and-personnel.md)). Rights, current-season factual roster verification, full rule verification and external release clearance remain open. The original synthetic pack is unchanged.
- [x] **Explicit owner sign-off 2026-10-14** for D03-D05 and D07-D11 under [ADR-0007](adr/0007-match-tactics-multicurrency.md), **refined by [ADR-0008](adr/0008-online-daily-fx-rounding.md)**: network-connected browser (no mandatory offline play), D07 RUB/USD/EUR with **one fixed Google reference snapshot at first game entry per calendar day** and rounded conversion output (**USD/EUR -> RUB: 10,000 ₽; RUB -> USD/EUR: 1,000 units**). D03/D05 retain interactive in-match control. This closes only the product specification choice; legal Google feed access, exact balance, RPL execution, source rights, actual browser/storage edge cases and two full audits remain separate gates.
- [ ] Record the **remaining** decisions in ADRs and resolve identified incompatibilities in the specifications. [ADR-0002](adr/0002-configurable-delegation.md), [ADR-0003](adr/0003-manager-origins-biographies.md) and [ADR-0004](adr/0004-liga-prikolov-rpl-rules.md) record accepted principles; future implementation is tracked in [#58](https://github.com/StanleyLl0yd/FootClubSim/issues/58) and [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).
- [ ] Approve the M0 source/edition matrix and source citation for **every currently encoded M0 check**; identify outstanding official amendments, conflicts, implementation tests and the exact M2 authentic-rules gate. [A sourced subset](RPL_2026_27_RULES.md) includes match interruption, pre-kickoff substitution and cross-season discipline; exhaustive executable coverage is **M2**, not a fictitious M0 success.

## Data readiness

- [x] Define and implement the **M0 synthetic-only** catalog, revision-0 initial-career JSON/save and provenance declaration schemas with bounded validation: `src/core/import.ts`, `src/core/save.ts`, `src/core/provenance.ts`, and corresponding tests. This does **not** imply a full evolving career schema or a licensed real RPL data-pack provenance contract; both require new versions, tests and independent permission review.
- [x] Add a **synthetic** fictional 16-club/368-player test dataset, seed-specific pack identity, author-origin manifest and runtime validation.
- [x] Demonstrate duplicate identity detection, malformed/oversized data rejection and cross-reference checks in headless tests.
- [ ] Complete M0 source/provenance and branding **risk review** for actually included original names, visual identity definitions and the synthetic pack; confirm no third-party roster, image, protected expressive text or unlicensed material enters the M0 output. Wikipedia-first research references must pin revisions and retain effective-date/rights unknowns. Full M2 roster/coach registration verification and clearance of **future** release content are separate, still-blocking **M2** gates under [ADR-0006](adr/0006-m0-m2-acceptance-boundary.md).
- [ ] Ensure no prohibited scraping, copyrighted assets, production/private credentials or secret values are committed.

## Code and tooling foundation

- [x] Create the minimal TypeScript strict workspace with Vite/React browser shell and isolated headless domain modules.
- [x] Commit dependency lockfile, define numeric-only versioning and safe production build (CI verified).
- [x] Set source-format hygiene, ESLint (TypeScript/React Hooks), types, unit tests and CI, with least privilege and pinned external actions.
- [x] Implement/document the **M0-only worker-message/orchestration contract and pure command/state admission validation**, with negative tests, in [M0_WORKER_PROTOCOL.md](M0_WORKER_PROTOCOL.md), `src/core/command-contracts.ts` and `src/core/worker-protocol.ts`. No real Worker scheduling, simulation or multi-revision commit is implemented yet; that belongs to later milestones.
- [x] Test bounded JSON export/import and integrity rejection in [PR #22](https://github.com/StanleyLl0yd/FootClubSim/pull/22); a repeatable manual browser [smoke plan](M0_BROWSER_SMOKE.md) is available. This is the M0 initial-career prototype only.
- [x] Verify actual macOS Safari initial-career save/reload/restore in [PR #38](https://github.com/StanleyLl0yd/FootClubSim/pull/38), Windows Edge in [PR #39](https://github.com/StanleyLl0yd/FootClubSim/pull/39), and **Windows Chrome** in [PR #67](https://github.com/StanleyLl0yd/FootClubSim/pull/67) ([four-browser CI run](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38473107523)). [PR #40](https://github.com/StanleyLl0yd/FootClubSim/pull/40) covers unavailable IndexedDB API. **Native Windows Chrome Incognito/Edge InPrivate and complete normal-browser restart/restore on Windows Chrome/Edge** ([PR #127](https://github.com/StanleyLl0yd/FootClubSim/pull/127)) are also covered, but Safari Private Browsing, genuine quota exhaustion/eviction, Safari process-restart persistence and Safari's native downloaded-file recovery remain open; native Windows Chrome/Edge downloaded-file recovery was verified in [PR #129](https://github.com/StanleyLl0yd/FootClubSim/pull/129) (reproducible [exceptional-case QA protocol](M0_STORAGE_EDGE_ACCEPTANCE.md)). M0 exit is not approved.

## Match engine preparation

- [ ] **Owner-sign off** deterministic PRNG contract and exact input/event/output schema. The existing M0 `xorshift32-v1` is documented and locked to known vectors in [MATCH_ENGINE.md](MATCH_ENGINE.md) and `tests/rng-vectors.test.mjs`, but the M1 algorithm/sign-off remains open.
- [x] Establish seeded synthetic double-round-robin fixture generation and invariant/negative tests in [PR #20](https://github.com/StanleyLl0yd/FootClubSim/pull/20), [PR #24](https://github.com/StanleyLl0yd/FootClubSim/pull/24) and [PR #51](https://github.com/StanleyLl0yd/FootClubSim/pull/51).
- [ ] Approve the [M1 calibration protocol](M1_CALIBRATION_PROTOCOL.md) (metrics, 10,000-seed sampling, uncertainty and reference-rights gate drafted); select legally permitted external baselines and freeze tolerances before tuning.
- [x] Specify **planned** rules-pack separation and dependencies for registration, standings, discipline and administrative outcomes in [M0_RPL_RULES_MATRIX.md](M0_RPL_RULES_MATRIX.md). Complete source/legal verification and executable rules remain **open** under issue #15.
- [x] Open the [prioritized M1 implementation backlog](M1_BACKLOG.md); remaining effort estimates and technical risks still require approval.

**Further D07 owner refinement, 2026-10-14:** [ADR-0009](adr/0009-rub-only-ledger-and-cbr-source-option.md) approves **RUB-only ledger postings to nearest 10,000 ₽** irrespective of deal currency and **all USD/EUR target conversion rounding to nearest 1,000 units**, including direct EUR ↔ USD. CBR exchange rates are a documented, credited-source **candidate**, not yet a confirmed replacement for Google Finance. No M0 finance code or browser/source acceptance is implied.

## Cross-milestone backlog explicitly NOT required to finish M0

- [x] The **boundary decision** is owner-approved in [ADR-0006](adr/0006-m0-m2-acceptance-boundary.md): research-only 16-club Wikipedia references are sufficient at M0; the **0/16** complete registrations and no licensed playable person facts remain explicitly unresolved M2 tasks under [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91).
- [ ] M2 (not M0): complete source-verified and rights-reviewed personnel pack for all 16 clubs, independent parody names and ratings, plus full real-RPL executable rules/edge cases. Do not tick these in M0.
- [ ] M2 (not M0): production-career migrations, quota/eviction/recovery and backup testing for evolving saved careers. Current additional M0 browser exit conditions are **not** automatically waived by this boundary decision.

## Repository-wide milestone exit

Текущие подтверждённые находки и исправления документируются в [M0_AUDIT_PROGRESS.md](M0_AUDIT_PROGRESS.md). Этот отчёт промежуточный: полный первый и обязательный второй проходы ещё не приняты и галочки ниже остаются незакрытыми.

- [ ] Inspect **entire repo**, including docs, scripts, source, tests, dependencies, build, workflows and settings.
- [ ] Do a first complete audit and implement safe corrections/refactoring.
- [ ] Do a mandatory second full pass over the already-refactored repo.
- [ ] Run full applicable tests, build, format, types, security, source-rights and browser verification, with evidence; never claim checks that were not run.
- [ ] Publish M0 audit report: findings, changes, unchanged risks, limitations, before/after metrics with consistent method.
- [ ] Attach audit report, PRs and final-main CI results to issue #2 and close only after criteria actually pass.

## Important caveat

Initial M0 design documentation is **not** an implemented match engine. Do not claim that TypeScript, game rules, a real RPL roster, browser saves, tests, CI or game release are working just because they are described here.
