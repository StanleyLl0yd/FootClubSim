# M1 P5 v70: full-source open-play xG corpus

Research-only, non-calibrated extension to merged v69. The bounded CLI
`node scripts/m1-p5-v70-source-xg-corpus.mjs --firstfixture=1 --fixtures=8 --start=1 --count=128`
uses the EXACT same synthetic catalog (seed 77), fixture order, tactical
defaults and match seeds as the original v62 and post-v66 4096-case cohort.
Four disjoint Linux jobs cover fixture indices 1..8, 9..16, 17..24,
25..32 with seeds 1..128. Each calls the opt-in v69 trace of the single
full v29 match source replay, not a surrogate approximation or extra RNG.

For each accepted match it records source shot count, realized open-play
goals and exact v8 model-computed xG (integer milli-goals). Rejections
remain explicit, never converted to zero-goal or zero-xG observations.
The tool verifies source/fixture identity, 18-phase shot ceiling, xG
range, goal/shot conservation and full source replay flag. It hashes
ordered source observations with SHA-256 for deterministic comparison.
All four hosted shards must pass before claiming 4096 coverage.

The workflow also checks each shard's accepted match count and realized
open-play goals against observed post-v66 CI run 40854076711. Its
model-xG/shot and actual-goals/shot outputs can diagnose whether the
synthetic engine's low scoring comes from shot opportunities, predicted
shot quality or finishing outcomes. This comparison does NOT establish
an observed real-world xG benchmark, independent shots reference, or
statistical independence: seeded fixtures/players are clustered.

This is a diagnostic data collection, not a model-tuning or
real-football calibration acceptance gate. The reference 2023/24
all-goal total must not be compared as if it were open-play-only.
The reserved 2024/25 holdout is never accessed. No runtime engine,
normal API, RNG, match events, saved game, CAS, medical/referee
authority or roster source is changed. P3/P5/M1 exit and two full
repository audits remain open. M2 prohibited.
