# M1 P5: bounded v29 causal medical source replay

**2026-10-21. Synthetic engineering regression only. No clinical
incidence estimate, independent treatment authorization or calibrated
football realism.**

The independent v29 simulator in
`src/core/m1-v29-causal-medical.ts` now has a bounded seeded workload
in `scripts/m1-v29-causal-corpus.mjs`:

```sh
npm run build:core
node scripts/m1-v29-causal-corpus.mjs --start=1 --count=12 --fixtures=3
```

A manual [GitHub Actions workflow](../.github/workflows/m1-p5-v29-causal-medical.yml)
accepts only bounded positive seed and fixture counts (1..128 seeds,
1..32 fixtures) for at most **4096 seeded fixture/seed attempts**.
It logs exact source version, accepted and typed rejected cases,
per-fixture completeness, generated foul stop counts, modelled on-field
(legacy `on-field-quick` tag) and temporary off-field assessments,
return/exit counts,
score sums, one observed CI wall time and a SHA-256 of the
deterministic, source-derived observations.

For each supported run the workload replays v29 from exact inputs;
checks 90 match RNG, 90 referee RNG and 54 medical RNG draws; binds
physical presence at the whistle, offender decision, whistle/restart
sequence and actual temporary off-field exit/return events; verifies
300 simulated running seconds for off-field returns; and rejects
unexpected error classes or incomplete fixture coverage.

**Measurement interpretation:** fixed synthetic medical trigger values
and branch selection are uncalibrated parameters. A treatment record
does not prove a true injury; patient identity is internally generated,
not certified by any external clinician or league referee. A
regression SHA-256 is a reproducibility fingerprint, **not** a
signature. Reported proportions are not incidence rates per real
player-minute. Unsupported incidents are explicitly counted as typed
rejections, never silently omitted. All reference/authentication
booleans remain false.

This is separate from the previously completed v24 32 × 128 engineering
corpus. No v29 maximum hosted run has been claimed before that exact
workflow executes successfully. No official source bytes are
ingested; no commercial data purchase or external network API is
needed. P3 #29, P5 #31 and M1 exit #3 remain OPEN, M2 prohibited.
