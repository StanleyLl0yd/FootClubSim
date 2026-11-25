# M1 P2: paired playable-source tactical sensitivity (development evidence)

The dedicated test `tests/m1-v188-p2-paired-tactics.test.mjs` executes the
**actual v188 two-team career match generator** and full revision-bound
`applyM1V188LeagueMatch`, not a v5/v57 research-only simulator.

It constructs 12 independently seeded first-fixture careers and pairs two
authorized selected-club tactical plans (tempo 0 versus 100), preserving the
same fixture, source roster, formation, opponent tactics, historical journal,
PRNG seed with current playable medical source v5 and v191 special-goal source version 2. Each proposal is
admitted to an independent journal without editing the common prior state.
The paired aggregate checks that higher tempo increases own-team source
shots and open-play-only xG and changes event streams for at least half the
seeds. It also source-replays both saved alternatives for the first seed.
No single fixture result or victory is required.

The test is a **directional functional invariant**, not real-football
calibration, a release benchmark, or a substitute for P5's 10,000-game
final-engine cohorts and independent held-out validation. It does not
claim medical/referee/KDK authenticity, clinical clearance, or external
data rights. All 2024/25 holdout files remain sealed; original career pack
and historical persisted fixtures are unchanged.

Do not mark P2 or M1 accepted before exact-head and exact-main CI,
cross-module review and the remaining P1/P2 gate assessment. P3/P5,
M1 exit #3 and M2/release restrictions remain in force.

## P5-2 paired player-attribute sensitivity gate (same playable source)

The companion P5-2 test in the **existing** v188 paired-tactics suite
uses the same 12 predetermined seed values and the same source-2
special-goal and source-v5 medical generators used in current playable
careers. Instead of changing a tactical slider, its pair changes only
the selected synthetic club's `finishing`, `composure` and
`offBallMovement` skills from 35 to 75, preserving the canonical club IDs,
fixture, player IDs, seeded RNG, fixed selected XI, tactical plans and
unmodified opposing club. Both variants must be valid source-replayed
journal commits; at least half their event streams must change.
The stronger attacking-skill group must improve aggregate **open-play
xG by more than 5%** across the original 12 fixture/seed pairs. This is a
**predeclared mechanical directional sensitivity threshold**, not a
licensed provider effect or historical model calibration.

This validates player *attribute response*, not external player
ratings, physical fitness, calibrated match-score prediction or
the sealed 2024/25 holdout. All P5-2 final model/metric prerequisite
gates remain independent.

## Default preview configuration evidence (2026-11-25, pending execution)

Retain the original 12-seed paired tests and run their same predeclared
thresholds again with the fixed Liga Prikolov preview catalog (seed 2026),
medical v5, special-goal source 2 and fictional calendar v2. The new
attribute variant changes only selected-club outfield skills, not the
keeper. Preserve same-fixture RNG, tactics and starting XI comparisons.
Each experiment logs actual aggregate shots/xG and changed-stream counts
as `M1_PAIRED_SENSITIVITY`; no result is claimed before CI passes.
The preview tests are directional mechanism evidence, not a second
historical benchmark or a change to the frozen goal tolerance.
