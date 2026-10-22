# M1 P4 v41: native IndexedDB transaction-lifetime instrumentation

**22 October 2026. Research-only. Not an approved latency SLA.**

The v39 native 16-fixture profile established nontrivial end-to-end
latency growth but combined M0 loading, full source replay, IndexedDB
setup and IndexedDB transaction occupancy. We need to know whether
synchronous replay happens **while a readwrite transaction is open**.

v41 adds a strictly opt-in `?instrument=1` test-page-only wrapper for
`IDBDatabase.prototype.transaction`. The wrapper records
`performance.now()` at creation of a schema-6 readwrite transaction
and on its true `complete`/`abort` event. It does not substitute,
force-complete, or change source validation or CAS data.

For each synthetic fixture we record:

- source derivation duration before any transaction;
- full end-to-end `commitM1V32PersistedBatch` duration;
- actual readwrite transaction lifetime (including the synchronous
  full-history replay performed inside `IDBRequest.onsuccess`);
- separate replay-on-load duration and journal size.

The existing v35 export/add-only restore remains tested after real
navigation. Its readwrite transaction lifetime is recorded separately
from total restore time. When instrumentation is requested, the CDP
driver rejects missing or invalid measured fields instead of accepting
an uninstrumented successful status.

A dedicated PR workflow measures eight source-replayed fixtures in
fresh native Linux Chromium and can be manually dispatched with 1..16.
The existing v36/v39 workflow remains the independent non-instrumented
profile. No production engine, M0, schema-6 journal or adapter changed.

Even these measurements are browser task/event wall time, **not**
isolated IO wait, main-thread blocking duration, multiple-device
percentiles or a 240-fixture limit. Any persistent-transaction replay
cost motivates later structural remediation without relaxing the
source-replay validity requirement. No fabricated release threshold.

P3 #29, P4 #30, P5 #31, exit #3 remain OPEN. M2 prohibited.

## Actual native Chromium 8-fixture result (22 October 2026)

[CI run 39749835429](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/39749835429),
Linux/HeadlessChrome 155, original v41 head
`20df5b3b03814f906d0ad4f27ed1439623678b1d`:

| Replay history | End-to-end CAS | Actual readwrite lifetime | Replay-on-load |
| --- | ---: | ---: | ---: |
| 1 fixture | 217.4 ms | 211.1 ms | 206.9 ms |
| 4 fixtures | 725.9 ms | 719.7 ms | 715.6 ms |
| 8 fixtures | 1,431.0 ms | 1,425.1 ms | 1,422.4 ms |

At revision 8, the readwrite transaction occupied **99.6%** of
end-to-end CAS wall time in this observation, consistent with the
full-history source replay performed while the transaction is active.
The v35 recovery's actual readwrite add transaction took only
**1.4 ms**, while its entire replay-based restore took **2,945.7 ms**.

**Engineering conclusion:** moving expensive full-history replay into
a pre-transaction optimistic-validation phase, followed by a protected
version/content compare-and-put inside a short readwrite transaction,
is a plausible next experiment. It must preserve fail-closed corrupted
history rejection, stale-writer behavior, atomic rollback and complete
source replay on every untrusted read; it is not yet implemented by v41.
