# M1 P5 v154 — 240-fixture calendar, 11,520 fixed-seed research inputs

This is an opt-in and **unfiltered** full synthetic-calendar study of the
unchanged v104 baseline and two research candidates. The cohort covers all
240 double-round-robin synthetic fixtures from catalog seed 77, each with
48 SHA-256 fixture-domain-separated seed indices. Sixteen CI shards process
15 fixtures each, totaling **11,520 distinct fixture/seed inputs** and
**34,560 model-run attempts** (three cases per input). Attempted, accepted and
typed rejected outcomes remain separate for each case; no silent failure
filtering or selection of favorable winners.

Every successful result is independently folded from the original event
sequence and must verify against the source and PRNG, full-time 5,400-second
clock, 270 draws, goal/shot/on-target/open-play xG conservation, negative
replay of a forged event for the first seed of each fixture, and research-only
flags. The deterministic SHA-256 digest excludes observed timing and RSS, but
includes original accepted event streams, source reports and rejected errors.
Record exact original GitHub job IDs and log-derived SHA values only after
the sixteen shards complete. Aborting after five minutes or 1,024 MiB is an
operational runaway guard, **not** a validated production latency or memory
acceptance threshold.

The real-world 2025/26 RPL reference numbers are not merged into this
experiment: candidate v104 shots, open-play goals, generic blocks, synthetic
penalties and fictional injuries do not share established publisher-specific
taxonomy. No parameter tuning, training, benchmark threshold selection,
simulated-to-real individual score matching or untouched 2024/25 holdout
access. This is a P5 research increment, **not** a P5 acceptance gate.
Production RNG/probabilities, M0, v8 and saved journals are unchanged.
M1/P3/P5 remain OPEN; P4 deferred, M2 prohibited; two complete repository
exit audits #3 remain outstanding.

Reproduce after `npm ci && npm run build:core`:

```bash
node --test tests/m1-p5-v154-full-calendar-replay-fuzz.test.mjs
node scripts/m1-p5-v154-full-calendar-replay-fuzz.mjs 0
```
