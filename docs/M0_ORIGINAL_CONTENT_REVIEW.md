# M0 original-content review (2026-10-14)

**Baseline:** `main` commit `620f58335b2bf14061c564348caa0321d3722736`. Technical inventory only; not legal clearance or the mandatory final two-pass audit.

[Documentation CI 38556362413](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38556362413) ran `scripts/repo_audit.py` against that exact commit and reported 136 Git-tracked files, 800,903 tracked bytes, 67 source files, 5,884 source lines, 35 test files, 38 Markdown documents and **zero** files with configured binary/artwork/archive/database suffixes. It passed its known-secret-pattern, declared-asset and pinned-action checks. These are **heuristic** checks; independent rights/security review remains necessary.

## M0 content boundary

- `src/core/synthetic.ts` plus `data/packs/m0-synthetic-manifest.json`: 16 clubs and 368 generated **fictional** player records, with project-authored provenance and validation; not a real RPL roster.
- `src/branding/identities.ts` and `src/app/ClubBadge.tsx`: 16 approved fictional names and project-authored circle/letter badge renderings. No copied crest files are included. Owner creative approval does **not** equal trademark clearance.
- `src/app/**` and `src/browser/**`: M0 local UI and initial-career save/export prototype. No external player photos or source roster table are consumed by this UI.
- `data/drafts/**` and `docs/**`: research-only Wikipedia/RFU references, limited individual leads, frozen Wikipedia revision IDs and provenance. They are **not** part of the playable M0 catalog.

Wikipedia article prose, third-party photographs, official crests, external compiled rosters, commercial player ratings and any release-specific material require a separate compatible rights evaluation. Wikipedia references do **not** prove complete registration as of 2026-10-14. Rights and effective competition-rule checks for the first playable 16-club personnel pack remain [M2 work #91](https://github.com/StanleyLl0yd/FootClubSim/issues/91), plus the executable-rules subset of [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15). Dependency notice review and release branding/legal assessment are also outstanding.

## Locked NPM dependency metadata inventory (2026-10-14)

Independently parsed [`package-lock.json` at `e4141c0`](https://github.com/StanleyLl0yd/FootClubSim/blob/e4141c02f24ececb0e4f7cec2601f70b5fa50971/package-lock.json) with the installed [`package.json`](../package.json). There are **2 direct runtime dependencies** (`react`, `react-dom`), **7 direct development dependencies**, and **192** non-root package entries in the lockfile. All 192 currently contain a `license` metadata field. This is package-manager metadata, **not** independent verification of copyright ownership, license validity, individual source-file exceptions or bundled notices.

| Declared lockfile license expression | Package entries |
| --- | ---: |
| MIT | 142 |
| Apache-2.0 | 16 |
| ISC | 11 |
| BSD-2-Clause | 6 |
| BSD-3-Clause | 2 |
| MPL-2.0 | 12 |
| CC-BY-4.0 | 1 |
| Python-2.0 | 1 |
| BlueOak-1.0.0 | 1 |
| **Total** | **192** |

The 12 MPL-2.0 entries correspond to `lightningcss` and its platform-specific packages; the other exceptional entries are `caniuse-lite` (CC-BY-4.0), `argparse` (Python-2.0), and a nested `minimatch` (BlueOak-1.0.0). All of these entries are marked as development dependencies in the current lockfile, **not necessarily shipped application code**. Production bundle content and required notices must be verified separately, especially when the deployment/archive format changes.

**Remaining before publishing a game:** inspect the actual production bundle and dependency license texts, preserve mandatory attribution/notices, confirm that no proprietary or incompatible data/code enters distributed artifacts, and repeat this analysis after any dependency changes. GitHub's dependency-vulnerability audit is a different check and does **not** determine license compatibility. No package replacements or removals are warranted based solely on these counts.

## Audit correction in this change

`scripts/repo_audit.py` now reports a controlled error for an invalid but syntactically valid JSON manifest root (array, null, number or string). Previously `read_manifest()` could raise `AttributeError` on non-object JSON. Negative Python regression tests cover all four shapes. This change neither reinterprets valid manifests nor alters the M0 catalog or saves.

**Status:** technical content inventory recorded; remaining legal assessment, rules/source verification, browser corner cases, two complete repository audit passes and final-main validation stay OPEN. See [ADR-0006](adr/0006-m0-m2-acceptance-boundary.md) and [M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2).

## Additional M0 inventory hardening (2026-10-14, pending verification)

The tracked-file audit now recognizes additional binary and distributable file extensions (WASM, desktop/mobile executables, native libraries, Java archives, firmware-like binary payloads and compressed archives). It also flags NUL-containing content presented as an unrecognized extension or as ordinary text, and scans several additional text configuration/script formats for known token signatures. Negative tests exercise these paths without storing credentials.

Crucially, the M0 synthetic provenance parser already requires an **empty** `assetPaths` list. The Python Git inventory must enforce the **same M0-only boundary**, rather than allowing an unreviewed file to be made acceptable merely by adding its name to the manifest. Any future material that needs a nonempty asset list requires a separately reviewed, versioned, post-M0 asset/provenance contract; it must not silently mutate the immutable M0 synthetic manifest.

These are deterministic local repository heuristics, not positive copyright/trademark clearance or a substitute for production-bundle review. The actual GitHub PR and exact-main CI results must be recorded before counting this correction as merged or verified; **both full mandatory audits, original naming/branding release screening, and final M0 sign-off stay OPEN**.

## Generated Vite bundle boundary (incremental M0 guard)

`scripts/check_m0_bundle.py` checks the **actual generated `web-dist/` output after the production Vite build** in Core CI. For the current M0 prototype, only the HTML entrypoint and Vite-generated JS/CSS assets are allowed. The test rejects downloaded images, roster JSON/CSV, WebAssembly, PDFs, executables, unexpected output paths, symbolic links, oversized/non-UTF-8 output and a limited set of recognizable research-source markers. Negative Python tests use isolated temporary directories.

This complements the Git-tracked file scanner: a generated distribution can contain something not present as a separately tracked binary. The guard deliberately has a **M0-specific** whitelist; future M2 production images and versioned data packs will require an independently reviewed manifest and replacement checks rather than silently bypassing this gate.

A clean bundle check **does not prove** that every bundled dependency includes required license notices, that all textual content is independently authored, or that parody branding is legally cleared. Those release checks remain separate; neither full M0 repository audit pass is complete.
