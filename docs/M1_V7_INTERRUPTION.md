# M1 P4: interrupted v7 match prefix, no premature completion

**2026-10-16. This is a limited replay-verified checkpoint, not a full resumption procedure.**

`src/core/m1-v7-interruption.ts` introduces a separate interruption snapshot schema 1, referencing existing engine `'6'` and event schema 7. It accepts **only** a checkpoint after play has started, at a valid 300-second step strictly before full-time.

- Validates that every submitted in-match action and trusted referee adjudication happened **strictly before** the interruption. Rejects future actions instead of using them to precompute an apparent settled result.
- Replays the complete deterministic v7 source internally to verify the already-played chronological ledger, then returns **only** prior events and the partial PRNG continuation at the stop. The full-time continuation, future events and full-time RNG state are never returned.
- The snapshot status is always `interrupted-awaiting-ruling`. A read-only `provisionalScore` reflects goals before the stop, including successful penalties and own goals without double counting. It does **not** carry a final match report, league points, a winner, or a finalized career journal revision.
- `verifyM1V7InterruptedMatch` reconstructs from the trusted source and rejects tampered event histories, scores, clock times and PRNG states.
- Existing M0, v3-v6 and all v7 full-time journal formats remain byte-for-byte unchanged.

## Important restrictions

This prototype can snapshot a *manually declared* stop of an otherwise fully valid v7 match. It **cannot** resolve an abnormal stop caused by fewer than seven eligible players, missing goalkeeper, concussion, abandonment, emergency procedures, referee ruling or active competition resumption decision. v7's existing full-match evaluator still rejects those situations. It does **not** resume a match, assign future fixture participation or substitute a score determination for the RFU/KDK authority.

[RPL 2026/27 rules](RPL_2026_27_RULES.md), Article 8.3, generally preserve an interrupted match's already played portion, score and discipline for any authorized completion, with exceptions and governing body decisions. The exact resumption player eligibility, timing, restart, sanctions, fixture scheduling and match status transitions still require a separate authority-backed, edition-verified implementation.

The caller must authenticate the stop notice and its source chronology independently. No future data may be passed under `trustedDecisions`. A local snapshot has no cryptographic evidence of a genuine referee interruption. It is **not** persisted by this module. Add that evidence, full resumable partial RNG/control/availability state and atomic career CAS under later P4 tasks before declaring complete interruption handling.

M1 P3 #29, P4 #30, P5 #31 and exit #3 remain open; M2 is not authorized.
