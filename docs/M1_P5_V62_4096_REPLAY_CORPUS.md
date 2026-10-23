# M1 P5 v62: hosted 4096 seeded v29 source replays

The v29 source-replayed medical/referee corpus already checks a bounded
32 x 128 scenario domain but had not been executed at full capacity
in hosted GitHub CI. This increment adds a one-based 'firstfixture'
selector with strict 240-fixture bounds and deterministic, disjoint
synthetic fixture identities. Existing calls default to fixture 1.

The opt-in research workflow runs FOUR independent GitHub Actions
Linux jobs, each covering eight disjoint synthetic fixtures with
128 identically numbered seeds per fixture. Each attempts 1024 exact
source replays. Four successful jobs establish 4096 attempted cases.
Rejected simulations remain explicit in denominators, never zero-goal
fictional matches. Each accepted game passes a full source replay.
Each shard logs its replay SHA-256, score/card/medical metrics and
one observed runner wall-time. There is no fabricated performance gate.

Four shard windows are 1..8, 9..16, 17..24 and 25..32. Each tests
seed 1..128. These hypothetical catalog fixtures are not real-RPL
reconstructions and their reused seeds are clustered. No licensed
reference-comparable xG, official cards or clinical-injury calibration
has been achieved. No 2024/25 holdout is examined. P3/P5 and M1 exit
stay OPEN; M2 remains prohibited.
