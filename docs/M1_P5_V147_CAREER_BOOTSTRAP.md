# M1 P5 v147 — observed whole-career bootstrap (exploratory)

Read-only analysis of the eight original v141 CI source records, pinned in
v143 with exact job-line SHA-256 digests. The CLI reads only the repository's
v143 JSONL/manifest and fails closed if any original record line, ordering,
declared run, cohort count or digest has changed. This **does not** independently
authenticate GitHub job provenance: original run #41353522380 remains the
separately reviewed external evidence.

Run `node scripts/m1-p5-v147-career-bootstrap.mjs`. The output is a
deterministic 4096-replicate nonparametric percentile bootstrap of **64 whole
independent careers**; it deliberately keeps each seed's four correlated
fixtures together and reports 12 separate metric means and exploratory
intervals. The bootstrap RNG is domain-separated from, and never advances,
the actual football simulator's PRNG. Exact fixture outcomes and historical
results are neither reproduced nor optimized for.

Percentile 95% is a nominal exploratory interval, **not a finite-sample
coverage guarantee** or proof of realistic football. Publisher definitions of
shot attempts, on-target blocks, total goals, referee decisions and injuries
remain unaligned, so there is no external distributional acceptance. The
model's disciplinary and injury events are fictional; real xG and verified
medical provenance are absent. The sealed 2024/25 holdout is not accessed.

No engine, probability, UI, saved schema, M0/v8 journal, rules or P4/M2
functionality changes. P3 #29, P5 #31, M1 and exit audit #3 remain OPEN.
