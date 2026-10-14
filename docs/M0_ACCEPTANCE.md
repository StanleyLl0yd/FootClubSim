# M0 acceptance checklist

Status: **OPEN**. Evidence must come from actual implementation, source review or observed tests, not from the existence of this checklist. The [M0 blocker decision package](M0_BLOCKER_DECISIONS.md) lists concrete **pending** owner choices and proposed M0 vs M2 acceptance boundaries; it grants no automatic approval. Complete and cross-reference [M0 exit issue #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) before declaring M0 closed.

## Scope and documentation

Продуктовые решения и их статусы перечислены в [M0_PRODUCT_DECISIONS.md](M0_PRODUCT_DECISIONS.md). **2026-10-14 утверждены принципы распределения обязанностей по каждой задаче отдельно** ([ADR-0002](adr/0002-configurable-delegation.md)), **трёх путей создания менеджера с характеристиками и вымышленной биографией** ([ADR-0003](adr/0003-manager-origins-biographies.md)), а также **«Лиги приколов» с вымышленными клубами-антонимами и настоящими спортивными правилами РПЛ** ([ADR-0004](adr/0004-liga-prikolov-rpl-rules.md)). Остальные решения и конкретные численные параметры не считаются согласованными автоматически.

- [x] Create public FootClubSim repository and adapt `AGENTS.md` from WindowTidy.
- [x] Create dedicated whole-repo exit issues for M0–M6.
- [ ] Review and approve roadmap, boundaries and platform plan.
- [x] Agree on **default player control with independent delegation per responsibility** across coach/director/staff duties (owner decision 2026-10-14, [ADR-0002](adr/0002-configurable-delegation.md)). Detailed UX and feature-phase acceptance remain open.
- [x] Agree on **three manager-origin paths**, starter competencies and biography generation based on the origin/skill distribution before club selection (owner decision 2026-10-14, [ADR-0003](adr/0003-manager-origins-biographies.md)); exact attribute list, point budget, templates and implementation are for later design/M2 under [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).
- [x] Agree on fictional **«Лига приколов»** with reversed/antonym-inspired names based on the 16 RPL 2026/27 participants, **but genuine source-verified effective RPL/RFU/IFAB sporting regulations** (owner decision 2026-10-14, [ADR-0004](adr/0004-liga-prikolov-rpl-rules.md)). **Five source-team aliases** have now been accepted (Зеленобер, Изумруд, Низон and two clubs both called Статика); remaining eleven mappings, geographic disambiguation, full rule verification and brand/asset rights remain open. The existing synthetic pack has not been changed.
- [ ] Sign off player attributes, tactics, economy representation and the **remaining** detailed minimum-season rules. The fictional «Лига приколов» naming principle and **authentic-source RPL regulations requirement** are approved, while the remaining eleven club aliases, locality choices for both «Статика» teams, numerical balance, complete regulations and edge cases are pending.
- [ ] Record the **remaining** decisions in ADRs and resolve identified incompatibilities in the specifications. [ADR-0002](adr/0002-configurable-delegation.md), [ADR-0003](adr/0003-manager-origins-biographies.md) and [ADR-0004](adr/0004-liga-prikolov-rpl-rules.md) record accepted principles; future implementation is tracked in [#58](https://github.com/StanleyLl0yd/FootClubSim/issues/58) and [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).
- [ ] Verify official RPL 2026/27 rules from primary document and cite exact revision for each encoded rule. [A sourced subset](RPL_2026_27_RULES.md) now includes match interruption, pre-kickoff substitution and cross-season discipline details; full rules, amendments and implementation checks remain open.

## Data readiness

- [x] Define and implement the **M0 synthetic-only** catalog, revision-0 initial-career JSON/save and provenance declaration schemas with bounded validation: `src/core/import.ts`, `src/core/save.ts`, `src/core/provenance.ts`, and corresponding tests. This does **not** imply a full evolving career schema or a licensed real RPL data-pack provenance contract; both require new versions, tests and independent permission review.
- [x] Add a **synthetic** fictional 16-club/368-player test dataset, seed-specific pack identity, author-origin manifest and runtime validation.
- [x] Demonstrate duplicate identity detection, malformed/oversized data rejection and cross-reference checks in headless tests.
- [ ] Complete rights review for the fictional league's original **parody club names/visual identities** and any separately included real club/league references; no real roster, team crest or licensed image is authorized for bundling by this design decision. The owner has explicitly chosen fictional participant identities, not a real roster database.
- [ ] Ensure no prohibited scraping, copyrighted assets, production/private credentials or secret values are committed.

## Code and tooling foundation

- [x] Create the minimal TypeScript strict workspace with Vite/React browser shell and isolated headless domain modules.
- [x] Commit dependency lockfile, define numeric-only versioning and safe production build (CI verified).
- [x] Set source-format hygiene, ESLint (TypeScript/React Hooks), types, unit tests and CI, with least privilege and pinned external actions.
- [x] Implement/document the **M0-only worker-message/orchestration contract and pure command/state admission validation**, with negative tests, in [M0_WORKER_PROTOCOL.md](M0_WORKER_PROTOCOL.md), `src/core/command-contracts.ts` and `src/core/worker-protocol.ts`. No real Worker scheduling, simulation or multi-revision commit is implemented yet; that belongs to later milestones.
- [x] Test bounded JSON export/import and integrity rejection in [PR #22](https://github.com/StanleyLl0yd/FootClubSim/pull/22); a repeatable manual browser [smoke plan](M0_BROWSER_SMOKE.md) is available. This is the M0 initial-career prototype only.
- [x] Verify actual macOS Safari initial-career save/reload/restore in [PR #38](https://github.com/StanleyLl0yd/FootClubSim/pull/38), Windows Edge in [PR #39](https://github.com/StanleyLl0yd/FootClubSim/pull/39), and **Windows Chrome** in [PR #67](https://github.com/StanleyLl0yd/FootClubSim/pull/67) ([four-browser CI run](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38473107523)). [PR #40](https://github.com/StanleyLl0yd/FootClubSim/pull/40) covers unavailable IndexedDB API. **Native Windows Chrome incognito and Edge InPrivate smoke are now additionally covered**, but Safari Private Browsing, genuine quota exhaustion/eviction and across-session backup/recovery remain open. M0 exit is not approved.

## Match engine preparation

- [ ] **Owner-sign off** deterministic PRNG contract and exact input/event/output schema. The existing M0 `xorshift32-v1` is documented and locked to known vectors in [MATCH_ENGINE.md](MATCH_ENGINE.md) and `tests/rng-vectors.test.mjs`, but the M1 algorithm/sign-off remains open.
- [x] Establish seeded synthetic double-round-robin fixture generation and invariant/negative tests in [PR #20](https://github.com/StanleyLl0yd/FootClubSim/pull/20), [PR #24](https://github.com/StanleyLl0yd/FootClubSim/pull/24) and [PR #51](https://github.com/StanleyLl0yd/FootClubSim/pull/51).
- [ ] Approve the [M1 calibration protocol](M1_CALIBRATION_PROTOCOL.md) (metrics, 10,000-seed sampling, uncertainty and reference-rights gate drafted); select legally permitted external baselines and freeze tolerances before tuning.
- [x] Specify **planned** rules-pack separation and dependencies for registration, standings, discipline and administrative outcomes in [M0_RPL_RULES_MATRIX.md](M0_RPL_RULES_MATRIX.md). Complete source/legal verification and executable rules remain **open** under issue #15.
- [x] Open the [prioritized M1 implementation backlog](M1_BACKLOG.md); remaining effort estimates and technical risks still require approval.

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
