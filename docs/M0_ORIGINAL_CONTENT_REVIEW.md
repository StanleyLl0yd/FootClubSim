# M0 original-content review (2026-10-14)

**Baseline:** `main` commit `620f58335b2bf14061c564348caa0321d3722736`. Technical inventory only; not legal clearance or the mandatory final two-pass audit.

[Documentation CI 38556362413](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38556362413) ran `scripts/repo_audit.py` against that exact commit and reported 136 Git-tracked files, 800,903 tracked bytes, 67 source files, 5,884 source lines, 35 test files, 38 Markdown documents and **zero** files with configured binary/artwork/archive/database suffixes. It passed its known-secret-pattern, declared-asset and pinned-action checks. These are **heuristic** checks; independent rights/security review remains necessary.

## M0 content boundary

- `src/core/synthetic.ts` plus `data/packs/m0-synthetic-manifest.json`: 16 clubs and 368 generated **fictional** player records, with project-authored provenance and validation; not a real RPL roster.
- `src/branding/identities.ts` and `src/app/ClubBadge.tsx`: 16 approved fictional names and project-authored circle/letter badge renderings. No copied crest files are included. Owner creative approval does **not** equal trademark clearance.
- `src/app/**` and `src/browser/**`: M0 local UI and initial-career save/export prototype. No external player photos or source roster table are consumed by this UI.
- `data/drafts/**` and `docs/**`: research-only Wikipedia/RFU references, limited individual leads, frozen Wikipedia revision IDs and provenance. They are **not** part of the playable M0 catalog.

Wikipedia article prose, third-party photographs, official crests, external compiled rosters, commercial player ratings and any release-specific material require a separate compatible rights evaluation. Wikipedia references do **not** prove complete registration as of 2026-10-14. Rights and effective competition-rule checks for the first playable 16-club personnel pack remain [M2 work #91](https://github.com/StanleyLl0yd/FootClubSim/issues/91), plus the executable-rules subset of [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15). Dependency notice review and release branding/legal assessment are also outstanding.

## Audit correction in this change

`scripts/repo_audit.py` now reports a controlled error for an invalid but syntactically valid JSON manifest root (array, null, number or string). Previously `read_manifest()` could raise `AttributeError` on non-object JSON. Negative Python regression tests cover all four shapes. This change neither reinterprets valid manifests nor alters the M0 catalog or saves.

**Status:** technical content inventory recorded; remaining legal assessment, rules/source verification, browser corner cases, two complete repository audit passes and final-main validation stay OPEN. See [ADR-0006](adr/0006-m0-m2-acceptance-boundary.md) and [M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2).
