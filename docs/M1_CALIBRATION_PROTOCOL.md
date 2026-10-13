# Match engine M1 calibration protocol (defined during M0)

**Status: prospective measurement plan, not a passed realism benchmark.** As of 2026-10-13 there is no implemented match generator or legally approved statistical benchmark dataset. Any numeric results would be invented. This specification defines how M1 must produce and assess real measurements after implementation.

## Fixed, reproducible experiment

1. Freeze the exact `catalog.packId`, `catalog.packVersion`, engine version, ledger schema, rules-pack ID/version, tactical plans, fixture matrix and Node/browser runtime metadata.
2. For each scenario, run at least **10,000 independently seeded matches**. The M1 smoke-test subset may use 128 fixed seeds, but it is an invariant/replay test only and must never be advertised as statistical calibration.
3. Use deterministic seed assignment from a checked-in list or algorithm; persist each seed, match inputs and summary results. Never call `Math.random()` or wall-clock time inside the match engine.
4. Include balanced mirrored fixtures (same squads swap home/away) to separate home effects from roster-strength effects, and repeat tactical and attribute perturbations under paired seeds.
5. Allocate independent development/tuning seeds and holdout/evaluation seeds *before* tuning. Do not tune probabilities using the same holdout data that determines acceptance.
6. Report CI runtime and machine configuration separately. Performance requirements can be set only after collecting actual baseline measurements.

## Metric definitions

| Metric | Numerator / interpretation | Checks |
| --- | --- | --- |
| Goals per match | Total validated goals divided by completed fixtures | Sum of both teams' ledger-derived scores |
| Draw rate | Equal-score completed fixtures / all completed fixtures | Include 0-0 separately |
| Home win / away win | Respective victories / all completed fixtures | Three outcomes sum to 1 |
| Shots per club-match | Validated `shot` events / team appearances | On-target shots are a subset |
| Shots on target | Goals plus saved on-target shots / club-match | Cannot exceed shots |
| xG per match | Sum of pre-outcome `xgMilli` / 1000 | No independent post-score random xG |
| Shot conversion | Goals / shots (also per zone and shot-quality band) | No zero-denominator claims |
| Cards | Yellow/red events / completed fixtures | Not evaluated until card events exist |
| Injuries | New injury events per 1000 player-match minutes | Not evaluated until minutes/injuries exist |
| Possession/phase flow | Resolved possessions, transitions and entries | Not evaluated until event model exists |
| Tactical sensitivity | Paired-seed change from perturbing tactics | Show sign, spread, uncertainty |
| Player-rating sensitivity | Paired-seed change with only one modeled attribute modified | Show sign, spread, uncertainty |
| Deterministic replay | Identical versioned input + seed reproduces identical canonical events and report | 100% equality expected |
| Illegal-match safety | Invalid roster, fixture, version, event or numeric input rejected | 100% rejection expected for supplied negative cases |

No events = no metric. A missing injury model must be reported as *not implemented*, not as zero injuries. Abandoned/error fixtures require separate handling and are excluded from completed-match rate denominators with a recorded reason.

## Uncertainty and acceptance

- For binary rates (draw/home win/on target), report a 95% Wilson confidence interval, sample size and denominator.
- For goals, shots, xG and other means, report mean, standard deviation, median and a 95% interval (bootstrap, with a fixed resampling seed and disclosed method; or an explicitly justified analytical alternative).
- For shot xG quality, report Brier score and reliability buckets for observed conversion vs predicted probability, with a minimum count per bucket. Do not report empty/small buckets as calibrated.
- A specific reference distribution must have source, date, licensed use scope and documented extraction method in a **separate rights-reviewed reference manifest**, not copied from unlicensed repositories.
- Register target ranges, uncertainty treatment and permitted deviations **before tuning**, using independently licensed official/other credible aggregates. No hard-coded target scores or post-hoc thresholds.
- If permission is absent or a reference is unverified, publish only synthetic self-consistency, directional sensitivity and confidence intervals; the external realism gate remains **BLOCKED**.
- A CI job must fail on broken determinism, invalid probabilities, mismatched ledger/report totals or numerical non-finiteness. An unknown reference does not magically make realism pass.

## Model invariants and M1 regression strategy

Run table-driven tests for: score 0-0, late goal, penalties, own goals, red cards, substitutions, no bench, injuries, foreigner limit after every substitution, interrupted/invalid fixture and reapplication of the same match. Preserve a baseline golden fixture at the current engine version; a change in version must explicitly generate a new baseline with human review, not silently overwrite historical expectations.

Test `xG=0..1` per shot, `0 <= goals <= shots` for regular goals (with distinct own-goal accounting), `onTarget <= shots`, monotone virtual time and finite bounded player/team post-match deltas. Property tests may vary synthetic seeds and valid tactics, but must never assume a preferred final score.

## Baseline sources and rights gate

- Official RFU/RPL regulations verify **competition rules**, not empirical distributions. [Verified RPL regulations](RPL_2026_27_RULES.md) are not a license to bundle match reports.
- Aggregate match statistics may come from licensed providers or primary reports only after review of collection, extraction, redistribution and use rights per [DATA_SOURCES.md](DATA_SOURCES.md).
- Transfermarkt scraping or copying third-party football-manager ratings is prohibited without permission.
- Do not publish raw provider data or copied protected assets in the public repository unless distribution rights are recorded.

## Reproducible output checklist

Each published calibration run must record: source commit SHA, scenario/config ID, catalog and rules pack version, engine and PRNG version, seed plan/hash, number of valid fixtures and exclusions, full metric/CI table, property failures, performance/runtime/OS, rights-reviewed benchmark reference and exact pass/fail thresholds. A report without those fields is **diagnostic**, not milestone acceptance.

**M1 exit gate:** A completed comparison and calibration evidence is required before [M1 exit audit #3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) can pass. Defining the method in M0 does not establish that the current simulation is realistic.
