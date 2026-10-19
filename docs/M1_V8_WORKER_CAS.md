# M1 P4: isolated native Worker for the existing v8 CAS

**Research-only (2026-10-19): not production gameplay, not M1 acceptance.**

The schema-1 worker envelope in
`src/browser/m1-v8-cas-worker-protocol.ts` admits only the exact
`commit` operation, with a stable request/career ID, safe expected revision,
1..16 proposed commands, closed fields, plain JSON and a bounded serialized
size. The worker module `src/browser/m1-v8-cas-worker.ts` invokes the
**same** `commitM1V8PersistedBatch` used by the original browser prototype.
It neither duplicates the domain algorithm nor introduces a second database,
storage schema, network service, authentication claim or save migration.

IndexedDB is accessible in dedicated Web Workers in supported target browser
versions. The entire read-modify-write transaction, including one source
replay, revision admission and atomic `put`, now executes off the page's main
thread **in the isolated smoke path**. It still locks the existing v8
`footclubsim-m1-v8/result-journals` object store. A successful reply is
sent only after the IndexedDB transaction completes; a stale revision or
another typed v8 storage/domain error produces a bounded failure response.
No referee/medical claims become authenticated through Worker isolation.

`examples/m1-v8-cas-smoke.html` keeps the old two-match real-navigation
proof and competing main-thread CAS writers, then commits a fourth fixture
using a dedicated Worker. It checks the worker's job/career response identity,
persistent revision and rejection of a stale worker retry. The extended
native smoke additionally races two separate Dedicated Workers at the same
revision; exactly one must commit, the other must report `STALE_REVISION`,
and the single resulting journal revision must survive reload. The existing
browser CI runs this exact fixture in Linux Chromium, real macOS Safari,
Windows Chrome and Windows Edge. `tests/m1-v8-cas-worker-protocol.test.mjs`
adds malformed-version, unknown-field, oversize, non-JSON, getter, cycle and
alias rejection.

## Boundaries and further acceptance

The smoke creates a Worker directly; there is no production app-level
job scheduler, lifecycle policy or UI integration yet. Worker termination,
OS power loss, quota exhaustion, cross-origin/browser-worker restrictions,
full-season latency and long-lived memory are not proven. UI-side code must
correlate the worker job ID and career ID before trusting a reply and must
never consider an early progress indication a durable commit.

A later production design needs a bounded worker lifecycle, cancellation and
timeout semantics, native measured responsiveness and recovery/backup
verification. No optimization may turn a two-stage precomputation into an
unprotected write. The immutable M0 store and every v3-v8 journal format
remain unchanged. P4 #30, P5 #31 and milestone exit #3 remain OPEN.
