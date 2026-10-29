# M1 P5 v90 - opt-in multi-opportunity research, not a game engine change

The current v8 source calls `computeM1V5PhaseShot` **at most
once per five-minute checkpoint**, with exactly 18 checkpoints in a
90-minute game. This hard caps the generated open-play source
at **18 shots/match**, before any probabilities, fitness or referee
decisions are considered. The independent RPL 2025/26 observed
benchmark is **5548 shots / 240 matches = 23.1167
shots/match** (Sport-Express). The current schema cannot attain
even that average, regardless of choosing a chance probability
of 100%. This is a **structural impossibility**, not a parameter
tuning error.

Moreover, the frozen balanced v81 source corpus recorded 4899
final open-play goals from 24511 source shots over 3840
match-seed outcomes. Its descriptive **goals/source-shot ratio
was 0.19987**, while real 2025/26 total-score goals divided by
published attempts is 609/5548 = **0.10977**. The two ratios
do not have fully aligned special-goal, penalty/shot and keeper
taxonomies, so they are not equivalent real conversion rates.
Nevertheless, simply quadrupling opportunities without adjusting
chance quality would likely create *too many* goals.

v90 tests this joint frequency-versus-quality constraint without
altering the actual game. It calls the **unchanged public v5
`computeM1V5PhaseShot` function** 1, 2, 3 or 4 times at each
of the original 18 five-minute checkpoints, advancing the
existing authorized player-control clock exactly once per
checkpoint. It records aggregate shots, on-target shots,
source open-play goals, xG milli, home/away metrics, and
continued game PRNG draws. A mandatory same-source test checks
that mode `1` is **byte-for-byte numerically equivalent** to
`simulateM1V5Phases` with no substitutions. Modes 2–4
are *research counterfactuals only*, and are not converted into
M1 v8 events.

The registered experiment uses 16 seeded shards covering all
240 balanced double-round-robin fixture positions, 8 distinct
fixture-index SHA-256-mapped seed pairs each, and all four
density modes evaluated on exactly the **same prematch, seed
and tactics**. Every shard has 120 paired seed cases × 4 modes
= 480 research runs. That totals **1920 source input
pairs and 7680 counterfactual runs**, with source failures
retained in all denominators and a deterministic digest.
The first shard repeats the entire run to verify parity
independently of wall-clock performance.

**Important limitations:** this only considers unchanged starting
XIs and original tactical state with no substitutions, medical
actions, referee decisions, penalties or own goals. A candidate
additional shot has no authenticated intermediate in-play
second, physical presence, restart, referee origin or stable
schema-6 event ID. The result explicitly says
`canPersistInV76CareerJournal:false` and
`sourceMatchReplayOrPersistenceClaimed:false`. It is
neither a new playable match generator nor a lawful basis for
bypassing the v76 gate. The existing M0, v5/v8, PRNG,
match clock and journals are unchanged.

For an actual new game engine to close P3/P5, a separately
versioned intraphase event source must be implemented,
including physical actor presence, substitutions, referee
and medical chronological ordering, distinct RNG draws,
source replay, trusted special-goal attribution, and
complete durable CAS integration. Frequency and shot-quality
parameters should then be tuned *jointly* against independent
real-world attempts, goals, on-target counts and sanctions,
with the untouched 2024/25 holdout used only after tuning.

P5 #31 OPEN, P3 #29 OPEN, P4 #30 deferred, M1 OPEN,
M2 prohibited and two full repository-wide exit audits #3
not yet completed.
