# M1 P4: isolated v8 IndexedDB CAS prototype

**2026-10-16, browser prototype, not a production career release.**

`src/browser/m1-v8-journal-store.ts` implements a new **separate**
IndexedDB database `footclubsim-m1-v8`, schema 1 with a
`result-journals` store for v8 domain journal schema 4.

This is **not** a migration or extension of any M0 or v3-v7 saved
career, and it does not access the existing v7 result database.
The original M0 add-only initial career is loaded through its
existing reader and remains unchanged.

The API supports add-only journal initialization, validated reads,
and a bounded **single-transaction read-modify-write CAS batch**.
Independent tabs serializing the same object-store transaction cannot
silently overwrite a newer revision. Stale revisions, corrupt stored
journal bytes, duplicate fixture/command IDs, malformed match sources,
quota aborts and failed later batch members reject without replacing
the previously committed journal. The domain replays every retained
v8 match source against the immutable original catalog before
committing a next journal.

The minimal in-memory IndexedDB model exercises error/abort branches,
concurrent-writer serialization, quota rollback and separate database
names. **PR #212 (2026-10-16), exact-head 6/6 and exact-main 7/7 PASS**, also
verified v8 IndexedDB survival after actual page navigation, source-replayed
medical/penalty/own-goal data and competing CAS writers on native Linux
Chromium, macOS Safari and Windows Chrome/Edge. All older v7 browser checks
continue to pass. This proves those explicit interoperability scenarios,
not arbitrary real storage exhaustion, eviction or OS crash durability.

**Crucial limitations:** input medical, referee and staff claims have
no authenticated origin. Even a durable local IndexedDB record is not
proof of factual sporting decisions. Storage eviction, disk corruption,
OS crash after power failure, backup/restore, malicious extensions,
browser private mode, all-quota exhaustion, full 240-fixture
performance and cross-device transfers are not established.
Synchronous source replay inside a readwrite transaction can block
the UI thread; measured production throughput and Worker isolation
are still pending. No standings, fatigue or condition changes or
actual production career are posted.

M0/v3-v7 saves, approved synthetic/fictional assets and existing
browser stores remain byte-for-byte untouched. M1 P3 #29, P4 #30,
P5 #31 and exit #3 remain OPEN. M2 is not authorized.

## Single-pass source replay during a CAS commit (2026-10-19)

Previously the v8 CAS store fully replayed a retrieved journal and then
passed it to the public batch function, which replayed the same historical
source a second time inside the readwrite transaction. The new domain API
`applyM1V8MatchResultBatchAtRevision` accepts an **untrusted** source journal,
performs the same strict full-history verification **once**, checks the
confirmed revision, and only then admits the next bounded batch. No caller
can provide an unchecked "already verified" journal or skip integrity review.

The persisted commit still reads and writes inside **one** IndexedDB readwrite
transaction; competing tabs cannot overwrite one another. Corrupt stored
data maps to `CORRUPTED` **before** the stale-revision check. The pure
helper uses a distinct `CAS_REVISION_MISMATCH` for the external revision
conflict, which persistence maps to `STALE_REVISION`; a stale command within
an otherwise current batch still maps to `DOMAIN_REJECTED` with domain error
`STALE_REVISION`. Aborts still roll back without partial
journal state. The older public pure single/batch APIs are unchanged,
including their error ordering; the original schema-4 journal is unchanged.

This is a measured-code-path reduction, **not** an independently measured
speedup or a performance acceptance gate. Full-history synchronous replay
still occurs on the main thread inside the browser transaction. Worker
isolation, real quota/eviction, source authority, crash recovery and official
career posting remain unresolved. M1 #30 and exit #3 stay open.
