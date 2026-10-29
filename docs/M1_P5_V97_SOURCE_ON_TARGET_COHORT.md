# M1 P5 v97 - exact source-replayed shots-on-target calibration cohort

This is an opt-in measured **source replay**, not simulated
new gameplay. It follows already merged PR #371 (v88), which
exposes the exact `sourceShotsOnTarget` counter from the
same v8 medical-physical-XI match which v29/v31 replay.

The cohort is frozen before results:
- 16 synthetic clubs, catalog seed 77 and the same complete 240-fixture
  double-round-robin calendar used in P5 v81/v87
- Eight distinct, SHA-256 fixture-domain-separated
  `[fixtureId, seedIndex]` pairs per fixture, 1920 attempts in total
- 16 GitHub Actions shards × 15 fixtures × 8 unique input seeds
- Unfiltered failed source replays with typed errors and denominators;
  16 full shard checks plus an exact rerun of shard zero
- Output includes all 240 fixture-level subtotals, deterministic digests,
  observed wall-clock times (NOT performance acceptance), source
  on-target/total shot/goals/xG counters, and conservation equations
- The model uses original v8, v29 and v88 physical + referee source,
  unchanged xorshift32-v1 and original seed-77 synthetic catalog;
  no invented shot events or unsupported medical/penalty awards

External reference for RPL 2025/26 (240 **real** games):
- **5548 shots = 23.1167/match**
- **1879 on target = 7.8292/match**
- **609 final-score goals, all types = 2.5375/match**
- independently sourced from [Sport-Express's 30-round RPL 2025/26
  statistics](https://www.sport-express.ru/football/n/russia/premier/2025-2026/statistics/common/)
  and pinned in `data/rpl-2025-26-p5-shot-discipline-reference.json`

Every fully replayed synthetic source outcome is required to satisfy
`0 <= openPlayGoals <= shotsOnTarget <= shots <= 18`,
nonnegative model xG and source-fixture/medical continuity.
Do not conflate model's open-play goals with reference's
*total* goals including penalties/own goals. Source shot event
definition and the publisher's blocked-shot/on-target methodology
are **not yet fully harmonized**; the output explicitly keeps
`shotDefinitionVerifiedAgainstPublisher:false`.

This new cohort can measure the model's real on-target count
without pretending it is a conversion-rate, injury or referee
authentication. It has no new event generator, no 2024/25
holdout analysis, no change to production RNG/probabilities,
M0 shell or career journal and no legal clinical/KDK admission.
P5 #31 remains OPEN pending full generated match calendar
calibration, tactical/attribute sensitivity, externally aligned
metrics, latency/memory/fuzz gates and holdout. P3 #29 OPEN,
P4 #30 deferred, two complete exit audits #3 required.
M1 OPEN, M2 prohibited.
