# M1 P4 v40: two-store M0 + schema-6 recovery prototype

**Research-only, 22 October 2026. Not an accepted production backup
or crash/eviction guarantee.**

The previous v35 schema-6 backup could only restore if the exact
immutable M0 initial career was still locally present. v40 introduces
an isolated format `footclubsim-m0-schema6-recovery` that carries
**both** the existing serialized M0 snapshot and the source-replayed
schema-6 journal. Existing databases and original stored formats are
left untouched.

- Export re-validates the existing M0 career and schema-6 journal,
  then hashes both exact serialized payload strings with SHA-256.
- Import validates strict format, size, hashes, authentic M0 *format*
  and catalog invariants, and the **entire** schema-6 v29/v31 source
  replay **before writing anything**.
- Import then adds the M0 career only if missing, or checks an existing
  M0 career for exact identity. It adds the journal only if missing,
  or checks an existing, fully replayed journal for exact identity.
  Corrupt/conflicting entries are never rewritten.
- If the second database write fails or is interrupted, the first
  database may contain only the M0 entry. A repeat import of the same
  bundle safely resumes the missing second stage. Concurrent identical
  imports converge via independent add-only store operations.
- Unit tests cover loss of both stores, idempotent/concurrent import,
  recomputed malicious hash over forged journal, M0 conflict, corrupted
  journal and quota-aborted second-stage retry.

**Critical boundary:** the two IndexedDB databases do NOT share an
atomic transaction. A partially restored M0-only state is possible.
The importer must not report a fully restored career until **both**
stages finish; the caller must retain the backup and retry on failure.
No silent overwrite, migration or partial success is represented as
a playable schema-6 career.

SHA-256 is an accidental-corruption checksum, NOT a signature,
authorization, confidentiality or trusted referee/medical attestation.
Loss of the archive itself, browser storage eviction, malicious
modification with recomputed hashes, power loss during a commit,
automatic resume UX and device portability remain unresolved.

M1 #29-31 and exit #3 remain OPEN; M2 prohibited.

## Native Chromium disposable recovery

The v40-specific workflow opens a genuine Chromium browser profile,
saves and source-validates one M0/schema-6 fixture, exports the combined
archive and deletes **only the disposable test career's two keys**.
After actual page navigation, restoration reconstructs both M0 and the
journal. The browser checks a fully replayed match and M0 identity,
then deletes only the test journal again and verifies repeatable
second-stage and idempotent recovery. This is an intentional deletion,
**not a proven natural eviction or real device crash**.
