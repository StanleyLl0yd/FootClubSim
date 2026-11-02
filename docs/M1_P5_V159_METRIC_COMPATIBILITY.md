# M1 P5 v159 — comparable metric contracts (research-only)

The observed full-calendar v155 cohort has **11,520** distinct synthetic
fixture/seed inputs, three experimental model variants and **34,560**
source-replayed model attempts. The separate published RPL 2025/26
Sport-Express and PerformanceOdds short factual aggregates **do not**
automatically share the experiment's goal and shot definitions.

`scripts/m1-p5-v159-compatibility-gate.mjs` validates the two existing
pinned research objects and makes the unresolved comparison boundary
executable: **nine named metric categories remain NOT COMPARABLE**.
It refuses changed source versions, 2024/25 substitution, fake
"calibrated" flags, mismatched model cohorts or impossible
shots/on-target/goal conservation. A numerically close value
does **not** change a compatibility status.

- Model goals are **open play only**; RPL published goals include
  penalty, set-piece and own-goal contributions.
- Provider `shots` and `on target` do not have a common
  demonstrated blocked/last-line taxonomy. Sport-Express lists
  5,548 attempts but PerformanceOdds 5,867 for the same season.
- Synthetic xG has no verified corresponding real RPL xG baseline.
- The v155 experimental shot cohort does not measure real
  comparable KDK sanctions, clinical injury withdrawals, penalties or
  independently held-out home/draw/away outcomes.

All publisher rights and original raw-source permissions remain
subject to separate scrutiny; no data is copied beyond the existing
limited, attributed aggregate facts. This is a **diagnostic gate**:
it does not grant any license, align metrics, tune model probabilities,
accept performance or open the separately reserved **2024/25 holdout**.
P5-1 remains OPEN, as do P5 5/P3 4, M1 and exit #3 with 0/2 full
repository-wide audits. P4 deferred, M2 prohibited.

Reproduce with Node 24 after dependency installation:

```bash
node --test tests/m1-p5-v159-compatibility-gate.test.mjs
node scripts/m1-p5-v159-compatibility-gate.mjs --summary
```

To progress P5-1 rather than accumulate research reports, identify
independently documented provider-specific exact event definitions
and provenance; introduce versioned simulator semantics for last-line
blocks, penalty/own-goal distinction and the missing disciplinary/
medical categories. Declare unsupported comparisons openly; freeze
lawful development reference populations and tolerances before any
final playable-engine tuning. Do not use 2024/25 match outcomes to
select those thresholds.
