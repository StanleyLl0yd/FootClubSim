# M1 P5 v104 - reproducible joint probability candidates

This experiment is **not** release calibration. It introduces opt-in, source-versioned research settings for the shot opportunity rate, generated open-play xG and the saved-shot probability, with **all five original PRNG draws retained for every 100-second slot**. The historical v5/8/99/101/103 match sources, M0, production save formats and career CAS are unchanged. Only the research-only v104 caller supplies experimental parameters to a shared shot kernel.

## Frozen development input

- Pinned source baseline: v100 / v102, 240 fixture positions × 8 deterministic seeds = 1,920 accepted games. Original observations: 41,238 shots, 21,023 on target, 7,535 open-play goals and synthetic xG 7,539.757.
- Frozen 2025/26 development reference, Sport-Express: 240 games, 5,548 total shots, 1,879 on target, 609 final-score goals of *all* types.
- Do not invent a comparable accuracy denominator: ordinary blocks and last-line blocks are not distinguished by the model; the publisher's event taxonomy is not yet proven equal to Opta's. Real xG is unavailable, and the reference includes goals of types absent from v104.
- Original v100 fixtures and SHA-256 fixture-specific seeds are reused for paired comparisons; 2024/25 is a **sealed holdout**, not consulted when selecting these proposals.

## Predeclared candidates

| Case | Shot opportunity multiplier | Synthetic xG multiplier | Saved-shot probability multiplier |
| --- | ---: | ---: | ---: |
| baseline | 1.00 | 1.00 | 1.00 |
| candidateA | 1.08 | 0.62 | 0.72 |
| candidateB | 1.08 | 0.60 | 0.68 |

These are **predeclared research hypotheses**, not measured success or optimized production constants. The shot multiplier acts on the original bounded opportunity probability; the xG multiplier acts before the original xG bounds; the save multiplier changes only the saved/not-saved allocation after the goal probability. Each still uses the identical fixture, roster, tactics, RNG algorithm, seeded draw stream and chronological shot slots. Original behavior is selected whenever research settings are absent. Invalid, nonfinite or extra parameters are rejected at the v104 boundary.

The CLI and matrix workflow replay all **16 shards** and require exact v99 baseline event, RNG and report parity **for every source game**. Each shard independently checks its baseline counts against the frozen successful v100/v102 research evidence, and emits complete per-candidate outcome totals with a SHA-256 result digest. Inspect all successful shard logs, aggregate 1,920 matches per candidate, report model-vs-reference gaps and actual test/performance measurements before proposing any decision. Do not report CI SUCCESS or favorable parameters before the workflow actually finishes.

## Reproduce

```bash
npm ci
npm run build:core
node --test tests/m1-p5-v104-joint-candidate.test.mjs
node scripts/m1-p5-v104-joint-candidate-shard.mjs 0
```

The optional GitHub Actions `M1 P5 v104 joint candidate` workflow runs all 16 fixture groups. The baseline provides a source-identity regression rather than a new independent season. These experimental generators have no authenticated referee/medical inputs, no complete P3 event chronology, no penalties or own goals, no durable CAS admission and no real release-acceptance status.

P5 #31 and P3 #29 remain OPEN. M1 OPEN, M2 prohibited, P4 #30 deferred. The two full repository-wide exit audits #3 are still required.
