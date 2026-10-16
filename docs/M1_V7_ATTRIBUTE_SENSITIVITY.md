# M1 P5: fixed-seed paired finishing-attribute sensitivity

**2026-10-16. Synthetic-only, bounded, transient counterfactual.**

\`runM1V7PairedFinishingExperiment\` runs a valid v7 source fixture with
the **same seed** under the untouched synthetic catalog and under a
transient variant changing only a single eligible starting outfield
player's \`finishing\` attribute by an integer delta in [-20, -1] or
[1, 20], retaining its valid 1..100 range.

For 1..10,000 seeded matches, the experiment derives paired changes
in that club's goals, shots and open-play-only xG, and the specific
player's shots and goals. It publishes sample size, total, mean, sample
standard deviation and normal-approximation 95% interval; the share of
seeds with increased, unchanged or decreased **player shots** has Wilson
95% bounds. Exactly 90 seeded draws and final RNG state parity are
checked for each baseline/variant pair.

This does **not** edit or publish the official M0 source pack or any
saved career. The counterfactual contains the original pack identifiers
only for traceability, but it must **never** be written out as a game
pack with those original identifiers. Both source and variant are
synthetic; direction, effect size and uncertainty are not evidence of
real-world player ratings, injury rates, goals, licensed club statistics
or realism calibration. The experiment does not generate new penalties,
cards or injuries.

Independent rights-reviewed benchmark data, held-out mirrored
experiments, pre-registered tolerances, representative player/formation
coverage, 10,000-seed acceptance and the two complete repository audits
remain M1-P5 #31 and exit #3 work.
