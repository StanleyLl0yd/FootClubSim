# M1 P4: v8 unranked points preview (read-only)

**2026-10-17. Synthetic, independent domain calculation. NOT an official
league table, adjudication or career transaction.**

`src/core/m1-v8-unranked-points.ts` derives a conventional **3/1/0**
win/draw/loss points preview from the full, source-replay-verified v8
schema-4 journal. No goals or points are sampled independently: each
completed result is replayed against its original unchanged synthetic
catalog, prematch snapshot, referee/medical source claims and deterministic
RNG before its final dossier goal totals contribute.

Each club in the **original catalog order**, not the league ranking order,
receives matches played, won/drawn/lost, goals scored/conceded, goal
difference and hypothetical points. Empty or incomplete journals retain
all 16 clubs without inventing pending 0-0 results. The preview verifies
twice-counted club appearances, goals for = goals against across the
competition, per-team result counts and the aggregate 3-points-per-win /
2-points-per-draw conservation law. Tests cover special penalty and own-goal
attribution, match insertion order, tampered replay evidence and immutable
caller inputs, and compare goals with the existing read-only v8 season
statistics.

The result is explicitly
`SYNTHETIC_V8_UNRANKED_POINTS_PREVIEW_NOT_OFFICIAL`; it does **not** rank
teams, apply RPL-specific tie-breaks, post points to IndexedDB, infer
forfeits or disciplinary adjustments, certify registrations or resolve
interrupted fixtures. Referee and medical source assertions still lack
external authentication. Career journal schema 4, M0/v3-v7 saves and
original game data are unchanged.

The original
[synthetic v8 season-statistics report](M1_V8_SEASON_STATISTICS.md)
remains a separate unchanged player/club performance projection and
still deliberately has **no points field**. The new preview is an
opt-in calculation, not a production standings or M2 feature.

M1 P3 #29, P4 #30, P5 #31 and exit #3 remain OPEN. Final rules review,
genuine source authority, full career posting, calibration and two
repository-wide exit audits are still required. M2 is not authorized.
