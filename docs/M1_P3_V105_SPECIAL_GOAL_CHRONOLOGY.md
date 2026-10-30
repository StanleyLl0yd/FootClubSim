# M1 P3 v105 - special goals on the physical 100-second chronology

This is a separate opt-in, exact-source-replayed research contract. It combines the v103 100-second shot and arbitrary-second ordinary medical-presence stream with **v8/v7 referee-decision claims** for scored/saved/missed penalties and defender-attributed own goals at existing 300-second checkpoints. It does **not** reinterpret or modify M0, historical match schemas, RNG or saved career records.

## Admission and chronology

1. Replay v103 from the exact prematch, policy, legal planned commands, checkpoint medical actions and arbitrary-second medical actions. No claimed v103 result is trusted.
2. Independently replay original v8 with the same checkpoint inputs and the requested v7 special decisions. Its deterministic legal decision gate rejects unknown fixtures, invalid penalty/own-goal attribution, conflicting decisions and source-invalid checkpoint procedures.
3. Require v8's physical availability and medical transition sequence to match v103's original checkpoint source after excluding only event IDs and outer sequences whose numbering shifts when decisions are inserted.
4. Build one ordered stream: checkpoint physical transitions first, adjudications next, source shots and arbitrary-second medical events on their original clock. Replay physical presence on each event. A penalty taker or own-goal defender must belong to the **physically present** side at the exact decision second. A player sent for treatment at second 150 and not yet returned at second 300 cannot take a penalty at 300, even if the legacy checkpoint-only referee source would otherwise accept that claim.
5. Recalculate special-goal counts only once on top of the unchanged open-play v103 score/xG. A scored penalty increments attempts, on-target and goals; a saved penalty increments attempts and on-target; a missed penalty increments attempts; an own goal increments beneficiary goals without inventing a shooting event or synthetic xG. The original open-play xG remains separate from non-open-play outcomes.
6. Verify the entire returned candidate by independent source replay and canonical structural equality. Reject colliding decision IDs with arbitrary-second medical source IDs.

All decisions remain **caller-supplied claims**, even if their old schema uses names like `trustedDecisions` or `refereeSignalId`. Neither name authenticates a referee or physician. An actual trusted referee/controller, interruption/restart and exception ruling, explicit cross-fixture sanction provenance, non-checkpoint special decisions and version-aware durable career CAS are still missing. This prototype cannot enter v76 and does not approve calibration.

## Verification

```bash
npm ci
npm run build:core
node --test tests/m1-v105-special-goal-chronology.test.mjs
```

P3 #29/P5 #31 OPEN. M1 OPEN, M2 prohibited, P4 #30 deferred. Both full repository-wide M1 exit audits #3 remain pending.
