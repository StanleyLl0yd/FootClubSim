# M1 P5: paired medical-counterfactual diagnostic for event schema 8

**Experimental 2026-10-16. No statistical calibration accepted.**

`src/core/m1-v8-medical-diagnostics.ts` compares two synthetic engine-7,
schema-8 matches for **each identical seed**: no temporary medical departure
versus a predeclared fixed treatment-exit/return sequence. Rules, fixture,
catalog, staff policy and other inputs are held fixed. Both executions use
90 RNG draws with identical final RNG states. Changed shots, scoreline and
paired changes in goals, shots and open-play xG are measured, not prescribed.

The report includes deterministic seed boundaries, sample size, version,
source catalog, per-seed paired mean deltas with normal-approximate 95%
intervals, and Wilson 95% intervals for changed shot-ledger and scoreline
frequencies. A singleton cohort has null uncertainty on means.

Run after `npm run build:core`:

```sh
node scripts/m1-v8-medical-diagnostics.mjs --count=32 --first-seed=1
```

Or run `npm run diagnose:m1:v8 -- --count=10000 --first-seed=1`
for a bounded larger synthetic cohort. Runtime metadata is observational,
not a predefined throughput gate. CI runs the smaller 32-seed smoke.

**Critical limits:** fixed medically absent time is an exogenous artificial
scenario, **not** a sampled or verified distribution of injuries. No
licensed external match benchmark or preregistered realism tolerance is
supplied. Input referee restart and signal assertions remain unauthenticated.
An interval around an internal synthetic paired difference does not prove
realism or an accepted effect size. Do not infer incidence of treatment,
serious injuries, substitutions, missed minutes, or real refereeing outcomes.
Not a full M1 P3/P4/P5 exit, not complete competition-law implementation,
and not permission for M2. M0/v3-v7 saves are unchanged.
