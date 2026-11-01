# M1 P5 v119 — opt-in distributed *playable-source* observation

This workflow executes the actual v119 browser-playable-source projector
and full v8 source journal replay on the exact GitHub Actions commit,
**not** isolated v31/v99/v104 research generators.

- 4 fixed disjoint seed groups (1–2, 3–4, 5–6, 7–8)
  for both `ordinary` and `internal-referee` scenarios.
- 4 attempted sequential controlled-club fixtures per seed.
- 8 shards × 8 game attempts each = **64 attempted fixture simulations**
  (not necessarily accepted; every rejection is reported with reason).
- Source-replay and negative option tests for each shard, pinned SHA-256
  of the actual JSON evidence line, runtime logs on GitHub-hosted Linux.
- Explicitly uncalibrated modelled injury/referee severity and partial
  opponent history; no 2024/25 holdout.

The workflow runs via explicit `workflow_dispatch`, and once upon a guarded
merge into `main` touching the versioned script, tests or workflow.
The push trigger is strictly path-filtered; ordinary unrelated pushes do
not consume the eight-shard experiment.
**Do not claim executed 8/8 evidence before real jobs finish.**
Once executed, read original job outputs and match each scenario,
input coverage, accepted/rejected totals, SHA-256 and exact commit.
This is a reproducible operational baseline and a stepping stone
towards high-sample independent distributional acceptance. A
64-attempt convenience sample cannot establish realism, performance
SLA or real game-world event taxonomy equivalence.

Mandatory successor work to actually **unblock** P5: a new
versioned denser (100-second or equivalent) source with shot
capacity above 18 per match, physical medical/referee events and
full v8-compatible migration or separate journal + native browser
CAS. Merely changing shot probabilities on the old 18-slot engine
cannot reach a 23.12 attempt/match reference average.

#31, #29, M1 and #3 remain OPEN. P4 deferred; M2 prohibited.
