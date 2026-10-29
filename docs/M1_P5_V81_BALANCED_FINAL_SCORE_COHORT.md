# M1 P5 v81: full two-leg balanced final-score sensitivity

The v79 source-replayed 4096 cohort uses only fixture positions 9..40.
It is useful for goal, draw and final 0:0 frequencies but *cannot*
independently identify home-field advantage: the short prefix is not
a strength-balanced home/away schedule. Do not attribute its observed
away-win excess to the home coefficient alone.

**Before observing v81 outcomes**, preregister:
- Original untouched synthetic catalog seed 77 and its 16 clubs
- All **240** double-round-robin fixtures, *15 home and 15 away
  games per club*, 120 club pairs each with two mirror legs
- Each fixture × **16 identical SHA-256-dispersed mapped seed indices**
  1..16; exactly **3840** source-replayed full-time synthetic outcomes
- 16 fixed shards, each 15 consecutive fixtures × 16 seeds, one
  deterministic first-shard repeat
- Every failed replay remains attempted/rejected with reason, never
  filtered out to improve observed metrics

Extract v31 final-score goals (including their supported synthetic
goal types), home/draw/away classification, true final 0:0,
per-team goals, source shots and modelled medical withdrawals.
Each fixture row retains home/away club IDs so the mirrored legs can
be paired after full coverage. Validate original v77 external season
scope without reimporting real match rows. No production RNG or
source/saved schema modification; no 2024/25 holdout.

This sample *balances club strength and calendar home/away assignment*,
but reuses 16 RNG seeds across every match, and all 3840 outcomes are
not independent real league observations. Home/away evaluation still
needs club-pair clustering, uncertainty on the 240-match real reference,
external coverage and validated final-goal generation. Simple raw
percentage comparison alone is not a release pass. No clinical injury,
KDK/referee authenticity, trusted recovery or performance SLA follows
from this measurement.

**Research completion:** all 240 fixture × 16 seed pairs present;
full replay and conservation successful; reproducible deterministic
digest and no work stealing across shard ranges. Leave P5 #31 OPEN
until formal external statistical tolerance/holdout validation and
release performance are accepted. P3 #29 OPEN, P4 #30 deferred,
M1 OPEN, M2 prohibited, exit audits #3 require two full passes.
