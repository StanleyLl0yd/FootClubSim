# M1-P5: observed home/draw/away balance from full source seasons

The already source-replayed deterministic `m1-v188-season-diversity.mjs`
creates a fixture tuple for every one of 240 league matches.
`summarizeM1P5ScorelineOutcomes` turns **exactly those final results**
into independently counted home victories, draws, away victories,
scoreless draws and home/away goals. It requires distinct fixture IDs
and valid whole-number scores, and rejects an inconsistency with each
team's source-derived final table draw totals. No regenerated parallel
match simulator, score adjustments, gameplay changes or save migration.

The result is emitted as `results[].outcomeTotals`, with 240-match
rates in `results[].perMatch`. Separate source-0 historical,
source-1 and v191 source-2 cohorts retain their explicit version
discriminators. The research report remains **NOT CALIBRATED**.
Home/draw/away population counts are arithmetically more directly
comparable to a completed 240-fixture real season than provider-specific
shot-on-target, injury or referee data, but four seeds cannot establish
a release confidence interval or a final RPL performance target.

See [P5 issue #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
and the [paired v191 census](M1_P5_V191_OBSERVED_COHORT.md).
The 2024/25 holdout is untouched, no provider match-level data is copied,
and M1 P5-1/P5-2 and exit #3 remain OPEN.
