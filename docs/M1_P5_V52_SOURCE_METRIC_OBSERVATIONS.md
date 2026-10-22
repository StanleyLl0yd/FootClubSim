# M1 P5: source-replayed multi-metric observations (v52)

**Scope: synthetic regression, not football calibration.** Existing
`scripts/m1-v29-causal-corpus.mjs` reports, alongside the original
deterministic cohort fingerprint, a bounded `p5Observation` derived
from successful source-replayed v29 fixtures. No simulation behavior,
starting roster, historical event schema, RNG state, career save or
browser storage format is changed.

The observation includes home/draw/away/scoreless outcomes with Wilson
95% intervals; goals, timeline shots, internal yellow cards and
dismissals, modelled injury withdrawals and synthetic causal medical
assessments with sample mean and normal-approximation 95% intervals.
It uses only fully replayed matches as the denominator and separately
reports failed fixture/seed cases. This is **conditional on successful
source replay** and can be biased relative to all requested scenarios.
Normal intervals are statistical diagnostics, not proof of realism.

Unsupported coverage is explicit: v29 timeline does not expose the
underlying shot-level xG statistic in this diagnostic; clinical injury
diagnoses are absent; independent metric-compatible licensed RPL
reference sample, tolerance and pass result are `null` and
`UNAVAILABLE`. Open-play-only goal events do not cover generated
penalties/own goals. An in-game seeded referee decision is not an
external authenticated real-world official decision; a synthetic
medical assessment or permanent withdrawal is not a clinician's injury
diagnosis.

Example (after `npm run build:core`):

```sh
node scripts/m1-v29-causal-corpus.mjs --start=1 --count=16 --fixtures=8
```

The `p5Observation` is versioned separately within the backward
compatible schema-1 top-level corpus output. All values are derived
from the same replayed match; no extra random draws or reference
imports are introduced. Tests check conservation, intervals, explicit
missing-data classification, and byte-identical repeated JSON outputs.

**Still required for P5 closure:** pre-registered, independently
permitted metric-compatible reference(s), comparable injury/card/shot/xG
definitions where available, nontrivial tactical differential analysis,
agreed acceptance tolerances and performance/memory boundaries, and
the two full repository-wide M1 exit audits. This increment alone
cannot close #31 or #3. M2 remains prohibited.
