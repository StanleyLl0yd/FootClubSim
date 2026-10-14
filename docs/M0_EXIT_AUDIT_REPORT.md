# M0 exit audit: two full repository passes

**Status: BOTH COMPLETE TECHNICAL REPOSITORY PASSES PERFORMED, OWNER M0 ACCEPTANCE STILL REQUIRED.** Started 2026-10-14. This report records the audit work and evidence, not the owner's final M0 sign-off. Follow [AGENTS.md](../AGENTS.md) and [issue #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2). M1 is blocked.

## Immutable baseline before first-pass changes

- Exact GitHub `main`: `08688106a494e421c24a0cc516926047cf9716c4`.
- All **147 Git-tracked files** in the recursive GitHub source tree were individually fetched and inspected at this revision, in ordered file-range groups `0..13, 14..27, 28..41, 42..55, 56..69, 70..83, 84..97, 98..111, 112..125, 126..139, 140..146`. Read scope includes seven CI workflows, `.gitignore`, every governance/ADR/source/rights/QA document, all JSON draft/research datasets and test manifest, npm lockfile, build/lint/TypeScript config, source and browser automation/scripts, Python/Node tests, CSS, React shell and branding. The GitHub tree had no separately tracked binary assets. The CI-tracked index is the authoritative size/count method; fetched text lengths are **not** mixed with Git byte measurements.
- Exact-main [Core run 38626130427](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38626130427): 139/139 Node tests, type checking, lint, source-format validation and Vite production build PASS. [Docs run 38626130440](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38626130440): 27/27 Python tests, local links and Git-tracked provenance/secret/action scan PASS. [Dependency security 38626130442](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38626130442): npm audit PASS, 0 reported vulnerabilities.
- Git-index measurements from that exact Docs run: **147 tracked files, 976,966 bytes; 69 `.ts/.tsx/.mjs/.py/.css` source files, 6,540 source lines; 36 test files; 47 Markdown files; zero asset extensions**. These are a baseline for comparison, **not** a commitment to reducing the total number of files when tests/evidence are added.
- Last full four-browser smoke at [exact prior main `fc8dfcd4`, run 38621563388](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38621563388): native Safari/macOS, Windows Chrome/Edge, Linux Chromium all PASS. Documentation-only changes since that run did not trigger another browser job; the final exit must still execute full browsers on the final main.

## First full pass: findings and implemented corrections

| Scope | Review finding / first-pass action | Behavior / evidence |
| --- | --- | --- |
| `src/core/validation.ts` | A new array of all 33 fixed attribute keys was created for every player checked. Hoist this invariant to a module-level constant (no public API or rejection logic change). | No per-player key-list allocation. Existing test/negative input coverage retained. |
| `src/core/match-contracts.ts` | Every `shot` did two separately allocated four-value allowed-outcome arrays and repeated xG bounds checks. Store allowed outcomes once and compute the validity predicate once. | Same `INVALID_SHOT` and same report arithmetic for all four outcomes; add targeted four-outcome regression test. |
| Catalog, import, save, provenance, IndexedDB, worker/delegation protocol | Reviewed stable IDs, version gates, bounded import, add-only write and transaction completion, worker correlation/cancellation and encrypted-context SHA-256 usage. | No broad refactor: contracts are already separated and saved-data compatibility makes speculative deletion risky. |
| Browser app/styles, badge rendering, fixture generator, tactics, RNG, 16-club identities | No safe and independently demonstrated removal was established; accepted original badges/person names and deterministic seed must not drift. | Unchanged until owner-approved milestone work. |
| Tests, browser automation and scripts | Existing input, abnormal browser storage and negative test coverage inspected. | Add a focused shot-outcome regression to prove refactor equivalence; no weakened tests or CI. |
| 7 workflows, dependency and build tools | Action full-SHA pins/least privileges, npm lockfile, Vite separate outputs, TS strict and Node/Python runners inspected. React, ReactDOM, Vite, TypeScript, ESLint plugins and typings have clear build/runtime roles. | No dependency removal shown safe; maintain immutable lockfile. Browser full workflow must be explicitly dispatched on final main. |
| Rights and data files | Synthetic authored M0 manifest has empty assets, published `web-dist` is HTML/JS/CSS-only; pinned Wikipedia-first research is separate, Wikidata secondary. `Изумруд` name collision is a risk lead. | A clean source scan is not trademark/likeness clearance. M2 release needs separate permissions. |
| Docs and ADRs | Reconciled accepted product decisions and M2 deferrals (#149-#152), examined all 47 Markdown files, including historical text and full two-pass mandate. | Historical ADR wording need not be erased if marked superseded; final M0 owner decisions still outstanding. |

The changes in this first pass are **small and behavior-preserving by construction**, targeted at avoiding unnecessary allocations and duplicate checks. A passing Core PR does not prove benchmark speed improvement; no unmeasured performance claims are made. No names, 16-club synthetic pack, M0 saved-career serialization, rules, public interfaces or M1 features change.

## Not currently signable by CI

- Native actual Safari Private Browsing and normal-profile full application restart/download/recovery.
- Real browser-enforced IndexedDB quota rejection, automatic eviction and host-profile recoverability. An injected `QuotaExceededError` and a CDP quota override that allowed a 24-MiB write do **not** satisfy this evidence.
- Release trademark/branding/media/roster rights, independent 2026/27 registered person datasets and full operative RPL rules. Under [ADR-0006](adr/0006-m0-m2-acceptance-boundary.md), the **future playable M2 pack and full executable rules** are M2 deliverables, not an M0 exit precondition. The current M0 synthetic source/asset review is within scope.
- Owner approval of the M0 architectural baseline, versioned PRNG/event/rules contract and pre-M1 calibration *procedure*. Real reference distributions and numerical tolerances can only be frozen before M1 tuning after lawful sources are available; don't invent them now.
- Final owner decision to accept documented **limited M0 storage test coverage** rather than further native/manual experiments. A technical audit cannot grant this on the owner's behalf.

## Second entire-repository pass after first-pass merge

**Completed 2026-10-14 at exact `main=d610cf4c40f4a00fcf7f0c1f0fd4e8635287d97a`.** The first-pass change [PR #153](https://github.com/StanleyLl0yd/FootClubSim/pull/153) was squash-merged only after green Node/Python CI and native Safari, Chrome, Edge and Chromium smoke. The **second pass is independent of the first and uses the already-refactored tree**, not only the first-pass diff.

All **148** tracked files in the new GitHub recursive tree were individually fetched and re-examined in contiguous ordered ranges `0..13, 14..27, 28..41, 42..55, 56..69, 70..83, 84..97, 98..111, 112..125, 126..139, 140..147`. This includes the newly added first-pass report and the changed match-outcome regression test. Reviewed the same complete domains: all M0 core modules/React/CSS/branding/IndexedDB; synthetic/data/research JSON and license flags; test coverage; seven CI workflows, pinned actions and runner privileges; full npm lockfile/dependencies and TS/ESLint/Vite config; Git secret/asset and shipping artifact checks; Safari/Windows/Linux browser harnesses; the full roadmap, AGENTS.md, ADRs, rights, M0/M1/M2 acceptance split and historical notes.

**Second-pass findings:** the newly hoisted key list is used by catalog validation without mutable exposure or API change. The shot event branch has one stable outcome set and reuses one bounded predicate; no previously validated outcome, error code, full-time ordering or immutable version changes. Negative regression explicitly covers `goal/saved/off-target/blocked` plus invalid outcome. Cross-layer import/save/worker validation has intentional distinct trust boundaries; combining these would increase coupling and risk accidental API/persistence changes. No unused production or development dependency could be proven from the full repo and lockfile; no safe obsolete code or abandoned compatibility path was established. Historical ADR proposals retain clear **supersession** markers; removing the original text would destroy decision traceability. The last-pass review found **no further safe, justified changes** to current runtime paths.

## Verified before/after comparisons (same CI/git-index counting method)

| Comparable metric | Before pass 1 (exact `08688106`) | After pass 1 / pass 2 base (exact `d610cf4c`) |
| --- | ---: | ---: |
| Git-tracked files | 147 | 148 |
| Git-tracked bytes | 976,966 | 985,100 |
| Source files | 69 | 69 |
| Source lines | 6,540 | 6,560 |
| Test files | 36 | 36 |
| Markdown files | 47 | 48 |
| Git-tracked asset files, by known asset suffix | 0 | 0 |
| Node tests passed / failed | 139 / 0 | **140 / 0** |
| Python tests passed / failed | 27 / 0 | **27 / 0** |
| Generated M0 HTML/JS/CSS bundle bytes | 245,716 | 245,736 |
| npm vulnerabilities reported | 0 | 0 |

Metrics from [before Core](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38626130427), [before Docs](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38626130440), [after Core 38628297019](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38628297019), [after Docs 38628296757](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38628296757), [after dependency security 38628296758](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38628296758) and [after native four-browser run 38628296789](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38628296789). Each named run completed successfully at the stated commit. **Total repository bytes and source lines increased only because the audit report and a focused regression test were added; this is not evidence of a performance regression or overall code shrinkage.** The two runtime changes remove unnecessary array allocations and duplicated predicates, but runtime speed was not benchmarked. The output bundle grew by 20 bytes; this is just a build artifact comparison, not a measured speed change.

## Source, rights and release scope review

The actually shipped M0 browser bundle is only three generated HTML/JS/CSS files; no source Wikipedia roster, Wikidata person data, historical PDF, images or arbitrary binaries were included according to the executed artifact checker. Synthetic manifest has `assetPaths: []` and `containsThirdPartyFootballData=false`, verified by contract tests and source inventory; no legal clearance is inferred from declarations or scans. The 16 approved parody identities are code-authored circular colored text badges; `Изумруд` has a documented external football use risk that still requires release clearance. Wikipedia is primary for future personnel research, Wikidata strictly secondary, official RFU/RPL/IFAB primary for genuine effective sport rules. Real register/rights checks and playable content remain M2 separate, never implicitly approved by this audit.

## Still awaiting owner decisions (not CI failures)

1. Accept the M0 scope/architecture, synthetic source/edition/PRNG and initial-career contracts as an **M0-only foundation**; treat `xorshift32-v1`, event ledger v1, synthetic rules-pack v1 and the M1 10,000-seed/uncertainty **method** as the current proposed M0 versioned contract. No statistical realism, externally calibrated target thresholds or implemented M1 engine is claimed. Exact lawful realism baselines and tolerance bands must be chosen and frozen **before** M1 tuning.
2. Agree to close technical M0 with **limited real-browser evidence**, while recording real Safari Private Browsing, Safari regular-profile full-app shutdown, OS-file download/recovery and true browser-enforced quota/automatic eviction as **NOT TESTED / deferred** to pre-release browser/career acceptance in M2/M5. Normal Safari/Chrome/Edge and Windows process-restart/backups have already passed. This is a deliberate change to earlier M0 exit acceptance and **requires explicit owner permission**, not a false PASS. Preserve the manual test plan and errors as a known limitation.
3. Accept that M0 needs only the original synthetic artifact **source/rights risk inventory**, with the documented «Изумруд» name collision and other 15 names **not legally cleared**. Formal territory/class trademark/likeness/badge and future 16-team personnel publishing checks are M2/M6 release gates, not proof of rights or a pass. All 16 approved names are retained. No real-person data bundled in the M0 shipping app.

**Audit protocol gates 1 and 2 are technically completed, but M0 EXIT REMAINS OPEN** pending these explicit owner decisions and final exact-main report/CI after this editorial report update. The [issue #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) must remain open until the user signs off; do not start M1 without separate permission.
