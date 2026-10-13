# M0 game-command and worker orchestration boundary

**Status: implemented pure validators and documented execution design only (2026-10-14).**
There is **no running Web Worker, no event generator, no command executor, no
multi-revision career and no automatic game-state commit** in M0. The modules
below formalize the boundaries that future M1/M2 implementations must respect.

## Existing code

- `src/core/command-contracts.ts` validates the versioned career command envelope
  and the owner's approved default-manual/per-area delegation rule.
  `set-lineup` and `set-tactics` are **future** M2 operations accepted for
  structural validation only; they are not dispatched by the current UI.
- `src/core/worker-protocol.ts` parses bounded versioned structured-clone
  messages, accepts cancellation/progress/error signalling, validates summary
  report invariants and rejects results from the wrong job, wrong career,
  different fixture, cancelled job or obsolete state revision.
- `src/core/match-contracts.ts` independently validates and derives an M0
  `shot` / `full-time` ledger. A valid worker **transport** request may still
  contain invalid match data and must pass this full domain validator.

## Proposed transaction and worker lifecycle

1. The **application** serializes commands affecting the same career. Capture
   immutable career revision `N`, selected club, effective actor/delegation,
   canonical input and explicit rules/engine/PRNG versions. Validate the
   `CareerCommand` envelope and context **before** admitting a job to the queue.
2. Assign a new canonical unique `jobId` and record an in-memory pending entry:
   `{jobId, careerId, expectedRevision:N, fixtureId, cancelled:false}`.
   `commandId` (idempotence key for a career transaction) and `jobId`
   (correlation key for a worker computation) are **different identities**.
3. `postMessage` a protocol-1 `derive-ledger` request for an already-existing
   event ledger. The future M1 **simulation** request must have a new, explicitly
   reviewed, versioned payload; do not pretend M0 derives its own events.
4. The worker validates the wire envelope, then validates/derives match state
   using pure domain code. Progress updates, if emitted, must be bounded integer
   percentages 0..100. A completed reply includes the **derived report**,
   not a guess at a score. Failures return fixed error codes, not arbitrary
   user-provided error text.
5. The application checks `readWorkerReply(reply, pending, currentRevision)`.
   Only a reply correlated with the exact active job, career, revision and
   fixture may advance to **further** ledger-identity/rules/permission checks.
   The parser enforces summary arithmetic, but does **not** authenticate
   worker provenance or prove that the returned report equals the event ledger.
6. Only then may the future application layer assemble a proposed new state,
   verify full roster/rules/budget/authority invariants and **atomically**
   commit state revision `N+1` together with `commandId` and relevant events.
   Replayed `commandId`, lost IndexedDB transaction, failed checks, stale
   revision or invalid worker reply must leave state unchanged.
7. Mark the job complete after the durable commit, not merely when the worker
   produces an in-memory response. Never grant the worker direct IndexedDB
   writes to authoritative career state.

## Cancellation, stale replies, failure and recovery

- Cancel before commitment by setting the pending job's `cancelled` flag
  **locally first** and then sending a new protocol-1 `cancel` request with
  its own unique message `jobId` and the old `targetJobId`. An arriving
  late completion or progress result is rejected with `CANCELLED_JOB`.
  A correctly correlated `cancelled` acknowledgement may still be accepted
  to release pending resources; it is never a career-state transaction.
- The worker may not be able to interrupt a currently executing synchronous
  action immediately. For long M1 batches it must periodically yield/check
  cancellation. The application must never rely on cancellation alone to
  prevent stale commits; it must check revision and cancellation at commit.
- A completed reply for revision `N` is rejected if the authoritative career
  has advanced to `N+1`, even if the response itself still advertises `N`.
- A worker crash, timeout or browser navigation invalidates pending jobs.
  Show an explicit failure and allow deterministic retry only with frozen
  inputs, compatible engine/rules versions and a **new** job correlation ID.
  Never silently commit a partial match or fabricate a fallback result.
- Protocol-version changes or migration to an actual `simulate-match`
  request require new tests and explicit versioning, not a reinterpretation
  of `derive-ledger`.
- A staff member may prepare a delegated command, but must pass the same
  command validation, match legality and transaction path as a player.
  Changing a responsibility back to the player takes effect for future
  decisions and must invalidate/resolve incompatible pending staff actions.

## Test evidence and remaining acceptance

`tests/command-contracts.test.mjs` covers validation, authorization, defaults,
revocation by changed assignment, duplicate IDs and revision mismatches.
`tests/worker-protocol.test.mjs` covers version/size checking, correlation,
stale results, cancellation acknowledgement, errors, progress bounds,
impossible report arithmetic and match validator separation.

**Not yet demonstrated:** actual worker creation and scheduling, live
cancellation of running computation, atomic multi-revision IndexedDB writes,
queued season progression, handling interrupted fixtures and match generation.
These belong to M1/M2 and require separate implementation/real-browser tests.

This document closes only the **M0 command/worker contract-and-negative-tests**
acceptance item, once CI for its PR succeeds. It does not close the whole M0
exit review [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2).
After M0 passes the two full audit passes and is formally closed, stop and
report status to the owner; **do not start M1 without explicit permission**.
