# M0 initial-career save prototype

This is a **headless initial-career format**, not a playable career. The format and validation live in `src/core/save.ts`, without React, filesystem, IndexedDB or server dependencies. A **separate preliminary browser IndexedDB adapter** already exists in `src/browser/initial-career-store.ts`; it stores only add-once initial snapshots.

## Boundary and semantics

- `createInitialCareer(catalog, selectedClubId, rngSeed, careerId)` validates a synthetic catalog, checks the selected club and seed, and copies the catalog to an independent initial snapshot. The game-engine version is `"0"` because no match engine exists yet.
- `exportInitialCareer(snapshot)` validates the snapshot and returns a JSON envelope with `format`, `checksumAlgorithm`, `checksum` and an exact JSON `payload` string.
- `importInitialCareer(json)` performs bounded parsing, checksum verification, schema/foreign-key validation and returns a **candidate** snapshot. It never overwrites an existing save or makes any storage writes.
- Envelope payload is limited to 4,500,000 JavaScript string units, and complete encoded envelope to 5,000,000. These are conservative M0 prototype limits, not a promised final game-save limit.
- SHA-256 via Web Crypto detects accidental corruption. It **does not establish authenticity**, prevent intentional changes by a person who can recompute the checksum, encrypt saves or confer copyright permissions.
- Export requires secure-context Web Crypto. Import returns `CRYPTO_UNAVAILABLE` when the runtime lacks it.
- The generated 16-club synthetic pack uses `packVersion=1-seed-N`, where N is the deterministic generator seed. An M0 browser shell tied to one seed rejects importing/restoring careers from a different seed or older unversioned synthetic pack. It does not delete or silently overwrite those saved records. The core importer itself can still inspect any independently valid M0 synthetic save.
- Unknown `saveSchemaVersion` is rejected rather than silently migrated. `saveSchemaVersion=1` only represents a newly created **initial** career, with `revision=0`. Versioned migrations and complete evolving career state belong to subsequent milestones.

## Required next steps

1. A preliminary add-only IndexedDB adapter is implemented in `src/browser/initial-career-store.ts`. It stores verified initial JSON and rejects duplicate career IDs, waits for transaction commit, and validates on restore. Add revision compare-and-swap for actual evolving careers, migrations, storage quota/eviction recovery and meaningful backup/export UX before shipping.
2. Connect the existing M0 versioned command, event-ledger and [worker-message contracts](M0_WORKER_PROTOCOL.md) to an actual game-state transaction executor in a later milestone; idempotent commit, fixture transitions and worker execution are **not yet implemented**.
3. Real Safari/macOS, Chrome/Windows and Edge/Windows save/reload/restore smoke checks already pass; unavailable IndexedDB API is also exercised (see [PR #67](https://github.com/StanleyLl0yd/FootClubSim/pull/67)). Actual private-mode, storage-quota/eviction and deeper recovery scenarios remain open before persistence can be declared release-ready.
4. Add full career version migrations only when a genuine M1/M2 career state exists.

Run `npm run check` for the current headless tests. Green Node tests are not evidence of real-browser storage reliability.
