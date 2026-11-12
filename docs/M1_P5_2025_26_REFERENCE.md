# M1-P5: non-acceptance reference for 2025/26 Russian Premier League
## Frozen P5-1 category boundary for the next final-engine evaluation

The existing attributed aggregate reference now records its metric categories
and a **broad 20% relative development tolerance for all-type goals only**.
This tolerance is frozen **before the next 10,000+ match final-source evaluation**;
it was **not** predeclared before the older four-seed v191 experiment and does
not retroactively validate that experiment. All other provider comparisons
(shots/on-target, xG, penalty awards/conversions, cautions, dismissals,
injury withdrawals and home/draw/away) explicitly remain **excluded**, not
assumed equivalent by matching column names or close numerical totals.

The existing cohort comparator now fails closed if this freeze is modified
without a corresponding explicit review. It reports goal comparability only
for `specialGoalSourceVersion:2`; it never treats excluded metric totals as
calibrated or accepted. The existing 2024/25 holdout remains unopened.
Limited public aggregate observations are attributed; underlying provider
records are not republished. **P5-1/P5-2 remain open pending the complete
metric-review, real cohort result and separate formal acceptance.**


**Development diagnostic only.** The sole purpose of `data/research/rpl-2025-26-aggregate-reference.json` is to freeze six explicitly sourced public aggregate observations before the next generation of FootClubSim match-engine tuning. No provider data tables, player records, photos, API credentials or database rights are bundled.

| Complete 240-match season | Observed real aggregate | Source |
| --- | ---: | --- |
| Goals | 609 | [Sportbox 2025/26 complete competition](https://news.sportbox.ru/Vidy_sporta/Futbol/Russia/premier_league/stats/turnir_23003) |
| Shots | 5,781 | [FBref 2025/26 squad shots, total of 16 club rows](https://fbref.com/en/comps/30/2025-2026/shooting/2025-2026-Russian-Premier-League-Stats) |
| Penalty attempts | 101 | Sportbox |
| Penalties converted | 77 | Sportbox |
| Yellow cautions | 1,024 | Sportbox |
| Red-card dismissals | 59 | Sportbox |

The definition of FBref shots **may differ** from the game's source-generated shot event or Sportbox penalty shots; there are differences between published providers for penalties and yellow cards, and direct-red plus second-yellow dismissal classifications require reconciliation. This year's 16 real clubs are **not** exactly the 2026/27 club composition. An aggregate observation is not a legal permission to ingest the underlying database, nor a frozen multi-year calibration target.

`scripts/m1-p5-cohort-comparison.mjs` consumes the already source-replayed **four independent complete v188 seasons** output by `scripts/m1-v188-season-diversity.mjs`. It checks seed uniqueness, 240-match scope, internal goal conservation and proper fictional provenance, and reports per-metric mean, min/max and relative difference with source URL. It explicitly returns **`DESCRIPTIVE_2025_26_COMPARISON_NOT_M1_P5_ACCEPTED`** and `releaseAccepted:false` even when results happen to resemble real aggregates. This should be used to determine priorities and whether shot frequency vs conversion is the dominant mismatch, not to auto-pass M1.

Before calibration acceptance: independently prove event-definition harmonization, rights to reuse any provider records, official source editions and time cutoffs, predeclare appropriate tolerances and cross-seed coverage, implement a new source-versioned calibrated playable model, and evaluate against a genuinely independent **unopened 2024/25 holdout** exactly once under a controlled protocol. The existing diagnostic does not access that holdout and does not decide or certify M1 or M2 readiness. #155 remains a final storage-release gate, not a current blocker on experimental saves.

## Between-seed uncertainty (descriptive only)

The comparator now reports `observedSeedMean95Interval` for every metric, a
95% two-sided Student-t interval over **complete, independently seeded
240-fixture fictional seasons** (4..32 seeds, sample standard error).
This estimates variability of the *synthetic seed sample* only. It does not
correct incompatible shot/card definitions, quantify uncertainty in the one
2025/26 reference season, establish realistic game-to-game distributions or
approve calibration thresholds. Four seeds have only three degrees of freedom;
report and compare the full range and mean as well. No holdout observations are
opened by the calculation.

## P5-1 acceptance evidence: selected published references and category boundary

This section freezes the **2025/26 development population of 240 played RPL
fixtures**, observed no later than `2026-11-10` in
`data/research/rpl-2025-26-aggregate-reference.json`. The current game
population is a different, fictional 2026/27 16-club league. Aggregates are
historical observations, **not** permission to redistribute underlying
provider match/player tables or a claim that the competitions have equal clubs.

| Frozen real metric | Named source / attributed event meaning | Comparison to current playable source |
| --- | --- | --- |
| 609 credited goals | Sportbox final 2025/26 competition aggregate; independently cross-checked against [Championnat's 240-match 609-goal table](https://www.championat.com/football/_russiapl/tournament/6594/) | **COMPARABLE** to source-2 all-type goals = open-play + scored penalties + own goals credited to the beneficiary; not equivalent to open-play-only goals |
| 5,781 shots | FBref 2025/26 16-club squad shooting aggregate: publisher-defined attempts, not proven equivalent to source-generated open-play attempt | **EXCLUDED** |
| 101 penalty attempts / 77 conversions | Sportbox same frozen season, official decision/attempt categories not proven identical to synthetic v190 decision rule | **EXCLUDED** |
| 1,024 cautions / 59 dismissals | Sportbox same frozen season; card, direct-red and second-yellow partitions and reporting differences not fully reconciled | **EXCLUDED** |
| Shots on target, saves, last-line blocks | No frozen matched provider event taxonomy or confirmed denominator | **EXCLUDED** |
| Full xG and medical injury events | No corresponding validated same-population xG/clinical incidence comparison | **EXCLUDED** |
| Home/draw/away | [Championnat's 109/67/64 reference was recorded on 2026-11-10](https://github.com/StanleyLl0yd/FootClubSim/issues/31#issuecomment-6770210903), before the 48-season run, but was not included in this comparator's original machine-readable reference or given predeclared numerical tolerances | **EXCLUDED** from formal numerical acceptance for this existing cohort; historical reference values remain descriptive |

**Provenance/rights boundary:** each selected metric's direct source URL is
recorded under `sourceByMetric` in the existing JSON; the reference file
records competition, edition, season, population, observation date and
known limitations. Only short attributed factual *aggregates* are stored.
No provider raw event database, fixture-by-fixture licensed table, player
records, images or source credentials are copied or redistributed. No
external data license or official medical/KDK authority is asserted.
Some linked provider pages may deny automated current retrieval; their
existing frozen observations are therefore not promoted into newly
authenticated raw evidence. The 609-goal total has the independent
attributed cross-check above.

**Frozen pre-fit limit:** only the all-type goal mean has an allowed broad
**±20% relative development envelope**, fixed by [#528](https://github.com/StanleyLl0yd/FootClubSim/pull/528)
*before* the new 48-career/11,520-match CI run. Every other unaligned
metric has an explicit `EXCLUDED` category and **no numerical pass**.
The result comparator rejects forged all-comparable claims, changed limit,
changed source version, and 2024/25 holdout access. These are sufficient
for the category/provenance freeze **P5-1 only**; P5-2 statistical
acceptance and the separate 2024/25 held-out protocol require the final
post-P3 engine and their own proof.
