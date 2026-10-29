# M1 P5 v102 - measured joint shot, target and goal gap (not calibration)

## Immutable evidence

- Source: [PR #378 v100](https://github.com/StanleyLl0yd/FootClubSim/pull/378), exact source head `b592971ef103cf23e0db1459ad2fb604125ef2ee`.
- [GitHub Actions source run 40945616709](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/40945616709), all 16 source-v99 research jobs SUCCESS.
- Frozen per-shard counts and source replay SHA-256 digests: `data/m1-p5-v102-v100-shard-evidence.json`. These were extracted from the 16 **completed original job logs**, not estimated from the model equations.
- 240 synthetic fixture positions × 8 fixture-domain-separated deterministic seeds = 1,920 attempted, **1,920 accepted**, zero rejected. 18 tactical phases × 3 fixed 100-second shot slots = 270 RNG draws per match. This is **source schema 99**, not schema 101 or the production match source.
- Reference: `data/rpl-2025-26-p5-shot-discipline-reference.json` with 240 real RPL 2025/26 games, 5,548 attempts, 1,879 on target, 609 final-score goals (all types). Original [Sport-Express 30-round totals](https://www.sport-express.ru/football/n/russia/premier/2025-2026/statistics/common/). Short numerical facts only; no provider match-level feed embedded.

| Metric | Source-v99 model total, 1,920 simulated matches | Model / match | RPL 2025/26 / match |
| --- | ---: | ---: | ---: |
| Shot attempts | 41,238 | 21.4781 | 23.1167 |
| On target | 21,023 | 10.9495 | 7.8292 |
| Goals | 7,535 open-play | 3.9245 open-play | 2.5375 all types |
| Synthetic xG | 7,539.757 | 3.9270 | **not available** |

Synthetic outcome conservation: **7,535 goals + 13,488 saved + 9,037 blocked + 11,178 off-target = 41,238 attempts**; on target = goals + saved = 21,023. 1,537 / 1,920 matches exceeded the old 18-shot ceiling; max observed 37 shots. The new maximum possible is 54.

## Interpretation for the next calibration experiment

Measured **shot attempts are about 7.1% below** the primary publisher's season average, while the model reports **about 39.9% more on-target events per match**. Model on-target share is approximately **51.0%**, versus the publisher's **33.9%**; do not hide this through a shots-only frequency change. The model's **open-play-only** goals per match already exceed the observed real **all-types** goal average by about **54.7%**, despite omitting synthetic penalties and own goals. This is a warning of excessive goal outcomes, **not** a formally aligned like-for-like conversion rate.

A future source-versioned candidate must **jointly** vary shot opportunity frequency, on-target classification and finishing / goal probabilities, report all three measured outputs and seeded uncertainty, and measure tactical and roster sensitivity. Candidate selection must be fixed on development evidence *before* any use of the reserved 2024/25 holdout. Mere ratio scaling, post-hoc labels or hypothetical shots that cannot replay are not acceptable. The 2025/26 reference is the pinned development benchmark; 2024/25 remains untouched.

Limitations: publisher and model definitions for blocked shots and on-target attempts are not yet harmonized, real xG is unavailable, and real total goals include penalties/own goals. The v99/v101 experimental sources do not establish authenticated referee/medical decisions, arbitrary-second live physical transitions, durable career CAS or release-quality football realism. This evidence records a **measured failure / calibration target**, never a calibrated PASS.

## Reproduction and regression

```bash
npm ci
npm run build:core
node --test tests/m1-p5-v102-*.test.mjs
node scripts/m1-p5-v102-joint-gap.mjs --summary
node scripts/m1-p5-v102-joint-gap.mjs --replay
```

`--summary` computes the ratios from pinned evidence without a new simulation. `--replay` executes all 16 source-v100 cohorts again with the original seeds and requires every shard SHA-256 digest, shard counts and all aggregate fields to match exactly. It does **not** access the external holdout or accept calibration. Preserve the original source-v100 job logs as primary immutable evidence.

P5 #31 and P3 #29 remain OPEN. M1 OPEN, M2 prohibited, P4 #30 deferred. M1 exit audit #3 still requires **two complete repository-wide passes** before acceptance.
