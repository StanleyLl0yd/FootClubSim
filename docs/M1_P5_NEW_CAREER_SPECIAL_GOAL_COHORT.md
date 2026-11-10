# Experimental new-career special-goal cohort (M1/P5 open)

The original `scripts/m1-v188-season-diversity.mjs` defaults to the historical
v188 source and retains its previous exact output model. For the new playable
career source added in #513, invoke the same full-journal, source-replayed
season driver with `--special-goal-source=1`, which passes the
version discriminator for every fixture and rejects a mid-season fallback.

The separate CI workflow runs seeds 11, 41, 71 and 101 through **240 fixtures
each**, source-replays final journals and reconciles scored goals with
open-play, penalty and own-goal contributions. It records cards, shots,
fictional injury withdrawals, league orderings and per-seed totals in a
downloadable JSON artifact. Synthetic special goals remain **uncalibrated**:
the `0.26` penalty and `0.06` own-goal per-fixture probabilities are test
settings, not real-life estimates. No real match-level data is copied.

This extends the existing deterministic diversity census instead of creating
a second independent simulation pipeline. It does not alter the default game,
match source, legacy journal, backup, or user UI. Compare its output with the
historical v188 report and the source-labelled 2025/26 aggregate diagnostic
in #514, without treating different event taxonomies as identical. M1 P3/P5,
M2 and browser storage reliability #155 remain open. The 2024/25 holdout
remains unused.
