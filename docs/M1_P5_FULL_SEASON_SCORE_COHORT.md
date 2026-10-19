# M1 P5: complete-fixture synthetic score diagnosis, development only

**19 October 2026 - source-labelled diagnostic, NOT football realism
calibration or P5 acceptance.**

We already have an evidence-corrected, SHA-pinned **240-match Russian
Premier League 2023/24** result source under the publisher's CC0 claim,
[described here](M1_P5_OPENFOOTBALL_2023_24_REPAIR.md). The empirical
reference observes 113 home wins, 66 draws, 61 away wins, 20 scoreless
draws and 359 + 278 = **637 total goals**.

`scripts/m1-p5-score-cohort.mjs` runs the **unchanged isolated M1 v8
headless match engine** across the complete 240-fixture synthetic
16-club double round robin for a bounded reproducible sequence of
1..8 seasons. It verifies all fixture IDs are unique, each match has
exactly 90 original phase RNG draws, and that no unmodelled synthetic
penalties or own goals slipped into this **zero-adjudication scenario**.
Its score/outcome summary has an SHA-256 over all fixture/seed/score/RNG
observations. The original synthetic parody catalog is never mistaken
for a licensed real 2023/24 or 2026/27 roster.

Example after `npm run build:core`:

`node scripts/m1-p5-score-cohort.mjs --seasons=1 --first-seed=1`

The output compares descriptive rates to **2023/24 development season
only**. It deliberately does **not read, tune against or display 2024/25
holdout statistics**. The source data, season correction, and source
rights limitations are fully referenced, but an OpenFootball CC0
publisher declaration alone cannot certify each upstream right.

### Incomparability is the expected result

The real RPL 637 goals include scored penalties and own goals.
This v8 synthetic baseline generates **only open-play shots** without
automatic referee-awarded penalties, own goals, injuries or cards.
The reported `exploratoryDeltaPerMatch` is strictly **descriptive**.
It must not be used as an error bar, calibrated model pass/fail,
publication-quality confidence interval or hyperparameter objective
until the generator produces those missing event classes and the
reference matches source/event coverage. No arbitrary performance gate
or numerical tolerance has been approved.

CI unit tests verify source reference invariants, impossible aggregate
rejection, bounded seeds and one real complete **240-fixture synthetic
v8 cohort**. No result fixture is written to the browser journal,
and legacy M0/v3-v8 saves are unchanged.

Full P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
remains OPEN: lawful, independent RPL shots/xG/cards/injury references,
generated referee/medical events with verified rules, full statistical
calibration and an accepted holdout/test protocol are pending.
M1 exit #3 and M2 scope unchanged.
