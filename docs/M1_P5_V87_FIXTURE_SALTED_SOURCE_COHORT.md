# M1 P5 v87 - fixture-domain-separated research seed sensitivity

The existing v86 P5 cohort is **source replay correct** and its exact-head CI
was 26/26 PASS, including 16/16 referee source shards. However, a deep
inspection of all 240 fixture-level rows of [workflow 40913042747](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/40913042747)
identified a confounding design choice: **exactly the same 8 research seeds
were reused for every synthetic fixture**. Consequently, despite different
teams, the model referee aggregate was **exactly identical for all 240
fixtures**:

| Eight matches per fixture | Value for each of 240 fixtures |
|---|---:|
| First yellow cards | 24 |
| Second-yellow dismissals | 1 |
| Straight-red dismissals | 4 |
| Generated foul stoppages | 29 |
| Generated referee incidents | 30 |
| Modelled permanent medical withdrawals | 1 |

Totals 1,920 source games: 12,207 shot events, 3,203 open-play goals,
5,760 first yellows, 240 second-yellow and 960 straight-red
dismissals, 6,960 generated foul stoppages and 240 modelled
withdrawals. These are true deterministic outputs, **not 1,920
statistically independent discipline samples**. They cannot be
treated as robust league-wide rate estimates. V86 remains an honest
fixed-seed reproducibility diagnostic, not formal calibration.

V87 performs a predeclared independent sensitivity experiment on
**exactly the same 240 fixture identities × 8 seed indices**. For
each unique `[fixtureId, index]`, generate a domain-separated,
nonzero 32-bit integer from SHA-256 with tag
`FootClubSim-P5-v87-fixture-seed`; reject duplicate mappings
within a shard. This is a **research-input mapping**, not a change
to the xorshift32-v1 match engine or saved career/journal data.
The existing v31 source-replayed match, referee, physical-player,
foul and medical conservation invariants still apply. Source
denials remain in the denominator.

Sixteen GitHub Actions shards each examine 15 fixture positions ×
8 fixture-specific seeds, with a first-shard repeat digest check.
The special-goal omission, source-licensed RPL metrics, referee
authority and definitional non-equivalences remain exactly as in
v86. Both v86 and v87 data will be retained, not selectively
discarded when results disagree.

Acceptance for this research: exact-head CI, all 1,920
source-replayed attempts fully accounted for, 240 unique fixtures,
unambiguous digests, genuine variation of fixture-level referee
totals, and bounded runtime. Merely matching real RPL 2025/26
averages is **not** sufficient for statistical release acceptance.

Only after v87 results should P5 re-estimate baseline card/red
frequency and decide whether referee event generation is actually
wrong or the earlier 8-seed subset is biased. Model probabilities,
production RNG and save schemas remain unchanged. Independent
external real RPL shot/card/penalty references are pinned in v85;
2024/25 holdout remains unused.

P3 #29 OPEN, P5 #31 OPEN, P4 #30 deferred, M1 OPEN,
M2 prohibited, two whole-repository audit passes #3 outstanding.
