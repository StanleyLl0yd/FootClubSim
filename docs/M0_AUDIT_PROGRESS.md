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

## Gaps and blockers

1. **Owner decisions:** the concrete [M0 product proposal](M0_PRODUCT_DECISIONS.md) from [#54](https://github.com/StanleyLl0yd/FootClubSim/pull/54) documents manager/coach/director responsibilities, tactics, economy and season scope, but each decision remains **unapproved** until the owner explicitly accepts/revises it.
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
