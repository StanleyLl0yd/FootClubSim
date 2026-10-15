# Full repository audit and safe refactoring, 2026-10-15

**Status:** both source-review passes and local verification complete. The owner explicitly authorized branch publication, a PR and merge after successful checks on 2026-10-15. Remote verification and final-main evidence are tracked in #157.

Owner-requested maintenance after M0 closure, tracked in [#157](https://github.com/StanleyLl0yd/FootClubSim/issues/157). This is a new whole-repository review, not a reuse of the earlier milestone audit. **M1 remains unauthorized.** No playable release, source-data rights clearance or exceptional-browser acceptance is asserted.

## Scope and architecture

Baseline: `f71b7873448b3043a0ab8de463259d3f854e7729`, all **149 tracked files**, including configuration and governance files. The complete inventory was examined by subsystem, with automated checks of the full tracked tree, all research snapshots and generated production output. No directory was excluded in favor of a diff-only review.

| Area | Reviewed responsibilities and contracts |
| --- | --- |
| All `src/core/` modules | Typed catalog/lineup/tactics validation versus untrusted JSON, bounded match ledgers, fixture completeness, identifiers, seeded RNG and vectors, provenance declarations, revision-0 save integrity, command authority and worker correlation/cancellation |
| Browser, application and branding | Add-only IndexedDB transactions and failure handling, asynchronous ownership, fixed restore slots, import/export, rendering, keyboard/focus/labels, CSS, entrypoints and the 16 approved geometric badges |
| All Node and Python tests | Positive and negative assertions, independently fixed RNG vectors, storage stubs versus native browser evidence, research/source cross-references, fixture/event invariants and repository/artifact heuristics |
| All scripts and standalone QA | Native Safari WebDriver and Windows Chromium CDP harnesses, file-download/recovery tests, formatting/link/inventory/bundle checks, personnel/dated-match validators and all three bounded Wikidata diagnostics |
| All 17 data JSON files | JSON syntax/duplicate-key review, stable club/person identities, zero playable imported facts, snapshot/revision links, date/count arithmetic, provenance and research-only release flags, with their complete contract tests |
| All seven workflows and build configuration | Permissions, immutable action pins, untrusted PR execution, path filters including transitive imports, separate TypeScript/Vite outputs, exact dependency installation and real-browser coverage |
| Manifests and every lock entry | Both runtime dependencies and seven direct development dependencies, 192 non-root locked entries, integrity/registry/license metadata and install scripts; generated dependency notices |
| All documentation/governance | README, roadmap, architecture, contributor/security/copyright policies, AGENTS, every ADR, product and acceptance documents, historical audit logs, browser plans, rules/source matrices, research reports and M1 planning boundaries |

Current behavior is a React/Vite M0 technical shell, pure TypeScript contracts and a local initial-career store. A generated catalog initializes a copied revision-0 snapshot; imports are isolated and checksum-checked, writes are add-only and resolve after transaction completion. Match generation, an executing worker, evolving seasons and finances do not exist. Existing core contracts, approved identities, synthetic data, historical research snapshots and dependency versions remain byte-for-byte unchanged by this review.

## Pass 1: findings and implemented corrections

First-pass implementation checkpoint: `c72c207`.

| Finding | Correction | Verification |
| --- | --- | --- |
| A checksum-valid save can contain a different selected club while claiming the shell's pack/version. Setting that absent selection leaves the rendered club undefined | React rejects absent clubs on both import and restore before changing active state; standalone QA applies the same membership gate | Native Chrome/Edge regression covers import and actual IndexedDB restore; Safari regression covers import and preserved non-default career |
| IndexedDB reread `snapshot.careerId` after asynchronous export, allowing a caller mutation to put valid bytes under a different key | Capture the key before the first await, alongside synchronous snapshot validation/copying | New regression fails on baseline with `NOT_FOUND`, passes after correction and verifies roundtrip under the original key |
| Standalone QA accepted other career IDs although Restore always used `m0-manual-test` | Apply its existing fixed-slot policy before adopting imported state | Source review of both QA admission paths; the separate React fixed-slot regression remains in native-browser harnesses |
| HTTP body limits were enforced only after `response.text()` allocated the entire body; `Content-Length` was not a decoded streaming bound | One shared reader counts response bytes while reading, rejects above 4,000,000, cancels the reader and releases its lock; fetch controllers also abort unread HTTP error responses | Unknown-length and compressed-header fixtures, exact limit, early declared-size rejection, split UTF-8, both actual endpoint adapters and throttle/maxlag tests |
| Missing/malformed entity responses could be confused with absent properties; batches retained all raw claims until the end | Reject missing markers by property presence, require entity/claims shape, validate each batch and immediately add only aggregate counts | Missing/empty-string marker, malformed entity, legitimate empty claims and misplaced entity in a 41-person/two-batch regression |
| A missing-entity diagnostic included a source-person QID in published error text | Use a fixed non-identifying failure description | Failed-measurement regression verifies no source-person QID in the summary |
| Live diagnostic path filters omitted shared/transitive implementation changes | Add shared reader/tests and the dependent P54/field modules to each relevant workflow; browser audit-document filter includes future audit reports | Complete workflow/source dependency review; changed live diagnostics run on the PR |
| Current documents still called M0 open, retained an obsolete offline requirement and listed tooling not actually used | Record completed #2 and its exact-main CI evidence, reconcile current architecture/tooling, label historical proposals, repair literal newline escapes and six-club scope in the dated-match report | Local link checks, full documentation/status review and unchanged ADR precedence |

## Pass 2: complete refactored-tree review

Revisited the complete **151-file** tree after pass 1 by the same subsystem inventory, including unchanged core, tests, data, build/workflows, dependencies and documentation. Rechecked direct/indirect uses before considering deletion, trust boundaries and mutation across awaits, all JSON keys, JavaScript/Python syntax, strict TypeScript unused-symbol checks, dependency metadata and the actual built artifact. A hashed full-tree working inventory was generated during verification.

This pass found an additional packaging defect: production JS contained **no copyright/license notices**, and no separate dependency notice was emitted. The installed React, React DOM and Scheduler packages each contain the MIT text requiring copyright and permission notices with copies. Enabled Vite's existing `build.license` facility to emit `THIRD_PARTY_LICENSES.txt`, with no new dependency or custom packaging layer. The bundle guard permits **only this exact additional text filename** and checks each complete notice plus package/version/license heading against the installed package metadata and LICENSE text. Missing or truncated notices fail regression tests. This does not license FootClubSim itself or establish rights to any football data.

After the packaging fix, rechecked affected build/guard/tests, all repository boundaries and the complete applicable suite. No further safe, justified removal or architecture reduction was established. This review does not describe an additional independent human approval.

## Removed, consolidated and simplified

- **Removed:** two unbounded full-body text reads, the retained cross-batch raw entity accumulator, repeated batch-end aggregation and identifying QIDs in missing-entity errors. Ignore generated Python bytecode rather than risk tracking verification output. No production API, file, asset or compatibility path was proven dead and deleted speculatively.
- **Consolidated:** response-size enforcement and stream cleanup for both Wikidata endpoints in one small shared reader. This adds a necessary network trust boundary, without changing research priority or promoting research to gameplay.
- **Simplified:** each field batch is validated and summarized immediately; only five counters survive into the next batch. Save-key ownership is fixed before async work. No runtime speed claim is made without a benchmark.
- **Dependencies:** none added, removed or upgraded. React/React DOM render the shell; type packages, TypeScript, Vite, ESLint, typescript-eslint and Hooks rules each have active build/check use. All locked non-root entries have registry URLs and integrity metadata. The sole declared install script belongs to optional `fsevents`; CI retains `--ignore-scripts`. npm reports no vulnerability. npm warns that pinned ESLint 9 is unsupported; a future major-version migration needs deliberate compatibility review, not removal of lint or an untested upgrade.
- **Legacy:** earlier ADR/proposal/audit checkpoints retain decision history with explicit current supersession/closure links. Revision-0 saves remain a supported contract, not obsolete code. The standalone QA page is documented and useful; it is preserved.
- **Intentionally unchanged:** duplicated small shape predicates operate at different domain, JSON and worker boundaries; merging them would couple public contracts. Worker requests intentionally perform cheap transport checks before full match validation. Exported domain types/functions are current or planned consumer contracts, not proven unused internals. No speculative store/worker/framework dependency, broad UI rewrite or M1 feature was introduced.

## Comparable measurements

Counts use `scripts/repo_audit.py` over the Git index, reading tracked working-tree bytes and counting `.ts/.tsx/.mjs/.py/.css` source lines. Bundle size uses `scripts/check_m0_bundle.py` over the generated output. The report itself is included in final tracked/document counts.

| Metric | Baseline | Final reviewed tree |
| --- | ---: | ---: |
| Tracked files | 149 | 152 |
| Source files / lines | 69 / 6,560 | 71 / 6,808 |
| Test files | 36 | 37 |
| Markdown files | 49 | 50 |
| Direct runtime / development dependencies | 2 / 7 | 2 / 7 |
| Node tests passed / failed | 140 / 0 | 148 / 0 |
| Python tests passed / failed | 27 / 0 | 29 / 0 |
| Generated files / bytes | 3 / 245,736 | 4 / 249,604 |
| npm vulnerabilities reported | 0 | 0 |

The additional source lines primarily provide regression coverage and bounded response processing; the extra generated file is required dependency notices. JS grew by 439 bytes for admission protection, and notices add 3,429 bytes. This is not an overall code-size reduction or a measured speedup. The concrete simplification is removal of duplicated response logic and retention of raw cross-batch claims.

## Verification and limits

Executed locally: locked `npm ci --ignore-scripts --no-audit --no-fund`; `npm run check` (types, lint, format, complete Node suite, core/web builds); all Python unit tests; documentation links; full tracked secret/asset/action-pin inventory; production bundle and exact dependency notices; `npm audit`; TypeScript `--noUnusedLocals --noUnusedParameters` for both projects; JavaScript syntax, Python AST and duplicate-key JSON checks. Core and web output coexist. No check failure is represented as success.

Native Safari/macOS and Chrome/Edge/Windows are unavailable in this Linux workspace, as is a local Chromium binary. The revised native harnesses and bounded live diagnostics require GitHub CI. Publication was initially stopped by automatic approval review; the owner subsequently explicitly authorized the branch push, PR and conditional merge on 2026-10-15. Actual PR/final-main run URLs and conclusions are recorded in [audit #157](https://github.com/StanleyLl0yd/FootClubSim/issues/157); local tests alone do not establish native-browser or live-service success. Live observations do not overwrite historical research JSON or prove roster registration. External service overload is a failure to retry later, not a reason to weaken checks.

Unchanged limits: genuine Safari Private Browsing, normal-profile full application restart and native downloaded-file recovery, real enforced quota and organic eviction remain **NOT TESTED**, carried by [#155](https://github.com/StanleyLl0yd/FootClubSim/issues/155). Complete roster/rules/rights and brand clearance remain [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15), [#87](https://github.com/StanleyLl0yd/FootClubSim/issues/87) and [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91). No new full legal opinion, external regulation amendment sweep, empirical match calibration, actual worker execution or M2 career migration can be claimed from M0 checks. Heuristic secret/asset scans are not proof of complete security. **M0 remains closed; M1 is not started.**

## Continuation checkpoint

Local branch: `audit/repository-2026-10-15`. First implementation commit: `c72c2070f2fb17458868ec633097973499cc8b22`; second-pass packaging/report commit: `f14d0a2f8fb41a07e75f4511c23bcc7086cf914e`. Documentation-only checkpoints record the initial publication block and its subsequent explicit owner authorization. The audit baseline main is `f71b7873448b3043a0ab8de463259d3f854e7729`. The owner has authorized publication and merge after successful checks. The remaining execution is to verify the PR native browsers and all changed live diagnostics without relaxing checks, then finish exact-main Core/Docs/Security/browser verification and record it in #157. Do not restart completed audit passes or start M1.
