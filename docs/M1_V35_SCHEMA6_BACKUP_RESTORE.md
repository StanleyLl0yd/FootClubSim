# M1 P4: v35 existing-career schema-6 backup/restore

**22 October 2026. Development-only recovery experiment. Not an
accepted user backup plan or a promise of crash/eviction durability.**

v35 adds `src/browser/m1-v35-schema6-backup.ts`, plus one add-only
`restoreM1V32PersistedJournal` operation in the isolated v32 IDB
adapter. A backup captures a **fully source-replayed** v32/schema-6
journal as a JSON string, with a format/version, stable career ID,
SHA-256 journal checksum and SHA-256 fingerprint of the locally stored
immutable M0 initial career. The digest detects accidental corruption,
**not adversarial tampering or trusted authority**.

Restoration is restricted to an **already present and identical M0
initial career**. The import verifies the envelope shape, length,
checksums and identity; fully replays the journal's v29/v31 modelled
source against the existing canonical catalog; then performs one
`IndexedDB.add` in a single readwrite transaction. An existing
schema-6 journal, even if corrupted, is never overwritten. A missing
or mismatched initial career is never synthesized or migrated, and
the M0 database is never modified. Competitors cannot both restore
the same key; quota/transaction failure leaves the key absent.

Public functions:

- `exportM1V35Schema6Backup(careerId): Promise<string>`
- `restoreM1V35Schema6Backup(careerId, backup): Promise<M1V32Journal>`

The exported text is bounded at 20 million UTF-16 code units, and
the original v32 16-million-code-unit source-replay journal limit
remains in force. Secure-context Web Crypto is required. No
key management or confidentiality is included, so the application
must not present this SHA-256 checksum as proof of author identity.

Regression tests cover a real v29/v31 persisted fixture, exact
round-trip after removing only the disposable test journal, tampered
checksums and recomputed malicious checksums, missing-key/no-overwrite
behavior, simultaneous restore races and quota rollback. The native
v32 browser smoke performs export, deletes only its disposable
schema-6 test key, restores the same content and verifies M0
identity remained unchanged.

**Not covered or accepted:** physical OS crash interruption,
profile eviction/reinstall, lost M0 initial careers, backup
encryption, externally signed archives, multi-device migration,
restore UI, production file download/import, 240-fixture real-browser
performance, long-lived transaction watchdog, medical diagnosis,
official sanctions or fatigue calibration. A separate source-authenticated
recovery plan and native long-history measurements are required before
M1 exit.

v35 does not migrate or edit M0, v7/v8, v26/schema-5, v32/schema-6
journal structure or v33/v34 projections. P3 #29, P4 #30,
P5 #31 and M1 exit #3 remain OPEN; M2 prohibited.
