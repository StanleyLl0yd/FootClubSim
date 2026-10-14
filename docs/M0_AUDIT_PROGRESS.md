# M0 audit evidence and open exit blockers

**Status: IN PROGRESS (2026-10-13).** This document records code review and verified fixes already completed. It is **not** the required final two-pass whole-repository audit report and does not approve or close M0. The milestone exit remains [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2).

## Baseline, scope and rules

Current implementation is a Russian-language React/Vite technical shell, pure TypeScript football data contracts, synthetic 16-club catalog, deterministic schedule, M0 shot/full-time event ledger, and preliminary JSON/IndexedDB initial-career persistence. There is no match generator, season simulation, production rules pack or playable release.

Reviewed areas during incremental M0 inspection:
- Domain: `src/core/{model,identifiers,validation,import,rng,synthetic,fixtures,fixture-validation,tactics,match-contracts,save}.ts`.
- Browser/UI: `src/browser/initial-career-store.ts`, `src/app/{App,main}.tsx`, `src/app/styles.css`, browser smoke HTML.
- Tests: Node domain/import/calendar/save/storage/manifest/tactics tests; native browser smoke scripts.
- Tooling: npm manifests/lockfile, TypeScript and ESLint config, source-format and Markdown verification, Vite entrypoint.
- CI: core, documentation, browser smoke (Safari/Edge/Chromium), and npm vulnerability audit workflows.
- Documentation: architecture, ADR, roadmap, acceptance, rights/data sources, regulation notes, M1 specification and backlog.
- Rights: project-authored synthetic-pack manifest; reviewed references to official RPL rules without bundling third-party PDF or real rosters.

A full frozen file inventory, final-source scanning evidence, full second review of **every** file and formal owner approval are still outstanding. Do not infer their completion from this scope list.

## Verified fixes from incremental audit

| Finding | Change | Regression protection |
| --- | --- | --- |
| Inconsistent acceptance of opaque IDs in catalog, lineup, fixture and persistence boundaries | [#46](https://github.com/StanleyLl0yd/FootClubSim/pull/46): consolidated `isStableId` | Cross-module invalid-ID tests; CI successful |
| Documentation checker descended into ignored dependency trees, and followed symlinked Markdown files | [#47](https://github.com/StanleyLl0yd/FootClubSim/pull/47): prune directories and reject symlink file reads | Python tests; CI successful |
| Malformed match/worker input could throw before typed validation or during event iteration | [#49](https://github.com/StanleyLl0yd/FootClubSim/pull/49): input-shape guard and bounded event handling | Null/malformed input tests; CI successful |
| Sparse catalog array passed `Array.every`; unbounded registration count in match shape validation | [#50](https://github.com/StanleyLl0yd/FootClubSim/pull/50): bounded `for..of` checks and 128-registration ceiling | Sparse/malformed catalog and oversized roster tests; CI successful |
| Fixture generator/validator skipped missing club IDs in sparse arrays | [#51](https://github.com/StanleyLl0yd/FootClubSim/pull/51): dense ID validation and explicit array requirement | Sparse and non-array input tests; CI successful |

Earlier reliability/privacy-relevant changes also include [#33](https://github.com/StanleyLl0yd/FootClubSim/pull/33) add-only IndexedDB persistence, [#38](https://github.com/StanleyLl0yd/FootClubSim/pull/38) Safari reload/recovery, [#39](https://github.com/StanleyLl0yd/FootClubSim/pull/39) Windows Edge save/restore, [#40](https://github.com/StanleyLl0yd/FootClubSim/pull/40) unavailable storage paths, [#41](https://github.com/StanleyLl0yd/FootClubSim/pull/41) seed-specific pack identity, [#42](https://github.com/StanleyLl0yd/FootClubSim/pull/42) lint/format checks and [#43](https://github.com/StanleyLl0yd/FootClubSim/pull/43) source declaration.

Additional follow-up findings:
- [#53](https://github.com/StanleyLl0yd/FootClubSim/pull/53): formatting CI previously omitted root build/config files and the synthetic provenance manifest. Its unified checker now covers both, without duplicating validation code.
- [#55](https://github.com/StanleyLl0yd/FootClubSim/pull/55): `tsc` emitted `dist/core` but Vite's default build cleaned `dist`, deleting headless modules. Browser assets now go to `web-dist` and Core CI checks that both output paths survive one complete build. Safari/Edge/Chromium smoke jobs passed against the new Vite output.
- [#56](https://github.com/StanleyLl0yd/FootClubSim/pull/56): M0 checklist and browser-smoke documentation now cite only verified initial-career/import/fixture browser evidence, and distinguish automated tests from still-untested private/quota/Chrome cases.

### Removal, consolidation, simplification and dependencies

- **Consolidated:** scattered ID checks into the canonical validator (#46); repeated shape validation now uses explicit bounds and safe iteration (#49-#51).
- **Simplified:** documentation traversal prunes irrelevant directories before exploring them (#47). No new runtime dependencies were required for #46-#51.
- **Removed:** redundant local ID validators (#46), unsafe reliance on sparse-ignoring iteration (#50-#51), inefficient directory traversal (#47). No unrelated source files were deleted.
- **Dependencies:** existing React, React DOM, Vite, TypeScript, ESLint and TypeScript-ESLint are used by the currently implemented UI/build/test path. No unproved removal was attempted.
- **Legacy:** no released gameplay format exists; the M0 initial-career schema is kept because the existing browser QA and saves use it. Do not silently drop it as hypothetical legacy.
- **Intentionally unchanged:** the pure headless match ledger and current JSON/IndexedDB interfaces; changes to their public shape or saved data require explicit migration tests. The inherited AGENTS.md audit rules are preserved by owner request.

## CI evidence and comparable statistics

All three PR checks (Core contracts, Documentation verification, Browser smoke) completed **SUCCESS** on the final heads of [#49](https://github.com/StanleyLl0yd/FootClubSim/pull/49), [#50](https://github.com/StanleyLl0yd/FootClubSim/pull/50) and [#51](https://github.com/StanleyLl0yd/FootClubSim/pull/51).

Measured using the **same** `npm run check` GitHub Actions Core contracts log output, Linux runner and same Vite 8.3.4 build reporting method:

| CI measurement | PR #49 head (`d6aa17b`) | PR #51 head (`3b64b5a`) |
| --- | ---: | ---: |
| Node unit tests | 47 | 50 |
| Passed | 47 | 50 |
| Failed | 0 | 0 |
| Built JS (uncompressed, Vite display) | 237.39 kB | 237.47 kB |
| Built JS (gzip, Vite display) | 74.72 kB | 74.74 kB |
| Built CSS (uncompressed) | 2.89 kB | 2.89 kB |

Evidence: [Core CI for #49](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38462033108) and [Core CI for #51](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38463873462). The values are from the runs' recorded console output, **not** estimated from source. No reliable before/after entire-source-line totals or complete file counts have yet been measured, so none are claimed. Runtime benchmarking would need a separate controlled method.

Production builds, typechecks, lint, source-format hygiene and Node tests are all included in Core CI. After [#55](https://github.com/StanleyLl0yd/FootClubSim/pull/55), [Core CI 38465738893](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38465738893) passed 50/50 Node tests and verified that `dist/core/save.js` and `web-dist/index.html` coexist. Vite reported web JS 237.47 kB (gzip 74.74 kB) and CSS 2.89 kB. [Browser smoke 38465738918](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38465738918) passed native Safari, Windows Edge and Linux Chromium against that build. Browser smoke is independent and uses actual Safari/macOS and Edge/Windows, plus Chromium/Linux. The dependency-vulnerability workflow has passed on previously reviewed dependency changes, but a final-main full security and rights verification remains necessary.

## Automated Git inventory and safety heuristics (added for M0 review)

`scripts/repo_audit.py` uses the **actual Git index**, not the working
directory, to report reproducible file counts, tracked bytes, source file/line
counts, test files and documentation files. It flags tracked generated files,
symlinks, environment files, known token/private-key signatures (without
printing suspected secret values), undeclared artwork/data assets and
GitHub Actions not pinned to 40-character commit SHAs. The script runs in
Documentation verification CI, with standalone Python negative tests.
The manifest allowlist is the existing project-authored synthetic pack
asset list.

A passing scan **does not** establish absence of all secrets, legal
authorization for data, copyright status, staff privacy clearance or image
rights. These still require manual review. Measured counts must be recorded
only after the successful CI job prints `TRACKED_REPO_METRICS`. The first
and second required *whole-repo human/code* reviews remain OPEN.

## Further M0 work verified on 2026-10-14

- [#60](https://github.com/StanleyLl0yd/FootClubSim/pull/60) implemented pure command-envelope, current-revision and per-responsibility staff-authorization validation without any game-state mutation.
- [#61](https://github.com/StanleyLl0yd/FootClubSim/pull/61) defined bounded worker wire envelopes, cancellation acknowledgement and stale/foreign/invalid report guards. These are **not** an active Web Worker or M1 match generator.
- [#62](https://github.com/StanleyLl0yd/FootClubSim/pull/62) introduced independent Git-tracked inventory metrics, known-secret/asset/action-pin heuristics with negative Python tests. One failing YAML-list recognition regression was caught by CI and corrected **before merging**.
- [#63](https://github.com/StanleyLl0yd/FootClubSim/pull/63) registered the relevant primary 2026/27 RPL, July 2026 disciplinary/status/transfer and IFAB source editions and documented rule-group precedence, tests, rights and open verification in [M0_RPL_RULES_MATRIX.md](M0_RPL_RULES_MATRIX.md). No executable RPL rules or license permission were inferred.

### Reproducible inventory measurements

The **same** `python3 scripts/repo_audit.py` script ran in Documentation verification CI
after checking out the complete PR merge ref on an Ubuntu Linux runner. Both runs
reported `PASS`, no Git-tracked binary/artwork assets and no findings from the
defined known-signature secret or GitHub Actions SHA-pin heuristics:

| Measurement | [PR #62 docs CI](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38471362509) | [PR #63 docs CI](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38471857385) |
| --- | ---: | ---: |
| Tracked files | 73 | 74 |
| Tracked bytes | 420859 | 431891 |
| Source files (`.ts/.tsx/.mjs/.py/.css`) | 39 | 39 |
| Source lines (Python `bytes.splitlines()`) | 3242 | 3242 |
| Test files (`tests/` and `scripts/tests/`) | 15 | 15 |
| Markdown files | 22 | 23 |
| Asset/data files by flagged extension | 0 | 0 |

The difference is a single documentation addition and edits. These measurements
are *not* a claimed entire-project shrinking/refactoring result, and the totals
will change with further M0 edits. The metrics are reproducible only for the
cited commits/PR checkout contexts. Core CI after #62 recorded **63/63 passing
Node tests**; actual browser smoke was previously green on worker-command PR
heads #60 and #61. Final-main full security/rights scanning and both complete
whole-repository review passes are still REQUIRED.

## Further code review and browser CI evidence (2026-10-14)

- [#65](https://github.com/StanleyLl0yd/FootClubSim/pull/65) caught synchronous IndexedDB object-store/add/get exceptions that escaped as raw errors. The adapter now returns typed `STORAGE_FAILED`, closes the database and preserves the active career. Its [Core CI run](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38472552450) passed **64/64 Node tests**; [browser CI](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38472552350) passed.
- [#66](https://github.com/StanleyLl0yd/FootClubSim/pull/66) broadened dependency-security workflow to every main push. The change's own dependency audit, core and docs checks passed, but a **final-main** audit after all remaining changes is still required.
- [#67](https://github.com/StanleyLl0yd/FootClubSim/pull/67) added independent Windows Chrome to the existing Edge job via a shared Windows matrix. [Browser run #38473107523](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38473107523) contains four separate completed SUCCESS jobs: actual macOS Safari, Windows Chrome, Windows Edge and Linux Chromium.
- [#68](https://github.com/StanleyLl0yd/FootClubSim/pull/68) stopped Markdown validation from traversing generated `web-dist` after the earlier Vite-output isolation. Its [Core run #38473203752](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38473203752) passed **64/64 Node tests**, 0 failures, with web JS 237.57 kB (gzip 74.74 kB) and CSS 2.89 kB. This source-change run is not a performance benchmark.

These are incremental reviewed changes, **not** a claim that the full required
first and second source-by-source audit passes or the complete M0 acceptance
criteria have been satisfied. Actual Safari/Chrome/Edge storage **quota,
eviction and private browsing** scenarios remain untested.

## October 14 repository review snapshot (still not milestone exit)

Audit input: Git `main` after [#72](https://github.com/StanleyLl0yd/FootClubSim/pull/72), plus the documentation/QA-only [#73](https://github.com/StanleyLl0yd/FootClubSim/pull/73). Tracked-file inventory and safety checks were executed in [Documentation verification run 38512503830](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38512503830) for the #73 head, not extrapolated from the working directory. The repository uses `python3 scripts/repo_audit.py` to reproduce the measurement.

| Measured quantity | #73 PR head | Counting method |
| --- | ---: | --- |
| Tracked files | 76 | Git index (`git ls-files -z`) |
| Tracked file bytes | 452,894 | Sum of Git-indexed working tree file sizes |
| Source files | 41 | `.ts`, `.tsx`, `.mjs`, `.py`, `.css` |
| Source lines | 3,492 | `bytes.splitlines()` for those same source file extensions |
| Test files | 16 | `tests/` or `scripts/tests/` prefixes |
| Markdown documentation files | 23 | `.md` extensions |
| Binary/artwork/data file paths | 0 | The audit script's reviewed asset suffixes |

The [Core run 38512503839](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38512503839) passed **68/68 Node tests**, with TypeScript checks, ESLint, source-format gate and Vite production build. The same run reported browser JS **237.73 kB**, gzip **74.77 kB** and CSS **2.89 kB**. These are CI display measurements, not a reproducible runtime performance benchmark. [#72 browser run 38512235297](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38512235297) passed actual Safari, Windows Chrome/Edge and Linux Chromium. #73 changes the *standalone* manual QA HTML; automated production-app browser smoke does **not** establish that new standalone HTML exercised the cross-pack test.

### Preliminary source-by-source review categories

The reviewed inventory encompasses domain logic (`src/core/**`), React shell and stylesheet (`src/app/**`), IndexedDB adapter, standalone QA HTML, JS/Python test and tooling scripts, npm lockfile and configs, `.github/workflows/**`, repository governance files and Markdown design/regulation/rights documents. File listing is reproducible via `git ls-files`; this paragraph is not a proof that every behavioral edge case has been tested.

**Implemented reliability corrections:** [#71](https://github.com/StanleyLl0yd/FootClubSim/pull/71) aligned direct catalog validation with the JSON importer's boolean-foreigner and 256-character name requirements; malformed domain objects can no longer bypass this check. [#72](https://github.com/StanleyLl0yd/FootClubSim/pull/72) required cancellation acknowledgements to refer to the original worker job revision. [#73](https://github.com/StanleyLl0yd/FootClubSim/pull/73) rejected imported/restored careers from incompatible synthetic packs in the standalone manual QA page without replacing an active career and corrected obsolete Chrome/storage documentation.

**Additional reviewed areas preserved intentionally:** synthetic PRNG and schedule generator, initial save envelope and checksums (integrity detection, not authentication), add-only IndexedDB, React single-career M0 UI, test scripts, dependencies in the pinned lockfile, official-rule *source notes*, rights restrictions and reserved-code license. No actual match engine, worker executor, licensing permission or employee AI is claimed. The first playable career, historical-save migrations, actual multi-season IndexedDB revisions, per-area delegation UI and authentic sanctioned RPL rules all remain later milestones.

**Limitations that still block final exit:** architecture/owner acceptance beyond D01-D02, the core D13 origin/biography principle and new D06/D12 «Лига приколов» direction; full official regulation and amendment review; original name/branding rights review without shipping copied RPL rosters or imagery; private-mode/quota/eviction browser checks; definitive remaining source-by-source simplification and mandatory full second pass **after** all M0 functional/decision changes; final-main complete security/CI pass. This work is an evidence-backed **interim review**, not a completed first or second mandatory exit pass.

## Continued M0 validation and audit fixes (14 October, PR #78-#84)

This section is **incremental review evidence, not a completed two-pass exit
audit**. Measurements below are tied to an actual PR head, not extrapolated
from an earlier revision or represented as the final reviewed `main`.

| PR | Verified change | Remaining qualification |
| --- | --- | --- |
| [#78](https://github.com/StanleyLl0yd/FootClubSim/pull/78) | CDP launch retries only failed Chrome/Edge startup once in a fresh isolated profile, without retrying app assertions | Real runner flakiness can still recur; attempts remain bounded |
| [#79](https://github.com/StanleyLl0yd/FootClubSim/pull/79) | QuotaExceededError is distinct from duplicate/generic IndexedDB errors; mocked transaction abort/rollback and native-browser **injected** quota UI path preserve active career | Does **not** exercise real disk quota or browser eviction |
| [#80](https://github.com/StanleyLl0yd/FootClubSim/pull/80) | Four golden xorshift32-v1 integer sequences, snapshot continuation and float consumption/range tests | No owner sign-off on adopting M0 RNG for M1 probabilistic model |
| [#81](https://github.com/StanleyLl0yd/FootClubSim/pull/81) | Native Windows Chrome Incognito and Edge InPrivate browser sessions store/restore the initial career during the same session | No evidence private data survives window closure; Safari Private Browsing unverified |
| [#82](https://github.com/StanleyLl0yd/FootClubSim/pull/82) | CDP `Target.getTargetInfo` confirms separate browserContextId in **both** native Windows private sessions, excluding a false pass caused by silently ignored launch flags | First SafariRunner new-session handshake timed out; rerun succeeded without source change |
| [#83](https://github.com/StanleyLl0yd/FootClubSim/pull/83) | SafariDriver new-session HTTP timeout raised to 45 s, while normal WebDriver commands remain at 15 s | Not a guarantee of SafariDriver session startup under all runner conditions |
| [#84](https://github.com/StanleyLl0yd/FootClubSim/pull/84) | M0 worker report cannot claim more than 4095 shots combined when the event ledger allows 4096 events including terminal full-time; negative and boundary tests added | Wire validation is not an authoritative atomic career-state commit |

**Exact CI evidence for [#84 core](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38517256708):** 76 Node tests passed, 0 failed, with compiled TypeScript core, source-format checks, ESLint and production Vite build. Built browser JavaScript: **238.13 kB**, gzip **74.92 kB**; CSS **2.89 kB**.

**Exact inventory from [#84 documentation CI](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38517256722):** 78 tracked files, 500,713 tracked bytes, 42 source files and 3,771 source lines under the automated counting method; 17 test files, 24 Markdown files, 0 declared/bundled binary/artwork assets. This is the PR head and may differ from `main` after subsequent merges. The tracked-file heuristic did not identify known token patterns, unpinned external GitHub Actions or undeclared binary assets; it does **not** constitute an independent intellectual-property clearance or exhaustive vulnerability scan.

**Actual browser evidence:** [#84 browser workflow](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38517256629) passed the current normal React prototype browser checks on macOS Safari, Windows Chrome, Windows Edge and Linux Chromium, as well as the Windows private-session paths. Under [#82 browser workflow](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38516820503), the first native Safari job timed out creating the SafariDriver session, but the retry was successful. Both Chrome and Edge independently logged confirmation of isolated CDP contexts.

**Still NOT M0 exit:** D03-D05/D07-D11 and D13 balance details lack approval, D06/D12 league principle is accepted but exact aliases/rule verification/original branding review are pending, RPL disciplinary and transfer source cross-review is incomplete, actual Safari private/quota/eviction tests remain, and the required **first and second COMPLETE whole-repository audit passes after final M0 acceptance** are not signed off. M1 must not start without explicit owner permission, even after M0 eventually closes.

## Gaps and blockers

1. **Owner decisions:** the [M0 product decision register](M0_PRODUCT_DECISIONS.md) records accepted D01/D02 (default human control with per-area delegation) and D13 (three origin profiles with a skill-aware biography, [ADR-0003](adr/0003-manager-origins-biographies.md), [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76)). Other D03-D05 and D07-D11 decisions, exact D06 club aliases, full effective RPL sporting regulations, original name/branding review, and the D13 skill budget, numeric attributes and biography generation UX remain **unapproved or unverified** until the owner explicitly accepts/revises them. No playable wizard exists in M0.
2. **Rights:** no documented license/permission for redistributing actual RPL rosters, player images or club marks. The synthetic authored pack only supports M0 tests.
3. **Regulations:** primary-source clauses have been documented incrementally, but amendments, related disciplinary requirements, rule-pack behavior and full validation remain open.
4. **Worker and game command orchestration:** no reviewed game-command transaction, queued simulation worker or multi-revision state machine exists. Existing initial-career snapshots remain revision 0.
5. **Persistence:** no evolving multi-season save migrations, quota/eviction recovery guarantees or revised career compare-and-swap semantics.
6. **Engine calibration:** [M1 protocol](M1_CALIBRATION_PROTOCOL.md) is proposed only. No statistically validated simulation and no permitted real benchmark data yet.
7. **Security and release:** complete file inventory, secret/asset-license checks, all-browser error-path matrix, dependency report on final `main` and the mandatory complete second whole-repository pass remain open.

## Remaining review and milestone process

- Finish a complete first-pass file inventory and review of every source/test/config/workflow/document plus justified fixes and reliable baseline statistics.
- Repeat that whole inventory **after** fixes for the mandatory second pass, looking for residual duplication, dead code, inconsistent validators, unnecessary dependencies and newly introduced regressions.
- Run the full final-main CI/rights/security/browser suite and attach concrete evidence, including any unavailable checks.
- Reconcile unresolved requirements/rights/architecture approvals. Only after the above may [M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) close and M1 implementation begin.

**Do not treat this progress report as completion evidence for either whole-repository audit pass.**

## Owner-approved milestone boundary (2026-10-14)

[ADR-0006](adr/0006-m0-m2-acceptance-boundary.md) explicitly moves the **full** date-verified 16-club personnel catalog and exhaustive executable real-rule pack to M2. The M0 exit still requires the research/provenance and official source/edition contracts, M0 original-content rights review, pending owner interface decisions, applicable M0 browser acceptance and both complete whole-repository audit passes. 0/16 complete as-of registrations and 0 licensed playable person rows remain true, but **are not by themselves M0 exit blockers**. Historical references above to #91 completion as an M0 blocker are superseded only in that narrow sense. No pass of the final two full audits is claimed by this decision.

## Measured original-content inventory and invalid-manifest parser review (2026-10-14)

[PR #114](https://github.com/StanleyLl0yd/FootClubSim/pull/114) addresses the JSON-root type guard in `scripts/repo_audit.py` and adds negative tests for arrays/scalars. The [original-content review](M0_ORIGINAL_CONTENT_REVIEW.md) preserves baseline `main` [Documentation CI 38556362413](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38556362413): **136** files, **800,903** tracked bytes, **67** source files, **5,884** source lines, **35** test files, **38** Markdown files, and **zero configured binary/artwork/database asset-file suffix hits**. This is inventory evidence, not legal clearance or either mandatory final repository-wide audit pass. The owner-approved M0/M2 boundary remains [ADR-0006](adr/0006-m0-m2-acceptance-boundary.md).

## Browser exceptional-case acceptance protocol documented (2026-10-14)

[The native-browser storage matrix](M0_STORAGE_EDGE_ACCEPTANCE.md) distinguishes verified normal Safari/Windows Chrome/Edge workflows, private Windows smoke, injected quota errors and **still unexecuted** Safari Private Browsing, real browser quota/eviction and full-shutdown JSON recovery. It provides specific manual evidence steps without claiming browser coverage not performed. The owner has **not** separately accepted any narrower M0 browser exit gate.

## Pending owner product sign-off consolidated (2026-10-14)

The [M0 decision package](M0_PRODUCT_SIGNOFF_PACKAGE.md) groups outstanding **D03-D05 and D07-D11** into one reviewable set with exact proposed interface scope, future implementation stage and PENDING state. Previously approved product choices remain intact. Exact D13 manager point totals and full calibration baselines remain later-stage design, **not** accepted by implication. No production match/financial behavior was added.

## Additional M0 audit fixes and evidence, 2026-10-14 (PR #121-#127)

- [#121](https://github.com/StanleyLl0yd/FootClubSim/pull/121): README now spells out **FootClubSim = Football Club Simulator** at the top; Core and Docs PR CI passed.
- [#122](https://github.com/StanleyLl0yd/FootClubSim/pull/122): reject impossible P580/P582 calendar days and reversed source membership periods as candidate evidence; regression tests and Wikidata diagnostic CI passed. These remain research-only records, **not** 2026/27 registrations.
- [#123](https://github.com/StanleyLl0yd/FootClubSim/pull/123): track credential-looking filenames and binary key stores even without recognisable plaintext signatures, with negative Python tests. Heuristics are not an exhaustive secret audit.
- [#124](https://github.com/StanleyLl0yd/FootClubSim/pull/124): fixed-M0-UI restore slot rejects otherwise valid but **unrestorable foreign career IDs**; core import and save schema remain unchanged. Actual Safari/Chrome/Edge browser regression CI passed.
- [#126](https://github.com/StanleyLl0yd/FootClubSim/pull/126): lockfile metadata review recorded in [M0 original-content review](M0_ORIGINAL_CONTENT_REVIEW.md): 192 locked non-root NPM packages, all with stated license metadata. Shipped-bundle notices and legal clearance remain open.
- [#127](https://github.com/StanleyLl0yd/FootClubSim/pull/127): verified **real Windows Chrome and Edge browser-process shutdown/restart** with the same disposable user profile and successful initial-career Restore, in [four-browser CI 38566035144](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38566035144) (all four browser jobs PASS). This does **not** establish Safari process-restart persistence, organic eviction or actual downloaded JSON recovery.
- [#125](https://github.com/StanleyLl0yd/FootClubSim/pull/125) was deliberately **CLOSED UNMERGED** after browser evidence contradicted its quota-test assumption: CDP reported an active 512-KiB override but accepted a 24-MiB IndexedDB write in both Windows browsers. [Negative CI 38565076622](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38565076622). Do not mark browser quota acceptance PASS.

**Current scope:** cumulative incremental M0 verification, NOT the mandatory first-and-second completed whole-repository audits. Remaining approvals D03-D05/D07-D11, original-brand/source rights risk sign-off, source-edition acceptance, genuinely constrained storage, Safari Private Browsing and full Safari process-restart, final two-pass audit and final-main verification remain OPEN. M1 must not start without later owner authorization.

## Native Windows backup download verification (2026-10-14)

[PR #129](https://github.com/StanleyLl0yd/FootClubSim/pull/129) passed the full [four-platform browser workflow 38567283004](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38567283004). The Windows Chrome and Edge jobs **actually downloaded** the M0 JSON to their temporary browser profile, compared its raw bytes to the persisted SHA-256 envelope, used that genuine file to recover after explicit IndexedDB clearing, and still passed the full browser-process restart with the same profile. This is additional M0 prototype evidence, **not** native Safari download, automatic eviction, enforced storage quota, multi-career save migration or full two-pass exit-audit completion.

## Owner sign-off of all eight outstanding interfaces (2026-10-14)

The owner **explicitly accepted D03-D05 and D07-D11**, including **interactive in-match commands/individual tactics** and **RUB/USD/EUR automatic current-real-day Google-referenced conversion**, documented in [ADR-0007](adr/0007-match-tactics-multicurrency.md). This eliminates their standalone M0 product-decision blocker. This approval does **not** resolve Google Finance's published copying/storage/redistribution restrictions, establish a supported API or authorize unlicensed automated scraping; the M3 FX-source integration must meet applicable rights. It also does not implement match features, resolve RPL source verification, waive browser quotas/Private Safari checks, finalize D13 point-balance design, perform either full whole-repository audit pass, or authorize M1.

## Subsequent owner refinement: browser connectivity and Google conversion rounding (2026-10-14)

[ADR-0008](adr/0008-online-daily-fx-rounding.md) replaces the earlier assumption that full gameplay must work offline: FootClubSim may rely on a browser internet connection. Owner-approved D07 now requires **one immutable Google quotation snapshot for RUB/USD/EUR at first entry per real calendar date**, with no same-day refetch and no retrospective mutation; round the final converted output **USD/EUR -> RUB to nearest 10,000 ₽** and **RUB -> USD/EUR to nearest 1,000 target units**. Original contract and saved accounting values remain exact. Google Finance source data rights/programmatic acquisition remain **unresolved M3 #131**; no Google rate content or new finance code was added to M0. Existing M0 browser IndexedDB/private/quota acceptance checks and both mandatory full repository passes remain OPEN.

## Later owner's RUB-only accounting and six-pair conversion rule (2026-10-14)

[ADR-0009](adr/0009-rub-only-ledger-and-cbr-source-option.md) fixes the M3 accounting principle: **all club general-ledger postings and budgets only in RUB rounded to nearest 10,000 ₽**, regardless of quoted RUB/USD/EUR source contract. Final currency conversion rounded to **nearest 10,000 ₽ for RUB targets** and **nearest 1,000 $/€ for USD/EUR targets, including EUR ↔ USD**. Original foreign amounts and exact quote snapshot remain immutable document metadata. The Bank of Russia's official XML and source-attribution terms were reviewed; the owner has since **explicitly approved CBR to replace Google Finance**, recorded in ADR-0009. Direct browser CORS and final reuse conditions are still unresolved. The M0 catalog and career saves are unchanged, M3 #131 continues to own actual FX implementation, and no whole-repository pass or unresolved browser gate is claimed complete by this documentation update.


## Approved exclusive CBR exchange-rate source (2026-10-14)

The owner explicitly chose **Банк России** instead of Google Finance as the M3 daily FX quotation source. [ADR-0009](adr/0009-rub-only-ledger-and-cbr-source-option.md) documents use of the [official CBR XML daily rates](https://www.cbr.ru/development/sxml/) once per real calendar login date, with a fixed snapshot, source effective date, visible attribution and consistent USD/RUB/EUR/RUB-derived cross-rate. No Google fallback. The owner's source choice is now approved, while CBR legal applicability, native Safari/Chrome/Edge CORS access and adapter deployment remain future M3 validation tasks. No M0/game/save code changed, and this does not complete a repository-wide audit pass.
