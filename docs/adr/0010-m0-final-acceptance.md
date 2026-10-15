# ADR-0010: M0 final owner acceptance and pre-release deferrals

**Date:** 2026-10-15  
**Status:** ACCEPTED by explicit project owner instruction.  
**Scope:** Closure of the technical foundation M0 only; **not** M1 authorization, first playable release approval or legal/trademark clearance.

## Decision

The owner explicitly accepted **all three** conditions of the [M0 final technical audit](../M0_EXIT_AUDIT_REPORT.md), after two full consecutive entire-repository audits and successful exact-main automated verification.

### 1. Technical M0 contract acceptance

Approve the existing architectural boundary and versioned M0 foundation: original seeded **16-club/368-player synthetic** catalog and strict provenance, immutable revision-0 initial-career save/backup contract, `xorshift32-v1` seeded deterministic PRNG with vector tests, match `shot/full-time` **ledger v1** validation, current synthetic rules-pack version, command and Worker **protocol/validation design** and browser shell. These are the **M0 contract baseline**, not a functioning event generator, a genuine RPL rules implementation, durable evolving career, or an unqualified endorsement of the M1 algorithm for performance/football realism.

Approve the **method** of the [M1 calibration protocol](../M1_CALIBRATION_PROTOCOL.md): at least **10,000 independently seeded matches per scenario**, documented reproducibility, confidence intervals, declared evaluation cohorts, independent lawful external baseline review, held-out checks and recorded limitations. Actual numerical tolerances, lawful reference distributions and acceptance thresholds must be proposed/reviewed/frozen **before M1 calibration/tuning**, without inventing sample outcomes now. M1 match/PRNG implementation and any changes to those versioned contracts require **separate owner authorization** after M0.

### 2. Narrowed **M0-only** browser acceptance

M0 is accepted based on verified ordinary-session Safari/macOS, Windows Chrome/Edge, Linux Chromium, current IndexedDB recovery/backup scenarios and mocked storage-failure checks documented in the audit and GitHub CI. The owner **explicitly revised** the earlier requirement to execute *all* special browser cases before **M0** closure.

All of the following are carried forward as **NOT TESTED**, not PASS: genuine Safari Private Browsing, Safari **normal user profile and full application shutdown/restart**, native Safari OS downloaded-file reimport, **genuine browser-enforced** IndexedDB quota rejection and organic/automatic eviction. New [M2 pre-release issue #155](https://github.com/StanleyLl0yd/FootClubSim/issues/155) is a hard acceptance gate **before the first playable M2 browser-career release**, or by M5 if the relevant capability is first released then. Do not conflate WebDriver's isolated Safari Automation session, an injected quota failure or ineffective DevTools quota override with an actual platform observation. A future narrower *release* limitation requires its **own** explicit decision.

### 3. M0 synthetic source/rights review accepted with declared risks

Accept the M0 [authored-synthetic content/provenance risk inventory](../M0_ORIGINAL_CONTENT_REVIEW.md), [source-policy and version references](../M0_ENCODED_RULES_PROVENANCE.md) and [parody name review](../M0_PARODY_BRAND_SCREENING.md) as sufficient **M0-only source/rights risk documentation**. **This is NOT a legal opinion, a grant of trademark/data/image/publicity rights or permission to distribute third-party rosters**. The approved 16 original parody club names and abstract circular badges are retained unchanged. The name **«Изумруд»** has an explicitly documented third-party football-use lead; other names cannot be declared unique merely because a limited web search did not identify conflicts.

Formal applicable-territory/class name and stylized-mark/trade-dress checks, player and staff rights/likeness, source data licensing, legal reuse and external release sign-off remain **M2/M6 pre-release gates**, tracked in [#87](https://github.com/StanleyLl0yd/FootClubSim/issues/87), [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15) and [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91). Wikipedia is **primary for version-pinned personnel research**, Wikidata secondary; **only official** RFU/RPL/IFAB editions govern the real sporting rules. The complete verified 16-club 2026/27 prototype squads, legal registrations and executable authentic RPL rules remain M2 deliverables per [ADR-0006](0006-m0-m2-acceptance-boundary.md), not retroactive M0 blockers.

## Verification, closure and follow-on

- Required full audit **pass 1**: baseline 147 tracked files at `08688106a494e421c24a0cc516926047cf9716c4`, safe core fixes and regression test merged as [PR #153](https://github.com/StanleyLl0yd/FootClubSim/pull/153).
- Required full audit **pass 2**: complete reinspection of all 148 tracked files after refactor at `d610cf4c40f4a00fcf7f0c1f0fd4e8635287d97a`, findings and before/after metrics merged as [PR #154](https://github.com/StanleyLl0yd/FootClubSim/pull/154).
- Last technical exact-main baseline before this sign-off: `18184747e78f9d8eadf14bd866f6221ca1f446fa`, **140/140 Node**, **27/27 Python**, **4/4 real-browser CI**, npm audit **zero reported vulnerabilities**, 3 generated M0 HTML/JS/CSS files.
- Final acceptance documentation itself is subject to **new final-main CI** after its PR merges. Attach the actual final commit hash and CI run links to [M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2), and **only then** close the issue as completed. This ADR represents the owner's explicit decision; it cannot anticipate future CI success.
- Any feature change following M0, particularly the **M1 match simulator**, requires a **new, separate and explicit owner instruction**. M1 issue [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) remains open. No M1 commits/PRs should be started as part of this closure.

**Result:** The technical M0 exit is authorized **subject only to successful final-main CI and recording the resulting evidence**. Deferred release checks retain their own hard blockers and honest status.

## Recorded closure evidence (2026-10-15)

The acceptance PR #156 merged as `f71b7873448b3043a0ab8de463259d3f854e7729`.
All exact-main runs completed successfully: [Core 38681258310](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38681258310), [Docs 38681258265](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38681258265), [dependency security 38681258316](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38681258316) and [four-browser smoke 38681258290](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38681258290).
[Exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) was closed after those checks. **M0 is complete; M1 still requires separate owner authorization.** The conditional wording above preserves the decision as made before its CI ran.
