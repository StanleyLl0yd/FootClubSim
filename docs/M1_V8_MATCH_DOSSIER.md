# M1 P4: combined read-only v8 match dossier

**2026-10-16. Synthetic source-bound proof, not official football evidence.**

`src/core/m1-v8-match-dossier.ts` combines **two independent
statistical projections** from the *same source-replayed and fully compared*
v8 result, original prematch, manager policy, commands, referee
assertions and medical assertions:

1. `m1-v8-goal-attribution`: scorers, shots, penalties and the
   defending player responsible for each own goal.
2. `m1-v8-phase-presence`: registered XI versus actual physical
   on-field synthetic phase seconds, including temporary treatment.
3. Versioned **complete named matchday lists** (starting XI plus all
   bench players, even if the bench was never used), actual entered
   substitutes, recorded cautions, second yellows, straight reds and
   permanent medical withdrawals.

The record distinguishes a registered unused substitute from a
participant and a temporarily absent player from a permanent medical
withdrawal or dismissal. It reconciles physical final XI, treatment
absences, goals, match identity and team chronology against the
deterministic replay. The result is a coherent domain report suitable
for later acceptance/persistence design, **not** a finalized legal
fixture or authoritative seasonal career update.

**Security and acceptance boundary:** the testable source inputs are
caller assertions, not authenticated IFAB/RFU/KDK feeds, and do not
prove absence of an omitted ruling. The report does not invent legal
red-card suspensions, retrospective adjudication, normal-injury
probabilities, xG from penalties, continuous match minutes or fatigue.
It does not atomically commit a fixture, change league tables or
save a v8 career. Future career implementation must also validate
revision and fixture idempotency and independently retain validated
matchday bench/history before reconciling retrospective sanctions.

Legacy M0/v3-v7 saves, IndexedDB v7 CAS journals, synthetic data,
approved characters and v8 match event schema are unchanged.
P3 #29, P4 #30 and exit #3 stay OPEN, M2 remains prohibited.

## Replay deduplication within verified dossiers (2026-10-16)

The public dossier first regenerates the complete canonical v8 match
from the source and compares **all** of the caller's proposed result,
including ordered events and final RNG state. Both deterministic
projections then read that **same already-verified canonical replay**
rather than independently simulating the identical match twice more.

The standalone `deriveM1VerifiedV8GoalAttribution` and
`deriveM1VerifiedV8PhasePresence` entrypoints **still each replay and
verify independently** before reporting. Their explicitly named
`project...FromVerifiedReplay` helpers are internal, unsafe without
the caller first successfully verifying the exact source replay, and
must never be used as a public persisted-journal admission boundary.
The journal executes one full canonical simulation per old/new fixture,
compares all retained claims against the replay-derived dossier, and
uses the internal dossier projection only *after* that replay has succeeded.
The public dossier independently replays and compares untrusted
candidates. The 16-entry batch and independent projection equivalence
regressions remain required; no source origin
has gained authentication and no old schema has been migrated.
