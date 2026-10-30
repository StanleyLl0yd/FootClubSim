# M1 P5 v108 - shot taxonomy uncertainty envelope

This research-only report derives categorical **model** counts from the already
pinned 16-shard/1920-match v106 evidence, using the independent v106 evidence
validator. It does **not** rerun, tune, resample, or change probabilities,
production RNG, historical match engines, M0 or persistent career formats.

## What is and is not measurable

The v104 simulator records four shot outcomes: `goal`, `saved`, `blocked`,
`off-target`. Its `blocked` category does not say whether a defender was the
last player between the ball and the goal. There is also no verified
goalkeeper-save actor in the model event. The model's `goal` is open-play only.

Under [Opta's published event definitions](https://theanalyst.com/articles/opta-football-stats-definitions)
and [Stats Perform's definition](https://optaplayerstats.statsperform.com/en_GB/opta-event-definitions),
a last-line defender block preventing a goal is a shot on target; ordinary
defender blocks are not. A shot rebounding off woodwork without entering the
goal is off target. **We have not verified that Sport-Express, Sportbox or
PerformanceOdds apply those precise definitions.** They must not be treated
as interchangeable Opta feeds.

The envelope reports the model's originally recorded on-target count
(`goal + saved`) alongside an *illustrative* maximum (`goal + saved +
all generic blocks`), as if every ambiguous block was by a last-line
defender. This is a **classification uncertainty range**, not a confidence
interval or proof of actual last-line blocks.

| Model source | Matches | Shots | Reported model on target | Generic blocked | Hypothetical upper on target |
| --- | ---: | ---: | ---: | ---: | ---: |
| v99 baseline | 1920 | 41238 | 21023 | 9037 | 30060 |
| v104 A | 1920 | 44584 | 16483 | 12552 | 29035 |
| v104 B | 1920 | 44584 | 15751 | 12870 | 28621 |

Sport-Express's separate **2025/26** aggregate (5548 shots and 1879 on
target in 240 matches, 609 goals of all types) stays descriptive only,
not a shared denominator or matched event taxonomy. Its penalty counts
99/76 and the separately observed Sportbox 101/77 remain unresolved;
neither is silently overwritten. Model open-play goals cannot be compared
as identical to real all-type goals. The untouched **2024/25 holdout must
remain unopened** until definition alignment and parameter/tolerance
pre-registration are frozen.

## Reproduce and boundaries

```bash
npm ci
node --test tests/m1-p5-v108-taxonomy-envelope.test.mjs
node scripts/m1-p5-v108-taxonomy-envelope.mjs --summary
```

No materialization of impossible simulated last-line events is performed.
Next steps: source-verified publisher-specific category definitions,
true model last-line/penalty/own-goal event separation, independent
event accounting, pre-registered thresholds, fuzz and performance gates.
P5 #31, P3 #29, M1 and exit audit #3 remain OPEN; P4 #30 deferred;
M2 prohibited.
