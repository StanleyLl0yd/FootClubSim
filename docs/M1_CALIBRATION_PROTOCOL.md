# Match engine M1 calibration protocol (defined during M0)

**Status: METHODOLOGY OWNER-APPROVED 2026-10-15 FOR THE M0 DESIGN CONTRACT under [ADR-0010](adr/0010-m0-final-acceptance.md); still a prospective measurement plan, NOT a passed realism benchmark.** As of 2026-10-15 the preliminary **synthetic shot-phase model exists**, but no legally approved external statistical benchmark dataset, threshold or empirical football realism acceptance has been established. Its internal measurements are permitted as **diagnostics only**, never as proof of calibration. This specification describes the later lawful evaluation process.

## M1 P5 internal diagnostics only (2026-10-15)

For transparent baseline-free engineering diagnostics, run \`npm run diagnose:m1\` (default 128 consecutive nonzero seeds), or \`npm run diagnose:m1 -- --count=10000 --first-seed=1\` for an explicitly larger **synthetic-only** cohort. The CLI builds the core locally before running. The bounded pure module \`src/core/m1-diagnostics.ts\` accepts 1..10000 unique seeds in the specified range and derives scores only from the authoritative simulated v3 shot-event ledger; it calculates actual local home/draw/away and 0-0 counts, per-match goals/shots/shots-on-target/xG means with uncertainty, shot conversion/Brier score and 10 xG buckets. Wilson intervals describe binary rates and sample-mean normal 95% intervals describe synthetic samples; these are **not** external calibration evidence. Low-count buckets (<30 shots) are explicitly marked. Empty buckets have null observed/predicted rates, not fabricated zeros.

The [Core CI smoke workflow](../.github/workflows/core.yml) checks a fixed 128-seed diagnostic in addition to unit tests. Neither that PASS nor a voluntarily executed 10,000-seed synthetic report approves probability realism: there is still **no rights-reviewed real football benchmark, no pre-registered target ranges, no balanced/mirrored scenario campaign, no held-out evaluation or actual completed M1-P5 calibration**. The generated JSON explicitly identifies itself as \`SYNTHETIC_INTERNAL_ONLY_NOT_CALIBRATED\` with \`NO_LICENSED_EXTERNAL_REFERENCE\`. Record an exact commit and CI/runtime separately before comparing runs.

## Paired-seed tactical sensitivity (2026-10-15)

The internal `runM1PairedTacticalDiagnostics` routine reuses **exactly the same seed and identical fixture/catalog/lineup/competition inputs** for each baseline/variant pair. Only valid tactical plans may differ. It reports per-seed variant-minus-baseline shifts in home shots/goals/xG, away shots, total goals, uncertainty intervals and the fraction of paired seeds with increased/tied/decreased home shot totals. No standalone final score is sampled and this does not represent football causation or external realism. CLI example: `npm run diagnose:m1 -- --count=10000 --paired-home-tempo=100`. A 64-seed paired smoke is added to CI; an internal diagnostic with a positive change does **not** establish true-to-life effect sizes or remove the owner requirement for licensed reference distributions, mirrored cohorts, held-out samples and pre-registered tolerances.

## M1 P5 deterministic negative-ledger campaign (2026-10-15)

`tests/m1-invariant-campaign.test.mjs` adds a reproducible **internal contract/fuzz corpus**, not a random external football dataset. It exercises a pinned set of nonzero seed boundaries (including `0xffffffff`), 80 additional fixed seeds for v5 score/event and exact 90-draw PRNG conservation, 16 substituted v5 fixtures with two-team active-player/bench eligibility and verified playing time, systematic invalid fields across sampled shot events (version, participant ID, time, sequence, xG, fatigue, zone, outcome and unknown extras) and 11 referee snapshot mutations. Every corrupt event should be rejected instead of silently affecting the official score or field availability. Initial M0 catalog and fixture inputs are verified unchanged.

This campaign **cannot certify sports realism, referee authenticity, an actual field distribution, the IFAB match laws beyond the source-limited implementations or production security**. Its deterministic corpus is intended to be expanded with independent hold-out reference cohorts and performance/constraint checks. P5 #31 and M1 exit #3 remain OPEN.

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

## M1 P5: v7 fixed-seed engineering cohort (2026-10-16, partial)

A new **isolated** `runM1V7SyntheticDiagnostics` covers v7 engine `'6'`, event schema 7, the original unchanged synthetic M0 pack and 1..10,000 sequential nonzero seeds. It reports home/draw/away and scoreless counts with 95% Wilson intervals, observed mean goals/shots/on-target/**open-play-only** xG and normal-approximation 95% mean intervals, plus separate totals of true synthetic open-play goals, externally forced penalties and own goals. The result contains explicit `NO_LICENSED_EXTERNAL_REFERENCE`, `refereeModel: NOT_GENERATED` and `SYNTHETIC_INTERNAL_ONLY_NOT_CALIBRATED` markers.

Manual CLI: `npm run diagnose:m1:v7 -- --count=1000 --first-seed=1`; optional `--forced-penalty` adds **one externally imposed successful penalty at exactly 300 seconds per fixture**, never an automatically generated offence, so it does **not** represent a football-wide penalty rate. The CLI appends the actually measured Node runtime/platform and elapsed milliseconds, and the CI commit SHA only if explicitly available. This extra execution block is excluded from the pure deterministic report comparison. No execution-time result or pass statistic has been invented.

CI tests use small fixed cohorts to check replay determinism, version/source metadata, Wilson/mean arithmetic, forced-penalty vs baseline seed pairing, score conservation and illegal plans. The Core workflow also executes a **32-seed live v7 CLI smoke**, prints the actual JSON aggregate/uncertainty output and fails if the diagnostics reject an invariant; retained CI logs are the evidence rather than invented results. A 10k scenario remains a **manual measurement** until machine resources and reference data are accepted. The source currently never generates random cards, medical withdrawals, fouls or awarded penalties. These **unimplemented rates are not presented as zeros or calibrated metrics**. This is NOT the full P5 10,000-seed real-football benchmark, independent heldout cohort, attribute sensitivity campaign, fuzz coverage or performance acceptance gate.

## M1 P5: v7 seeded mixed-event and adversarial replay corpus (2026-10-16, partial)

The v7-only `tests/m1-v7-invariant-campaign.test.mjs` runs 28 fixed seeds, including 32-bit boundary values, with one deliberately verified straight-red decision, one exogenous successful penalty and one exogenous own goal. It compares full deterministic replay, exactly 90 inherited PRNG draws, scorer/defender attribution, red-card eligibility, chronology, score conservation and unchanged source inputs. A separate mutation matrix attempts invalid versions, forged RNG state, altered goals/shots-on-target, removed/reordered events, unexpected event fields, changed referee evidence, malformed/sparse arrays and duplicate/colliding/out-of-order adjudications. Invalid cases are required to fail closed.

The deliberate referee incidents are a **test fixture**, not generated football incidents or calibrated card/penalty rates. This is a bounded regression and attack-input campaign only; it is not unbounded fuzzing, an independently licensed sporting comparison or a full performance/memory acceptance gate. M1-P5 and milestone exit remain OPEN.

## M1 P5 bounded v8 journal workload probe (2026-10-16)

Run `npm run diagnose:m1:v8:career -- --fixture-count=8 --first-seed=1` for a
small source-replayed journal test, or use `--fixture-count=240` for the entire
synthetic 16-club double-round-robin calendar. The dedicated CLI records
actual simulation, incremental single-apply replay/CAS-domain cost, final
full-history source verification, season-statistics derivation, serialized
journal bytes, RSS after execution and power-of-two intermediate samples.
The Core CI uses just **8 fixtures**, not a claimed 240-game completion.
The benchmark executes pure-domain transactions, not native IndexedDB or
real browser storage. Measured timings vary by machine and CI run and no
latency/memory acceptance threshold is yet approved. Medical and special-goal
samples are explicitly artificial unverified claims. The JSON carries
`SYNTHETIC_V8_WORKLOAD_ONLY_NOT_A_PERFORMANCE_GATE` and must not be cited as
real-match calibration, genuine quota testing or accepted release performance.

The same probe also accepts `--batch-size=N` (1..16, default 1). With
`--batch-size=8`, the 8 fixtures form one strict all-or-nothing validated
domain batch; full-source replay still runs at the transaction boundary and
every incoming fixture is individually verified. The Core CI records both
single-apply and 8-item batch measurements, without an acceptance threshold.
These are different transaction patterns, not a speed claim for identical
browser persistence behavior.
