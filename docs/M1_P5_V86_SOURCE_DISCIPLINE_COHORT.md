# M1 P5 v86 - predeclared full-calendar model discipline and foul research

After v85 adds actual RPL 2025/26 season aggregates for shots,
yellow/red cards, fouls and penalties, this opt-in study measures
the corresponding *available synthetic source counters*, rather than
deriving cards from scorelines or treating modelled injuries as real
medical records.

**Frozen before results**:
- Same 16-club synthetic catalog seed 77 as v81
- Every one of the 240 generated double-round-robin fixtures
- Eight independently mapped research seed indices **1..8** per
  fixture, using unchanged SHA-256 mapping and production
  xorshift32-v1, total **1920** attempted fixture-seed pairs
- 16 disjoint hosted shards × 15 fixtures × 8 mapped seeds
- Zero outcome filtering: all source rejects retained with typed
  reason; first shard rerun and deterministic digest compared
- No 2024/25 holdout access, no edits to game probabilities, M0 or
  persisted career/journal schemas

The versioned v31 source-replay output is authoritative for model
observations. The source's `playerRows` counts first yellows,
second-yellow dismissals, direct-red dismissals, permanent modelled
withdrawals, and the same referee source reports generated foul
stoppages. Every card count is cross-checked against the existing
source `sourceRefereeEffects` invariant; mismatches fail the shard.
The source `kind:'shot'` and open-play final-score counters are
recorded alongside them. This is distinct from hand-asserted,
externally authenticated IFAB/KDK authority.

Comparison reference:
[Sport-Express RPL 2025/26](https://www.sport-express.ru/football/n/russia/premier/2025-2026/statistics/common/),
240 games, **5548 real shot attempts**, 1879 on target,
**1035 yellow cards, 26 reds, 6815 fouls**, **99 penalties
recorded/76 scored**. The real totals are short factual fields,
versioned in `data/rpl-2025-26-p5-shot-discipline-reference.json`.

**Non-equivalences**:
- Model **generated foul stoppages** are a subset of the model's
  referee interventions, not all real football fouls. Do not compare
  their raw count directly to 6815 as an equivalent total.
- Model `firstYellowCards` and second-yellow dismissal events may
  differ from the publisher's exact definition of yellow cards;
  preserve both counters separately until aligned.
- Default v29 source explicitly reports
  `specialGoalsGenerated:false`. This is not a claim that separate
  confirmed-penalty or own-goal mechanisms do not exist elsewhere.
  **No penalties are invented** by this benchmark.
- Model shot-on-target is **unknown** at this v31 wrapper level,
  not zero. It must be reconstructed from source-consistent v8
  outcomes before matching the real on-target metric.
- Modelled medical withdrawals are not clinical injury diagnoses.

Research acceptance requires all 16 shards, correct unique fixture
coverage, exact replay and cardinality conservation, deterministic
digests and explicit failed-source denominators. This is **NOT**
realism/release acceptance. Independent confidence intervals,
tolerances, penalty generation, meaningful playing time and
cross-browser performance still remain.

P5 #31 OPEN, P3 #29 OPEN, P4 #30 deferred; M1 OPEN,
M2 prohibited. Exit audit #3 still requires two *full*
repository-wide passes.
