# FootClubSim M0 product decisions for owner review

**Status: PARTIALLY APPROVED.** Initial proposal prepared 2026-10-13. On 2026-10-14 the owner confirmed D01-D02 (default player control and independent staff delegation), plus D13 (manager origin, characteristic profile and generated biography at career start). See [ADR-0002](adr/0002-configurable-delegation.md), [ADR-0003](adr/0003-manager-origins-biographies.md), and implementation issues [#58](https://github.com/StanleyLl0yd/FootClubSim/issues/58), [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76). D03-D12 and exact D13 attribute names, numeric budgets and UX details remain proposals.

## What is already established by project scope

FootClubSim is an offline-first, single-player, Russian-first football **club management** simulator. A browser application is the first target (macOS Safari and Windows Chrome/Edge), with no mandatory account or hosted game server. The first intended playable competition is the RPL; match outcomes are calculated by an independent headless engine, not shown through 2D/3D match animation. Third-party rosters, photography and logos cannot be distributed without appropriate rights; numeric-only versions are required.

These constraints should be preserved while making the decisions below.

## Proposed owner decisions

| ID | Topic | Proposed M0 decision | Planned implementation | Status |
| --- | --- | --- | --- | --- |
| D01 | Default player role | At career start the player decides all implemented head-coach and sporting-director matters personally, including training, lineup, tactical choices, recruitment, player and staff contracts when those systems exist. This is only the **default**; the player's role is not permanently fixed. | M2 core lineup/tactics; M3 training/club operations | **Accepted in principle 2026-10-14** |
| D02 | Delegation and decision-maker | The player chooses **separately for each responsibility** whether to decide personally or to assign it to a named staff member; settings can be changed later without restarting. Different areas may have different decision-makers. Employee proposals with player approval are a recommended **additional mode**, not yet confirmed. See [ADR-0002](adr/0002-configurable-delegation.md). | M2 minimum for lineup/tactics, M3 training/contracts/recruitment/staff, M4+ youth | **Accepted core requirement 2026-10-14; UI granularity/modes proposed** |
| D03 | Match | Both user and AI fixtures run through exactly the same deterministic seeded event-driven engine, with report and stats derived solely from one event ledger. No manual in-match real-time button prompts are needed in the first playable version. | M1 engine, M2 season | **Needs owner approval of interaction details** |
| D04 | Player attributes | Keep 33 currently modeled football attributes on the integer 1..100 scale and explicit position/goalkeeper skills. Values and weights are **original game ratings**, not copied from a commercial football manager or third-party valuation data. Player potential, condition and form are separate mutable state. | M1 probability tuning, M3 growth | **Needs owner approval of attribute set and granularity** |
| D05 | Tactics | Start with formation, eligible starting XI/bench and bounded controls for mentality, pressing, compactness, defensive line, passing risk and tempo. All changes affect event probabilities, never guarantee outcomes. | M1 inputs/effects; M2 UX | **Needs owner approval of tactical depth** |
| D06 | Competition | First playable season has 16 clubs, double round-robin (30 rounds / 240 fixtures), league standings and official source-cited tiebreak/registration rules. **Use fictional pack for testing**, not an unauthorized roster or copied league calendar. The exact playable RPL rules pack remains blocked on full legal/rule verification. | M2 season | **Needs owner approval and source rights verification** |
| D07 | Economy | In M3 introduce player/staff wage commitments, transfer budget, operating cash and a separate immutable transaction ledger. For initial Russian league, monetary amounts are safe integer RUB; no floating-point finances. | M3 | **Needs owner approval of complexity and constraints** |
| D08 | Contracts/transfers | All club/player registrations, negotiations, agreements and actual eligibility changes are separate transactional steps. Imported real-life contract dates and fees remain unknown unless legally sourced or explicitly labeled synthetic. | M3 | **Needs owner approval** |
| D09 | Career continuity | New careers freeze a versioned data/rules snapshot; existing career saves must not silently change when a pack updates. Future saves use schema migrations, revision checks and atomic IndexedDB transactions. Export stays user-accessible. | M2+ | **Needs owner approval of recovery/compatibility policy** |
| D10 | Timeline | M2 targets one coherent complete season, not all lifelong manager features. M4 adds multi-season history, player aging, academy/regens and promotion/relegation. | M2/M4 | **Needs owner approval of first playable scope** |
| D11 | User experience | Russian interface first, dense desktop-friendly tables, keyboard-accessible controls, explicit diagnostics instead of silent save failures. UI translation boundaries remain independent of internal IDs. | M2/M5 | **Needs owner approval of presentation priorities** |
| D12 | External data | Release a fictional authored test pack until legal sourcing for real names/rosters/club images is fully approved and documented. Official rules may be paraphrased with source citations but protected PDF/artwork may not be copied. | All stages | **Rights review still open** |
| D13 | Manager background and biography | **Before choosing a club**, the player selects former professional footballer, self-taught/educated theorist (no pro career), or a custom manager with a limited pool of points allocated manually. Each option produces a different competency distribution and the application generates a plausible biography reflecting the origin, strengths and weaknesses: playing clubs/achievements for the practitioner, courses/study/work for the theorist, inferred coherent history for custom. Preview before confirmation. See [ADR-0003](adr/0003-manager-origins-biographies.md). | M2 profile creation + persistence; M3+ full characteristic effects | **Accepted core requirement 2026-10-14; exact attributes/values/biography editing proposed** |

## Approved manager creation principle

A new career begins with **creating the manager**, before selecting a club. The **former professional footballer**, **theorist without professional playing history**, and **custom point-allocation** origins must all be viable. Starting manager ratings belong to their own schema, distinct from footballer attributes. The game generates a consistent fictional biography grounded in the origin, starting competencies, chronology, playing career/achievements or studies/work; the custom profile generates history from the actual distribution, not an arbitrary generic story. The user reviews the resulting biography before accepting it. The exact competency list, numerical balance and details of the generator have not yet been agreed. See [ADR-0003](adr/0003-manager-origins-biographies.md) and [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76).

The new manager's origin does **not** change the approved default/manual staff delegation authority in D01-D02: all available responsibilities remain under player control until expressly assigned to employees.

## Proposed responsibility boundary

The simulation should not imply the human controls all club staff or owns the club. **Owner-approved responsibility model:** the player manages everything by default, while authority can be assigned independently per implemented area (see [ADR-0002](adr/0002-configurable-delegation.md)).

- **Human manager:** controls selection, formation, tactics, training, recruitment and player/staff contracts by default. May delegate each responsibility separately; any area left manual stays manual. The board's budget and competition constraints always apply.
- **Club board/owner AI:** set season objectives, high-level financial limits and manager evaluation; implementation after the core season is coherent.
- **AI assistant/staff:** may **make** decisions in explicitly delegated areas and may advise on manually controlled decisions. Must not override player-controlled responsibilities. A named eligible employee makes the decision; the player can reclaim the area at any time. Proposed review/approval mode is separate from full staff autonomy.
- **Rival clubs:** use the same legal squad, fixture and match interfaces, with deterministic AI planning rather than privileged score shortcuts.

The **principles of independent responsibility delegation and manager-origin biography generation are approved**, but technical contracts for employee authorization, pending approvals, logs, AI behavior and UX must be separately designed/tested before their M2/M3 implementation. These principles do not approve the remaining D03-D12 decisions or the detailed D13 numbers. M1 may not start until M0 closes and the owner explicitly authorizes it.

## First-playable-season acceptance proposal (M2)

1. **Create a manager profile:** choose practitioner, theorist or custom point allocation, preview the generated biography and approve; then select one club from a legally usable versioned league dataset and inspect its squad/registration list where permitted by rules.
2. Choose a legal starting XI, bench and basic tactics; inaccessible players and foreigner limits are handled explicitly. The user can **independently** assign XI/bench preparation and pre-match tactical choices to an eligible employee via a working responsibility setting; manual remains the default.
3. Process all fixtures of an initial 16-team home/away schedule through the common match engine, including the AI fixtures, without rendering the pitch.
4. Display consistent results, reports, table, tie-breakers, fatigue/discipline and next match information.
5. Store each committed transition once and restore a career after browser reload; export and import an external backup without overwriting a healthy save on bad input.
6. Run offline after the required assets have been loaded; exercise both actual macOS Safari and Windows Chrome/Edge.
7. Do not call this an authentic 2026/27 RPL season if real rules/data licensing and source validation remain unverified.

This is an **acceptance proposal**, not a claim any listed feature already works in M0.

## Owner sign-off protocol

For each D01-D13, record a date and one of **Accepted / Revised / Rejected** (or **Partially accepted** where only the principle is agreed), plus any replacement rule. D01, the core of D02 and the core of D13 were accepted by the owner on 2026-10-14; do not treat remaining details or other entries as approved. Link resulting architectural/rules decisions from `ARCHITECTURE.md`, `docs/USER_EXPERIENCE.md` and the [M0 checklist](M0_ACCEPTANCE.md). Avoid automatic sign-off or changing an existing design without an explicit decision. Until that happens, M0 acceptance and [exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) remain open.

### Outstanding legal and engineering dependencies

- Verify the **entire** RFU/RPL regulation and any amendments and discipline sources before encoding an executable 2026/27 rules pack.
- Confirm distributable rights for actual player/club databases and artwork separately; do not rely on mere public access.
- Freeze this responsibility/tactics/economy proposal before implementing game-state orchestration or large M3 features.
- Complete the whole-repository two-pass audit, final validation, and rights/security acceptance after functional M0 work.
