# M1 P5 v74: preregistered expanded synthetic seed validation

This is the implementation of the **pre-outcome** 2026-10-29 protocol recorded in
[issue #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31).
The previous v73 positions 1..8 and indices 1..32 are exploratory; this new
validation covers synthetic schedule positions **9..40** (32 fixtures) and
indices **1..128**. Exactly 4096 attempted source-replayed cases per arm:
original low-numbered xorshift32-v1 seeds, and existing v73 SHA-256
domain-separated index-to-seed mapping. There are sixteen 8-fixture x
32-index fixed shards. No selection is conditional on study outcomes.

Each CI job prints a deterministic JSON record tagged V74_SHARD_RESULT.
All sixteen successful matrix jobs are required before claiming complete
coverage. The result includes both arms' accepted/rejected totals and
replay-backed shots, open-play goals, internal xG, zero-*open-play*-goal
counts, original and mapped stream digests and fixture-wise initial
possession threshold/exposure. The threshold is computed from unchanged
initial synthetic starting XIs, short passing, decisions and default
mentalities using the **existing** source formula; no engine probability is
changed. Zero open-play goals must not be relabeled an actual final 0:0.

Full-source replay remains mandatory. The first shard is run twice in
its GitHub Actions job to require exact deterministic output agreement.
If any shard is missing, failed or cancelled, the 4096 corpus is NOT
accepted. CI job logs preserve exact commit and shard indices; runtime
is observable in Actions but is not an approved performance gate.
Outcomes may differ in either direction and no desired direction is
hard-coded as a realism criterion.

The fixture/roster observations share dependencies; simple game-level
confidence bounds are not external league calibration. A lawful independent
empirical benchmark, formal uncertainty assessment, historical holdout,
authentic clinical/IFAB/KDK rulings, final release performance limits and
both full repository-wide audits remain outstanding.

M1 OPEN, P5 #31 OPEN, P3 #29 OPEN, P4 deferred, M2 prohibited.
