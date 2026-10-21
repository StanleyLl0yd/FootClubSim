# M1 P4: persistent v26 physical-exposure career CAS (schema 5)

**21 October 2026. Isolated browser persistence prototype; not a completed P4 acceptance or M1 release gate.**

`src/browser/m1-v26-journal-store.ts` persists the existing pure,
replay-verified **v26 schema-5** `M1V26Journal` in a separate IndexedDB
database `footclubsim-m1-v26`, object store `result-journals`.

- `createM1V26PersistedJournal` uses add-only initialization: existing
  journals cannot be silently overwritten.
- `loadM1V26PersistedJournal` rejects absent or corrupt entries, including
  mismatches against the immutable, separately persisted M0 initial career.
- `commitM1V26PersistedBatch(careerId, expectedRevision, requests)`
  fetches and full-replays the stored journal inside **one readwrite IDB
  transaction**, enforces the revision and existing domain's full
  per-fixture replay, then issues **one put** for the entire batch.
  Duplicate command IDs/fixtures, stale revisions, altered source match
  records and invalid later batch members cannot commit earlier proposals.
  Competing tabs using the same object store serialize under IndexedDB
  write-transaction isolation.
- The existing v7/v8 persistence databases and v26 domain schema are
  unchanged. M0 saves and saved initial catalogs are never migrated.
- A synthetic transactional IndexedDB test exercises reload, two writers,
  duplicate initialization, stale CAS, all-or-nothing failures,
  quota-aborted put, and source-journal corruption.

**Boundaries:** This is a domain adapter with a simulated-storage unit
suite. No real-browser v26 native Chromium/Safari/Windows verification,
OS/process-crash consistency experiment, eviction/quota persistence
guarantee, accepted backup/restore design, or user-facing gameplay
integration is claimed. Replaying a long history synchronously in a
readwrite transaction is a potential latency/transaction-lifetime risk:
a worker-based or appropriately measured design may be required before
shipping; do not relax history replay to make writes faster.

Source-generated medical incidents, exposure, cautions and substitutions
still have **no independently authenticated referee/medical authority**.
No certified intermatch injuries, condition/fatigue calibration, KDK
suspensions, official league points or season-wide accepted rules are
inferred from synthetic records. P3 #29, P4 #30, P5 #31, exit #3 all
remain OPEN. M2 is prohibited; complete two-pass repository-wide audit
remains required.
