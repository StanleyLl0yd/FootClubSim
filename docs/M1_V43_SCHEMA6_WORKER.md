# M1 P4 v43: schema-6 source-replayed CAS in a DedicatedWorker

**Research-only, M1 OPEN. No user-facing M2 feature or production gate.**

The v41/v42 real Chromium probes demonstrate that moving expensive
source replay out of an IndexedDB write lock shortens transaction
occupancy, but still causes a long synchronous calculation inside the
page's JavaScript thread. v43 introduces a separate **opt-in** native
DedicatedWorker client/worker/protocol to execute the unchanged v32
schema-6 CAS away from the main UI thread.

- Requests are versioned, size-limited, strict JSON trees with exact
  fields, stable job/career IDs, expected revision and bounded commands.
- Worker executes the existing source-replayed optimistic v32 CAS,
  making the same checks and one atomic IDB put under the same database.
- A successful reply returns ONLY `{jobId,careerId,journalRevision}`.
  It never treats a worker message as a verified report, medical
  clearance or signed referee decision.
- The caller checks exact request/reply identity, expected revision,
  exact keys, bounded error enum and optional domain errors.
- A lost, malformed, timed-out or crashed-worker reply returns
  `COMMIT_OUTCOME_UNKNOWN`, **not** "rolled back". It must load and
  replay the actual persisted journal before considering a retry.
- No changes to M0, v7/v8 storage, schema-6, worker-shared state or
  the main-thread persistence API. This is an independent prototype.

The native test commits four source-replayed fixtures through real
DedicatedWorkers, checks a 10 ms page heartbeat during the later two
commits, then races **two independent Workers** against expected revision
4. Exactly one CAS must succeed, one must return `STALE_REVISION` and the
winning fixture must survive navigation and full replay. This
is one bounded Chromium observation, not a production performance SLA. A nonblocking
page **does not** certify production performance: full source replay
still consumes CPU, and concurrent processes can be throttled.

P3 #29, P4 #30, P5 #31, M1 exit #3 OPEN; M2 prohibited.
