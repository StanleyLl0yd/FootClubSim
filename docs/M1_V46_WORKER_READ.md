# M1 P4 v46: replay-verified schema-6 reads in DedicatedWorker

**Research-only, M1 OPEN, no production UI or save migration.**

The v42 optimized source-replayed CAS shortens native IndexedDB
readwrite lock occupancy but `loadM1V32PersistedJournal` still performs
synchronous O(history) replay on whichever JavaScript thread called it.
The v43 Worker moves writes off-page. v46 provides the corresponding
strict and optional **read-only** Worker path:

- The Worker calls the existing `loadM1V32PersistedJournal`, which
  loads immutable M0, fetches schema-6, validates the entire source
  history after a readonly IndexedDB transaction, and rejects corrupted
  data. No shortcut, cache or trust bypass is introduced.
- A strict versioned, exact-field request admits only stable job and
  career identifiers. Worker replies contain only `jobId`, `careerId`,
  fully replayed `revision` and `fixtureCount`, and an explicit
  synthetic-source-only status. **No journal payload** crosses into the
  page and a receipt is not a referee/medical authorization.
- The main-thread client checks exact receipt shape, correlation,
  revision bounds, status, typed storage errors, and treats any lost,
  forged, timed-out or crashed Worker reply as unknown, never as an
  empty journal.
- Native Chromium should prove a multi-fixture Worker read can progress
  while main-thread event-loop ticks continue, with a separate normal
  full source-replayed load after navigation confirming the same state.

This work does not change schema-6 persistence, M0, v35/v40 backup,
match engine, competition calendar or existing full replay validation.
It does not prove CPU fairness, browser scheduler latency percentiles,
eviction immunity, long-lived career durability or a full 240-fixture
release SLA. P3 #29, P4 #30, P5 #31, M1 exit #3 OPEN; M2 prohibited.

## Native fixture

The dedicated v46 Chromium smoke first commits four synthetic sources,
races two v43 writers for revision 4, then launches a v46 read Worker
over the complete five-fixture source-replayed journal. The page
requires at least two ten-millisecond event-loop heartbeat callbacks
during this read, validates the compact result and navigates before
both main-thread and second Worker reads. This is a bounded research
observation, not quantified user-facing performance.
