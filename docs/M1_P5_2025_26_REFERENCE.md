# M1-P5: non-acceptance reference for 2025/26 Russian Premier League

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
