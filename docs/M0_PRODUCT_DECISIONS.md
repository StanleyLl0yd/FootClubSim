# FootClubSim M0 product decisions for owner review

**Status: PROPOSAL, not approved.** Prepared 2026-10-13 from the documented project scope. The owner has **not** signed off the detailed role split, match-attribute balance, economy or minimum season behavior merely because they are described here. Approved decisions should receive dated status updates/ADRs and tests before the M0 exit gate.

## What is already established by project scope

FootClubSim is an offline-first, single-player, Russian-first football **club management** simulator. A browser application is the first target (macOS Safari and Windows Chrome/Edge), with no mandatory account or hosted game server. The first intended playable competition is the RPL; match outcomes are calculated by an independent headless engine, not shown through 2D/3D match animation. Third-party rosters, photography and logos cannot be distributed without appropriate rights; numeric-only versions are required.

These constraints should be preserved while making the decisions below.

## Proposed owner decisions

| ID | Topic | Proposed M0 decision | Planned implementation | Status |
| --- | --- | --- | --- | --- |
| D01 | Player role | One human acts as club manager, combining head-coach decisions (lineups, roles, match tactics) and sporting-director decisions (transfers, contract priorities, scouting). The board sets high-level goals and constraints. | M2 tactical/season loop; M3 club operations | **Needs owner approval** |
| D02 | Delegation | Allow the user to delegate optional tasks to AI staff eventually, but keep direct control always possible. Do not require staff hiring UI for first playable season. | M3+, not M0/M1 | **Needs owner approval** |
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

## Proposed responsibility boundary

The simulation should not imply the human controls all club staff or owns the club. Proposed responsibility split:

- **Human manager:** decide selection, formation, tactical strategy, transfer priorities and contract decisions within the board's budget and competition constraints.
- **Club board/owner AI:** set season objectives, high-level financial limits and manager evaluation; implementation after the core season is coherent.
- **AI assistant/staff:** can suggest lineup, training and scouting choices, without overriding an explicit user command; delegation is optional and introduced only where it reduces UX workload.
- **Rival clubs:** use the same legal squad, fixture and match interfaces, with deterministic AI planning rather than privileged score shortcuts.

No M1 production code should hard-code this proposed split before approval.

## First-playable-season acceptance proposal (M2)

1. Select one club from a legally usable versioned league dataset and inspect a valid 23+ player squad/registration list where permitted by rules.
2. Choose a legal starting XI, bench and basic tactics; inaccessible players and foreigner limits are handled explicitly.
3. Process all fixtures of an initial 16-team home/away schedule through the common match engine, including the AI fixtures, without rendering the pitch.
4. Display consistent results, reports, table, tie-breakers, fatigue/discipline and next match information.
5. Store each committed transition once and restore a career after browser reload; export and import an external backup without overwriting a healthy save on bad input.
6. Run offline after the required assets have been loaded; exercise both actual macOS Safari and Windows Chrome/Edge.
7. Do not call this an authentic 2026/27 RPL season if real rules/data licensing and source validation remain unverified.

This is an **acceptance proposal**, not a claim any listed feature already works in M0.

## Owner sign-off protocol

For each D01-D12, record a date and one of **Accepted / Revised / Rejected**, plus any replacement rule. Link resulting architectural/rules decisions from `ARCHITECTURE.md`, `docs/USER_EXPERIENCE.md` and the [M0 checklist](M0_ACCEPTANCE.md). Avoid automatic sign-off or changing an existing design without an explicit decision. Until that happens, M0 acceptance and [exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) remain open.

### Outstanding legal and engineering dependencies

- Verify the **entire** RFU/RPL regulation and any amendments and discipline sources before encoding an executable 2026/27 rules pack.
- Confirm distributable rights for actual player/club databases and artwork separately; do not rely on mere public access.
- Freeze this responsibility/tactics/economy proposal before implementing game-state orchestration or large M3 features.
- Complete the whole-repository two-pass audit, final validation, and rights/security acceptance after functional M0 work.
