# ADR-0011: Playable-first development priority

Date: 2026-11-05
Status: owner-approved direction; formal M1/M2 milestone acceptance unchanged

## Context

M1's simulation detail grew much faster than its player-facing application. The protected main can replay a complete 240-match two-team fictional season, but the browser's main screen still exposes disconnected technical playtests. The nine-block technical closure matrix remains 1/9 accepted; a green internal test cannot substitute for a usable game.

## Decision

1. Deliver one coherent **player-visible** browser experience using the already integrated v188 source, rather than additional match-engine families.
2. Work in thin vertical slices: career → season → game → score/table → durable save/resume; then team management, tactical choices, manager identity and approved fictional personnel.
3. Defer rare medical, referee, clinical and KDK exceptions; keep the accumulated design, old journals and accepted invariants intact. Do not add new versioned edge-case mechanics without a reproduced **player-visible** failure or an approved requirement for the playable version.
4. Statistical realism remains a long-term goal, but research-level tuning/holdout evidence does not hold up the first internal playable loop. Never misrepresent unlicensed observations or a synthetic game as official RPL compliance.
5. Retain atomic IndexedDB writes, reload/replay validation, seeded determinism, two-team chronology, safety/security/rights requirements, exact-head checks, protected main and two whole-repository milestone-exit audit passes.
6. The owner authorizes player-facing prototype development **while M1 remains formally open**. This is not retroactive P3/P5 acceptance, M2 release authorization or permission to change saved career formats silently.

## Immediate deliverables

- One clear default season screen; old technical scenarios only under an explicitly labelled developer disclosure.
- Visible progress, next own fixture, score, fixtures and provisional points table (synthetic 3/1/0 only, never labeled an official RPL standings determination).
- Existing v188 atomic save/reload path; no parallel game engine or hidden state reset.
- Player-facing manual decisions and approved teams/manager setup as next slices.
- Measured, real-browser validation before promising a playable release.

Tracked in [#478](https://github.com/StanleyLl0yd/FootClubSim/issues/478). Deferred [#477](https://github.com/StanleyLl0yd/FootClubSim/pull/477) was closed without merge after an exact-head Core failure, and remains available as future backlog.
