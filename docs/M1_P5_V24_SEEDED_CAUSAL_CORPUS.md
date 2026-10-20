# M1 P5: v24 deterministic source-causal stress corpus

**20 October 2026. Developer diagnostic only; not RPL statistical
calibration or a match-accuracy/quality gate.**

Run after dependency installation:

```bash
npm run diagnose:m1:v24 -- --start=1 --count=24
npm run diagnose:m1:v24 -- --start=1 --count=24 --fixtures=8
```

The command compiles the headless core and executes a **strictly bounded**
cohort of 1–128 positive 32-bit xorshift seeds across the first 1–32
fixtures of a fixed synthetic RPL-scale catalog's generated league schedule.
`--fixtures` defaults to 1 for the original single-fixture diagnostic.
The total is bounded at 4,096 synthetic match attempts (128 × 32). It invokes the **current, single-source**
v24 physical-exposure derivation, including generated v23 referee,
synthetic treatment, coach-ready physical XI, and v8 shot outcome.

Each accepted fixture is independently replay-verified against its own
prematch/seed/policy. The diagnostic rejects score/exposure
inconsistencies, non-finite or out-of-range seed requests, unexpected
typed source errors, invalid draw budgets (90 v8, 90 referee, 54
medical) and absence of any accepted seed. Known fail-closed unsupported
source cases are counted as rejected **without rewriting them into a
zero-goal match**.

Machine-readable schema-2 JSON contains: seed/fixture cohort bounds,
per-fixture accepted/rejected counts and stable fixture IDs, combined
attempt/acceptance/rejection totals, typed rejection counts, generated
synthetic foul/treatment and goal counts, accumulated physical player
seconds, and a deterministic
SHA-256 fingerprint over source-derived (fixture ID, seed) summaries.
The digest is a **regression fingerprint**, not a referee signature,
data-license proof or cryptographic authentication of real events.
Each selected fixture must have at least one accepted seed; otherwise the
entire run fails closed rather than hiding missing fixture coverage. This
widens ENGINEERING regression coverage, not football-quality evidence.
The CLI intentionally produces a single structured stdout object; on
invalid options it returns nonzero with a stable diagnostic error.

**Do not treat** any percentage from this corpus as empirical model
accuracy, RPL injury/foul rates or a calibrated result; all fixtures
and causal events are internally generated. No free real-world source
is imported or paid data purchased. P5 source/license policy remains
[free-only](M1_P5_FREE_SOURCES_DECISION.md), with real RPL
calibration still blocked. This work establishes a reproducible
engineering test surface for the v23/v24 chain only.

No versioned engine, M0 shell, career journal, browser persistence or
public GUI was changed. P3 #29, P4 #30, P5 #31 and exit #3 remain
open; full two-pass repository audit is still required before M2.
