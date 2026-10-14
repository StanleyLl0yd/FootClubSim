# ADR-0006: M0 foundation exit versus M2 playable data and rules

- **Status:** Accepted, 2026-10-14 (owner instruction following the M0/M2 boundary review).
- **Supersedes:** Only earlier milestone-gate interpretations that required a completed 16-club real-prototype roster and playable real-RPL rules **during M0**.
- **Preserves:** ADR-0002 to ADR-0005, all 16 approved names/badges, all 46 approved «Надир» identities, immutable club/person IDs, the original synthetic M0 catalog, persisted career compatibility, the requirement for genuine effective RPL rules, and the mandatory two-pass M0 repository audit.

## Context

M0 is the architecture, specification, test-contract and synthetic technical-foundation milestone. M2 is the first coherent **playable** 16-club «Лига приколов» season. The research backlog #91 seeks date-verified 2026/27 player/staff prototypes from Wikipedia, corroborated as needed by official records, while full registration and source rights are still unresolved. None of these research pointers is a licensed playable catalog. An unfinished future data pack must not be quietly represented as finished M0 work; equally, M0's exit must not be indefinitely tied to completing an M2 feature.

## Decision: exact gate allocation

| Topic | M0 acceptance (required) | M2 playable/release acceptance (required later) |
| --- | --- | --- |
| Data | Versioned and validated original 16-club/368-player **synthetic** pack; documented distinct immutable IDs and separation of source-derived staging from career state | Versioned 16-club roster/personnel pack, independently authored parody names/ratings, verified player/staff identity, roles and provenance as of the declared date |
| Source strategy | Wikipedia-first **revision-pinned research references**, field-level temporal/evidence/rights policy, authoritative RFU/RPL/club conflict-review path, explicit unknowns and no unlicensed imports | Date-bounded complete team registration/roster reconciliation (including bench, loans, youth and staff), permitted acquisition/reuse and release-specific rights decision per fact/asset |
| Regulations | Official 2026/27 RFU/RPL/IFAB edition/source matrix, known relevant article citations, amendment-check procedure, separate versioned rules-pack design and flags for unverified rules | Exhaustive relevant rule/exception verification and tests for all actually implemented match, registration, table, discipline and eligibility behavior; no claim of official compliance before evidence |
| Club names and marks | All 16 owner-approved original names and badge definitions/stable IDs, their synthetic-code accessibility/provenance and research-only release-risk register | Original artwork/name/legal release screening and small-size/accessibility verification on shipping screens and every target browser |
| Sim/technical | Pure seeded M0 contracts, input/worker/save bounds, documented calibration plan, approved M1 interfaces and outstanding design decisions resolved at the M0 interface level | Working matches, season, latest-rules execution, person data and evolving saves with their own milestone tests |
| Browser persistence | Actual M0 initial-save, reload, import/export, unavailable-storage and cross-pack checks; unresolved environment-specific scenarios must remain expressly identified in M0 exit limits **unless** owner separately accepts a tested narrower gate | Real evolving-career storage quota/eviction, migration, backup/recovery and Safari private-browsing acceptance before production claims |
| Audit | Complete **two** repository-wide AGENTS.md passes after final M0 changes, fixes, available security/build/CI/browser checks and issue #2 report | Separate complete two-pass M2 exit audit after M2 delivery |

M0 requires a defensible **rights and provenance gate for what it actually ships**, including checking for prohibited third-party assets, data and credentials. It does not require third-party permission for *unreleased* M2 roster rows that have not been collected or redistributed. Rights checks for Wikipedia prose, Wikimedia photographs, copied database tables and trademark/publicity claims remain separate.

For regulations, M0 must document source editions and the rule-validation obligations. Exact playable execution is an M2 gate; the synthetic M0 `maxForeignersOnField` check is not a full official eligibility implementation. For personnel, a Wikipedia 2026/27 appearance table is not a complete 2026-10-14 registration list and the presence of a coach on a page does not establish a current contract or coaching license.

## Still open before M0 closes

This decision is **not** approval of pending product choices D03-D05/D07-D11, unstated numeric calibration tolerances, a modified browser quota/private-mode gate or legal clearance. Finish those **M0-level** interface/sign-off decisions, make the required source/rights inventory, resolve M0 browser acceptance, and perform the two full audits and final verification. Update checklists and issue scopes accordingly rather than silently marking checks as passed.

#91 is assigned to M2 implementation and may remain open when M0 closes; #15 tracks both its **M0 source/rights-policy subset** and its **M2 executable-rule and release-verification subset**; #87 similarly separates approved M0 identity contracts from M2 shipping visual QA and clearance. Do not close these multi-stage issues merely because the M0 subset is complete. Record the completed M0 slice explicitly in M0 exit issue #2.

## Consequences and migration guarantees

- No M1 or M2 implementation starts merely because this boundary was clarified. M1 still requires completed M0 exit and a **separate subsequent owner authorization**.
- No original synthetic pack, its manifest, any revision-0 saved career or approved fictional name/ID is rewritten.
- No source-derived fact is promoted from research-only `data/drafts` to `data/packs` merely by satisfying this ADR.
- Unknown registration, rights, rules or testing status remains unknown. No extra checkbox may be marked complete without positive evidence.
