# Source-1 versus v191 source-2 paired playable-season observations

**M1 P5 descriptive diagnostics, not accepted calibration or a release target.**
The compact [frozen CI census](../data/research/m1-p5-v190-v191-paired-cohorts.json)
contains only synthetic per-seed event totals and digest values; no user
career archive, external commercial match-level dataset, real players or 2024/25
held-out data. The 4×240 match artifacts were retrieved and verified from:

- [v190 source-1 run 42810758774](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/42810758774): artifact 13764597863, original JSON SHA-256 `7a5139129e84e21572974f37acc62cf328433061c5af8f3fe789c0cbde886601`.
- [v191 source-2 run 42815332443](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/42815332443): artifact 13767725503, original JSON SHA-256 `97b744d1408403dbdd9b6ee47592fb1ac582bd375236f32ba953e8ee09ce5c0a`.

| Event count per 240 matches | Source-1 seeds 11 / 41 / 71 / 101 | v191 source-2 seeds 11 / 41 / 71 / 101 | Old mean → new mean |
| --- | --- | --- | --- |
| All goals | 980 / 962 / 959 / 932 | 652 / 654 / 623 / 611 | 958.25 → **635.00** |
| Open-play goals | 915 / 895 / 892 / 882 | 587 / 587 / 556 / 561 | 896.00 → **572.75** |
| Open-play source shots | 5090 / 5112 / 5178 / 5225 | 5480 / 5548 / 5595 / 5615 | 5151.25 → **5559.50** |
| Penalty attempts | 67 / 56 / 72 / 55 | same | 62.50 → 62.50 |
| Scored penalties | 49 / 43 / 55 / 38 | same | 46.25 → 46.25 |
| Own goals | 16 / 24 / 12 / 12 | same | 16.00 → 16.00 |
| Yellow cautions | 758 / 712 / 751 / 718 | same | 734.75 → 734.75 |
| All dismissals | 85 / 88 / 81 / 80 | same | 83.50 → 83.50 |

The paired whole-season (four-seed, df=3) 95% Student-t interval for the
**v191 minus v190 change** is **−323.25 goals [−342.14, −304.36]** and
**+408.25 source shots [+372.52, +443.98]** per 240 matches. This quantifies
only variation in four chosen pseudo-random seeds, not uncertainty in the
real 2025/26 observation or generalizing to different fictional club packs.

Against the separately frozen and not definition-harmonized 2025/26
development observations (609 all-type goals, 5,781 published shots,
101 penalty attempts, 1,024 yellows, 59 dismissals), v191 reduces the
gross goal mismatch to +4.3% but has lower modeled penalties/yellows and
more dismissals. Do **not** count numeric proximity as proof of model
validity: publisher shot categories, excluded/penalty shots, real injury
coding, referee foul causation, and source rights still lack final alignment.
No 2024/25 holdout was accessed; none of the nine P3/P5 gates is newly
accepted by this memo.

Regenerate the **descriptive paired test** from the frozen compact evidence
with `node --test tests/m1-p5-cohort-comparison.test.mjs`. It checks the
same seeded populations, source/version discriminator, strict conserved
goal types, counts and recorded final-table hash shapes, but cannot replace
full 960-match source regeneration from the original CI runs.
