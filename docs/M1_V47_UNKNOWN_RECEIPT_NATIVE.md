# M1 P4 v47: native lost Worker-acknowledgement review

**Research-only. No durability or crash power-loss certification.**

v43 introduced real schema-6 optimistic CAS through a DedicatedWorker;
v45 added the pure fail-closed classifier for `COMMIT_OUTCOME_UNKNOWN`.
This browser test connects those pieces with **actual IndexedDB** and
an intentionally lossy response transport.

1. Create a disposable M0/schema-6 career, derive one authentic-by-model
   source command, and verify that a replayed revision-0 snapshot reports
   `NOT_OBSERVED_AT_READ` with `automaticRetryAllowed:false`.
2. Launch the actual v43 Worker and submit a command through its
   client transport, but intentionally suppress delivery of all replies
   while leaving the Worker alive. A 10 ms timeout must result in
   `COMMIT_OUTCOME_UNKNOWN`, not an assumed rollback.
3. Independently poll the real stored schema-6 journal until revision 1
   appears. Replay the entire persisted history and compare the original
   requested batch against the exact prefix using v45. Only
   `OBSERVED_COMMITTED` is accepted, still with **no automatic retry**.
4. Navigate the browser to a fresh document and independently replay
   the original stored data, verifying both M0 and committed fixture.

This deterministic lost-message test is NOT an arbitrary-timing process
kill or evidence that a real timeout always commits. It does not
claim an eviction test, OS power-loss durability, medical/referee
authority, validated production backup or 240-fixture performance SLA.
No production storage or protocol is modified by this experiment.
M1 P3 #29, P4 #30, P5 #31, exit #3 remain OPEN; M2 prohibited.
