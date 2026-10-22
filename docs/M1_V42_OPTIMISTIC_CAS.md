# M1 P4 v42: optimistic schema-6 source-replayed CAS

**22 October 2026, isolated correctness-first optimization, NOT a
release performance acceptance or automatic sports authority.**

v41 observed that schema-6 readwrite transactions were held for nearly
all end-to-end CAS time (8 fixtures: 1,425.1 ms transaction / 1,431.0 ms
API). The original v32 browser adapter source-replayed the entire
journal from inside the IDB `get.onsuccess` readwrite callback.

v42 changes the **implementation only**, not the v32/schema-6 format,
M0 initial career, existing accepted source rules, replay predicates,
revision limits or persistence keys:

1. Open a separate **readonly transaction** and obtain the original
   IDB structured-clone journal. Resolve only when that transaction
   completes, with no expensive source replay inside its callback.
2. On the same immutable M0 career/catalog, replay-validate the entire
   snapshot and apply every proposed command **outside any IndexedDB
   transaction** using the unchanged pure domain batch validator.
   All malformed, stale and domain-invalid inputs fail before writing.
3. Open one **readwrite transaction** and obtain the latest saved journal.
   Within the transaction's synchronous `get.onsuccess` callback,
   require full deep canonical equality with the *original raw snapshot*,
   not just matching revision; then perform one `put`.
   A different revision yields `STALE_REVISION`; a changed same-revision
   source returns `CORRUPTED` and is never overwritten.
4. Resolve only on the genuine IDB `transaction.oncomplete`. Quota/abort
   never signals successful commit; no asynchronous work is introduced
   inside a write transaction.

The ordinary read function also postpones replay until after its
readonly transaction has completed. The CAS model still serializes all
final writes under IndexedDB object-store transaction locking; it
does not adopt an unprotected load-then-save pattern.

## Verification boundaries

Unit regressions explicitly inject a valid competing revision and a
forged same-revision payload between the preflight and the actual
readwrite transaction, and check that neither is overwritten.
Existing browser races, invalid batch rollback, quota failure, hostile
backup/restore, native process interruption and browser-engine smoke
must continue passing unchanged.

Performance improvement is **not presumed** from this code change:
run the v41 native instrumentation on the modified head and report
observed readwrite occupancy as well as end-to-end time. Replay remains
required and may still block the JavaScript main thread. This change
does not solve a 240-fixture full-history replay cost or establish a
production latency SLA, actual eviction resistance or trusted
medical/disciplinary authority.

M1 P3 #29, P4 #30, P5 #31 and exit #3 OPEN. M2 prohibited.
