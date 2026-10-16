# M1 P4: isolated browser-local v7 journal atomic CAS prototype

**2026-10-16. Prototype persistence, not M1 acceptance or M2 career release.**

`src/browser/m1-v7-journal-store.ts` provides an independent IndexedDB database
(`footclubsim-m1-v7`, store `result-journals`, schema 1) solely for existing
v7 journal schema 3. It does **not** migrate the M0 initial-career store,
v5/v6 journals, source catalog, rules or legacy saves.

## API and safety boundaries

- `createM1V7PersistedJournal(careerId)` first loads and validates the
  **existing** add-only M0 initial career, then creates a separate initial v7
  journal with `IDBObjectStore.add`. A duplicate never overwrites data.
- `loadM1V7PersistedJournal(careerId)` does not auto-create an absent journal.
  Every loaded record is validated against the original M0 initial career.
  Missing and corrupt values are distinct, explicit failures.
- `commitM1V7PersistedBatch(careerId, expectedRevision, requests)`
  performs `get`, stored-journal validation, expected-revision comparison,
  complete in-memory domain batch verification and **one** `put` in the same
  `readwrite` IndexedDB transaction. Concurrent tabs using this API cannot
  both commit from the same revision. Duplicate fixture/command, rejected
  result, invalid batch and stale revision abort without a partial result.
- The promise reports success **only after the transaction's `complete`
  event**. On abort, quota or storage error, no success is reported. Database
  connections are closed following each operation.
- A fresh journal is never silently synthesized on load, corruption or CAS
  conflict. Failures are typed `M1V7PersistenceError`; invalid individual
  commands retain a `domainError` reason. M0 source-loading failures retain
  their existing `CareerStorageError` semantics.

## Limitations and threat model

This is **browser-local transactional persistence**, not a trusted,
tamper-resistant server or an authoritative referee feed. An attacker able to
alter the M0 source and v7 data coherently, or run arbitrary script in the
same browser origin, can still falsify a career. Client-supplied
`trustedDecisions` are not thereby authenticated. The implementation
relies on standard IndexedDB transaction serialization; it does not prove
durability under OS crash, browser storage eviction, quota exhaustion or
private-mode restrictions, and cannot replace externally verified backups.

Testing uses deterministic mocked IndexedDB transactions, concurrent writers,
late invalid batch rejection, request-level quota abort/rollback, duplicate
creation and corruption. **This does not satisfy** native Safari, OS-level
backup/recovery or real quota/eviction acceptance in
[M2 browser gate #155](https://github.com/StanleyLl0yd/FootClubSim/issues/155).

The engine still lacks verified automatic referee interruptions, medical
off-field XI integration, accepted fixture resumption, independent statistical
calibration and two full M1 repository audits. P3 #29, P4 #30, P5 #31 and M1
exit #3 remain OPEN, with M2 blocked pending separate owner acceptance.

## Native Chromium integration check

The optional development-only fixture `examples/m1-v7-cas-smoke.html` is
served through Vite **dev** with separately compiled core modules, not bundled
into the M0 shipping app. The Chromium CI job now opens it with an isolated
browser profile and real IndexedDB transactions. It creates and commits a
v7 result, navigates to the same origin with a new page evaluation, reloads
the stored M0 source and v7 revision, rejects stale and duplicate writes,
then races two revision-1 writers. Precisely one must commit revision 2.
CI asserts an explicit `M1_V7_BROWSER_CAS_PASS` marker.

This is a **real Chromium smoke** but not proof of a full browser process
restart, Safari support for this new journal, storage eviction, OS-level crash
consistency, actual quota pressure, referee authenticity or M2 playable
browser career acceptance. Mock-IDB fault tests remain separate.
