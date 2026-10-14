# M0 exit audit: two full repository passes

**Status: FIRST PASS FIXES UNDER REVIEW; SECOND PASS NOT YET PERFORMED.** Started 2026-10-14. This report records the audit work and evidence, not the owner's final M0 sign-off. Follow [AGENTS.md](../AGENTS.md) and [issue #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2). M1 is blocked.

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

## Second pass and final acceptance

After **merging and verifying** the first-pass corrections, re-examine the **entire updated Git-tracked tree** file by file, including the newly introduced files, specifically for residual duplicate checks, obsolete compatibility paths, unused imports/dependencies, security/rights risks and documentation contradictions. Apply any proven safe fixes separately, then run full exact-main Core/Docs/Security and force the independent four-browser workflow even if changes are documentation-only. Record exact after metrics, report delta and pending owner conditions. **Do not close issue #2 or start M1 merely because both technical passes and CI are green.**
