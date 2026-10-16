# M1 P3: temporary medical absence, read-only v7 presence gate

**2026-10-16. Limited schema-1 replay, not a medical-aware match generator.**

\`src/core/m1-v7-temporary-medical.ts\` adds a separately versioned
\`treatment-exit\` / \`treatment-return\` sequence. It replays a verified
existing v7 match, the validated starting XI, substitutions, cards and
permanently withdrawn players. For ordinary initial-XI outfield treatment it
tracks temporary off-field presence and invokes
\`admitM1OffFieldMedicalReturn\` from the existing IFAB 2026/27 limited
return gate. An accepted return restores active presence; red cards and
permanent medical withdrawal cannot be reversed through this contract.

At the existing 300-second phase checkpoints, it prevents a player who
is temporarily off field from being attributed an open-play shot, penalty
kick or defending own goal. Unlike a true medical-aware simulator, it
**rejects** an already-generated invalid match rather than silently
reselecting its shooter or changing seeded PRNG draws. Half-time remains
subject to the underlying first-half-only exception gate. Concurrent
re-entry and treatment at the same checkpoint is not represented by this
strictly ordered subset. Only initial outfield starters are supported;
goalkeeper, on-field treatment exceptions and substituted-in treatment
require later referee-specific work.

\`replayM1V7TemporaryMedicalPresence\` returns an independently derived
final on-field list, temporarily absent players and the accepted action
history, but it does not write the existing journal or v7 match result.
\`verifyM1V7TemporaryMedicalPresence\` reconstructs the report from the
supplied source and detects forged or modified results. Duplicate IDs,
out-of-order or malformed treatment actions, attempts to return without
exit, early return and wrong boundary fail with typed errors.

The timestamps, fixture, referee signal IDs and asserted restart remain
**unauthenticated caller claims**. The current simulation clock has
five-minute checkpoints, not independently verified wall-clock stoppages
and ball-in-play intervals; the return validator relies on independently
authenticated running-clock facts. Do not pass raw external events directly
to this gate and do not claim implementation of the complete IFAB exception
matrix or medical-aware match engine.

This is a P3 building block only. The v7 journal's format, existing
M0/v3-v6 saves, synthetic catalog, standings and all previous match replay
vectors remain unchanged. M1-P3 #29, P4 #30, P5 #31 and exit #3 remain open.
