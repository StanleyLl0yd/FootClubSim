# M1 P5 v79: preregistered final-score cohort vs RPL 2025/26 reference

**Purpose:** Measure genuinely comparable *final-score* synthetic
outcomes (home wins, draws, away wins, total goals, full-time 0:0)
without mistaking v74's open-play-only zero-goal counts for final 0:0.

The baseline is the already independent [v77 reference](../data/rpl-2025-26-p5-reference.json)
from Wikipedia revision 1380192814, corroborated by RSSSF:
240 RPL 2025/26 regular-season games, 609 all-type final-score goals,
109 home wins, 67 draws, 64 away wins and 15 final 0:0 results.
The 2024/25 holdout is not accessed.

**Cohort frozen before results:** reuse v74's previously preregistered
32 fixture positions 9..40 and numeric indices 1..128, but use the
dispersed SHA-256-derived **mapped** seeds (unchanged production
xorshift32-v1). Four fixture groups × four seed groups, each
8 fixtures × 32 indices, cover **4096** exact pairs once. These
are synthetic pairings from the fixed catalog seed 77, not real 2025/26
rosters. No RNG or probability calibration/tuning is performed.

Each generated v31 match is fully source-replayed before its final
score is counted. Report accepted/rejected, typed rejection reasons,
goals, home/draw/away results, full-time 0:0, source shots and
modelled permanent medical withdrawals separately. No outcome-based
filtering: failed runs stay in attempted and rejected denominators.
Per-fixture strata and SHA-256 deterministic digests accompany the
aggregate. The first shard is rerun; deterministic fields must be
byte-identical after excluding resource/timing observations.
Wall time and heap delta are measured, **not** performance pass gates.

**Scope:** Full source score can include v31 modelled special goals;
the synthetic source event generator's coverage of all real-world
scoring situations is not yet validated. Synthetic fixture/roster/seed
observations are dependent, so raw match-level confidence intervals
must not be treated as independent real RPL samples. The comparison
against one actual season is descriptive. No accepted tolerances,
cluster-adjusted statistical inference, clinical injury reference
or official referee/KDK control has yet been certified. No automatic
realism PASS should follow a superficially close aggregate.

**Acceptance for v79 research only:** every attempted pair represented,
replay/conservation checks pass, no duplicate/missing pairs,
deterministic digest repeat. Release-level P5 #31 acceptance and the
two full repository-wide audits #3 remain OPEN. P3 #29 OPEN,
P4 #30 deferred, M1 OPEN, M2 prohibited.
