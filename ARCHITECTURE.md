# FootClubSim architecture (M0 design)

Status: **partly implemented M0 architecture**. Pure TypeScript domain, a minimal React/Vite shell, and a preliminary IndexedDB adapter exist. Match generation, game orchestration, workers, PWA and long-term career storage remain proposed. Architectural changes require review and the relevant ADR.

## Product and platforms

FootClubSim is a Russian-first, browser-based, single-player club management simulation. Initial playable competition: RPL. All match outcomes are calculated headlessly. A dedicated Linux desktop release is not a goal. macOS Safari and Windows Chrome/Edge are priority browser acceptance targets.

The application must remain playable without a central server after its assets and a starting dataset are installed. OCI is an optional future host for distributing static data and optional sync, not the authoritative source of match results.

## Proposed technology baseline

- TypeScript in strict mode for browser UI, domain logic, and match simulation.
- Vite + React for a data-dense, accessible, Russian-language user interface.
- Web Worker for potentially long calculations; the main UI thread only dispatches commands and displays immutable results.
- IndexedDB for local career state; explicit versioned file export/import and recovery checks.
- Vitest for deterministic engine/unit/property checks; Playwright or equivalent for browser tests. Include real Safari validation, since a WebKit automation pass does not prove the exact installed Safari behavior.
- PWA/service worker only once caching and upgrade semantics are tested; packaging using Tauri or another wrapper remains a separate future decision.
- Dependency choices such as Zustand/Dexie are **candidates, not a commitment** until their concrete use is demonstrated.
- No Node.js runtime dependency for playing the game. Build tools run in development/CI only.

## Module boundaries

```text
Browser UI (React, ru-RU)
   | user commands / readonly selectors
   v
Game Application / career orchestrator
   | command validation, calendar scheduling, event transaction
   +--------------------+----------------------+
   v                    v                      v
Match Engine         Rules Engine           Club / Career AI
(seed, tactics,      (fixture, roster,      (lineup, transfers,
 event ledger)        discipline, table)      decisions, growth)
   +--------------------+----------------------+
                        |
                 Canonical domain state
                        |
                   Save adapter
                 (IndexedDB / file)

Starting data pack  --validated on load-->  new-career snapshot
                     (never mutates an existing career)
```

Direction of dependencies: platform adapters -> application -> domain. Pure domain code may not import React, browser globals, IndexedDB, Tauri, HTTP clients, or UI localization strings. Adapters implement narrow interfaces at the outside boundary.

## Core responsibilities

| Boundary | Owns | Must not own |
| --- | --- | --- |
| UI | Input, presentation, navigation, accessibility and locale mapping | Match probabilities, persistent business rules |
| Application | Command queue, career-date transitions, atomic state commits, errors | Hidden ad hoc football rules |
| Match | Seeded event calculation and complete match report | DOM, persistence, server, fetching data |
| Rules | Competition config, roster legality, ranking and sanctions | Cosmetic UI or network |
| Career/club AI | Deterministic AI decisions, development, finances and transfers | Direct low-level storage writes |
| Data catalog | Versioned starting datasets, validation and provenance | Dynamic career truth after save creation |
| Persistence | Durable saves, file export/import and migrations | Implicit mutation of canonical state |

## Canonical career state

One authoritative career store contains stable identities and all mutable match, team, player, competition and financial state. Temporary calculations may derive cached read models but never introduce a conflicting source of truth. Game commands are validated against a current state revision; they either yield an entirely valid new revision or no state change. Never partially commit a round or double-apply an event after retry/worker restart.

Starting dataset packs have immutable pack ID, schema version, release date and rights manifest. New career takes a snapshot of selected pack and rule versions; updates to source packs do not patch a running career. Reference identity is not a player's name or a mutable jersey number.

## Match calculation and time

A reproducible match result is a pure calculation from immutable pre-match snapshot + rules version + engine version + explicit PRNG/seed. Emit a canonical event ledger and report. Do not reconstruct match statistics from score, or score from independently randomized aggregate statistics. A single schedule orchestration step processes fixtures once, applies home/away effects, then commits standings, disciplinary and fatigue changes atomically.

Worker boundary should support cancellation before commit, progress signals for lengthy batches, error surfaces and abort/retry. For high-cost season simulation, perform batches and periodically yield; no arbitrary wall-time correctness conditions.

## Local persistence and offline availability

- IndexedDB is the main live store, with schema migrations and detection of storage unavailability/quota failure.
- Saves contain schema/engine/data-pack versions, explicit checksum or structural integrity validation, state revision and all RNG state required for deterministic continuation.
- User-initiated export/import is available from first playable version. Imported files are bounded, parsed into isolated candidate state, validated and committed atomically only after success.
- Service worker, when added, must differentiate immutable hashed app assets, mutable pack manifest and actual saves; never cache credentials, and never silently change a loaded career.
- Safari private browsing, storage clearing, eviction and browser upgrades require documented fallback and recovery UX.
- Optional future cloud sync requires opt-in, threat model, conflict resolution, encrypted transport, independent backups and no implicit data loss.

## Game-data source policy

Read [data source policy](docs/DATA_SOURCES.md). The repository must not contain unauthorized Transfermarkt exports, scraper output, player photos, team crests or copyrighted third-party databases. Start with synthetic clubs and fictional footballers, then enable a rights-cleared RPL data pack. Rules are data-driven with explicit verification against official regulations before claiming an authentic 2026/27 season.

## Security and correctness boundaries

- Untrusted: all imported datasets, exported saves, paths/URLs, user inputs, worker replies and optional future remote responses.
- Validate size, shape, bounded numerics, string lengths, identities and cross-reference integrity at boundaries. Do not use `eval` or execute embedded code in packs/saves.
- Never trust imported HTML, external URLs or images for direct DOM injection.
- Protect PR CI from untrusted code and do not commit tokens, private keys or signing material.
- Keep deterministic state changes independent of clock, locale, JS runtime iteration order ambiguities and uncontrolled `Math.random()`.
- Balance/probability tuning should be observed and versioned; historical saves must record engine version for migration/replay.

## Documentation governance

- `AGENTS.md`: mandatory development, security and whole-repository audit rules.
- `ROADMAP.md`: scope, progress and exit tasks.
- `docs/DATA_MODEL.md`: records, ID and persistence contracts.
- `docs/MATCH_ENGINE.md`: simulation/event/statistical invariants and acceptance.
- `docs/DATA_SOURCES.md`: provenance and rights gate.
- `docs/adr/`: explicit architecture decisions; unresolved tradeoffs stay labeled provisional.

No major subsystem implementation starts without tests for critical data and match invariants. Avoid abstracting hypothetical features before they exist.
