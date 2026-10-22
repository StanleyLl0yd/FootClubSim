# M1 P4 v38: native Chromium in-flight IndexedDB CAS interruption

**Research-only, 22 October 2026. Not a production crash or power-loss gate.**

This independent native Chromium workflow tests a state v37 did not cover:
**SIGKILL before acknowledgement of a real schema-6 readwrite CAS**.
The synthetic test page uses the unchanged production-prototype
`commitM1V32PersistedBatch`, not an imitation of its domain logic.

1. Create a disposable immutable M0 initial career and an isolated schema-6
   journal; source-replay and read back one acknowledged match at revision 1.
2. Restart Chromium with the same temporary profile. Instrument
   `IDBObjectStore.prototype.put` only in the test page and install CDP
   `Debugger.enable`. The actual second v32 CAS performs source validation
   and queues its native put. The injected `debugger` statement halts execution
   **inside the same readwrite callback**, before it returns.
3. The external Node driver requires both the exact console put-queued marker
   and `Debugger.paused`, then kills the browser process group with SIGKILL.
   There is no acknowledged revision-2 transaction.
4. Restart a fresh Chromium process using the identical profile.
   Replay-validate the initial career and journal, require revision 1 with
   its exact original fixture and command, then retry the interrupted second
   source command. Require revision 2 and full replay-identical readback.

The pause boundary is deliberately deterministic; it does not sample the
nondeterministic millisecond window between JavaScript return and an
IndexedDB storage-engine commit. It provides **one browser-engine observation**
of an unacknowledged in-flight write's rollback and retry behavior, not a
general proof of crash consistency.

**Not established:** arbitrary crash instant, operating-system power loss,
disk or filesystem durability, actual quota eviction, profile deletion,
multi-hour or 240-fixture browser histories, concurrent page crashes in
Safari/Edge, official referee/medical authority, fatigue correctness or
statistical calibration. No existing M0, v7/v8 or schema-6 format is changed.

P3 #29, P4 #30, P5 #31 and M1 exit #3 remain OPEN. M2 remains prohibited.
