# M0 initial-career save prototype

This is a **headless prototype**, not a playable career and not a browser storage implementation. It lives in `src/core/save.ts` and has no React, filesystem, IndexedDB or server dependency.

## Boundary and semantics

- `createInitialCareer(catalog, selectedClubId, rngSeed, careerId)` validates a synthetic catalog, checks the selected club and seed, and copies the catalog to an independent initial snapshot. The game-engine version is `"0"` because no match engine exists yet.
- `exportInitialCareer(snapshot)` validates the snapshot and returns a JSON envelope with `format`, `checksumAlgorithm`, `checksum` and an exact JSON `payload` string.
- `importInitialCareer(json)` performs bounded parsing, checksum verification, schema/foreign-key validation and returns a **candidate** snapshot. It never overwrites an existing save or makes any storage writes.
- Envelope payload is limited to 4,500,000 JavaScript string units, and complete encoded envelope to 5,000,000. These are conservative M0 prototype limits, not a promised final game-save limit.
- SHA-256 via Web Crypto detects accidental corruption. It **does not establish authenticity**, prevent intentional changes by a person who can recompute the checksum, encrypt saves or confer copyright permissions.
- Export requires secure-context Web Crypto. Import returns `CRYPTO_UNAVAILABLE` when the runtime lacks it.
- Unknown `saveSchemaVersion` is rejected rather than silently migrated. `saveSchemaVersion=1` only represents a newly created **initial** career, with `revision=0`. Versioned migrations and complete evolving career state belong to subsequent milestones.

## Required next steps

1. Add an adapter for IndexedDB with transactional revision compare-and-swap, backup/export and quota/eviction handling; storage mutation must be atomic.
2. Integrate an explicit game-command and event-ledger contract, including idempotency and fixture transitions.
3. Test export/import and browser storage in actual macOS Safari and Windows Chrome/Edge, including private/blocked storage.
4. Add full career version migrations only when a genuine M1/M2 career state exists.

Run `npm run check` for the current headless tests. Green Node tests are not evidence of real-browser storage reliability.
