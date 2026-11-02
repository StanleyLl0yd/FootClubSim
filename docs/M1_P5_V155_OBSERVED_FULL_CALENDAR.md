# M1 P5 v155 — pinned original full-calendar research rollups

Sixteen original successful jobs from
[Actions run #41413788321](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/41413788321),
all executing exact research PR head `034c74712cf9b23f5eec1a2829bdad9d1eabb166`,
were read directly from GitHub's job logs. Their exact
`V154_FULL_CALENDAR=` JSON outputs are represented as per-group observed
case counters, job IDs and independently reported source-run result SHA-256
fingerprints in `data/m1-p5-v155-observed-full-calendar.json`.
The **original logs** remain authoritative for job provenance and per-run
fingerprints: the repository manifest does **not** cryptographically
authenticate that GitHub originated those logs.

This freezes 240 synthetic double-round-robin fixtures × 48 deterministic
fixture-separated seeds = **11,520 unique source inputs**, evaluated against
three unchanged v104 research candidates = **34,560 accepted model runs**
with zero typed source rejections and **240/240 forged-event verifier
negative checks**. All 16 original jobs completed SUCCESS. The test checks
16 unique job IDs and digest values, all shard/model input denominators,
safe integer event totals, shots/on-target/goals conservation, aggregate
reconstruction and explicit non-acceptance/non-holdout flags.

Observed aggregate counts across 11,520 synthetic games per case:

| Case | Open-play goals | Shots | Model on target | Model xG |
|---|---:|---:|---:|---:|
| Baseline | 45,105 | 246,948 | 125,905 | 45,198.683 |
| Candidate A | 30,154 | 266,744 | 98,572 | 30,265.308 |
| Candidate B | 29,133 | 266,744 | 94,070 | 29,289.707 |

No real match outcome matching, no adjustment of simulation probabilities,
no use of the sealed 2024/25 holdout. Neither the synthetic on-target
taxonomy nor open-play-only goals are validated identical to provider-defined
real all-type goals or shots. This is **evidence preservation, not acceptance
of P5, production performance or calibration**. P3/P5/M1 remain OPEN;
exit audit #3 0/2, P4 deferred, M2 prohibited.

```bash
node --test tests/m1-p5-v155-observed-full-calendar.test.mjs
```
