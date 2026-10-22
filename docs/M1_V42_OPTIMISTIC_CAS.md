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

## Observed native Chromium result on initial v42 PR head

[CI run 39762299558](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/39762299558)
used Linux/HeadlessChrome 155, 8 synthetic fixtures on original
`32844db86a2d58e5e11ddd022c91e58cf272e90f`.

| Revision | v41 write occupancy | v42 write occupancy | v42 complete CAS |
| --- | ---: | ---: | ---: |
| 1 | 211.1 ms | 1.1 ms | 242.0 ms |
| 4 | 719.7 ms | 1.7 ms | 807.7 ms |
| 8 | 1,425.1 ms | 4.2 ms | 1,581.4 ms |

These are **separate, unpaired hosted CI observations**, not benchmark
distributions. The revision-8 readwrite interval shrank by roughly
339 times, but end-to-end CAS latency **did not improve**: source replay
remains mandatory and happens outside the transaction. The 8-fixture
post-navigation load still took 1,649.5 ms, and restoring the 8-fixture
backup took 3,204.7 ms. Full-history replay can still block the main
thread. It is not a solution to a 240-fixture history performance SLA.

The follow-up exact-head workflow also exercises native competing
writer protection, acknowledged and interrupted SIGKILL/restart, and
M0+schema-6 two-store recovery, not just the timing profile. Results
must be verified from the **latest** exact-head CI before merging.

No actual eviction resistance, power-failure recovery, trusted
medical/disciplinary authority or calibrated realism is established.

M1 P3 #29, P4 #30, P5 #31 and exit #3 OPEN. M2 prohibited.
