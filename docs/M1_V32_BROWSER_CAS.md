# M1 P4: v32 schema-6 causal medical IndexedDB CAS

**21 October 2026. Experimental browser persistence. This is not a
complete medical/disciplinary season state or a shipping release gate.**

`src/browser/m1-v32-journal-store.ts` is an isolated, separately
versioned persistence adapter for the **pure v32 schema-6 journal**.
It uses database `footclubsim-m1-v32`, object store `result-journals`.
The M0 initial career/catalog remains in its original add-only
database; v7, v8 and v26/schema-5 journals are **never modified or
implicitly migrated**.

- `createM1V32PersistedJournal` does an **add-only** IDB transaction:
  it refuses a duplicate career rather than overwriting history.
- `loadM1V32PersistedJournal` reloads the original immutable M0 career
  and fully replays every stored v29/v31 source row, its card and
  modelled medical patient decisions, physical seconds, goals and
  RNG facts before returning data. Missing and damaged histories
  fail closed.
- `commitM1V32PersistedBatch(careerId, expectedRevision, requests)`
  runs a `get`, **full historical domain replay**, all proposal
  validation and one final `put` in a **single IndexedDB readwrite
  transaction**. A stale revision, duplicate fixture/command,
  falsified physician/referee authority, invalid later batch item
  or corrupted historical record cannot commit any portion of the
  batch. Same-store competing browser writers are serialized by
  transaction ordering; exactly one of two equal-revision writers
  can commit.
- Request and transaction errors are typed; a quota-aborted
  transaction cannot partially advance the stored revision.
- Synthetic IndexedDB unit tests verify reload, duplicate create,
  two-writer CAS, stale and invalid batch rollback, simulated quota
  errors, corrupted history, unavailable IndexedDB and isolation
  from the older storage namespaces.
- The native browser fixture
  `examples/m1-v32-cas-smoke.html` checks initial write, actual page
  navigation and reload, saved source-linked causal medical facts,
  stale revision, competing writers and invalid-second-member atomic
  rollback in the existing Chromium, Windows Chrome/Edge and Safari
  hosted workflows.

**Remaining release blockers:** Full historical replay executes
synchronously during a readwrite IDB transaction and may block the main
thread; a measured long-history, cross-device performance/transaction-
lifetime gate is required before shipping. This test does **not**
establish process/crash durability, protection from OS/browser quota
eviction, backup/restore guarantees, or a production UI integration.
Synthetic medical decisions are not clinical diagnoses, doctor
signatures, authorized in-match/next-match return or independently
authenticated sanctions; fatigue and injury rates remain uncalibrated.
Do not equate modelled medical counters with real RPL injury rates.

P3 #29, P4 #30, P5 #31 and M1 exit #3 remain OPEN; M2 forbidden.
