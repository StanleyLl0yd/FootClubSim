# M1 P5 v61: synthetic v29 versus independent RPL 2023/24

## Scope
We now have two concordant independent results publishers (v59/v60).
This v61 experiment describes the v29 synthetic score/outcome gaps
against the 2023/24 published full-season aggregates.

The comparator confirms both source reports, 240 complete games,
the same eight score totals, then checks the source-replayed v29
cohort, its fingerprint, accepted/rejected denominators and conservation.
It emits separate reference/model proportions, exploratory Wilson
95% intervals and unadjusted differences in home/draw/away/scoreless
outcomes plus the per-match mean goal discrepancy.

The synthetic engine generates only open-play goals while real scores
include all goal types. Reused fixed seeds and fixtures form clustered
observations, while accepted-only results can be selection biased.
Therefore these intervals are DESCRIPTIVE, not independent statistical
acceptance tests. No preregistered tolerances or holdout have been used.
No code is tuned in response to these measurements.

The scoped hosted PR workflow downloads both source snapshots only to
an ephemeral runner, verifies OpenFootball original SHA-256 before its
one source-evidenced in-memory correction, runs 12 seeds x 2 model
fixtures, records the comparison and deletes raw snapshots.

Unavailable: comparable xG/shot quality, full card coverage, clinically
authenticated injuries, external adjudication authority, verified
upstream source licensing. The 2024/25 holdout remains untouched.
P3/P5 and exit audit stay OPEN. M2 prohibited.
