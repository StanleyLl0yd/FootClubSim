# Playable Preview: independent product acceptance

**Approved scope:** 2026-11-09, by the owner in [#478](https://github.com/StanleyLl0yd/FootClubSim/issues/478#issuecomment-6722937201) and the subsequent explicit confirmation.

**Current status:** acceptance criteria APPROVED; **Playable Preview NOT YET ACCEPTED**. Automated full-season evidence exists, but the owner has not completed a separate hands-on walkthrough. No public or stable release is authorized by this document.

This gate is independent of formal [M1 exit #3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) and [M2 exit #4](https://github.com/StanleyLl0yd/FootClubSim/issues/4). It follows [ADR-0011](adr/0011-playable-first.md). A feature demonstrated in the playable prototype is not automatically accepted under the formal M1 or M2 requirements.

## Product acceptance criteria

| ID | Expected player-visible behavior | Current evidence | Status |
| --- | --- | --- | --- |
| PP-1 | Create a manager **before club selection**, choosing former professional, theorist or custom; 12 skills on the 1–20 scale, starting values 5–15, exactly 120 points; preview/regenerate a fictional biography without redistributing skills; confirm and persist it | [#485](https://github.com/StanleyLl0yd/FootClubSim/pull/485), [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76), full-season [#486](https://github.com/StanleyLl0yd/FootClubSim/pull/486) | Implemented, automated |
| PP-2 | Choose one of the 16 approved fictional «Лига приколов» clubs; see the synthetic 368-player catalog and the club's fixtures | [#481](https://github.com/StanleyLl0yd/FootClubSim/pull/481), [#486](https://github.com/StanleyLl0yd/FootClubSim/pull/486) | Implemented, automated |
| PP-3 | Set the starting XI/bench and available team tactics before the user's match; do not silently skip the user's fixture; make a real halftime substitution when eligible | [#480](https://github.com/StanleyLl0yd/FootClubSim/pull/480), [#483](https://github.com/StanleyLl0yd/FootClubSim/pull/483), [#486](https://github.com/StanleyLl0yd/FootClubSim/pull/486) | Implemented, automated |
| PP-4 | Complete a single 30-round, 240-fixture season (30 own, 210 other fixtures) through the regular game UI; inspect schedule, results, final round and a 16-club provisional table | [#486](https://github.com/StanleyLl0yd/FootClubSim/pull/486), [main run](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/42464983604) | Automated full season PASS |
| PP-5 | Use only the integrated canonical v188 source for score and subsequent state; calculate table points from recorded matches, not independent preferred scores | Replay and independent standings check in [#486](https://github.com/StanleyLl0yd/FootClubSim/pull/486) | Automated verification PASS |
| PP-6 | Keep independent local careers; persist/resume after browser reload; export a **complete** bounded archive (manager, initial save and played-match journal); SHA-256 and source replay validation **before writes**; reject corrupt files and never silently overwrite other careers | [#484](https://github.com/StanleyLl0yd/FootClubSim/pull/484), [#486](https://github.com/StanleyLl0yd/FootClubSim/pull/486) | Implemented and automated; native edge cases remain |
| PP-7 | Exercise the ordinary player journey in Windows Chrome, Windows Edge and macOS Safari, recording the exact tested browser method and exclusions | [#486](https://github.com/StanleyLl0yd/FootClubSim/pull/486) | Automated browser run PASS, not all native lifecycle cases |
| PP-8 | Owner performs an independent, understandable, no-developer-help playthrough, including a fresh career, own coaching decisions, restart, full archive recovery and user-facing failure messages | [Manual procedure below](#owner-manual-acceptance) | **NOT TESTED / owner sign-off pending** |
| PP-9 | Explain the prototype's boundaries without suggesting official RPL compliance, real licensed rosters or a finished multi-season Football Manager | [README](../README.md), [ROADMAP](../ROADMAP.md), [ADR-0011](adr/0011-playable-first.md) | Documented; verify during owner review |

**Automated coverage is evidence for a criterion, not a substitute for PP-8 or a final owner acceptance decision.** Neither a green PR nor 240 simulated matches alone closes this gate.

## Owner manual acceptance

Use a **new disposable browser profile** or another isolated test origin. Back up all existing careers before touching any browser data. **Never clear a real profile's IndexedDB to conduct this test.**

- [ ] Start from an empty isolated profile, create each kind of manager in separate disposable careers, then test the custom distribution at minimum/maximum bounds and exact 120-point total.
- [ ] Preview and regenerate a biography; confirm that skills do not change and that the accepted biography remains after reload.
- [ ] Choose a club, inspect its roster and fixtures, set XI/bench and a tactic, then play a match; confirm the resulting events, score and table are understandable.
- [ ] Advance to the next own fixture and confirm it is not skipped. Make an eligible halftime substitution and confirm that it changes the real match record.
- [ ] Stop the season partway through, reload the page, resume the same career, then finish the season; inspect all 30 own fixtures, final round and standings.
- [ ] Download a **full-career** archive (not the initial-only export), restore it in a **different isolated** clean profile/origin with the same app version, and verify manager, biography, fixtures, results and standings. Verify that attempting an invalid/corrupt import leaves existing healthy careers untouched.
- [ ] Confirm the main Russian-language game flow is understandable without developer tools; labels, feedback and recovery errors explain what happened and what the player can do next.
- [ ] Record browser/OS versions, app commit SHA, defects, evidence and the owner's explicit **ACCEPTED** or **NOT ACCEPTED** decision in a dedicated issue. Fix actual blockers before acceptance.

The automated test stopped at committed match #86, reloaded and continued to 240 in each target browser. That is **not** evidence that the owner has performed the above manual playthrough.

## Platform and release boundary

**Verified on integrated main `99255709eba1e418a87666a6d54547cbcd5be249`:** Windows Chrome and Edge tested actual downloaded full archives and native file import; macOS Safari tested the exact app-created Blob, file-selection input and IndexedDB restoration, **not** an OS-level download dialog.

**Still unverified:** normal-profile Safari application quit/relaunch, actual Safari Private Browsing, genuine Safari OS-level file download, browser-enforced quota failure, and organic eviction. All remain in [storage release gate #155](https://github.com/StanleyLl0yd/FootClubSim/issues/155); simulated failures cannot be counted as their completion. Internal preview acceptance, if granted by the owner, does **not** waive any of them. No public release promising durable browser careers is accepted without satisfying #155 or an explicit, separate, written owner decision about narrower release limitations.

**Preview limits:** one fictional league, one season, no transfers/contracts/finances/staff or multi-season careers. Manager skills currently affect character identity and biography, **not match outcomes**; full game effects remain tracked in [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76) and M3+. A synthetic 3/1/0 standings table is **not** an official RPL classification; the fictional personnel pack and simplified competition rules are not a verified 2026/27 registration or IFAB/RFU/RPL compliance claim.

## Independent formal milestones

- **M1 remains OPEN.** Preserve all original acceptance criteria of [P1 #27](https://github.com/StanleyLl0yd/FootClubSim/issues/27), [P2 #28](https://github.com/StanleyLl0yd/FootClubSim/issues/28), [P3 #29](https://github.com/StanleyLl0yd/FootClubSim/issues/29), [P4 #30](https://github.com/StanleyLl0yd/FootClubSim/issues/30) and [P5 #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31). The [nine-block P3/P5 matrix](M1_P3_P5_ACCEPTANCE_MATRIX.md) is still **1/9 ACCEPTED** and does not replace P1/P2/P4. After functional acceptance, two complete repository-wide audit/refactor/review passes and exact-main verification must be recorded in [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3).
- **M2 remains OPEN.** Sporting rules, eligibility, registration, discipline, exceptions, competition requirements, legal/provenance review and its separate full exit audit remain required in [#4](https://github.com/StanleyLl0yd/FootClubSim/issues/4) and the [ROADMAP](../ROADMAP.md). The preview's fictional season does not demonstrate official rules compliance.
- **Branch governance** was completed in [#217](https://github.com/StanleyLl0yd/FootClubSim/issues/217). Continue to require enforced, current-head checks and protected merges.

The approval of **criteria** does not automatically confer acceptance of **implementation**, closure of any formal milestone, or authorization of a stable release.
