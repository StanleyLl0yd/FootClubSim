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
names. **A real-browser cross-platform v8 smoke remains required**
before considering this feature interoperable in Safari/Windows and
under real storage constraints. The previous v7 Chromium/Safari/
Windows evidence applies only to **v7**, not automatically to v8.

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
